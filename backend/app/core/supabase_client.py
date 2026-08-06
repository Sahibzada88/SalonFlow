# from supabase import create_client, Client
# from app.core.config import settings

# def get_supabase_client() -> Client:
#     """Get Supabase client instance"""
#     return create_client(
#         settings.SUPABASE_URL,
#         settings.SUPABASE_SERVICE_KEY  # Use service key for backend operations
#     )

# supabase_client = get_supabase_client()





from typing import Any, Optional

from supabase import Client, create_client

from app.core.config import settings


class LazySupabaseClient:
    def __init__(self) -> None:
        self._client: Optional[Client] = None

    def _get_client(self) -> Client:
        if self._client is None:
            url = settings.SUPABASE_URL or ""
            key = settings.SUPABASE_SERVICE_KEY or ""

            if not url or not key:
                raise RuntimeError("Supabase credentials are not configured")

            self._client = create_client(url, key)

        return self._client

    def __getattr__(self, name: str) -> Any:
        return getattr(self._get_client(), name)


supabase_client = LazySupabaseClient()