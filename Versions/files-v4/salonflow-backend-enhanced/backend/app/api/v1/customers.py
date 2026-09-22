from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.supabase_client import supabase_client
from app.core.auth_deps import require_roles, require_permission, UserContext
from app.core.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)

# Every route in this file is owner/staff only. In the original code these
# routes resolved "salon" by looking up `salons.owner_id = current_user`
# ONLY - which meant staff accounts got an empty list / 400 "no salon found"
# even though they should have full access, and there was no role check at
# all preventing a *customer* token from working here (a customer also maps
# to a salon_id via a different helper used elsewhere, which is exactly the
# kind of inconsistency that led to the data-exposure issue). Both are fixed
# by requiring role in ("owner", "staff") up front, and reading salon scope
# from ctx.salon_id (resolved once, correctly, per role, in auth_deps.py).
#
# Viewing customers stays available to every owner/staff account (any
# staff member generally needs to look customers up to book/bill for
# them). Only the mutating actions - create/edit/delete - are additionally
# gated behind the `can_manage_customers` permission, which the owner sets
# per staff member (see PUT /staff/{id}). Owners always pass this check
# regardless of the permissions dict (see UserContext.has_permission).
_staff_or_owner = require_roles("owner", "staff")
_can_manage_customers = require_permission("can_manage_customers")


class CustomerCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
async def get_customers(
    ctx: UserContext = Depends(_staff_or_owner),
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    if not ctx.salon_id:
        return []

    result = supabase_client.rpc(
        "get_customers",
        {"p_salon_id": ctx.salon_id, "p_search": search, "p_limit": limit, "p_offset": offset},
    ).execute()

    return result.data if result.data else []


@router.post("/")
async def create_customer(customer_data: CustomerCreate, ctx: UserContext = Depends(_can_manage_customers)):
    if not ctx.salon_id:
        raise HTTPException(status_code=400, detail="No salon found")

    result = supabase_client.rpc(
        "upsert_customer",
        {
            "p_salon_id": ctx.salon_id,
            "p_full_name": customer_data.full_name,
            "p_email": customer_data.email,
            "p_phone": customer_data.phone,
            "p_address": customer_data.address,
            "p_notes": customer_data.notes,
        },
    ).execute()

    return result.data


@router.get("/{customer_id}")
async def get_customer(customer_id: str, ctx: UserContext = Depends(_staff_or_owner)):
    """Get a single customer by ID."""
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    result = supabase_client.rpc(
        "get_customers", {"p_salon_id": ctx.salon_id, "p_limit": 100}
    ).execute()

    if result.data:
        for customer in result.data:
            if customer.get("id") == customer_id:
                return customer

    raise HTTPException(status_code=404, detail="Customer not found")


@router.put("/{customer_id}")
async def update_customer(
    customer_id: str, customer_data: CustomerCreate, ctx: UserContext = Depends(_can_manage_customers)
):
    if not ctx.salon_id:
        raise HTTPException(status_code=400, detail="No salon found")

    result = supabase_client.rpc(
        "upsert_customer",
        {
            "p_salon_id": ctx.salon_id,
            "p_id": customer_id,
            "p_full_name": customer_data.full_name,
            "p_email": customer_data.email,
            "p_phone": customer_data.phone,
            "p_address": customer_data.address,
            "p_notes": customer_data.notes,
        },
    ).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Customer not found")

    return result.data


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, ctx: UserContext = Depends(_can_manage_customers)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    result = supabase_client.rpc(
        "delete_customer", {"p_salon_id": ctx.salon_id, "p_customer_id": customer_id}
    ).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {"message": "Customer deleted successfully"}
