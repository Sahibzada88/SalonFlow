from supabase import create_client, Client

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


def get_supabase_client() -> Client:
    """Get Supabase client instance with the service role key.

    IMPORTANT: this key bypasses Row Level Security entirely. Every table/RPC
    call made with this client is trusted unconditionally by Postgres, which
    means *all* authorization must happen in the FastAPI layer (see
    app/core/auth_deps.py). This client should never be exposed to the
    frontend, and should never be used to execute a query built from
    unvalidated user input for a resource scope (e.g. "give me salon_id X's
    data") without first checking that the caller is actually allowed to see
    salon_id X.
    """
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    logger.info("Supabase client initialized for %s", settings.SUPABASE_URL)
    return client


supabase_client = get_supabase_client()

# Auth methods can store a user's session on the client. Keep those calls
# isolated so a customer session never replaces the service-role token used
# by backend database queries.
supabase_auth_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
