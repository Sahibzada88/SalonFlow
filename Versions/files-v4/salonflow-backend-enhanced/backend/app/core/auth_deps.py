"""
Centralized authentication & authorization for SalonFlow.

WHY THIS FILE EXISTS
---------------------
The original codebase repeated the same ~8 lines in nearly every route:

    user = supabase_client.auth.get_user(token)
    if user.user is None:
        raise HTTPException(401, "Invalid token")
    salon_response = supabase_client.table("salons").select("id").eq("owner_id", user.user.id).execute()
    ...

Because every endpoint hand-rolled this, the checks drifted out of sync:
- Some endpoints resolved salon_id via "owner_id" only, silently locking
  staff out of features they should have access to (customers.py).
- Others resolved salon_id via a helper that also matches *customers*,
  which meant an authenticated customer could hit owner/staff-only routes
  (billing stats, all invoices, all appointments in the salon) because the
  code only checked "does this token map to *a* salon_id", never "is this
  user's *role* allowed to do this".
- Staff deletion never checked is_owner, so any staff member could delete
  other staff.

This module fixes that by resolving identity + role + salon scope in ONE
place, and exposing small composable dependencies:

    ctx: UserContext = Depends(get_current_user)          # any authenticated user
    ctx: UserContext = Depends(require_roles("owner"))     # owner only
    ctx: UserContext = Depends(require_roles("owner", "staff"))
    ctx: UserContext = Depends(require_permission("can_bill"))  # staff permission-aware

Every route below should depend on one of these instead of re-implementing
the checks.
"""
from dataclasses import dataclass, field
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer

from app.core.supabase_client import supabase_client
from app.core.logging_config import get_logger
from app.core.config import settings

logger = get_logger(__name__)

