"""Select the active LLM provider from the LLM_PROVIDER env var."""

from functools import lru_cache

from app.config import settings
from app.services.llm.base import LLMProvider

_SUPPORTED = ("anthropic", "openai")


@lru_cache
def get_llm_provider() -> LLMProvider:
    """Return the configured provider instance (built once, then cached).

    Reads `settings.LLM_PROVIDER` (default ``anthropic``). Concrete providers are
    imported lazily so selecting one backend never forces the other's client to
    initialize. An unrecognized value fails loudly rather than silently picking
    a default — a typo in `LLM_PROVIDER` should not run the wrong model.
    """
    provider = settings.LLM_PROVIDER.strip().lower()

    if provider == "anthropic":
        from app.services.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider()
    if provider == "openai":
        from app.services.llm.openai_provider import OpenAIProvider

        return OpenAIProvider()

    raise ValueError(
        f"Unknown LLM_PROVIDER {provider!r}; expected one of {_SUPPORTED}"
    )
