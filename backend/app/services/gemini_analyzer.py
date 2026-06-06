"""Two-pass contract risk analysis with Gemini.

Pass 1 reads the whole contract and extracts every clause that falls into one of
the known risk categories. Pass 2 assesses each extracted clause independently —
all Pass 2 calls run concurrently via `asyncio.gather`, so total time is
Pass 1 + the slowest single Pass 2 call, not their sum.

Robustness is deliberate: the model is asked for raw JSON, but we still strip
stray markdown fences and tolerate a parse failure on any individual clause by
logging and skipping it — one bad clause never sinks the whole analysis.
"""

import asyncio
import json
import logging
import re

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

# gemini-1.5-flash now 404s on the API; gemini-2.0-flash is the current flash model.
_MODEL_NAME = "gemini-2.0-flash"

# The category keys the model is allowed to emit (mirrors the Pass 1 prompt).
_VALID_CLAUSE_TYPES = {
    "auto_renewal",
    "liability_cap",
    "data_ownership",
    "price_change",
    "sla_no_penalty",
    "termination",
    "indemnification",
    "governing_law",
}
_VALID_SEVERITIES = {"high", "medium", "low"}

# Placeholders are substituted with str.replace (not str.format) so the literal
# JSON braces in the prompts don't need escaping.
_PASS_1_PROMPT = """You are a contract risk analyst. Read the following contract and extract every clause that falls into one of these risk categories:

- auto_renewal: automatic renewal clauses, especially those with short notice windows
- liability_cap: limitations on liability, especially asymmetric or unreasonably low caps
- data_ownership: who owns data generated or processed under this contract
- price_change: unilateral rights to change pricing
- sla_no_penalty: SLA commitments with no financial remedy for breach
- termination: termination for convenience rights, especially one-sided ones
- indemnification: indemnification obligations, especially asymmetric ones
- governing_law: governing law or jurisdiction clauses, especially surprising ones

For each clause found, return ONLY a JSON array. No preamble, no explanation, no markdown.
Each item must have exactly these fields:
{
  "clause_type": "<one of the category keys above>",
  "original_text": "<verbatim text of the clause from the contract>"
}

If no risky clauses are found, return an empty array: []

CONTRACT TEXT:
__CONTRACT_TEXT__"""

_PASS_2_PROMPT = """You are a contract risk analyst. Assess the following contract clause.

Clause type: __CLAUSE_TYPE__
Clause text: __ORIGINAL_TEXT__

Return ONLY a JSON object. No preamble, no explanation, no markdown.
The object must have exactly these fields:
{
  "severity": "<high | medium | low>",
  "summary": "<1-2 sentence plain English explanation of why this is risky>",
  "recommendation": "<1-2 sentence practical recommendation for what to do about this>"
}"""

_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)

# Fixed sample used when settings.USE_MOCK_GEMINI is on — same shape the real
# two-pass analysis returns, spanning all three severities so the UI exercises
# every RiskBadge color. Never used unless the flag is explicitly enabled.
_MOCK_CLAUSE_RISKS: list[dict] = [
    {
        "clause_type": "auto_renewal",
        "original_text": (
            "This Agreement shall automatically renew for successive one-year "
            "terms unless either party provides written notice of non-renewal "
            "at least ninety (90) days prior to the end of the then-current term."
        ),
        "severity": "high",
        "summary": (
            "The contract auto-renews for a full year and demands 90 days' "
            "notice to stop it, making it easy to get locked in unintentionally."
        ),
        "recommendation": (
            "Add a calendar reminder ~100 days before renewal and try to "
            "negotiate the notice window down to 30 days."
        ),
    },
    {
        "clause_type": "liability_cap",
        "original_text": (
            "In no event shall Provider's aggregate liability exceed the fees "
            "paid by Customer in the one (1) month preceding the claim."
        ),
        "severity": "high",
        "summary": (
            "Liability is capped at a single month's fees, which is far below "
            "the potential damages from an outage or data breach."
        ),
        "recommendation": (
            "Push for a cap of at least 12 months of fees and a carve-out for "
            "data breaches and IP indemnity."
        ),
    },
    {
        "clause_type": "price_change",
        "original_text": (
            "Provider may modify the fees at any time upon thirty (30) days' "
            "notice, and such changes shall take effect automatically."
        ),
        "severity": "medium",
        "summary": (
            "The vendor can unilaterally raise prices with only 30 days' notice "
            "and no cap on the increase."
        ),
        "recommendation": (
            "Negotiate an annual price-increase cap (e.g. CPI or 5%) and the "
            "right to terminate if an increase is rejected."
        ),
    },
    {
        "clause_type": "governing_law",
        "original_text": (
            "This Agreement shall be governed by the laws of the State of "
            "Delaware, without regard to its conflict-of-laws principles."
        ),
        "severity": "low",
        "summary": (
            "Delaware governing law is standard and generally neutral for "
            "commercial agreements."
        ),
        "recommendation": (
            "No action needed; Delaware is a common, predictable choice of law."
        ),
    },
]


