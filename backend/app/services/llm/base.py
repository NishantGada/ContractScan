"""The Strategy interface every LLM backend implements."""

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """A vendor-agnostic single-prompt text completion backend.

    Concrete implementations wrap a specific vendor's async client. Callers
    (notably `llm_analyzer`) depend only on this interface and never touch a
    vendor SDK directly — that is what lets `LLM_PROVIDER` switch models with
    zero code changes.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Short identifier for logging, e.g. ``"anthropic"`` or ``"openai"``."""

    @abstractmethod
    async def generate(self, prompt: str) -> str:
        """Send a single user prompt and return the model's text response."""
