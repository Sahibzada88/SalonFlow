import re
import secrets
import string
import time
from typing import Optional, Dict

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from app.core.supabase_client import supabase_client, get_auth_client
from app.core.auth_deps import get_current_user, require_roles, UserContext
from app.core.logging_config import get_logger
from app.core.config import settings

router = APIRouter()
logger = get_logger(__name__)

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
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class Token(BaseModel):
    # NOTE: access_token is intentionally NOT part of this response anymore.
    # It's set as an httpOnly cookie instead (see login() below), so
    # client-side JavaScript never has access to it at all - this closes
    # the localStorage-token-theft-via-XSS gap from the original app.
    token_type: str
    role: str
    user_id: str
    username: Optional[str] = None
    email: str


def _set_session_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=access_token,
        max_age=settings.COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )


# ========== Helper Functions ==========


def generate_username(full_name: str) -> str:
    name_parts = full_name.strip().lower().split()
    if len(name_parts) >= 2:
        username = f"{name_parts[0]}.{name_parts[-1]}"
    else:
        username = name_parts[0] if name_parts else "user"
    username = re.sub(r"[^a-z0-9.]", "", username)
    return username or "user"


async def generate_unique_username(base_username: str) -> str:
    username = base_username
    counter = 1
    while True:
        check = supabase_client.table("users").select("id").eq("username", username).execute()
        if not check.data:
            return username
        username = f"{base_username}{counter}"
        counter += 1


def generate_secure_temp_password(length: int = 14) -> str:
    """Generate a cryptographically secure temporary password.

    The original code used `random.choices(...)`, which is NOT
    cryptographically secure (it's a Mersenne Twister PRNG, predictable
    given enough output) and is unsuitable for generating anything
    security-sensitive like a password. `secrets` is the correct module for
    this - it uses the OS's CSPRNG.
    """
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------------------------------------------------------------------------
# Very small in-memory login rate limiter.
#
# This is intentionally simple: it is NOT distributed-safe (each backend
# process/instance has its own counters, so it won't help behind multiple
# server instances) and resets on redeploy. It exists to stop the most
# trivial single-process brute-force attempts; for real protection, put this
# behind a proper rate limiter (e.g. Redis-backed, or your reverse proxy /
# API gateway / Supabase Auth's own rate limits).
# ---------------------------------------------------------------------------
_LOGIN_ATTEMPTS: Dict[str, list] = {}
_MAX_ATTEMPTS = 5
_WINDOW_SECONDS = 60


def _check_rate_limit(key: str) -> None:
    now = time.time()
    attempts = [t for t in _LOGIN_ATTEMPTS.get(key, []) if now - t < _WINDOW_SECONDS]
    if len(attempts) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait a minute and try again.",
        )
    attempts.append(now)
    _LOGIN_ATTEMPTS[key] = attempts


