from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    """Get Supabase client instance with service role key"""
    client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY
    )
    # ✅ Add logging
    print(f"🔌 Supabase client initialized for: {settings.SUPABASE_URL}")
    return client

supabase_client = get_supabase_client()