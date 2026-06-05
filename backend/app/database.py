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


def create_auth_client() -> Client:
    """A fresh (uncached) client for auth flows.

    `sign_up` / `sign_in_with_password` persist the resulting session on the
    client instance, so they must NOT run on the shared singleton — otherwise
    one user's session could bleed into a concurrent request. Each auth request
    gets its own short-lived client.
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
