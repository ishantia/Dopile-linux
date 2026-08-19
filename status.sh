#!/usr/bin/env bash
# Dopile - Status script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

PORT="${PORT:-8080}"
PID=$(pgrep -f "uvicorn app.main:app" || echo "")

if [ -n "$PID" ]; then
    echo "========================================"
    echo " Dopile Server Status: RUNNING (PID: $PID)"
    echo " Port: $PORT"
    echo "========================================"
else
    echo "========================================"
    echo " Dopile Server Status: STOPPED"
    echo "========================================"
fi
