"""ClauseRisk + analysis response schemas.

As everywhere else, `user_id` appears on nothing here — it is taken only from
the validated JWT, never accepted from a client. Unlike a contract's `raw_text`
(which never leaves the database), a clause's `original_text` IS returned: the
UI's "View original text" toggle needs it, and it's the specific snippet the
risk was found in, not the whole document.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.contract import ContractStatus

# Mirror the `risk_severity` enum in the Supabase schema.
RiskSeverity = Literal["high", "medium", "low"]


class ClauseRiskResponse(BaseModel):
    """A single risky clause found in a contract, with its assessment."""

    id: str
    contract_id: str
    clause_type: str
    severity: RiskSeverity
    summary: str
    original_text: str
    recommendation: str
    created_at: datetime


class AnalysisStartResponse(BaseModel):
    """Returned immediately by POST /contracts/{id}/analyze.

    The pipeline runs in the background, so the client gets `analyzing` right
    away and then polls the analysis endpoint until it reaches a terminal state.
    """

    status: ContractStatus


class ContractAnalysisResponse(BaseModel):
    """Returned by GET /contracts/{id}/analysis.

    Carries the contract's current status so the client can poll this single
    endpoint until it sees `done` or `failed`, plus every clause risk found.
    """

    contract_id: str
    status: ContractStatus
    analyzed_at: datetime | None = None
    clause_risks: list[ClauseRiskResponse]
