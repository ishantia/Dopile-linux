import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Depends, HTTPException, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.database import engine, get_db, SessionLocal, init_db
from app.db.base import Base
from app.db.models import User
from app.core.security import decode_token
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.tasks.router import router as tasks_router
from app.admin.router import router as admin_router
from app.websocket.manager import ws_manager

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} server on {settings.HOST}:{settings.PORT}")
    init_db()
    yield
    logger.info(f"Shutting down {settings.APP_NAME} server gracefully...")


docs_url = "/docs" if settings.is_dev() else None
redoc_url = "/redoc" if settings.is_dev() else None

app = FastAPI(
    title=settings.APP_NAME,
    description="Secure LAN Task Manager Server for Android/Termux",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    lifespan=lifespan
)

# CORS Configuration
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else []
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if not settings.is_dev():
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self' ws: wss:; "
            "font-src 'self';"
        )
    return response


# Uniform Error Formatting
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    code = "HTTP_ERROR"
    if exc.status_code == 401:
        code = "UNAUTHORIZED"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 422:
        code = "VALIDATION_ERROR"
    elif exc.status_code == 429:
        code = "RATE_LIMITED"

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": exc.detail
            }
        },
        headers=getattr(exc, "headers", None)
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=settings.is_dev())
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred."
            }
        }
    )


# Health Check Endpoints
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(Base.metadata.tables["users"].select().limit(1))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status
    }


@app.get("/api/version")
def version_info():
    return {
        "app_name": settings.APP_NAME,
        "version": "1.0.0"
    }


# Include Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(tasks_router)
app.include_router(admin_router)


# Authenticated WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Extract token from query param or cookie
    token = websocket.query_params.get("token")
    if not token:
        token = websocket.cookies.get("access_token")

    if not token:
        await websocket.close(code=1008, reason="Authentication token required")
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=1008, reason="Invalid token")
        return

    user_id = payload.get("sub")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            await websocket.close(code=1008, reason="User unauthorized or inactive")
            return

        role = user.role
    finally:
        db.close()

    await ws_manager.connect(websocket, user_id=user_id, role=role)
    try:
        while True:
            # Keep-alive receive loop
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        ws_manager.disconnect(websocket)


# Serve Built SPA / PWA Assets if available
frontend_dist = settings.BASE_DIR / "frontend" / "dist"
if frontend_dist.exists() and frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't hijack API or WS routes
        if full_path.startswith("api/") or full_path.startswith("ws"):
            raise HTTPException(status_code=404, detail="API endpoint not found")

        target_file = frontend_dist / full_path
        if full_path and target_file.exists() and target_file.is_file():
            return FileResponse(target_file)

        # Fallback to SPA index.html
        return FileResponse(frontend_dist / "index.html")
