"""Data access for contracts.

Every method takes the authenticated `user_id` and filters by it. The Supabase
client uses the service role key (bypasses RLS), so this user scoping — not RLS
— is the real access gate; RLS is defense in depth. No method ever trusts a
caller-supplied user_id from anywhere but the validated JWT.

Columns are always listed explicitly — never `select("*")`, and never
`raw_text` (it stays in the DB and is never returned to a client).
"""

from supabase import Client

# Client-safe columns — exactly the ContractResponse shape. Notably excludes
# `raw_text` and `storage_path`.
_COLUMNS = "id, vendor_id, filename, contract_type, status, uploaded_at, analyzed_at"


class ContractRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(self, user_id: str, data: dict) -> dict:
        """Insert a contract owned by `user_id` and return the created row.

        `status` defaults to 'pending' in the DB, so callers need not set it.
        """
        payload = {**data, "user_id": user_id}
        result = (
            self._client.table("contracts")
            .insert(payload)
            .execute()
        )
        row = result.data[0]
        # Insert returns every column; narrow to the client-safe shape so no
        # storage_path / raw_text can leak through the response_model.
        return {key: row[key] for key in _COLUMNS.replace(" ", "").split(",")}

    def get_all_by_vendor(self, user_id: str, vendor_id: str) -> list[dict]:
        """All contracts for a vendor the user owns, newest upload first."""
        result = (
            self._client.table("contracts")
            .select(_COLUMNS)
            .eq("user_id", user_id)
            .eq("vendor_id", vendor_id)
            .order("uploaded_at", desc=True)
            .execute()
        )
        return result.data

    def get_by_id(self, user_id: str, contract_id: str) -> dict | None:
        """A single contract, only if it belongs to the user. Else None.

        Includes `storage_path` because callers (e.g. delete, future analysis)
        need it server-side; never return this dict straight to a client without
        a response_model that strips it.
        """
        result = (
            self._client.table("contracts")
            .select(f"{_COLUMNS}, storage_path")
            .eq("id", contract_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def update_status(
        self,
        user_id: str,
        contract_id: str,
        status: str,
        analyzed_at: str | None = None,
    ) -> dict | None:
        """Move a user-owned contract to a new status. Returns the updated row."""
        changes: dict = {"status": status}
        if analyzed_at is not None:
            changes["analyzed_at"] = analyzed_at
        result = (
            self._client.table("contracts")
            .update(changes)
            .eq("id", contract_id)
            .eq("user_id", user_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def delete(self, user_id: str, contract_id: str) -> bool:
        """Delete a user-owned contract row. Returns True if a row was removed.

        Removal of the backing storage object is the router's responsibility —
        this only touches the database.
        """
        result = (
            self._client.table("contracts")
            .delete()
            .eq("id", contract_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)
