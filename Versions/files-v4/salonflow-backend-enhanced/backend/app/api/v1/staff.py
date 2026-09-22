from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.core.supabase_client import supabase_client
from app.core.auth_deps import require_roles, UserContext
from app.core.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


class StaffUpdate(BaseModel):
    position: Optional[str] = None
    phone: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None


@router.get("/")
async def get_staff(ctx: UserContext = Depends(require_roles("owner", "staff"))):
    if not ctx.salon_id:
        return []

    staff_result = (
        supabase_client.table("staff").select("*").eq("salon_id", ctx.salon_id).execute()
    )
    if not staff_result.data:
        return []

    staff_list = []
    for s in staff_result.data:
        user_result = (
            supabase_client.table("users")
            .select("id, email, username, full_name, phone, is_active")
            .eq("id", s["user_id"])
            .execute()
        )
        if user_result.data:
            user_data = user_result.data[0]
            staff_list.append(
                {
                    "id": s["id"],
                    "user_id": s["user_id"],
                    "full_name": user_data.get("full_name", ""),
                    "email": user_data.get("email", ""),
                    "username": user_data.get("username", ""),
                    "phone": user_data.get("phone", ""),
                    "position": s.get("position", ""),
                    "is_active": user_data.get("is_active", True),
                    "created_at": s.get("created_at", ""),
                    # Was missing entirely - the frontend had no way to
                    # show or edit a staff member's permissions without it.
                    "permissions": s.get("permissions") or {},
                }
            )

    return staff_list


@router.put("/{staff_id}")
async def update_staff(staff_id: str, staff_data: StaffUpdate, ctx: UserContext = Depends(require_roles("owner"))):
    """Owner only. Updates position/permissions/active-status for an
    existing staff member. Split from creation (POST /auth/staff) since
    editing doesn't involve creating an auth account."""
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Staff not found")

    staff_check = (
        supabase_client.table("staff")
        .select("user_id")
        .eq("id", staff_id)
        .eq("salon_id", ctx.salon_id)
        .execute()
    )
    if not staff_check.data:
        raise HTTPException(status_code=404, detail="Staff not found")

    user_id = staff_check.data[0]["user_id"]

    staff_update = {}
    if staff_data.position is not None:
        staff_update["position"] = staff_data.position
    if staff_data.permissions is not None:
        staff_update["permissions"] = staff_data.permissions
    if staff_update:
        supabase_client.table("staff").update(staff_update).eq("id", staff_id).execute()

    user_update = {}
    if staff_data.phone is not None:
        user_update["phone"] = staff_data.phone
    if staff_data.is_active is not None:
        user_update["is_active"] = staff_data.is_active
    if user_update:
        supabase_client.table("users").update(user_update).eq("id", user_id).execute()

    return {"message": "Staff updated successfully"}


@router.delete("/{staff_id}")
async def delete_staff(staff_id: str, ctx: UserContext = Depends(require_roles("owner"))):
    """Owner only. Previously this endpoint only checked that the caller
    belonged to the same salon (via get_user_salon_id, which also resolves
    salon scope for staff), so any staff member could delete any other
    staff member in the same salon. Now gated to owners via require_roles.
    """
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Staff not found")

    staff_check = (
        supabase_client.table("staff")
        .select("user_id")
        .eq("id", staff_id)
        .eq("salon_id", ctx.salon_id)
        .execute()
    )
    if not staff_check.data:
        raise HTTPException(status_code=404, detail="Staff not found")

    user_id = staff_check.data[0]["user_id"]

    supabase_client.table("staff").delete().eq("id", staff_id).eq("salon_id", ctx.salon_id).execute()
    supabase_client.table("users").update({"is_active": False}).eq("id", user_id).execute()

    return {"message": "Staff deleted successfully"}
