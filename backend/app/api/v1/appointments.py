from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme
from app.api.v1.billing import get_salon_id

router = APIRouter()

class AppointmentCreate(BaseModel):
    customer_id: str
    title: Optional[str] = None
    date: str
    start_time: str
    end_time: str
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None

@router.get("/")
async def get_appointments(
    token: str = Depends(oauth2_scheme),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            return []
        
        result = supabase_client.rpc(
            "get_appointments",
            {
                "p_salon_id": salon_id,
                "p_start_date": start_date,
                "p_end_date": end_date,
                "p_status": status,
                "p_limit": limit
            }
        ).execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        print(f"Get appointments error: {e}")
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/")
async def create_appointment(appointment_data: AppointmentCreate, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_response = supabase_client.table("salons")\
            .select("id")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if not salon_response.data:
            raise HTTPException(status_code=400, detail="No salon found")
        
        salon_id = salon_response.data[0]["id"]
        
        # ===== VALIDATION: Customer must exist =====
        customer_check = supabase_client.table("customers")\
            .select("id")\
            .eq("id", appointment_data.customer_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not customer_check.data:
            raise HTTPException(status_code=400, detail="Customer not found in your salon")
        
        # ===== VALIDATION: Check for double booking =====
        conflict_check = supabase_client.table("appointments")\
            .select("id")\
            .eq("salon_id", salon_id)\
            .eq("date", appointment_data.date)\
            .eq("start_time", appointment_data.start_time)\
            .eq("status", "scheduled")\
            .execute()
        
        if conflict_check.data:
            raise HTTPException(status_code=400, detail="Time slot already booked")
        
        # Create appointment
        result = supabase_client.rpc(
            "upsert_appointment",
            {
                "p_salon_id": salon_id,
                "p_customer_id": appointment_data.customer_id,
                "p_title": appointment_data.title,
                "p_date": appointment_data.date,
                "p_start_time": appointment_data.start_time,
                "p_end_time": appointment_data.end_time,
                "p_status": appointment_data.status,
                "p_notes": appointment_data.notes
            }
        ).execute()
        
        return result.data
        
    except Exception as e:
        print(f"Create appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))




@router.put("/{appointment_id}")
async def update_appointment(appointment_id: str, appointment_data: AppointmentCreate, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_response = supabase_client.table("salons")\
            .select("id")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if not salon_response.data:
            raise HTTPException(status_code=400, detail="No salon found")
        
        salon_id = salon_response.data[0]["id"]
        
        result = supabase_client.rpc(
            "upsert_appointment",
            {
                "p_salon_id": salon_id,
                "p_id": appointment_id,
                "p_customer_id": appointment_data.customer_id,
                "p_title": appointment_data.title,
                "p_date": appointment_data.date,
                "p_start_time": appointment_data.start_time,
                "p_end_time": appointment_data.end_time,
                "p_status": appointment_data.status,
                "p_notes": appointment_data.notes
            }
        ).execute()
        
        return result.data
        
    except Exception as e:
        print(f"Update appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, status: str, token: str = Depends(oauth2_scheme)):
    try:
        valid_statuses = ["scheduled", "completed", "cancelled", "no-show"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status")
        
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        result = supabase_client.rpc(
            "update_appointment_status",
            {
                "p_salon_id": salon_id,
                "p_appointment_id": appointment_id,
                "p_status": status
            }
        ).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        return {"message": f"Status updated to {status}", "appointment": result.data}
        
    except Exception as e:
        print(f"Update status error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{appointment_id}")
async def get_appointment(appointment_id: str, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Appointment not found")

        result = supabase_client.rpc(
            "get_appointments",
            {
                "p_salon_id": salon_id,
                "p_limit": 1
            }
        ).execute()
        
        # Filter by id manually (or create a dedicated function)
        if result.data:
            for apt in result.data:
                if apt.get("id") == appointment_id:
                    return apt
        
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    except Exception as e:
        print(f"Get appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))