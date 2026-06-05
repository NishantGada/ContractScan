"""Contract response schema.

As with vendors, `user_id` appears on nothing here — it is never accepted from
the client and is taken only from the validated JWT. `storage_path` and
`raw_text` are deliberately absent too: the storage key is an internal detail
and the extracted text stays in the database, never on the wire.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# Mirror the `contract_type` CHECK and `status` enum constraints in the schema.
ContractType = Literal["NDA", "MSA", "SaaS Agreement", "SOW", "Other"]
ContractStatus = Literal["pending", "analyzing", "done", "failed"]


class ContractResponse(BaseModel):
    """The only contract shape returned to clients — no storage_path, no raw_text."""

    id: str
    vendor_id: str
    filename: str
    contract_type: ContractType | None = None
    status: ContractStatus
    uploaded_at: datetime
    analyzed_at: datetime | None = None
