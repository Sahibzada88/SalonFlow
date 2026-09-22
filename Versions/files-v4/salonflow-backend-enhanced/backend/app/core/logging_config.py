import logging
import sys

from app.core.config import settings


def setup_logging() -> None:
    """Configure application-wide logging.

    Replaces the scattered print() calls that were throughout the original
    codebase (some of which logged user IDs, salon IDs, and full Supabase
    URLs to stdout unconditionally). Logging is now level-gated: verbose
    debug output only appears when DEBUG=true.
    """
    level = logging.DEBUG if settings.DEBUG else logging.INFO

    root = logging.getLogger()
    root.setLevel(level)

    if root.handlers:
        # Avoid duplicate handlers on reload
        return

    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    root.addHandler(handler)

    # Quiet down noisy third-party libraries unless we're in debug mode
    if not settings.DEBUG:
        for noisy in ("httpx", "httpcore", "postgrest", "hpack"):
            logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
