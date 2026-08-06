from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme

router = APIRouter()

# ========== Pydantic Schemas ==========

class CustomerCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    salon_id: str
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    total_visits: int
    total_spent: int
    last_visit: Optional[date]
    created_at: str

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

# ========== CRUD Endpoints ==========

@router.post("/", response_model=CustomerResponse)
async def create_customer(
    customer_data: CustomerCreate, 
    token: str = Depends(oauth2_scheme)
):
    """Create a new customer"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=400, detail="No salon found. Please set up your salon first.")
        
        # Check if customer with same email exists
        if customer_data.email:
            existing = supabase_client.table("customers")\
                .select("*")\
                .eq("salon_id", salon_id)\
                .eq("email", customer_data.email)\
                .execute()
            
            if existing.data:
                raise HTTPException(status_code=400, detail="Customer with this email already exists")
        
        # Create customer
        customer_dict = customer_data.dict()
        customer_dict["salon_id"] = salon_id
        
        response = supabase_client.table("customers").insert(customer_dict).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create customer")
        
        return response.data[0]
        
    except Exception as e:
        print(f"Create customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[CustomerResponse])
async def get_customers(
    token: str = Depends(oauth2_scheme),
    search: Optional[str] = Query(None, description="Search by name or email"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get all customers for the authenticated user's salon"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            return []  # Return empty list if no salon
        
        # Build query
        query = supabase_client.table("customers")\
            .select("*")\
            .eq("salon_id", salon_id)\
            .order("full_name")
        
        # Add search filter
        if search:
            query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")
        
        # Add pagination
        query = query.range(offset, offset + limit - 1)
        
        response = query.execute()
        return response.data if response.data else []
        
    except Exception as e:
        print(f"Get customers error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get a single customer by ID"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get customer
        response = supabase_client.table("customers")\
            .select("*")\
            .eq("id", customer_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    token: str = Depends(oauth2_scheme)
):
    """Update a customer"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Check if customer exists
        check = supabase_client.table("customers")\
            .select("*")\
            .eq("id", customer_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not check.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Update customer
        update_data = {k: v for k, v in customer_data.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        response = supabase_client.table("customers")\
            .update(update_data)\
            .eq("id", customer_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to update customer")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Delete a customer"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Check if customer exists
        check = supabase_client.table("customers")\
            .select("*")\
            .eq("id", customer_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not check.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Delete customer
        response = supabase_client.table("customers")\
            .delete()\
            .eq("id", customer_id)\
            .execute()
        
        return {"message": "Customer deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{customer_id}/stats")
async def get_customer_stats(
    customer_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get statistics for a specific customer"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get customer
        response = supabase_client.table("customers")\
            .select("*")\
            .eq("id", customer_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer = response.data[0]
        
        # Get appointment history (if appointments table exists)
        try:
            appointments = supabase_client.table("appointments")\
                .select("*")\
                .eq("customer_id", customer_id)\
                .order("date", desc=True)\
                .limit(5)\
                .execute()
            recent_appointments = appointments.data if appointments.data else []
        except:
            recent_appointments = []
        
        return {
            "customer": customer,
            "recent_appointments": recent_appointments,
            "total_visits": customer.get("total_visits", 0),
            "total_spent": customer.get("total_spent", 0)
        }
        
    except Exception as e:
        print(f"Get customer stats error: {e}")
        raise HTTPException(status_code=400, detail=str(e))