"""Vendor CRUD routes.

Handlers stay thin: validate input (Pydantic), resolve identity (the JWT via
`get_current_user`), call the repository, map to `VendorResponse`. `user_id`
comes only from the token — never from the body or query string.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase
from app.dependencies import get_current_user
from app.repositories.vendor_repository import VendorRepository
from app.schemas.vendor import VendorCreate, VendorResponse, VendorUpdate

router = APIRouter(prefix="/vendors", tags=["vendors"])


def get_vendor_repository() -> VendorRepository:
    return VendorRepository(get_supabase())


@router.get("", response_model=list[VendorResponse])
def list_vendors(
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> list[dict]:
    return repo.get_all_by_user(user_id)


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    body: VendorCreate,
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> dict:
    return repo.create(user_id, body.model_dump(exclude_none=True))


@router.patch("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: str,
    body: VendorUpdate,
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> dict:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )
    updated = repo.update(user_id, vendor_id, changes)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return updated


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: str,
    user_id: str = Depends(get_current_user),
    repo: VendorRepository = Depends(get_vendor_repository),
) -> None:
    # Ownership is enforced by the user_id filter in the delete query: a vendor
    # that isn't theirs simply matches nothing, yielding a clean 404.
    if not repo.delete(user_id, vendor_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
