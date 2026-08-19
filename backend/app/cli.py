import argparse
import getpass
import secrets
import sys
from pathlib import Path

from app.core.config import settings
from app.core.security import hash_password, validate_password_strength
from app.db.database import engine, SessionLocal
from app.db.base import Base
from app.db.models import User, UserRole
from app.admin.service import create_sqlite_backup


def cmd_init():
    print("Initializing Dopile environment...")
    
    root_dir = settings.BASE_DIR
    env_file = root_dir / ".env"
    env_example = root_dir / ".env.example"

    if not env_file.exists():
        print(f"Creating .env configuration file at {env_file}...")
        secret_key = secrets.token_urlsafe(32)
        csrf_secret = secrets.token_urlsafe(32)

        template = f"""APP_NAME=Dopile
APP_ENV=production
HOST=0.0.0.0
PORT=8080

DATABASE_URL=sqlite:///./data/dopile.db

SECRET_KEY={secret_key}
CSRF_SECRET={csrf_secret}
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_API=100/minute
"""
        with open(env_file, "w", encoding="utf-8") as f:
            f.write(template)
        print(" Generated secure SECRET_KEY and CSRF_SECRET.")
    else:
        print(" Configuration file .env already exists.")

    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize DB tables
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database initialization complete.")


def cmd_create_admin(username: str = None, password: str = None):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not username:
            username = input("Enter admin username: ").strip()

        if not username:
            print("Error: Username cannot be empty.")
            sys.exit(1)

        if not password:
            password = getpass.getpass("Enter admin password: ")
            confirm = getpass.getpass("Confirm admin password: ")
            if password != confirm:
                print("Error: Passwords do not match.")
                sys.exit(1)

        if not validate_password_strength(password):
            print("Error: Password must be at least 8 characters and contain a digit or symbol.")
            sys.exit(1)

        existing = db.query(User).filter(User.username == username).first()
        if existing:
            existing.password_hash = hash_password(password)
            existing.role = UserRole.ADMIN.value
            existing.is_active = True
            db.commit()
            print(f"Updated existing user '{username}' to ADMIN with new password.")
        else:
            admin_user = User(
                username=username,
                password_hash=hash_password(password),
                role=UserRole.ADMIN.value,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print(f"Successfully created ADMIN user '{username}'.")
    finally:
        db.close()


def cmd_backup():
    try:
        res = create_sqlite_backup()
        print(f"Backup created: {res['filename']} ({res['size_bytes']} bytes)")
    except Exception as e:
        print(f"Backup failed: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Dopile CLI - LAN Task Manager Server Management")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    subparsers.add_parser("init", help="Initialize configuration and database")

    admin_parser = subparsers.add_parser("create-admin", help="Create or promote an admin user")
    admin_parser.add_argument("--username", "-u", type=str, help="Admin username")
    admin_parser.add_argument("--password", "-p", type=str, help="Admin password")

    subparsers.add_parser("backup", help="Create a database backup")

    args = parser.parse_args()

    if args.command == "init":
        cmd_init()
    elif args.command == "create-admin":
        cmd_create_admin(args.username, args.password)
    elif args.command == "backup":
        cmd_backup()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
