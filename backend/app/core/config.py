import os
from typing import Annotated, List

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode

load_dotenv()


def _split_csv(value: str) -> List[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


_DEBUG = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")


class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "SalonFlow"
    APP_VERSION: str = "1.1.0"
    # DEBUG now defaults to False. Set DEBUG=true explicitly in your local .env.
    # When False, unhandled errors return a generic message instead of the raw
    # exception text (see app/main.py's exception handler).
    DEBUG: bool = _DEBUG

    # Salon Settings
    SALON_NAME: str = os.getenv("SALON_NAME", "My Salon")
    SALON_DOMAIN: str = os.getenv("SALON_DOMAIN", "localhost")

    # Database (legacy SQLAlchemy path - not used by the API, kept only in
    # case a background job / migration script needs a direct connection)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # JWT - only used if/when we issue our own tokens. Supabase Auth issues
    # the session tokens actually used by the app today. No hardcoded
    # fallback secret: if this is missing, the app fails to start rather
    # than silently running with a guessable key.
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # CORS - comma-separated list of allowed origins, e.g.
    # "https://app.example.com,https://staging.example.com"
    # Defaults cover local dev and the deployed frontend. NEVER "*" with credentials.
    CORS_ALLOWED_ORIGINS: Annotated[List[str], NoDecode] = _split_csv(
        os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,https://salon-flow-frontend.vercel.app",
        )
    )

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            return _split_csv(value)
        return value

    # ---- Session cookie (replaces returning the token in the JSON body) ----
    # The access token is now set as an httpOnly cookie, so client-side JS
    # (including any XSS payload) cannot read it - this is the fix for the
    # localStorage token-theft issue flagged in the original audit.
    #
    # COOKIE_SECURE must be True in any real deployment (cookie only sent
    # over HTTPS). Only relax it for plain-http local dev.
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false" if _DEBUG else "true").lower() in ("1", "true", "yes")
    # SameSite=None is required when the frontend and backend are on
    # different domains (e.g. Vercel + Render) - browsers will otherwise
    # refuse to send the cookie cross-site. SameSite=None requires Secure.
    # For local dev where both run on "localhost" (different ports still
    # count as the same site), "lax" works fine over plain http.
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax" if _DEBUG else "none")
    COOKIE_NAME: str = "sf_access_token"
    COOKIE_MAX_AGE_SECONDS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")) * 60

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    # Brevo
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

# Fail fast on missing critical config instead of silently running insecurely.
_missing = [
    name
    for name in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY")
    if not getattr(settings, name)
]
if _missing:
    raise RuntimeError(
        f"Missing required environment variable(s): {', '.join(_missing)}. "
        "Copy .env.example to .env and fill these in."
    )
