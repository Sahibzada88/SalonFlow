from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme

router = APIRouter()

class CustomerCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

# ============================================
# GET ALL CUSTOMERS
# ============================================
@router.get("/")
async def get_customers(
    token: str = Depends(oauth2_scheme),
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_response = supabase_client.table("salons")\
            .select("id")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if not salon_response.data:
            return []
        
        salon_id = salon_response.data[0]["id"]
        
        result = supabase_client.rpc(
            "get_customers",
            {
                "p_salon_id": salon_id,
                "p_search": search,
                "p_limit": limit,
                "p_offset": offset
            }
        ).execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        print(f"Get customers error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# CREATE CUSTOMER
# ============================================
@router.post("/")
async def create_customer(customer_data: CustomerCreate, token: str = Depends(oauth2_scheme)):
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
            "upsert_customer",
            {
                "p_salon_id": salon_id,
                "p_full_name": customer_data.full_name,
                "p_email": customer_data.email,
                "p_phone": customer_data.phone,
                "p_address": customer_data.address,
                "p_notes": customer_data.notes
            }
        ).execute()
        
        return result.data
        
    except Exception as e:
        print(f"Create customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# GET SINGLE CUSTOMER (FIXED)
# ============================================
@router.get("/{customer_id}")
async def get_customer(customer_id: str, token: str = Depends(oauth2_scheme)):
    """Get a single customer by ID"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_response = supabase_client.table("salons")\
            .select("id")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if not salon_response.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        salon_id = salon_response.data[0]["id"]
        
        # Use the stored procedure to get all customers and filter by ID
        result = supabase_client.rpc(
            "get_customers",
            {
                "p_salon_id": salon_id,
                "p_limit": 100
            }
        ).execute()
        
        # Find the customer by ID
        if result.data:
            for customer in result.data:
                if customer.get("id") == customer_id:
                    return customer
        
        raise HTTPException(status_code=404, detail="Customer not found")
        
    except Exception as e:
        print(f"Get customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# UPDATE CUSTOMER
# ============================================
@router.put("/{customer_id}")
async def update_customer(customer_id: str, customer_data: CustomerCreate, token: str = Depends(oauth2_scheme)):
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
            "upsert_customer",
            {
                "p_salon_id": salon_id,
                "p_id": customer_id,
                "p_full_name": customer_data.full_name,
                "p_email": customer_data.email,
                "p_phone": customer_data.phone,
                "p_address": customer_data.address,
                "p_notes": customer_data.notes
            }
        ).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return result.data
        
    except Exception as e:
        print(f"Update customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# DELETE CUSTOMER
# ============================================
@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_response = supabase_client.table("salons")\
            .select("id")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if not salon_response.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        salon_id = salon_response.data[0]["id"]
        
        result = supabase_client.rpc(
            "delete_customer",
            {
                "p_salon_id": salon_id,
                "p_customer_id": customer_id
            }
        ).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"message": "Customer deleted successfully"}
        
    except Exception as e:
        print(f"Delete customer error: {e}")
        raise HTTPException(status_code=400, detail=str(e))