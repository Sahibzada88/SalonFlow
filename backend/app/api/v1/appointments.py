from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme
from app.core.helpers import get_user_salon_id  # ✅ New import


router = APIRouter()

class AppointmentCreate(BaseModel):
    customer_id: str
    title: Optional[str] = None
    date: str
    start_time: str
    end_time: str
    status: Optional[str] = "requested"  # ✅ Changed to 'requested'
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    customer_id: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    # ✅ New fields for reschedule
    new_date: Optional[str] = None
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None
    reschedule_reason: Optional[str] = None

# ============================================
# GET APPOINTMENTS
# ============================================
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
        
        salon_id = await get_user_salon_id(user.user.id)
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

# ============================================
# GET APPOINTMENTS BY CUSTOMER
# ============================================
@router.get("/by-customer/{customer_id}")
async def get_appointments_by_customer(
    customer_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get appointments for a specific customer"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_user_salon_id(user.user.id)
        if not salon_id:
            return []
        
        result = supabase_client.table("appointments")\
            .select("*, customers(full_name)")\
            .eq("salon_id", salon_id)\
            .eq("customer_id", customer_id)\
            .order("date", desc=True)\
            .order("start_time", desc=True)\
            .execute()
        
        appointments = []
        if result.data:
            for apt in result.data:
                customer = apt.get("customers", {})
                customer_name = customer.get("full_name") if customer else "Unknown"
                
                appointments.append({
                    "id": apt.get("id"),
                    "customer_name": customer_name,
                    "title": apt.get("title", "Service"),
                    "date": apt.get("date"),
                    "start_time": apt.get("start_time"),
                    "status": apt.get("status", "scheduled")
                })
        
        return appointments
        
    except Exception as e:
        print(f"Get appointments by customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# CREATE APPOINTMENT (Customer Requests)
# ============================================
# ============================================
# CREATE APPOINTMENT (Customer Requests)
# ============================================
@router.post("/")
async def create_appointment(appointment_data: AppointmentCreate, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        print(f"📝 Creating appointment for user: {user.user.id}")
        
        # Get salon_id using helper
        salon_id = await get_user_salon_id(user.user.id)
        print(f"🏪 Salon ID from helper: {salon_id}")
        
        # If helper returns None, try direct query
        if not salon_id:
            print("🔍 Trying direct customer query...")
            customer_direct = supabase_client.table("customers")\
                .select("salon_id")\
                .eq("id", user.user.id)\
                .execute()
            print(f"📊 Direct customer query: {customer_direct.data}")
            
            if customer_direct.data:
                salon_id = customer_direct.data[0].get("salon_id")
                print(f"✅ Found salon_id directly: {salon_id}")
        
        if not salon_id:
            print(f"❌ No salon found for user: {user.user.id}")
            raise HTTPException(status_code=400, detail="No salon found for this user")
        
        # Verify customer exists
        customer_check = supabase_client.table("customers")\
            .select("id")\
            .eq("id", appointment_data.customer_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not customer_check.data:
            print(f"❌ Customer not found: {appointment_data.customer_id}")
            raise HTTPException(status_code=400, detail="Customer not found in your salon")
        
        print(f"✅ Customer verified: {appointment_data.customer_id}")
        
        # Check double booking
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
            "request_appointment",
            {
                "p_salon_id": salon_id,
                "p_customer_id": appointment_data.customer_id,
                "p_title": appointment_data.title,
                "p_date": appointment_data.date,
                "p_start_time": appointment_data.start_time,
                "p_end_time": appointment_data.end_time,
                "p_notes": appointment_data.notes
            }
        ).execute()
        
        print(f"✅ Appointment created successfully")
        return result.data
        
    except Exception as e:
        print(f"❌ Create appointment error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# UPDATE APPOINTMENT
# ============================================
@router.put("/{appointment_id}")
async def update_appointment(appointment_id: str, appointment_data: AppointmentCreate, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_user_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=400, detail="No salon found")
        
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

# ============================================
# APPROVE APPOINTMENT (Staff Action)
# ============================================
@router.patch("/{appointment_id}/approve")
async def approve_appointment(
    appointment_id: str,
    approve_data: dict,  # { status: "approved" | "rescheduled", new_date, new_time, reason }
    token: str = Depends(oauth2_scheme)
):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_user_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=403, detail="Only staff can approve appointments")
        
        # Verify appointment belongs to salon
        apt_check = supabase_client.table("appointments")\
            .select("id")\
            .eq("id", appointment_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not apt_check.data:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # ✅ Use stored procedure
        result = supabase_client.rpc(
            "approve_appointment",
            {
                "p_appointment_id": appointment_id,
                "p_approved_by": user.user.id,
                "p_new_date": approve_data.get("new_date"),
                "p_new_start_time": approve_data.get("new_time"),
                "p_reschedule_reason": approve_data.get("reason")
            }
        ).execute()
        
        return result.data
        
    except Exception as e:
        print(f"Approve appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# CUSTOMER RESPOND TO RESCHEDULE
# ============================================
@router.patch("/{appointment_id}/respond")
async def customer_respond(
    appointment_id: str,
    response_data: dict,  # { accept: true/false }
    token: str = Depends(oauth2_scheme)
):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # ✅ Use stored procedure
        result = supabase_client.rpc(
            "customer_respond_reschedule",
            {
                "p_appointment_id": appointment_id,
                "p_accept": response_data.get("accept", False)
            }
        ).execute()
        
        return result.data
        
    except Exception as e:
        print(f"Customer respond error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# UPDATE APPOINTMENT STATUS
# ============================================
@router.patch("/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, status: str, token: str = Depends(oauth2_scheme)):
    try:
        valid_statuses = ["scheduled", "requested", "approved", "completed", "cancelled", "no-show", "rescheduled_pending"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status")
        
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_user_salon_id(user.user.id)
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

# ============================================
# GET SINGLE APPOINTMENT
# ============================================
@router.get("/{appointment_id}")
async def get_appointment(appointment_id: str, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        salon_id = await get_user_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Appointment not found")

        result = supabase_client.rpc(
            "get_appointments",
            {
                "p_salon_id": salon_id,
                "p_limit": 1
            }
        ).execute()
        
        if result.data:
            for apt in result.data:
                if apt.get("id") == appointment_id:
                    return apt
        
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    except Exception as e:
        print(f"Get appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# GET NOTIFICATIONS
# ============================================
@router.get("/notifications")
async def get_notifications(token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        result = supabase_client.table("notifications")\
            .select("*")\
            .eq("user_id", user.user.id)\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        print(f"Get notifications error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# MARK NOTIFICATION AS READ
# ============================================
@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    token: str = Depends(oauth2_scheme)
):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        result = supabase_client.table("notifications")\
            .update({"read": True})\
            .eq("id", notification_id)\
            .eq("user_id", user.user.id)\
            .execute()
        
        return {"message": "Notification marked as read"}
        
    except Exception as e:
        print(f"Mark notification read error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/customer/appointments")
async def get_customer_appointments(token: str = Depends(oauth2_scheme)):
    """Get appointments for the logged-in customer using stored procedure"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = user.user.id
        print(f"🔍 Getting appointments for customer: {user_id}")
        
        # Get customer record first
        customer = supabase_client.table("customers")\
            .select("id, salon_id")\
            .eq("id", user_id)\
            .execute()
        
        print(f"📊 Customer record: {customer.data}")
        
        if not customer.data:
            print("❌ No customer record found")
            return []
        
        customer_id = customer.data[0]["id"]
        salon_id = customer.data[0]["salon_id"]
        
        print(f"✅ Customer ID: {customer_id}, Salon ID: {salon_id}")
        
        # ✅ Use stored procedure with customer_id filter
        result = supabase_client.rpc(
            "get_appointments",
            {
                "p_salon_id": salon_id,
                "p_customer_id": customer_id,  # ✅ Filter by customer
                "p_limit": 100
            }
        ).execute()
        
        print(f"📊 Appointments found: {len(result.data) if result.data else 0}")
        print(f"📊 Appointment data: {result.data}")
        
        return result.data if result.data else []
        
    except Exception as e:
        print(f"❌ Get customer appointments error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{appointment_id}/approve")
async def approve_appointment(
    appointment_id: str,
    approve_data: dict,
    token: str = Depends(oauth2_scheme)
):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_user_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=403, detail="Only staff can approve appointments")
        
        # Verify appointment belongs to salon
        apt_check = supabase_client.table("appointments")\
            .select("id, customer_id, title, date, start_time, end_time")\
            .eq("id", appointment_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not apt_check.data:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        apt_data = apt_check.data[0]
        
        # Approve appointment
        result = supabase_client.rpc(
            "approve_appointment",
            {
                "p_appointment_id": appointment_id,
                "p_approved_by": user.user.id,
                "p_new_date": approve_data.get("new_date"),
                "p_new_start_time": approve_data.get("new_time"),
                "p_reschedule_reason": approve_data.get("reason")
            }
        ).execute()
        
        # ✅ Return appointment details for redirection
        return {
            "message": "Appointment approved successfully",
            "appointment": result.data,
            "redirect": {
                "url": f"/dashboard/billing/new?appointment_id={appointment_id}&customer_id={apt_data['customer_id']}",
                "customer_id": apt_data["customer_id"],
                "appointment_id": appointment_id,
                "title": apt_data.get("title", "Service"),
                "date": apt_data.get("date"),
                "start_time": apt_data.get("start_time"),
                "end_time": apt_data.get("end_time")
            }
        }
        
    except Exception as e:
        print(f"Approve appointment error: {e}")
        raise HTTPException(status_code=400, detail=str(e))