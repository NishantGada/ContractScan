"""Risk aggregation.

Turns a flat list of clause risks into a roll-up: a count per severity, a single
overall level, and a numeric score. The overall rule is worst-wins — any high
makes the whole thing high, otherwise any medium makes it medium, otherwise low
(including the empty case, where there's no known risk).

Feature 6 produces clause risks; Feature 7's vendor risk-summary endpoint and
Feature 8's portfolio dashboard (which ranks vendors by `score`) are the main
consumers of this aggregation.
"""

from typing import Literal, TypedDict

RiskLevel = Literal["high", "medium", "low"]

# Severity weights for the ranking score. High clauses dominate the order, but a
# pile of mediums still outranks a single medium, and lows break ties — so two
# "high overall" vendors sort by how much risk they actually carry.
_WEIGHTS = {"high": 100, "medium": 10, "low": 1}


class RiskSummary(TypedDict):
    high: int
    medium: int
    low: int
    total: int
    overall: RiskLevel
    score: int


def aggregate(clause_risks: list[dict]) -> RiskSummary:
    """Count clause risks by severity, derive an overall level (worst-wins), and
    compute a weighted score for ranking."""
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
        "score": sum(counts[sev] * weight for sev, weight in _WEIGHTS.items()),
    }
