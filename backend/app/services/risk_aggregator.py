"""Risk aggregation.

Turns a flat list of clause risks into a roll-up: a count per severity and a
single overall level. The rule is worst-wins — any high makes the whole thing
high, otherwise any medium makes it medium, otherwise low (including the empty
case, where there's no known risk).

Feature 6 produces clause risks; Feature 7's vendor risk-summary endpoint is the
main consumer of this aggregation.
"""

from typing import Literal, TypedDict

RiskLevel = Literal["high", "medium", "low"]


class RiskSummary(TypedDict):
    high: int
    medium: int
    low: int
    total: int
    overall: RiskLevel


def aggregate(clause_risks: list[dict]) -> RiskSummary:
    """Count clause risks by severity and derive an overall level (worst-wins)."""
    counts = {"high": 0, "medium": 0, "low": 0}
    for risk in clause_risks:
        severity = risk.get("severity")
        if severity in counts:
            counts[severity] += 1

    if counts["high"]:
        overall: RiskLevel = "high"
    elif counts["medium"]:
        overall = "medium"
    else:
        overall = "low"

    return {
        "high": counts["high"],
        "medium": counts["medium"],
        "low": counts["low"],
        "total": counts["high"] + counts["medium"] + counts["low"],
        "overall": overall,
    }
