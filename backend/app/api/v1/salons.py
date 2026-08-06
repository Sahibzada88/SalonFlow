from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import time
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme

router = APIRouter()

class SalonCreate(BaseModel):
    name: str
    address: str
    city: str
    phone: str
    email: str
    opening_time: str = "09:00:00"
    closing_time: str = "21:00:00"

class SalonResponse(BaseModel):
    id: str
    name: str
    address: str
    city: str
    phone: str
    email: str
    opening_time: str
    closing_time: str
    owner_id: str
    is_active: bool

@router.post("/setup")
async def create_salon(salon_data: SalonCreate, token: str = Depends(oauth2_scheme)):
    """Create a salon for the authenticated user"""
    try:
        # Get user from token
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if salon already exists
        existing = supabase_client.table("salons")\
            .select("*")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if existing.data:
            raise HTTPException(status_code=400, detail="Salon already exists")
        
        # Create salon
        salon_dict = salon_data.dict()
        salon_dict["owner_id"] = user.user.id
        
        response = supabase_client.table("salons").insert(salon_dict).execute()
        
        return {
            "message": "Salon created successfully",
            "salon": response.data[0] if response.data else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/my-salon")
async def get_my_salon(token: str = Depends(oauth2_scheme)):
    """Get the authenticated user's salon"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        response = supabase_client.table("salons")\
            .select("*")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if not response.data:
            return {"exists": False, "message": "No salon found"}
        
        return {"exists": True, "salon": response.data[0]}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))