"""Anthropic implementation of LLMProvider, using the async Claude client."""

from anthropic import AsyncAnthropic

from app.config import settings
from app.services.llm.base import LLMProvider

# Haiku 4.5 is the fast, cost-effective model — a good fit for the short,
# JSON-only prompts the two-pass analyzer sends. Exact ID string, no date suffix.
_MODEL_NAME = "claude-haiku-4-5"

# Generous ceiling so a long Pass 1 clause list never truncates mid-JSON (which
# would fail the parse). Well under the SDK's non-streaming timeout threshold.
_MAX_TOKENS = 16000


class AnthropicProvider(LLMProvider):
    """Wraps `anthropic.AsyncAnthropic`. The API key is read from settings at
    construction time, so the client is only built when this provider is selected."""

    def __init__(self) -> None:
        self._client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    @property
    def name(self) -> str:
        return "anthropic"

    async def generate(self, prompt: str) -> str:
        response = await self._client.messages.create(
            model=_MODEL_NAME,
            max_tokens=_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        # content is a list of blocks; concatenate the text blocks (there is
        # normally exactly one for these single-turn, tool-free prompts).
        return "".join(
            block.text for block in response.content if block.type == "text"
        )
