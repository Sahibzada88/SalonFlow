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

    CRITICAL: never call .auth.sign_up() or .auth.sign_in_with_password() on
    THIS client. supabase-py updates a client's internal Authorization
    header to the resulting session's access token after either of those
    calls - so this module-level singleton would silently start sending the
    *logged-in user's* token instead of the service-role key on every
    subsequent table/RPC call. That is a real bug that was hit in practice:
    customer registration's own `public.users`/`public.customers` inserts
    started failing with RLS violations, because the same request had
    already called `sign_up()` on this client a few lines earlier. Because
    this client is a shared singleton across all requests (see below), it
    also means one user's login could contaminate concurrent requests from
    other users. Use get_auth_client() (a fresh, throwaway client) for any
    sign_up/sign_in_with_password call instead - see auth.py.
    """
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    logger.info("Supabase client initialized for %s", settings.SUPABASE_URL)
    return client


def get_auth_client() -> Client:
    """A fresh, throwaway Supabase client for auth SESSION operations only
    (sign_up, sign_in_with_password) - never for table/RPC queries.

    A new instance is created on every call rather than reusing a shared
    singleton, for two reasons:
    1. It keeps the session these calls create completely isolated from
       `supabase_client` (see the warning on get_supabase_client() above).
    2. `supabase_client` and any single shared "auth client" are both
       module-level singletons - reused across every request this process
       handles. If two different users signed up/logged in around the same
       time using one shared auth client, their sessions could race and
       contaminate each other. A fresh client per call has no shared state
       to race on.

    Uses the anon key (the privilege level sign_up/sign_in are meant to run
    with) when available, falling back to the service key otherwise - the
    isolation property holds either way, since what matters here is that
    the client instance itself is never reused for table queries.
    """
    key = settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_KEY
    return create_client(settings.SUPABASE_URL, key)


supabase_client = get_supabase_client()
