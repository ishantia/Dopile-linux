import logging
import sys
from app.core.config import settings


def setup_logging():
    log_level = logging.DEBUG if settings.is_dev() else logging.INFO

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    # Disable overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING if not settings.is_dev() else logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


logger = logging.getLogger("dopile")
