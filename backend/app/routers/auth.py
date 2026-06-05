"""Authentication routes.

Thin proxies to Supabase Auth. The route handler only validates input
(via the Pydantic body), calls Supabase, and maps the result onto our response
schema — no business logic here.
"""

from fastapi import APIRouter, HTTPException, status
from gotrue.errors import AuthApiError

from app.database import create_auth_client
from app.schemas.auth import AuthCredentials, SessionResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_session_response(result) -> SessionResponse:  # noqa: ANN001 — gotrue AuthResponse
    """Map a Supabase AuthResponse onto our SessionResponse schema."""
    if result.user is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Authentication provider returned no user",
        )
    session = result.session
    return SessionResponse(
        access_token=session.access_token if session else None,
        refresh_token=session.refresh_token if session else None,
        user=UserResponse(id=result.user.id, email=result.user.email),
    )


@router.post("/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def register(credentials: AuthCredentials) -> SessionResponse:
    client = create_auth_client()
    try:
        result = client.auth.sign_up(
            {"email": credentials.email, "password": credentials.password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)
    return _to_session_response(result)


@router.post("/login", response_model=SessionResponse)
def login(credentials: AuthCredentials) -> SessionResponse:
    client = create_auth_client()
    try:
        result = client.auth.sign_in_with_password(
            {"email": credentials.email, "password": credentials.password}
        )
    except AuthApiError:
        # Don't leak which of email/password was wrong.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return _to_session_response(result)