# auto_error=False: the Authorization header is now a fallback, not the
# primary path (see get_token below) - so a missing header shouldn't 401
# by itself before we've also checked for the session cookie.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_token(request: Request, header_token: Optional[str] = Depends(oauth2_scheme)) -> str:
    """Resolve the session token from the httpOnly cookie first (the path
    the actual frontend uses), falling back to a Bearer Authorization
    header (useful for curl/Postman/API clients that can't hold cookies).

    WHY THIS CHANGED: the token used to be handed to the frontend in the
    login response body and stored in localStorage, which is readable by
    any script on the page - an XSS bug anywhere becomes full account
    takeover. It's now set as an httpOnly cookie (see auth.py's /login and
    /logout), which client-side JS cannot read at all.
    """
    cookie_token = request.cookies.get(settings.COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if header_token:
        return header_token
    raise HTTPException(status_code=401, detail="Not authenticated")


@dataclass
class UserContext:
    user_id: str
    email: str
    role: str  # "owner" | "staff" | "customer"
    is_owner: bool
    is_staff: bool
    is_customer: bool
    is_active: bool
    full_name: str = ""
    username: Optional[str] = None

    # Scope - which salon this user's data lives under, resolved based on role.
    salon_id: Optional[str] = None

    # Only populated for staff
    staff_record_id: Optional[str] = None
    staff_permissions: Dict[str, Any] = field(default_factory=dict)

    # For customers, this equals user_id (customers.id == auth user id in
    # this schema), kept as a separate field for readability at call sites.
    customer_id: Optional[str] = None

    def has_permission(self, permission: str) -> bool:
        """Owners always have full access. Staff are gated by their
        `staff.permissions` JSONB column (can_book / can_approve / can_bill).
        This column existed in the schema but was never actually checked
        anywhere in the original code - it was a dead feature."""
        if self.is_owner:
            return True
        if self.is_staff:
            return bool(self.staff_permissions.get(permission, False))
        return False


async def get_current_user(token: str = Depends(get_token)) -> UserContext:
    """Resolve the bearer token to a full UserContext: identity, role, and
    the salon_id that role is scoped to. This is the ONLY place salon scope
    should be resolved - do not re-query owner_id/salon tables in route
    handlers."""
    auth_user = supabase_client.auth.get_user(token)
    if auth_user.user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    uid = auth_user.user.id

    user_row = (
        supabase_client.table("users")
        .select("id, email, full_name, username, role, is_active")
        .eq("id", uid)
        .execute()
    )
    if not user_row.data:
        raise HTTPException(status_code=401, detail="User record not found")

    u = user_row.data[0]

    if not u.get("is_active", True):
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    role = (u.get("role") or "customer").strip().lower()

    ctx = UserContext(
        user_id=uid,
        email=u.get("email", ""),
        role=role,
        # `role` is the only role column in this schema now - the
        # separate is_owner/is_staff/is_customer booleans that used to
        # exist were dropped (see database/01_fresh_schema.sql): they
        # could get out of sync with `role` in practice, which caused a
        # real bug where a customer with role='customer' but
        # is_customer=false resolved to no salon at all. `role` alone is
        # now the single source of truth.
        is_owner=role == "owner",
        is_staff=role == "staff",
        is_customer=role == "customer",
        is_active=bool(u.get("is_active", True)),
        full_name=u.get("full_name", ""),
        username=u.get("username"),
    )

    # ------------------------------------------------------------------
    # Resolve salon scope.
    #
    # This mirrors the ORIGINAL project's core/helpers.py::get_user_salon_id()
    # exactly: check the customers table (by id), then salons (by owner_id),
    # then staff (by user_id) - in that fixed order - and use whichever one
    # actually returns a match. This is deliberately NOT gated by
    # ctx.role/is_owner/is_staff/is_customer, because those columns proved
    # unreliable in practice (a real account existed with role='customer'
    # but is_customer=false, which meant the previous role-gated branching
    # matched nothing and salon_id was never resolved at all). Checking the
    # tables directly, unconditionally, is what the original app did and
    # is more robust: it doesn't matter what the role columns say, only
    # what rows actually exist.
    # ------------------------------------------------------------------
    customer_resp = supabase_client.table("customers").select("salon_id").eq("id", uid).execute()
    if customer_resp.data and customer_resp.data[0].get("salon_id"):
        ctx.salon_id = customer_resp.data[0]["salon_id"]
        ctx.customer_id = uid

    else:
        owner_resp = supabase_client.table("salons").select("id").eq("owner_id", uid).execute()
        if owner_resp.data:
            ctx.salon_id = owner_resp.data[0]["id"]

        else:
            staff_resp = (
                supabase_client.table("staff")
                .select("id, salon_id, permissions, is_active")
                .eq("user_id", uid)
                .execute()
            )
            if staff_resp.data:
                staff_row = staff_resp.data[0]
                if staff_row.get("is_active", True):
                    ctx.salon_id = staff_row["salon_id"]
                    ctx.staff_record_id = staff_row["id"]
                    ctx.staff_permissions = staff_row.get("permissions") or {}

            elif ctx.role == "customer":
                # SELF-HEALING FALLBACK (kept from the previous fix, on top
                # of the original logic above). None of the three tables
                # had any match at all, but this account is nominally a
                # customer (role='customer') - most likely an interrupted
                # registration (the auth account was created but the
                # customers-table insert never completed). Rather than
                # leaving them permanently unable to book anything, repair
                # it here.
                #
                # Deployment model is one salon per install (each salon
                # gets its own separate deployment + database), so "the
                # salon this customer belongs to" is unambiguous - it's
                # simply the one salon that exists in this database.
                # Attach them to it automatically, exactly like
                # register_customer() does at signup time.
                salon_resp = supabase_client.table("salons").select("id").limit(1).execute()
                if salon_resp.data:
                    healed_salon_id = salon_resp.data[0]["id"]
                    supabase_client.table("customers").upsert(
                        {
                            "id": uid,
                            "salon_id": healed_salon_id,
                            "full_name": ctx.full_name or ctx.email or "Customer",
                            "email": ctx.email,
                            "total_visits": 0,
                            "total_spent": 0,
                        }
                    ).execute()
                    logger.info(
                        "Self-healed missing customers row for user %s -> salon %s", uid, healed_salon_id
                    )
                    ctx.salon_id = healed_salon_id
                    ctx.customer_id = uid

    return ctx


def require_roles(*roles: str):
    """Restrict a route to specific roles, e.g. require_roles("owner") or
    require_roles("owner", "staff")."""

    async def _checker(ctx: UserContext = Depends(get_current_user)) -> UserContext:
        if ctx.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return ctx

    return _checker


def require_permission(permission: str):
    """Restrict a route to owners, or staff with the named permission
    (can_book / can_approve / can_bill). Customers are always denied."""

    async def _checker(ctx: UserContext = Depends(get_current_user)) -> UserContext:
        if not ctx.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return ctx

    return _checker


def require_salon_scope(ctx: UserContext = Depends(get_current_user)) -> UserContext:
    """Any authenticated staff/owner/customer that already has a resolved
    salon_id. Use this for endpoints where all three roles are allowed to
    call the endpoint but each must be scoped to their own data inside the
    handler (e.g. GET /appointments/notifications)."""
    if not ctx.salon_id:
        raise HTTPException(status_code=400, detail="No salon associated with this account")
    return ctx
