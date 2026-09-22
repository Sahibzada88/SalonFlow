from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.core.supabase_client import supabase_client
from app.core.auth_deps import get_current_user, require_permission, UserContext

router = APIRouter()

# Viewing the catalog is open to anyone signed in (customers need it to
# pick a service when booking - see list_services below). Changing it
# requires the `can_manage_services` permission specifically, which
# defaults to false for new staff (unlike can_book/can_approve/can_bill) -
# service pricing is exactly the kind of thing an owner is likely to want
# to keep to themselves or a trusted few, and this is fully customizable
# per staff member via PUT /staff/{id}. Owners always pass this check.
_can_manage_services = require_permission("can_manage_services")


class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration: int = 30
    price: int = 0
    category: Optional[str] = None
    is_active: bool = True


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    price: Optional[int] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_services(ctx: UserContext = Depends(get_current_user), active_only: bool = False):
    """Anyone signed in can browse the service catalog - customers need
    this to pick a service when booking. Only owner/staff can change it."""
    if not ctx.salon_id:
        return []

    query = supabase_client.table("services").select("*").eq("salon_id", ctx.salon_id)
    if active_only:
        query = query.eq("is_active", True)
    result = query.order("category").order("name").execute()
    return result.data if result.data else []


@router.post("/")
async def create_service(service_data: ServiceCreate, ctx: UserContext = Depends(_can_manage_services)):
    if not ctx.salon_id:
        raise HTTPException(status_code=400, detail="Set up your salon first")

    result = supabase_client.table("services").insert(service_data.dict()).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create service")
    return result.data[0]


@router.put("/{service_id}")
async def update_service(service_id: str, service_data: ServiceUpdate, ctx: UserContext = Depends(_can_manage_services)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Service not found")

    update_dict = {k: v for k, v in service_data.dict().items() if v is not None}
    result = (
        supabase_client.table("services")
        .update(update_dict)
        .eq("id", service_id)
        .eq("salon_id", ctx.salon_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Service not found")
    return result.data[0]


@router.delete("/{service_id}")
async def delete_service(service_id: str, ctx: UserContext = Depends(_can_manage_services)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Service not found")

    result = (
        supabase_client.table("services")
        .delete()
        .eq("id", service_id)
        .eq("salon_id", ctx.salon_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted successfully"}
