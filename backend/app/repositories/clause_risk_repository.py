"""Data access for clause risks.

Same contract as the other repositories: every method takes the authenticated
`user_id` and filters by it. The service-role client bypasses RLS, so this user
scoping is the real access gate; RLS is defense in depth. Columns are always
listed explicitly — never `select("*")`.
"""

from supabase import Client

# Client-safe columns — exactly the ClauseRiskResponse shape. Excludes user_id.
_COLUMNS = (
    "id, contract_id, clause_type, severity, summary, original_text, "
    "recommendation, created_at"
)


class ClauseRiskRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create_many(
        self, user_id: str, contract_id: str, risks: list[dict]
    ) -> list[dict]:
        """Insert all clause risks for a contract in one round-trip.

        Each risk dict carries the analysis fields (clause_type, severity,
        summary, original_text, recommendation); ownership (`user_id`) and the
        parent (`contract_id`) are stamped here, never trusted from the analyzer.
        Returns [] for an empty input rather than hitting the DB.
        """
        if not risks:
            return []
        payload = [
            {**risk, "user_id": user_id, "contract_id": contract_id} for risk in risks
        ]
        result = self._client.table("clause_risks").insert(payload).execute()
        # Narrow each inserted row to the client-safe shape.
        keys = _COLUMNS.replace(" ", "").split(",")
        return [{key: row[key] for key in keys} for row in result.data]

    def get_all_by_contract(self, user_id: str, contract_id: str) -> list[dict]:
        """All clause risks for a contract the user owns, oldest first."""
        result = (
            self._client.table("clause_risks")
            .select(_COLUMNS)
            .eq("user_id", user_id)
            .eq("contract_id", contract_id)
            .order("created_at", desc=False)
            .execute()
        )
        return result.data

    def delete_by_contract(self, user_id: str, contract_id: str) -> None:
        """Clear a contract's existing clause risks before a (re-)analysis, so a
        rerun never leaves stale rows behind. Scoped to the owner."""
        (
            self._client.table("clause_risks")
            .delete()
            .eq("user_id", user_id)
            .eq("contract_id", contract_id)
            .execute()
        )
