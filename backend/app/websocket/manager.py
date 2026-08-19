import json
from typing import Dict, List, Any
from fastapi import WebSocket
from app.core.logging import logger


class ConnectionManager:
    """Manages active WebSocket connections mapped by user ID and role."""
    def __init__(self):
        # Maps user_id -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps websocket -> (user_id, role)
        self.connection_meta: Dict[WebSocket, tuple[str, str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.connection_meta[websocket] = (user_id, role)
        logger.info(f"WebSocket connected: user_id={user_id}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.connection_meta:
            user_id, role = self.connection_meta[websocket]
            del self.connection_meta[websocket]
            if user_id in self.active_connections:
                if websocket in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected: user_id={user_id}")

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.warning(f"Failed to send personal WS message: {e}")

    async def broadcast_task_event(self, event_type: str, task_data: Dict[str, Any], owner_id: str):
        """
        Broadcast task change event ONLY to:
        1. The task owner
        2. Any active ADMIN users
        """
        payload = {
            "event": event_type,
            "task": task_data
        }
        
        for ws, (user_id, role) in list(self.connection_meta.items()):
            if user_id == owner_id or role == "ADMIN":
                try:
                    await ws.send_json(payload)
                except Exception as e:
                    logger.warning(f"Error broadcasting WS event to user {user_id}: {e}")

    def count_connected_clients(self) -> int:
        return len(self.connection_meta)


ws_manager = ConnectionManager()
