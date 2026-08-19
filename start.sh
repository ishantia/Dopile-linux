#!/usr/bin/env bash
# Dopile - Startup script for Termux / Linux
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "          Dopile LAN Server            "
echo "========================================"

# Acquire Termux wake lock if available to prevent Android CPU sleep
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock || true
fi

# Detect system Python binary (python3 vs python)
PYTHON_CMD="python3"
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
fi

# Auto-create virtual environment if missing
if [ ! -d ".venv" ] && [ ! -d "venv" ]; then
    echo "[*] Creating virtual environment (.venv)..."
    $PYTHON_CMD -m venv .venv
    source .venv/bin/activate
    echo "[*] Installing Python dependencies..."
    pip install -r backend/requirements.txt
fi

# Virtualenv activation check
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# Ensure .env exists
if [ ! -f ".env" ]; then
    echo "[!] .env not found. Initializing..."
    PYTHONPATH=backend python -m app.cli init
fi

# Export .env variables
export $(grep -v '^#' .env | xargs)

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8080}"

# Run database migrations
echo "[*] Checking database migrations..."
PYTHONPATH=backend python -m app.cli init

# Auto detect LAN IP
LAN_IP="127.0.0.1"
if command -v ip >/dev/null 2>&1; then
    LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || echo "127.0.0.1")
elif command -v ifconfig >/dev/null 2>&1; then
    LAN_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0.0.0.0-9.]+)' | grep -Eo '([0.0.0.0-9.]+)' | grep -v '127.0.0.1' | head -n 1 || echo "127.0.0.1")
fi

echo ""
echo "────────────────────────────────────────"
echo " Status:   RUNNING                      "
echo ""
echo " Local:    http://localhost:${PORT}      "
echo " LAN:      http://${LAN_IP}:${PORT}      "
echo " Port:     ${PORT}                       "
echo " Database: OK                           "
echo " PWA:      READY                        "
echo "────────────────────────────────────────"
echo " Press Ctrl+C to stop server.           "
echo ""

# Start FastAPI server via Uvicorn
PYTHONPATH=backend python -m uvicorn app.main:app --host "$HOST" --port "$PORT"
