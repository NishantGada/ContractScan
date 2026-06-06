"""Contract analysis routes.

`POST /contracts/{id}/analyze` kicks off the pipeline as a FastAPI background
task and returns immediately with `analyzing`; the client polls
`GET /contracts/{id}/analysis` (which carries the contract's status) every few
seconds until it sees `done` or `failed`.

As everywhere, identity comes only from the validated JWT, and every query is
scoped to that `user_id`. The background task can't use request-scoped `Depends`
(the request is already gone by the time it runs), so it builds its own
repositories from the shared Supabase client.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.database import get_supabase
from app.dependencies import get_current_user
from app.repositories.clause_risk_repository import ClauseRiskRepository
from app.repositories.contract_repository import ContractRepository
from app.schemas.clause_risk import AnalysisStartResponse, ContractAnalysisResponse
from app.services.gemini_analyzer import analyze_contract
from app.services.pdf_extractor import extract_text

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analysis"])

_BUCKET = "contracts"


def get_contract_repository() -> ContractRepository:
    return ContractRepository(get_supabase())


def get_clause_risk_repository() -> ClauseRiskRepository:
    return ClauseRiskRepository(get_supabase())


async def _run_analysis(user_id: str, contract_id: str) -> None:
    """The full pipeline, run in the background: download the PDF, extract text,
    run the two-pass analysis, persist the clause risks, and move the contract to
    `done`. Any failure logs and marks the contract `failed` — never crashes."""
    supabase = get_supabase()
    contract_repo = ContractRepository(supabase)
    clause_repo = ClauseRiskRepository(supabase)

    # Re-fetch under the user scope; if it vanished (e.g. deleted mid-flight),
    # there's nothing to do.
    contract = contract_repo.get_by_id(user_id, contract_id)
    if contract is None:
        return

    try:
        pdf_bytes = supabase.storage.from_(_BUCKET).download(contract["storage_path"])
        text = extract_text(pdf_bytes)
        risks = await analyze_contract(text)

        # Clear any prior run's rows so a re-analysis is idempotent, then insert.
        clause_repo.delete_by_contract(user_id, contract_id)
        clause_repo.create_many(user_id, contract_id, risks)

        contract_repo.save_raw_text(user_id, contract_id, text)
        contract_repo.update_status(
            user_id,
            contract_id,
            "done",
            analyzed_at=datetime.now(timezone.utc).isoformat(),
        )
        logger.info(
            "Analysis complete for contract=%s (%d clause risks)",
            contract_id,
            len(risks),
        )
    except Exception:  # noqa: BLE001 — any failure flips the contract to `failed`
        logger.exception("Analysis failed for contract=%s", contract_id)
        contract_repo.update_status(user_id, contract_id, "failed")


@router.post(
    "/contracts/{contract_id}/analyze", response_model=AnalysisStartResponse
)
def trigger_analysis(
    contract_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    repo: ContractRepository = Depends(get_contract_repository),
) -> dict:
    """Start (or restart) analysis for a contract the user owns."""
    contract = repo.get_by_id(user_id, contract_id)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found"
        )

    # Flip to `analyzing` before returning so a client poll never sees a stale
    # state, then run the heavy work in the background.
    repo.update_status(user_id, contract_id, "analyzing")
    background_tasks.add_task(_run_analysis, user_id, contract_id)
    return {"status": "analyzing"}


@router.get(
    "/contracts/{contract_id}/analysis", response_model=ContractAnalysisResponse
)
def get_analysis(
    contract_id: str,
    user_id: str = Depends(get_current_user),
    repo: ContractRepository = Depends(get_contract_repository),
    clause_repo: ClauseRiskRepository = Depends(get_clause_risk_repository),
) -> dict:
    """Current status plus every clause risk for a contract the user owns."""
    contract = repo.get_by_id(user_id, contract_id)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found"
        )

    return {
        "contract_id": contract_id,
        "status": contract["status"],
        "analyzed_at": contract["analyzed_at"],
        "clause_risks": clause_repo.get_all_by_contract(user_id, contract_id),
    }