# ============================================
# CUSTOMER REGISTRATION (public, self-service)
# ============================================
@router.post("/register-customer")
async def register_customer(user_data: UserCreate):
    if user_data.role != "customer":
        # Prevents someone from POSTing {"role": "owner"} to self-elevate.
        raise HTTPException(status_code=400, detail="Only customer registration is allowed here")

    username = user_data.username or generate_username(user_data.full_name)
    username = await generate_unique_username(username)

    # This deployment serves exactly one salon. Check that the owner has
    # actually set it up yet (a friendlier error than letting the DB
    # trigger silently leave salon_id null) - beyond that, no salon_id
    # needs to be looked up or passed anywhere below: the
    # assign_single_salon() trigger on the customers table fills it in
    # automatically (see database/01_fresh_schema.sql).
    salon_response = supabase_client.table("salons").select("id").limit(1).execute()
    if not salon_response.data:
        raise HTTPException(status_code=400, detail="This salon hasn't finished setting up yet")

    try:
        # CRITICAL: must use a fresh get_auth_client() here, never the
        # shared service-role `supabase_client` - see the warning in
        # supabase_client.py. Using the shared client here was a real bug:
        # this call would silently switch that client's Authorization
        # header to the new customer's session token, so the
        # `public.users`/`public.customers` inserts a few lines below
        # (which need service-role privileges to bypass RLS) would start
        # running as that customer instead and get rejected by RLS.
        auth_response = get_auth_client().auth.sign_up(
            {
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {
                        "full_name": user_data.full_name,
                        "phone": user_data.phone,
                        "role": "customer",
                        "username": username,
                    }
                },
            }
        )
    except Exception as e:
        logger.warning("Customer sign_up failed for %s: %s", user_data.email, e)
        raise HTTPException(status_code=400, detail="Could not register this account")

    if auth_response.user is None:
        raise HTTPException(status_code=400, detail="Registration failed")

    user_id = auth_response.user.id

    # Note: the handle_new_user DB trigger already inserts the
    # public.users row on auth.users INSERT. We still upsert here
    # defensively in case the trigger's defaults don't match what we want
    # (e.g. username, which the trigger doesn't know about).
    supabase_client.table("users").upsert(
        {
            "id": user_id,
            "email": user_data.email,
            "username": username,
            "full_name": user_data.full_name,
            "phone": user_data.phone,
            "role": "customer",
            "is_active": True,
        }
    ).execute()

    # salon_id is intentionally omitted - assign_single_salon() fills it
    # in automatically since there's only ever one salon to assign.
    supabase_client.table("customers").upsert(
        {
            "id": user_id,
            "full_name": user_data.full_name,
            "email": user_data.email,
            "phone": user_data.phone,
            "total_visits": 0,
            "total_spent": 0,
        }
    ).execute()

    return {"message": "Customer registered successfully", "user_id": user_id, "username": username}


# ============================================
# STAFF CREATION - owner only.
#
# Fixed: previously this endpoint manually checked `is_owner` inline; now
# it's enforced declaratively via require_roles("owner") so it's impossible
# to add a new staff-related route later and forget the check.
# ============================================
@router.post("/staff")
async def create_staff(staff_data: StaffCreate, ctx: UserContext = Depends(require_roles("owner"))):
    if not ctx.salon_id:
        raise HTTPException(status_code=400, detail="Set up your salon before adding staff")

    salon_id = ctx.salon_id

    existing_user = (
        supabase_client.table("users")
        .select("id, email, is_active")
        .eq("email", staff_data.email)
        .execute()
    )

    if existing_user.data:
        if not existing_user.data[0].get("is_active", True):
            user_id = existing_user.data[0]["id"]
            supabase_client.table("users").update(
                {
                    "is_active": True,
                    "role": "staff",
                    "full_name": staff_data.full_name,
                    "phone": staff_data.phone,
                }
            ).eq("id", user_id).execute()

            staff_record = {
                "user_id": user_id,
                "salon_id": salon_id,
                "position": staff_data.position,
                "permissions": staff_data.permissions or {"can_book": True, "can_approve": True, "can_bill": True, "can_manage_customers": True, "can_manage_services": False},
                "created_by": ctx.user_id,
            }
            supabase_client.table("staff").insert(staff_record).execute()

            return {
                "message": "Staff reactivated successfully",
                "staff_id": user_id,
                "username": existing_user.data[0].get("username", staff_data.email.split("@")[0]),
                "email": staff_data.email,
            }
        else:
            raise HTTPException(status_code=400, detail=f"User with email {staff_data.email} already exists")

    username = staff_data.username or generate_username(staff_data.full_name)
    username = await generate_unique_username(username)
    temp_password = generate_secure_temp_password()

    try:
        auth_response = supabase_client.auth.admin.create_user(
            {
                "email": staff_data.email,
                "password": temp_password,
                "email_confirm": True,  # Auto-confirm, no email sent
                "user_metadata": {
                    "full_name": staff_data.full_name,
                    "phone": staff_data.phone,
                    "role": "staff",
                    "username": username,
                    "created_by": ctx.user_id,
                },
            }
        )
    except Exception as e:
        logger.warning("Admin create_user failed, falling back to sign_up: %s", e)
        # Same contamination risk as register_customer() above - fresh
        # client only, never the shared service-role one.
        auth_response = get_auth_client().auth.sign_up(
            {
                "email": staff_data.email,
                "password": temp_password,
                "options": {
                    "data": {
                        "full_name": staff_data.full_name,
                        "phone": staff_data.phone,
                        "role": "staff",
                        "username": username,
                        "created_by": ctx.user_id,
                    },
                    "email_confirm": False,
                },
            }
        )

    if auth_response.user is None:
        raise HTTPException(status_code=400, detail="Failed to create staff")

    staff_id = auth_response.user.id

    supabase_client.table("users").upsert(
        {
            "id": staff_id,
            "email": staff_data.email,
            "username": username,
            "full_name": staff_data.full_name,
            "phone": staff_data.phone,
            "role": "staff",
            "created_by": ctx.user_id,
            "is_active": True,
        }
    ).execute()

    staff_record = {
        "user_id": staff_id,
        "salon_id": salon_id,
        "position": staff_data.position,
        "permissions": staff_data.permissions or {"can_book": True, "can_approve": True, "can_bill": True, "can_manage_customers": True, "can_manage_services": False},
        "created_by": ctx.user_id,
    }
    supabase_client.table("staff").insert(staff_record).execute()

    # NOTE: temporary_password is returned once, in this response only. It
    # is the owner's responsibility to relay it to the staff member out of
    # band (in person, over a call, etc). It is intentionally never emailed
    # or logged.
    return {
        "message": "Staff created successfully. Share the temporary password with them directly.",
        "staff_id": staff_id,
        "username": username,
        "email": staff_data.email,
        "temporary_password": temp_password,
    }


