#!/usr/bin/env bash
# Dopile - Stop script
echo "[*] Stopping Dopile server..."
pkill -f "uvicorn app.main:app" || echo "[!] No running Dopile process found."
echo "[+] Done."
