import json
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.db.models import AuditLog
from app.core.logging import logger


def log_audit_event(
    db: Session,
    action: str,
    target_type: str,
    actor_user_id: Optional[str] = None,
    target_id: Optional[str] = None,
    source_ip: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Log a security-sensitive audit event to the database.
    Filter out sensitive fields (password, token, hash) before persisting metadata.
    """
    safe_metadata = None
    if metadata:
        filtered = {
            k: v for k, v in metadata.items()
            if k.lower() not in ("password", "password_hash", "token", "secret", "cookie")
        }
        try:
            safe_metadata = json.dumps(filtered)
        except Exception:
            safe_metadata = "{}"

    try:
        audit_entry = AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            source_ip=source_ip,
            metadata_json=safe_metadata
        )
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record audit log: {e}")
