"""Portfolio dashboard route.

`GET /dashboard` rolls every vendor up into one portfolio view: per-vendor risk
counts plus account-wide totals, ranked highest-risk first. It runs a fixed
three queries (vendors, contracts, clause risks) and groups them in memory —
never one round-trip per vendor.

As everywhere, identity comes only from the validated JWT, and every query is
scoped to that `user_id`.
"""

from fastapi import APIRouter, Depends

from app.database import get_supabase
from app.dependencies import get_current_user
from app.repositories.clause_risk_repository import ClauseRiskRepository
from app.repositories.contract_repository import ContractRepository
from app.repositories.vendor_repository import VendorRepository
from app.schemas.dashboard import DashboardResponse
from app.services.risk_aggregator import aggregate

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_vendor_repository() -> VendorRepository:
    return VendorRepository(get_supabase())


def get_contract_repository() -> ContractRepository:
    return ContractRepository(get_supabase())


def get_clause_risk_repository() -> ClauseRiskRepository:
    return ClauseRiskRepository(get_supabase())


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    user_id: str = Depends(get_current_user),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    contract_repo: ContractRepository = Depends(get_contract_repository),
    clause_repo: ClauseRiskRepository = Depends(get_clause_risk_repository),
) -> dict:
    """Build the portfolio overview: every vendor with its risk roll-up, ranked
    by risk score descending, plus account-wide totals.

    All three lists are already user-scoped, so grouping them by vendor in memory
    needs no further ownership checks.
    """
    vendors = vendor_repo.get_all_by_user(user_id)
    contracts = contract_repo.get_all_by_user(user_id)
    risks = clause_repo.get_all_by_user(user_id)

    # contract_id -> vendor_id, so each risk can be attributed to a vendor.
    contract_to_vendor = {c["id"]: c["vendor_id"] for c in contracts}

    contracts_per_vendor: dict[str, int] = {}
    for contract in contracts:
        vendor_id = contract["vendor_id"]
        contracts_per_vendor[vendor_id] = contracts_per_vendor.get(vendor_id, 0) + 1

    risks_per_vendor: dict[str, list[dict]] = {}
    for risk in risks:
        vendor_id = contract_to_vendor.get(risk["contract_id"])
        if vendor_id is not None:
            risks_per_vendor.setdefault(vendor_id, []).append(risk)

    dashboard_vendors = []
    for vendor in vendors:
        summary = aggregate(risks_per_vendor.get(vendor["id"], []))
        dashboard_vendors.append(
            {
                "vendor": vendor,
                "total_contracts": contracts_per_vendor.get(vendor["id"], 0),
                "high": summary["high"],
                "medium": summary["medium"],
                "low": summary["low"],
                "total_risks": summary["total"],
                "overall": summary["overall"],
                "risk_score": summary["score"],
            }
        )

    # Highest risk first; break ties by name so ordering is stable and readable.
    dashboard_vendors.sort(
        key=lambda d: (-d["risk_score"], d["vendor"]["name"].lower())
    )

    totals = {
        "total_vendors": len(vendors),
        "total_contracts": len(contracts),
        "high_risk_clauses": sum(d["high"] for d in dashboard_vendors),
    }

    return {"totals": totals, "vendors": dashboard_vendors}
