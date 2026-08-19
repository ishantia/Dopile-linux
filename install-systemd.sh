#!/usr/bin/env bash
# Dopile Linux - Systemd Installer Script
set -e

if [ "$EUID" -ne 0 ]; then
    echo "[!] Please run as root (sudo ./install-systemd.sh)"
    exit 1
fi

INSTALL_DIR="/opt/dopile-linux"
SERVICE_FILE="/etc/systemd/system/dopile.service"
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "    Dopile Linux Systemd Installer      "
echo "========================================"

# Copy project to /opt/dopile-linux if not already there
if [ "$CURRENT_DIR" != "$INSTALL_DIR" ]; then
    echo "[*] Copying files to $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    cp -r "$CURRENT_DIR"/* "$INSTALL_DIR"/
fi

cd "$INSTALL_DIR"

# Ensure start.sh and shell scripts are executable
chmod +x start.sh stop.sh status.sh

# Configure dopile.service
echo "[*] Installing systemd unit file to $SERVICE_FILE..."
cp dopile.service "$SERVICE_FILE"

# Reload systemd, enable and start service
echo "[*] Reloading systemd daemon..."
systemctl daemon-reload

echo "[*] Enabling dopile.service on boot..."
systemctl enable dopile.service

echo "[*] Starting dopile.service..."
systemctl restart dopile.service

echo ""
echo "────────────────────────────────────────"
echo " Status:   INSTALLED & RUNNING          "
echo " Service:  dopile.service               "
echo " Commands:                              "
echo "   sudo systemctl status dopile         "
echo "   sudo systemctl restart dopile        "
echo "   sudo systemctl stop dopile           "
echo "   sudo journalctl -u dopile -f         "
echo "────────────────────────────────────────"
echo ""
