"""Data access for vendors.

Every method takes the authenticated `user_id` and filters by it. The Supabase
client uses the service role key (bypasses RLS), so this user scoping — not RLS
— is the real access gate; RLS is defense in depth. No method ever trusts a
caller-supplied user_id from anywhere but the validated JWT.

Columns are always listed explicitly — never `select("*")`.
"""

from supabase import Client

# Explicit column list — keeps `raw_text`-style accidents impossible and matches
# VendorResponse exactly.
_COLUMNS = "id, name, website, category, created_at"


class VendorRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(self, user_id: str, data: dict) -> dict:
        """Insert a vendor owned by `user_id` and return the created row."""
        payload = {**data, "user_id": user_id}
        result = (
            self._client.table("vendors")
            .insert(payload)
            .execute()
        )
        return result.data[0]

    def get_all_by_user(self, user_id: str) -> list[dict]:
        """All vendors owned by the user, newest first."""
        result = (
            self._client.table("vendors")
            .select(_COLUMNS)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    def get_by_id(self, user_id: str, vendor_id: str) -> dict | None:
        """A single vendor, but only if it belongs to the user. Else None."""
        result = (
            self._client.table("vendors")
            .select(_COLUMNS)
            .eq("id", vendor_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def update(self, user_id: str, vendor_id: str, data: dict) -> dict | None:
        """Patch a user-owned vendor. Returns the updated row, or None if it
        doesn't exist / isn't theirs (the user_id filter makes both indistinct)."""
        result = (
            self._client.table("vendors")
            .update(data)
            .eq("id", vendor_id)
            .eq("user_id", user_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def delete(self, user_id: str, vendor_id: str) -> bool:
        """Delete a user-owned vendor. Returns True if a row was removed."""
        result = (
            self._client.table("vendors")
            .delete()
            .eq("id", vendor_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)
