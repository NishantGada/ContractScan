from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables.

    Secrets are never hard-coded — they come from the environment (.env locally,
    platform dashboard in production).
    """

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""  # Service role key — backend only, never exposed to the frontend
    GEMINI_API_KEY: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """CORS origins as an explicit list — never a wildcard."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
