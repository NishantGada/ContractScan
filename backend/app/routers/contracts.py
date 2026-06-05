"""Contract upload / listing / deletion routes.

Handlers stay thin: validate input, resolve identity (the JWT via
`get_current_user`), check ownership, touch storage + repository, map to
`ContractResponse`. `user_id` comes only from the token.

Files are stored under a per-user, opaque key — `{user_id}/{uuid4()}.pdf` —
never the user-supplied filename, which is kept only as a display label in the
DB. The bucket is private; nothing here ever makes it public.
"""

from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)

from app.database import get_supabase
from app.dependencies import get_current_user
from app.repositories.contract_repository import ContractRepository
from app.repositories.vendor_repository import VendorRepository
from app.schemas.contract import ContractResponse, ContractType

router = APIRouter(tags=["contracts"])

_BUCKET = "contracts"
_MAX_BYTES = 50 * 1024 * 1024  # 50 MB
_PDF_MAGIC = b"%PDF-"


def get_contract_repository() -> ContractRepository:
    return ContractRepository(get_supabase())


def get_vendor_repository() -> VendorRepository:
    return VendorRepository(get_supabase())


def _ensure_vendor_owned(vendor_repo: VendorRepository, user_id: str, vendor_id: str) -> None:
    """404 if the vendor doesn't exist or isn't this user's — same response for
    both so we never reveal whether someone else's vendor id exists."""
    if vendor_repo.get_by_id(user_id, vendor_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")


@router.post(
    "/vendors/{vendor_id}/contracts",
    response_model=ContractResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_contract(
    vendor_id: str,
    file: UploadFile = File(...),
    contract_type: ContractType | None = Form(default=None),
    user_id: str = Depends(get_current_user),
    repo: ContractRepository = Depends(get_contract_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> dict:
    _ensure_vendor_owned(vendor_repo, user_id, vendor_id)

    contents = await file.read()

    # --- File validation: PDF only, non-empty, <= 50 MB ---
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty"
        )
    if len(contents) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 50MB limit",
        )
    # Trust the content, not the client: check the declared type, the extension,
    # and the actual PDF magic bytes.
    is_pdf = (
        file.content_type == "application/pdf"
        and (file.filename or "").lower().endswith(".pdf")
        and contents[: len(_PDF_MAGIC)] == _PDF_MAGIC
    )
    if not is_pdf:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are accepted",
        )

    # Opaque storage key — never the original filename.
    storage_path = f"{user_id}/{uuid4()}.pdf"
    try:
        get_supabase().storage.from_(_BUCKET).upload(
            storage_path,
            contents,
            {"content-type": "application/pdf"},
        )
    except Exception:  # noqa: BLE001 — surface any storage failure as a 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not store the uploaded file",
        )

    try:
        return repo.create(
            user_id,
            {
                "vendor_id": vendor_id,
                "filename": file.filename,
                "storage_path": storage_path,
                "contract_type": contract_type,
            },
        )
    except Exception:
        # Don't leave an orphaned object behind if the DB insert fails.
        get_supabase().storage.from_(_BUCKET).remove([storage_path])
        raise


@router.get("/vendors/{vendor_id}/contracts", response_model=list[ContractResponse])
def list_contracts(
    vendor_id: str,
    user_id: str = Depends(get_current_user),
    repo: ContractRepository = Depends(get_contract_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> list[dict]:
    _ensure_vendor_owned(vendor_repo, user_id, vendor_id)
    return repo.get_all_by_vendor(user_id, vendor_id)


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
    contract_id: str,
    user_id: str = Depends(get_current_user),
    repo: ContractRepository = Depends(get_contract_repository),
) -> None:
    contract = repo.get_by_id(user_id, contract_id)
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    # Remove the storage object first, then the row. A failed storage removal
    # leaves the record intact (and retryable) rather than orphaning a DB row.
    get_supabase().storage.from_(_BUCKET).remove([contract["storage_path"]])
    repo.delete(user_id, contract_id)
