# Dopile Linux 📋🐧

**Secure, Self-Hosted LAN Task Manager Server for Linux**

Dopile Linux is a modern, enterprise-grade, self-hosted Task Manager application engineered for Linux servers on your Local Area Network (LAN) or Home Server setup. Built with FastAPI, SQLite WAL, React 18, and WebSockets, it provides real-time multi-device task synchronization, Progressive Web App (PWA) offline capabilities, systemd service daemon integration, and enterprise security.

---

## 🌟 Key Features

* **📱 Progressive Web App (PWA)**: Installable across desktop and mobile devices with full offline caching.
* **⚡ Real-Time WebSocket Synchronization**: Instant multi-client updates across your LAN when tasks are created, modified, or completed.
* **🐧 Native Systemd Service Daemon**: Simple background service setup via `systemctl` with auto-restart on system boot.
* **🔒 Enterprise Security Architecture**:
  * **Argon2id Hashing**: Industry-standard password hashing ($m=65536, t=3, p=4$).
  * **HttpOnly Session Cookies**: Prevents XSS token exposure.
  * **Double-Submit CSRF Protection**: Mandatory `X-CSRF-Token` header verification for state-changing requests.
  * **Sliding-Window Rate Limiting**: In-memory rate limiting against brute-force login attempts.
  * **Strict RBAC & IDOR Prevention**: Robust role-based access control and user isolation.
* **🌐 Per-Account Wi-Fi IP-Binding Security**:
  * **Standard Users (`USER`)**: Automatically bound to their Wi-Fi / LAN IP address upon first login or registration. Attempts to log in from an unauthorized IP are blocked with HTTP 403.
  * **Admin Exemption (`ADMIN`)**: Admin accounts bypass IP binding restrictions and can log in from any IP address.
  * **Admin Management**: Admins can view, assign, or reset bound IP addresses in the Admin Panel.
* **👑 Full Admin Oversight Suite**:
  * **User Management**: Create, deactivate, update roles, reset passwords, delete accounts, and manage bound IP addresses.
  * **Task Oversight & Reassignment**: Reassign and edit tasks across all users.
  * **Audit Logging**: Comprehensive, immutable security audit trail.
  * **Live System Telemetry**: Server uptime, DB health metrics, and active WebSocket connection counters.
  * **Automated SQLite Backups**: One-click database backups and point-in-time restores.

---

## 🛠️ System Requirements & Support

Supports all major Linux distributions:

* **Ubuntu / Debian** (18.04, 20.04, 22.04, 24.04 LTS)
* **Fedora / RHEL / CentOS / AlmaLinux / Rocky Linux**
* **Arch Linux / Manjaro**
* **Debian-based Home Servers** (Raspberry Pi OS, OpenMediaVault, Proxmox LXC)

---

## 🚀 Quick Start Guide (Linux Setup)

### 1. Install Prerequisites

#### On Ubuntu / Debian:
```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv git curl
```

#### On Fedora / RHEL:
```bash
sudo dnf install -y python3 python3-pip git curl
```

#### On Arch Linux:
```bash
sudo pacman -S --needed python python-pip git curl
```

### 2. Clone Repository & Run Setup

```bash
git clone https://github.com/ishantia/Dopile-linux.git
cd Dopile-linux
./start.sh
```

`start.sh` automatically initializes the Python virtual environment (`.venv`), installs requirements, executes database migrations, and launches the server on port `8080`.

### 3. Create Admin Account

Initialize your primary administrator account:

```bash
PYTHONPATH=backend .venv/bin/python -m app.cli create-admin
```

---

## ⚙️ Systemd Service Daemon (Auto-Start on Boot)

To run Dopile Linux as a background daemon that starts automatically on system boot:

### Quick One-Step Systemd Installation

```bash
sudo ./install-systemd.sh
```

### Systemctl Management Commands

```bash
# Check service status
sudo systemctl status dopile

# Start / Stop / Restart service
sudo systemctl start dopile
sudo systemctl stop dopile
sudo systemctl restart dopile

# View live systemd logs
sudo journalctl -u dopile -f
```

---

## 🌐 Nginx Reverse Proxy Setup (Optional)

To serve Dopile Linux over standard HTTP (port 80) or HTTPS with Let's Encrypt / local SSL:

```nginx
server {
    listen 80;
    server_name dopile.local;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_header;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Support
    location /ws {
        proxy_pass http://127.0.0.1:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 🛠️ Admin Tools: Swagger UI & SQLite Web Interface

### 1. Interactive Swagger UI & ReDoc API Documentation
FastAPI includes built-in interactive OpenAPI documentation:

1. Edit `.env` and set:
   ```ini
   APP_ENV=dev
   ```
2. Restart the service (`sudo systemctl restart dopile` or `./stop.sh && ./start.sh`).
3. Open interactive documentation:
   * **Swagger UI**: `http://<YOUR_SERVER_IP>:8080/docs`
   * **ReDoc**: `http://<YOUR_SERVER_IP>:8080/redoc`

### 2. Graphical SQLite Database Web Interface (`sqlite-web`)
To browse and query raw SQLite database tables via a web browser:

1. Install `sqlite-web`:
   ```bash
   pip3 install sqlite-web
   ```
2. Launch the SQLite web GUI bound to all network interfaces (`-H 0.0.0.0`):
   ```bash
   sqlite_web ./data/dopile.db -H 0.0.0.0 -p 8081
   ```
3. Open in any browser on your network: `http://<YOUR_SERVER_IP>:8081`

---

## 💻 Tech Stack

* **Backend**: FastAPI, SQLAlchemy 2.0, Pydantic v2, PyJWT, Argon2-cffi, Uvicorn.
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Workbox PWA.
* **Database**: SQLite 3 with Write-Ahead Logging (WAL) and Alembic migrations.

---

## 📄 License

Distributed under the MIT License. Created by [ishantia](https://github.com/ishantia).
