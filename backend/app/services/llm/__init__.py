"""LLM provider abstraction.

`llm_analyzer` depends only on the `LLMProvider` interface; the concrete backend
is chosen at runtime by `get_llm_provider()` from the `LLM_PROVIDER` env var.
Swapping models is a config change, not a code change.
"""

from app.services.llm.base import LLMProvider
from app.services.llm.factory import get_llm_provider

__all__ = ["LLMProvider", "get_llm_provider"]