# ============================================
# LOGIN
# ============================================
@router.post("/login", response_model=Token)
async def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    login_input = form_data.username.strip()
    password = form_data.password

    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"{client_ip}:{login_input.lower()}")

    is_email = "@" in login_input

    if is_email:
        user_check = (
            supabase_client.table("users")
            .select("id, email, username, role, is_active")
            .eq("email", login_input)
            .execute()
        )
    else:
        user_check = (
            supabase_client.table("users")
            .select("id, email, username, role, is_active")
            .eq("username", login_input)
            .execute()
        )

    if not user_check.data:
        # Same generic message regardless of whether the account exists, to
        # avoid leaking which usernames/emails are registered.
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_data = user_check.data[0]

    if not user_data.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")

    try:
        # Fresh client, not the shared service-role one - same
        # contamination concern as register_customer() above.
        auth_response = get_auth_client().auth.sign_in_with_password(
            {"email": user_data["email"], "password": password}
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if auth_response.session is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    role = user_data.get("role", "customer")

    _set_session_cookie(response, auth_response.session.access_token)

    return {
        "token_type": "bearer",
        "role": role,
        "user_id": user_data["id"],
        "username": user_data.get("username", ""),
        "email": user_data["email"],
    }


# ============================================
# LOGOUT
#
# There was no server-side logout at all before - the frontend just called
# localStorage.clear(). Now that the token lives in an httpOnly cookie the
# frontend JS can't clear it itself, so a real endpoint is needed to
# instruct the browser to delete it.
# ============================================
@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=settings.COOKIE_NAME, path="/")
    return {"message": "Logged out"}


# ============================================
# GET CURRENT USER
# ============================================
@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(ctx: UserContext = Depends(get_current_user)):
    user_data = (
        supabase_client.table("users").select("*").eq("id", ctx.user_id).execute()
    )
    if not user_data.data:
        raise HTTPException(status_code=404, detail="User not found")
    return user_data.data[0]