def _strip_fences(text: str) -> str:
    """Remove a leading/trailing ```json … ``` fence the model may add anyway."""
    cleaned = _FENCE_RE.sub("", text.strip())
    return cleaned.strip()


def _model() -> genai.GenerativeModel:
    """Configure the SDK from settings and return the flash model.

    `configure` is process-global and idempotent; doing it here keeps the API
    key out of import-time side effects (so importing this module never requires
    a key to be present).
    """
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(_MODEL_NAME)


async def _extract_clauses(
    model: genai.GenerativeModel, contract_text: str
) -> list[dict]:
    """Pass 1 — pull every risky clause out of the contract as {type, text}."""
    prompt = _PASS_1_PROMPT.replace("__CONTRACT_TEXT__", contract_text)
    response = await model.generate_content_async(prompt)

    try:
        parsed = json.loads(_strip_fences(response.text))
    except (json.JSONDecodeError, ValueError):
        logger.exception("Pass 1 returned unparseable JSON")
        return []

    if not isinstance(parsed, list):
        logger.error("Pass 1 returned %s, expected a list", type(parsed).__name__)
        return []

    clauses: list[dict] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        clause_type = item.get("clause_type")
        original_text = item.get("original_text")
        if clause_type not in _VALID_CLAUSE_TYPES:
            logger.warning("Skipping clause with unknown type: %r", clause_type)
            continue
        if not isinstance(original_text, str) or not original_text.strip():
            continue
        clauses.append(
            {"clause_type": clause_type, "original_text": original_text.strip()}
        )
    return clauses


async def _assess_clause(
    model: genai.GenerativeModel, clause: dict
) -> dict | None:
    """Pass 2 — assess one clause. Returns a full risk dict, or None on failure
    (logged and skipped so it can't crash the gathered batch)."""
    prompt = (
        _PASS_2_PROMPT.replace("__CLAUSE_TYPE__", clause["clause_type"]).replace(
            "__ORIGINAL_TEXT__", clause["original_text"]
        )
    )
    try:
        response = await model.generate_content_async(prompt)
        parsed = json.loads(_strip_fences(response.text))
    except Exception:  # noqa: BLE001 — a bad clause is logged and skipped, never fatal
        logger.exception("Pass 2 failed for clause_type=%s", clause["clause_type"])
        return None

    severity = parsed.get("severity")
    summary = parsed.get("summary")
    recommendation = parsed.get("recommendation")
    if severity not in _VALID_SEVERITIES or not summary or not recommendation:
        logger.warning(
            "Pass 2 returned an incomplete assessment for clause_type=%s",
            clause["clause_type"],
        )
        return None

    return {
        "clause_type": clause["clause_type"],
        "original_text": clause["original_text"],
        "severity": severity,
        "summary": str(summary).strip(),
        "recommendation": str(recommendation).strip(),
    }


async def analyze_contract(contract_text: str) -> list[dict]:
    """Run the full two-pass analysis and return a list of clause-risk dicts.

    Each dict has: clause_type, original_text, severity, summary, recommendation
    — exactly the columns the ClauseRiskRepository persists. Returns [] when no
    risky clauses are found.
    """
    if settings.USE_MOCK_GEMINI:
        # Mock mode: skip the API entirely and hand back the fixed sample. Logged
        # loudly so a stray flag in production is obvious.
        logger.warning("USE_MOCK_GEMINI is on — returning mocked clause risks")
        return [dict(risk) for risk in _MOCK_CLAUSE_RISKS]

    model = _model()

    clauses = await _extract_clauses(model, contract_text)
    if not clauses:
        return []

    # All Pass 2 calls run concurrently.
    assessments = await asyncio.gather(
        *(_assess_clause(model, clause) for clause in clauses)
    )
    return [risk for risk in assessments if risk is not None]
