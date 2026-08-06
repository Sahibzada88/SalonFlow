from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme

router = APIRouter()

# ========== Pydantic Schemas ==========

class AppointmentCreate(BaseModel):
    customer_id: str
    staff_id: Optional[str] = None
    service_id: Optional[str] = None
    title: Optional[str] = None
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    customer_id: Optional[str] = None
    staff_id: Optional[str] = None
    service_id: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: str
    salon_id: str
    customer_id: str
    staff_id: Optional[str]
    service_id: Optional[str]
    title: Optional[str]
    date: str
    start_time: str
    end_time: str
    status: str
    notes: Optional[str]
    created_at: str
    customer_name: Optional[str] = None
    service_name: Optional[str] = None

# ========== Helper Function ==========

async def get_salon_id(user_id: str):
    """Get salon ID for the authenticated user"""
    response = supabase_client.table("salons")\
        .select("id")\
        .eq("owner_id", user_id)\
        .execute()
    
    if not response.data:
        return None
    return response.data[0]["id"]

async def get_customer_name(customer_id: str):
    """Get customer name by ID"""
    try:
        response = supabase_client.table("customers")\
            .select("full_name")\
            .eq("id", customer_id)\
            .execute()
        if response.data:
            return response.data[0]["full_name"]
        return None
    except:
        return None

async def get_service_name(service_id: str):
    """Get service name by ID"""
    if not service_id:
        return None
    try:
        response = supabase_client.table("services")\
            .select("name")\
            .eq("id", service_id)\
            .execute()
        if response.data:
            return response.data[0]["name"]
        return None
    except:
        return None

# ========== CRUD Endpoints ==========

@router.post("/", response_model=AppointmentResponse)
async def create_appointment(
    appointment_data: AppointmentCreate,
    token: str = Depends(oauth2_scheme)
):
    """Create a new appointment"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=400, detail="No salon found. Please set up your salon first.")
        
        # Check if customer exists
        customer_check = supabase_client.table("customers")\
            .select("id")\
            .eq("id", appointment_data.customer_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not customer_check.data:
            raise HTTPException(status_code=400, detail="Customer not found in your salon")
        
        # Create appointment
        appointment_dict = appointment_data.dict()
        appointment_dict["salon_id"] = salon_id
        
        response = supabase_client.table("appointments").insert(appointment_dict).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create appointment")
        
        result = response.data[0]
        
        # Get customer and service names
        customer_name = await get_customer_name(result["customer_id"])
        service_name = await get_service_name(result.get("service_id"))
        
        return {
            **result,
            "customer_name": customer_name,
            "service_name": service_name
        }
        
    except Exception as e:
        print(f"Create appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[AppointmentResponse])
async def get_appointments(
    token: str = Depends(oauth2_scheme),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=500)
):
    """Get appointments for the authenticated user's salon"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            return []
        
        # Build query
        query = supabase_client.table("appointments")\
            .select("*")\
            .eq("salon_id", salon_id)\
            .order("date", desc=False)\
            .order("start_time", desc=False)
        
        # Add filters
        if start_date:
            query = query.gte("date", start_date)
        if end_date:
            query = query.lte("date", end_date)
        if status:
            query = query.eq("status", status)
        
        # Add limit
        query = query.limit(limit)
        
        response = query.execute()
        results = response.data if response.data else []
        
        # Enrich with customer and service names
        enriched_results = []
        for item in results:
            customer_name = await get_customer_name(item["customer_id"])
            service_name = await get_service_name(item.get("service_id"))
            enriched_results.append({
                **item,
                "customer_name": customer_name,
                "service_name": service_name
            })
        
        return enriched_results
        
    except Exception as e:
        print(f"Get appointments error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/today")
async def get_today_appointments(
    token: str = Depends(oauth2_scheme)
):
    """Get today's appointments"""
    try:
        today = date.today().isoformat()
        
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            return []
        
        response = supabase_client.table("appointments")\
            .select("*")\
            .eq("salon_id", salon_id)\
            .eq("date", today)\
            .order("start_time")\
            .execute()
        
        results = response.data if response.data else []
        
        # Enrich with customer and service names
        enriched_results = []
        for item in results:
            customer_name = await get_customer_name(item["customer_id"])
            service_name = await get_service_name(item.get("service_id"))
            enriched_results.append({
                **item,
                "customer_name": customer_name,
                "service_name": service_name
            })
        
        return enriched_results
        
    except Exception as e:
        print(f"Get today appointments error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get a single appointment by ID"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        response = supabase_client.table("appointments")\
            .select("*")\
            .eq("id", appointment_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        result = response.data[0]
        
        # Get customer and service names
        customer_name = await get_customer_name(result["customer_id"])
        service_name = await get_service_name(result.get("service_id"))
        
        return {
            **result,
            "customer_name": customer_name,
            "service_name": service_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str,
    appointment_data: AppointmentUpdate,
    token: str = Depends(oauth2_scheme)
):
    """Update an appointment"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Check if appointment exists
        check = supabase_client.table("appointments")\
            .select("*")\
            .eq("id", appointment_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not check.data:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Update appointment
        update_data = {k: v for k, v in appointment_data.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        response = supabase_client.table("appointments")\
            .update(update_data)\
            .eq("id", appointment_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to update appointment")
        
        result = response.data[0]
        
        # Get customer and service names
        customer_name = await get_customer_name(result["customer_id"])
        service_name = await get_service_name(result.get("service_id"))
        
        return {
            **result,
            "customer_name": customer_name,
            "service_name": service_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    status: str,
    token: str = Depends(oauth2_scheme)
):
    """Update appointment status (scheduled, completed, cancelled, no-show)"""
    try:
        valid_statuses = ["scheduled", "completed", "cancelled", "no-show"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Update status
        response = supabase_client.table("appointments")\
            .update({"status": status})\
            .eq("id", appointment_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        return {"message": f"Appointment status updated to {status}"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update appointment status error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{appointment_id}")
async def delete_appointment(
    appointment_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Delete an appointment"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Check if appointment exists
        check = supabase_client.table("appointments")\
            .select("*")\
            .eq("id", appointment_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not check.data:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Delete appointment
        supabase_client.table("appointments")\
            .delete()\
            .eq("id", appointment_id)\
            .execute()
        
        return {"message": "Appointment deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))