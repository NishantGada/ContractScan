from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_supabase() -> Client:
    """Singleton Supabase client authenticated with the service role key.

    Service role bypasses RLS, so every repository MUST still scope its queries
    to the authenticated user_id — RLS is defense in depth, not the only gate.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def check_connection() -> str:
    """Lightweight connectivity probe used by the health check.

    Returns "connected" once the schema exists, otherwise a short error string
    (e.g. before the SQL schema has been run in Supabase).
    """
    try:
        get_supabase().table("vendors").select("id").limit(1).execute()
        return "connected"
    except Exception as exc:  # noqa: BLE001 — surface any failure to the health check
        return f"error: {exc}"
