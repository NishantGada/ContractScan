"""Vendor CRUD routes.

Handlers stay thin: validate input (Pydantic), resolve identity (the JWT via
`get_current_user`), call the repository, map to `VendorResponse`. `user_id`
comes only from the token — never from the body or query string.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase
from app.dependencies import get_current_user
from app.repositories.clause_risk_repository import ClauseRiskRepository
from app.repositories.contract_repository import ContractRepository
from app.repositories.vendor_repository import VendorRepository
from app.schemas.vendor import (
    VendorCreate,
    VendorResponse,
    VendorRiskSummaryResponse,
    VendorUpdate,
)
from app.services.risk_aggregator import aggregate

router = APIRouter(prefix="/vendors", tags=["vendors"])


def get_vendor_repository() -> VendorRepository:
    return VendorRepository(get_supabase())


def get_contract_repository() -> ContractRepository:
    return ContractRepository(get_supabase())


def get_clause_risk_repository() -> ClauseRiskRepository:
    return ClauseRiskRepository(get_supabase())


@router.get("", response_model=list[VendorResponse])
def list_vendors(
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> list[dict]:
    return repo.get_all_by_user(user_id)


@router.get("/{vendor_id}/risk-summary", response_model=VendorRiskSummaryResponse)
def vendor_risk_summary(
    vendor_id: str,
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
    contract_repo: ContractRepository = Depends(get_contract_repository),
    clause_repo: ClauseRiskRepository = Depends(get_clause_risk_repository),
) -> dict:
    """Roll up every clause risk across a vendor's contracts.

    Confirm ownership first (a vendor that isn't theirs is a clean 404), then
    resolve the vendor to its user-scoped contract ids and aggregate the clause
    risks found across them.
    """
    vendor = repo.get_by_id(user_id, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    contracts = contract_repo.get_all_by_vendor(user_id, vendor_id)
    contract_ids = [c["id"] for c in contracts]
    risks = clause_repo.get_all_by_contracts(user_id, contract_ids)
    summary = aggregate(risks)

    return {
        "vendor_id": vendor_id,
        "total_contracts": len(contracts),
        "high": summary["high"],
        "medium": summary["medium"],
        "low": summary["low"],
        "total_risks": summary["total"],
        "overall": summary["overall"],
        "clause_risks": risks,
    }


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    body: VendorCreate,
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> dict:
    return repo.create(user_id, body.model_dump(exclude_none=True))


@router.patch("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: str,
    body: VendorUpdate,
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> dict:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )
    updated = repo.update(user_id, vendor_id, changes)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return updated


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: str,
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> None:
    # Ownership is enforced by the user_id filter in the delete query: a vendor
    # that isn't theirs simply matches nothing, yielding a clean 404.
    if not repo.delete(user_id, vendor_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
