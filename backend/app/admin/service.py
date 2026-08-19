import os
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any

from app.core.config import settings
from app.core.logging import logger


def create_sqlite_backup() -> Dict[str, Any]:
    """Creates a consistent online backup of the SQLite database."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
    backup_filename = f"backup-{timestamp}.db"
    backup_path = settings.BACKUP_DIR / backup_filename

    # Source database path
    db_file_str = settings.DATABASE_URL.replace("sqlite:///", "")
    db_path = Path(db_file_str).resolve()

    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found at {db_path}")

    # Connect source and backup databases using sqlite3 backup API
    src_conn = sqlite3.connect(str(db_path))
    dst_conn = sqlite3.connect(str(backup_path))
    with dst_conn:
        src_conn.backup(dst_conn)
    src_conn.close()
    dst_conn.close()

    file_size = backup_path.stat().st_size
    logger.info(f"Database backup created successfully: {backup_filename} ({file_size} bytes)")

    return {
        "filename": backup_filename,
        "size_bytes": file_size,
        "created_at": datetime.now(timezone.utc)
    }


def list_backups() -> List[Dict[str, Any]]:
    """List available database backup files."""
    backups = []
    for file in settings.BACKUP_DIR.glob("backup-*.db"):
        stat = file.stat()
        created = datetime.fromtimestamp(stat.st_mtime, timezone.utc)
        backups.append({
            "filename": file.name,
            "size_bytes": stat.st_size,
            "created_at": created
        })
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return backups


def restore_sqlite_backup(filename: str):
    """
    Restores SQLite database from a backup file after path safety validation.
    """
    # Prevent path traversal attacks
    clean_name = os.path.basename(filename)
    backup_path = (settings.BACKUP_DIR / clean_name).resolve()

    if not str(backup_path).startswith(str(settings.BACKUP_DIR.resolve())):
        raise ValueError("Invalid backup filename path traversal attempt")

    if not backup_path.exists() or not backup_path.is_file():
        raise FileNotFoundError(f"Backup file '{clean_name}' not found")

    db_file_str = settings.DATABASE_URL.replace("sqlite:///", "")
    db_path = Path(db_file_str).resolve()

    # Safety copy before overwrite
    safety_backup = settings.BACKUP_DIR / "pre-restore-safety.db"
    if db_path.exists():
        shutil.copy2(db_path, safety_backup)

    # Perform restore using SQLite backup API
    src_conn = sqlite3.connect(str(backup_path))
    dst_conn = sqlite3.connect(str(db_path))
    with dst_conn:
        src_conn.backup(dst_conn)
    src_conn.close()
    dst_conn.close()

    logger.info(f"Database restored successfully from: {clean_name}")
