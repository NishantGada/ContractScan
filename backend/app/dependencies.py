"""Shared FastAPI dependencies.

`get_current_user` is the single gate every non-auth route depends on. It
validates the Supabase JWT via Supabase itself (never a hand-rolled verifier)
and yields the authenticated user's UUID — which is the ONLY trusted source of
`user_id` anywhere in the backend. Request bodies and query params are never
trusted for identity.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import get_supabase

_bearer_scheme = HTTPBearer(auto_error=True)

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired authentication token",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> str:
    """Validate the bearer JWT with Supabase and return the user's UUID.

    Raises 401 if the token is missing, malformed, expired, or rejected.
    """
    token = credentials.credentials
    try:
        response = get_supabase().auth.get_user(token)
    except Exception:  # noqa: BLE001 — any gotrue/network failure is an auth failure here
        raise _INVALID_CREDENTIALS

    if response is None or response.user is None:
        raise _INVALID_CREDENTIALS

    return response.user.id
