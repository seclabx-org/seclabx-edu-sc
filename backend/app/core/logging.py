import logging
import logging.config
from pathlib import Path
from app.core.config import settings


def setup_logging():
    log_dir = Path(settings.LOG_DIR)
    log_dir.mkdir(parents=True, exist_ok=True)
    logfile = log_dir / "app.log"

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s [%(levelname)s] %(name)s %(message)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "level": settings.LOG_LEVEL,
                },
                "file": {
                    "class": "logging.handlers.TimedRotatingFileHandler",
                    "formatter": "default",
                    "level": settings.LOG_LEVEL,
                    "filename": str(logfile),
                    "when": "midnight",
                    "backupCount": settings.LOG_RETENTION_DAYS,
                    "encoding": "utf-8",
                    "utc": True,
                },
            },
            "loggers": {
                "uvicorn.error": {"handlers": ["console", "file"], "level": settings.LOG_LEVEL, "propagate": False},
                "uvicorn.access": {"handlers": ["console", "file"], "level": settings.LOG_LEVEL, "propagate": False},
                "": {"handlers": ["console", "file"], "level": settings.LOG_LEVEL},
            },
        }
    )
