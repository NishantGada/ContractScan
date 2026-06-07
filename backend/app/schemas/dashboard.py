"""Portfolio dashboard schemas (GET /dashboard).

As everywhere, `user_id` appears on nothing here — identity is taken only from
the validated JWT. The dashboard embeds the same `VendorResponse` shape used
elsewhere, so no extra vendor columns can leak through this endpoint.
"""

from pydantic import BaseModel

from app.schemas.clause_risk import RiskSeverity
from app.schemas.vendor import VendorResponse


class DashboardVendor(BaseModel):
    """One vendor's portfolio row: the vendor itself plus its rolled-up risk.

    `risk_score` is the weighted severity score the list is ranked by;
    `overall` is the worst-wins level. A vendor with no analyzed contracts has
    zero counts and an `overall` of "low" (the aggregator's empty case) — the UI
    uses `total_contracts`/`total_risks` to tell "no risk" apart from "unscanned".
    """

    vendor: VendorResponse
    total_contracts: int
    high: int
    medium: int
    low: int
    total_risks: int
    overall: RiskSeverity
    risk_score: int


class DashboardTotals(BaseModel):
    """Account-wide headline stats shown across the top of the dashboard."""

    total_vendors: int
    total_contracts: int
    high_risk_clauses: int


class DashboardResponse(BaseModel):
    """Returned by GET /dashboard — totals plus vendors ranked highest-risk first."""

    totals: DashboardTotals
    vendors: list[DashboardVendor]
