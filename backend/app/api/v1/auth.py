from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.security import create_access_token
from app.core.supabase_client import supabase_client
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Pydantic schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "owner"

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str]
    role: str
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register")
async def register_user(user_data: UserCreate):
    try:
        # 1. Create user in Supabase Auth
        auth_response = supabase_client.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "full_name": user_data.full_name,
                    "phone": user_data.phone,
                    "role": user_data.role
                }
            }
        })
        
        if auth_response.user is None:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        # 2. Direct insert into users table
        user_data_dict = {
            "id": auth_response.user.id,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "phone": user_data.phone,
            "role": user_data.role,
            "is_active": True
        }
        
        # Try to insert, ignore if already exists
        try:
            supabase_client.table("users").insert(user_data_dict).execute()
        except Exception as insert_error:
            print(f"User insert error (may already exist): {insert_error}")
            # Check if user already exists
            check = supabase_client.table("users")\
                .select("*")\
                .eq("id", auth_response.user.id)\
                .execute()
            if not check.data:
                raise HTTPException(status_code=400, detail="Failed to create user record")
        
        return {
            "message": "User registered successfully",
            "user_id": auth_response.user.id
        }
        
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login user with Supabase Auth - returns Supabase session token"""
    try:
        # Authenticate with Supabase
        auth_response = supabase_client.auth.sign_in_with_password({
            "email": form_data.username,
            "password": form_data.password
        })
        
        if auth_response.session is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Return Supabase's native access token
        return {
            "access_token": auth_response.session.access_token,
            "token_type": "bearer"
        }
        
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/logout")
async def logout():
    """Logout user"""
    try:
        supabase_client.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/me")
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user info"""
    try:
        # Get user from Supabase
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get additional user data
        user_data = supabase_client.table("users")\
            .select("*")\
            .eq("id", user.user.id)\
            .execute()
        
        if user_data.data:
            return user_data.data[0]
        return {"email": user.user.email, "id": user.user.id}
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))