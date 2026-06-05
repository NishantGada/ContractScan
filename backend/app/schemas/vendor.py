"""Vendor request/response schemas.

`user_id` deliberately appears on NONE of these — it is never accepted from the
client and is taken only from the validated JWT. `VendorResponse` is the single
shape the API returns, so no other columns can leak by accident.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Mirror the `category` CHECK constraint in the Supabase schema.
VendorCategory = Literal["SaaS", "Legal", "Infrastructure", "Finance", "Other"]


class VendorCreate(BaseModel):
    """Body for POST /vendors."""

    name: str = Field(min_length=1, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    category: VendorCategory | None = None


class VendorUpdate(BaseModel):
    """Body for PATCH /vendors/{id} — every field optional (partial update)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    category: VendorCategory | None = None


class VendorResponse(BaseModel):
    """The only vendor shape returned to clients."""

    id: str
    name: str
    website: str | None = None
    category: VendorCategory | None = None
    created_at: datetime
