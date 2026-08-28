from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timedelta
import re
import random
import string
from app.core.config import settings
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.supabase_client import supabase_client

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# ========== Schemas ==========

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "customer"
    username: Optional[str] = None

class StaffCreate(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    position: Optional[str] = None
    permissions: Optional[dict] = None
    username: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    full_name: str
    phone: Optional[str] = None
    role: str
    is_owner: bool = False
    is_staff: bool = False
    is_customer: bool = False
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    confirmed_at: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: str
    username: Optional[str] = None
    email: str

# ========== Helper Functions ==========

def generate_username(full_name: str) -> str:
    name_parts = full_name.strip().lower().split()
    if len(name_parts) >= 2:
        username = f"{name_parts[0]}.{name_parts[-1]}"
    else:
        username = name_parts[0]
    username = re.sub(r'[^a-z0-9.]', '', username)
    return username

async def generate_unique_username(base_username: str) -> str:
    username = base_username
    counter = 1
    while True:
        check = supabase_client.table("users")\
            .select("id")\
            .eq("username", username)\
            .execute()
        if not check.data:
            return username
        username = f"{base_username}{counter}"
        counter += 1

async def get_salon_id(user_id: str):
    response = supabase_client.table("salons")\
        .select("id")\
        .eq("owner_id", user_id)\
        .execute()
    if not response.data:
        return None
    return response.data[0]["id"]

# ============================================
# CUSTOMER REGISTRATION
# ============================================
@router.post("/register-customer")
async def register_customer(user_data: UserCreate):
    try:
        if user_data.role != "customer":
            raise HTTPException(status_code=400, detail="Only customer registration is allowed")
        
        username = user_data.username or generate_username(user_data.full_name)
        username = await generate_unique_username(username)
        
        salon_response = supabase_client.table("salons")\
            .select("id")\
            .limit(1)\
            .execute()
        
        salon_id = salon_response.data[0]["id"] if salon_response.data else None
        
        if not salon_id:
            raise HTTPException(status_code=400, detail="No salon available")
        
        auth_response = supabase_client.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "full_name": user_data.full_name,
                    "phone": user_data.phone,
                    "role": "customer",
                    "username": username,
                    "salon_id": salon_id,
                    "is_customer": True,
                    "is_staff": False,
                    "is_owner": False
                }
            }
        })
        
        if auth_response.user is None:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        user_id = auth_response.user.id
        
        user_dict = {
            "id": user_id,
            "email": user_data.email,
            "username": username,
            "full_name": user_data.full_name,
            "phone": user_data.phone,
            "role": "customer",
            "is_owner": False,
            "is_staff": False,
            "is_customer": True,
            "is_active": True
        }
        supabase_client.table("users").insert(user_dict).execute()
        
        customer_data = {
            "id": user_id,
            "salon_id": salon_id,
            "full_name": user_data.full_name,
            "email": user_data.email,
            "phone": user_data.phone,
            "total_visits": 0,
            "total_spent": 0
        }
        supabase_client.table("customers").insert(customer_data).execute()
        
        return {
            "message": "Customer registered successfully",
            "user_id": user_id,
            "username": username
        }
        
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# STAFF CREATION (Only Owner)
# ============================================
@router.post("/staff")
async def create_staff(staff_data: StaffCreate, token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_check = supabase_client.table("users")\
            .select("is_owner, role")\
            .eq("id", user.user.id)\
            .execute()
        
        if not user_check.data or not user_check.data[0].get("is_owner"):
            raise HTTPException(status_code=403, detail="Only owner can create staff")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=400, detail="No salon found")
        
        existing_user = supabase_client.table("users")\
            .select("id, email, is_active")\
            .eq("email", staff_data.email)\
            .execute()
        
        if existing_user.data:
            if not existing_user.data[0].get("is_active", True):
                user_id = existing_user.data[0]["id"]
                supabase_client.table("users")\
                    .update({
                        "is_active": True,
                        "role": "staff",
                        "is_staff": True,
                        "is_customer": False,
                        "is_owner": False,
                        "full_name": staff_data.full_name,
                        "phone": staff_data.phone
                    })\
                    .eq("id", user_id)\
                    .execute()
                
                staff_record = {
                    "user_id": user_id,
                    "salon_id": salon_id,
                    "position": staff_data.position,
                    "permissions": staff_data.permissions or {"can_book": True, "can_approve": True, "can_bill": True},
                    "created_by": user.user.id
                }
                supabase_client.table("staff").insert(staff_record).execute()
                
                return {
                    "message": "Staff reactivated successfully",
                    "staff_id": user_id,
                    "username": existing_user.data[0].get("username", staff_data.email.split('@')[0]),
                    "email": staff_data.email
                }
            else:
                raise HTTPException(status_code=400, detail=f"User with email {staff_data.email} already exists")
        
        username = staff_data.username or generate_username(staff_data.full_name)
        username = await generate_unique_username(username)
        
        temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
        
        # ✅ FIX: Use admin API to create user WITHOUT sending email
        try:
            auth_response = supabase_client.auth.admin.create_user({
                "email": staff_data.email,
                "password": temp_password,
                "email_confirm": True,  # Auto-confirm, no email sent
                "user_metadata": {
                    "full_name": staff_data.full_name,
                    "phone": staff_data.phone,
                    "role": "staff",
                    "username": username,
                    "is_staff": True,
                    "is_customer": False,
                    "is_owner": False,
                    "created_by": user.user.id
                }
            })
        except Exception as e:
            # Fallback: regular signup with email_confirm False
            auth_response = supabase_client.auth.sign_up({
                "email": staff_data.email,
                "password": temp_password,
                "options": {
                    "data": {
                        "full_name": staff_data.full_name,
                        "phone": staff_data.phone,
                        "role": "staff",
                        "username": username,
                        "is_staff": True,
                        "is_customer": False,
                        "is_owner": False,
                        "created_by": user.user.id
                    },
                    "email_confirm": False
                }
            })
        
        if auth_response.user is None:
            raise HTTPException(status_code=400, detail="Failed to create staff")
        
        staff_id = auth_response.user.id
        
        staff_dict = {
            "id": staff_id,
            "email": staff_data.email,
            "username": username,
            "full_name": staff_data.full_name,
            "phone": staff_data.phone,
            "role": "staff",
            "is_owner": False,
            "is_staff": True,
            "is_customer": False,
            "created_by": user.user.id,
            "is_active": True
        }
        supabase_client.table("users").insert(staff_dict).execute()
        
        staff_record = {
            "user_id": staff_id,
            "salon_id": salon_id,
            "position": staff_data.position,
            "permissions": staff_data.permissions or {"can_book": True, "can_approve": True, "can_bill": True},
            "created_by": user.user.id
        }
        supabase_client.table("staff").insert(staff_record).execute()
        
        return {
            "message": "Staff created successfully. No email confirmation needed.",
            "staff_id": staff_id,
            "username": username,
            "email": staff_data.email,
            "temporary_password": temp_password
        }
        
    except Exception as e:
        print(f"Staff creation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============================================
# LOGIN
# ============================================
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        login_input = form_data.username
        password = form_data.password
        
        is_email = '@' in login_input
        
        if is_email:
            user_check = supabase_client.table("users")\
                .select("id, email, username, role, is_owner, is_staff, is_customer, is_active")\
                .eq("email", login_input)\
                .execute()
        else:
            user_check = supabase_client.table("users")\
                .select("id, email, username, role, is_owner, is_staff, is_customer, is_active")\
                .eq("username", login_input)\
                .execute()
        
        if not user_check.data:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user_data = user_check.data[0]
        
        if not user_data.get("is_active", True):
            raise HTTPException(status_code=401, detail="Account is deactivated")
        
        auth_response = supabase_client.auth.sign_in_with_password({
            "email": user_data["email"],
            "password": password
        })
        
        if auth_response.session is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        role = user_data.get("role", "customer")
        
        return {
            "access_token": auth_response.session.access_token,
            "token_type": "bearer",
            "role": role,
            "user_id": user_data["id"],
            "username": user_data.get("username", ""),
            "email": user_data["email"]
        }
        
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=401, detail=str(e))

# ============================================
# GET CURRENT USER
# ============================================
@router.get("/me", response_model=UserResponse)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = supabase_client.table("users")\
            .select("*")\
            .eq("id", user.user.id)\
            .execute()
        
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user_data.data[0]
        
    except Exception as e:
        print(f"Get user error: {e}")
        raise HTTPException(status_code=401, detail=str(e))