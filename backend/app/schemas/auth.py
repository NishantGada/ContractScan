from pydantic import BaseModel, EmailStr, Field


class AuthCredentials(BaseModel):
    """Request body for register and login."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    """The authenticated user — only non-sensitive identity fields."""

    id: str
    email: EmailStr | None = None


class SessionResponse(BaseModel):
    """Session tokens plus the user, returned by register and login.

    `access_token` may be null on register when the project requires email
    confirmation — the client then prompts the user to confirm before logging in.
    """

    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserResponse
