"""OpenAI implementation of LLMProvider, using the async OpenAI client.

Kept as a working alternate backend so `LLM_PROVIDER=openai` switches models
without a code change. Not exercised by the default configuration.
"""

from openai import AsyncOpenAI

from app.config import settings
from app.services.llm.base import LLMProvider

_MODEL_NAME = "gpt-4o-mini"


class OpenAIProvider(LLMProvider):
    """Wraps `openai.AsyncOpenAI`. The API key is read from settings at
    construction time, so the client is only built when this provider is selected."""

    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    @property
    def name(self) -> str:
        return "openai"

    async def generate(self, prompt: str) -> str:
        response = await self._client.chat.completions.create(
            model=_MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""
