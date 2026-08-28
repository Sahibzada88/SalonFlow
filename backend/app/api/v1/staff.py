from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme
from app.core.helpers import get_user_salon_id

router = APIRouter()

@router.get("/")
async def get_staff(token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_user_salon_id(user.user.id)
        if not salon_id:
            return []
        
        # Get staff records
        staff_result = supabase_client.table("staff")\
            .select("*")\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not staff_result.data:
            return []
        
        # Get user details for each staff member
        staff_list = []
        for s in staff_result.data:
            user_result = supabase_client.table("users")\
                .select("id, email, username, full_name, phone, is_active")\
                .eq("id", s["user_id"])\
                .execute()
            
            if user_result.data:
                user_data = user_result.data[0]
                staff_list.append({
                    "id": s["id"],
                    "user_id": s["user_id"],
                    "full_name": user_data.get("full_name", ""),
                    "email": user_data.get("email", ""),
                    "username": user_data.get("username", ""),
                    "phone": user_data.get("phone", ""),
                    "position": s.get("position", ""),
                    "is_active": user_data.get("is_active", True),
                    "created_at": s.get("created_at", "")
                })
        
        return staff_list
        
    except Exception as e:
        print(f"Get staff error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{staff_id}")
async def delete_staff(staff_id: str, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_user_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        staff_check = supabase_client.table("staff")\
            .select("user_id")\
            .eq("id", staff_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not staff_check.data:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        user_id = staff_check.data[0]["user_id"]
        
        supabase_client.table("staff")\
            .delete()\
            .eq("id", staff_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        supabase_client.table("users")\
            .update({"is_active": False})\
            .eq("id", user_id)\
            .execute()
        
        return {"message": "Staff deleted successfully"}
        
    except Exception as e:
        print(f"Delete staff error: {e}")
        raise HTTPException(status_code=400, detail=str(e))