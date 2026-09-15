from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.supabase_client import supabase_client
from app.core.auth_deps import require_roles, UserContext

router = APIRouter()


class SalonCreate(BaseModel):
    name: str
    address: str
    city: str
    phone: str
    email: str
    opening_time: str = "09:00:00"
    closing_time: str = "21:00:00"


@router.post("/setup")
async def create_salon(salon_data: SalonCreate, ctx: UserContext = Depends(require_roles("owner"))):
    """Create a salon for the authenticated owner."""
    existing = supabase_client.table("salons").select("id").eq("owner_id", ctx.user_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Salon already exists")

    salon_dict = salon_data.dict()
    salon_dict["owner_id"] = ctx.user_id

    response = supabase_client.table("salons").insert(salon_dict).execute()

    return {"message": "Salon created successfully", "salon": response.data[0] if response.data else None}


@router.get("/my-salon")
async def get_my_salon(ctx: UserContext = Depends(require_roles("owner"))):
    if not ctx.salon_id:
        return {"exists": False, "message": "No salon found"}

    response = supabase_client.table("salons").select("*").eq("id", ctx.salon_id).execute()
    if not response.data:
        return {"exists": False, "message": "No salon found"}

    return {"exists": True, "salon": response.data[0]}
