from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.core.supabase_client import supabase_client
from app.core.auth_deps import get_current_user, require_roles, require_permission, UserContext
from app.core.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)

_staff_or_owner = require_roles("owner", "staff")
_customer_only = require_roles("customer")
_can_approve = require_permission("can_approve")
_can_book = require_permission("can_book")

VALID_STATUSES = [
    # NOTE: 'scheduled' was removed from this list - see
    # database/01_fresh_schema.sql's design note. The real booking flow
    # only ever produces the statuses below; 'scheduled' was dead and had
    # silently broken the dashboard "next appointment" widget and the
    # customer-visit-count trigger, both of which filtered on it.
    "requested",
    "approved",
    "completed",
    "cancelled",
    "no-show",
    "rescheduled_pending",
]


class AppointmentCreate(BaseModel):
    customer_id: str
    service_id: Optional[str] = None
    title: Optional[str] = None
    date: str
    start_time: str
    end_time: str
    status: Optional[str] = "requested"
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    customer_id: Optional[str] = None
    service_id: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    new_date: Optional[str] = None
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None
    reschedule_reason: Optional[str] = None


class ApproveAction(BaseModel):
    status: Optional[str] = None  # "approved" | "rescheduled"
    new_date: Optional[str] = None
    new_time: Optional[str] = None
    reason: Optional[str] = None


class RespondAction(BaseModel):
    accept: bool = False


def _fetch_appointment_or_404(appointment_id: str, salon_id: str) -> dict:
    result = (
        supabase_client.table("appointments")
        .select("id, customer_id, salon_id, title, date, start_time, end_time")
        .eq("id", appointment_id)
        .eq("salon_id", salon_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return result.data[0]


# ============================================
# STATIC ROUTES FIRST
#
# NOTE ON A ROUTING BUG THAT EXISTED HERE: the original file declared
# `GET /{appointment_id}` *before* `GET /notifications`. FastAPI/Starlette
# matches routes in declaration order, and `/notifications` is a single path
# segment - so it satisfied the `{appointment_id}` pattern and was captured
# by get_appointment("notifications") first, meaning the real notifications
# endpoint was unreachable. All fixed-path routes are declared before any
# `/{appointment_id}...` route to prevent this class of bug entirely.
# ============================================


@router.get("/notifications")
async def get_notifications(ctx: UserContext = Depends(get_current_user)):
    result = (
        supabase_client.table("notifications")
        .select("*")
        .eq("user_id", ctx.user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data if result.data else []


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, ctx: UserContext = Depends(get_current_user)):
    supabase_client.table("notifications").update({"read": True}).eq("id", notification_id).eq(
        "user_id", ctx.user_id
    ).execute()
    return {"message": "Notification marked as read"}


@router.get("/customer/appointments")
async def get_customer_appointments(ctx: UserContext = Depends(_customer_only)):
    """Get appointments for the logged-in customer only."""
    if not ctx.salon_id or not ctx.customer_id:
        return []

    result = supabase_client.rpc(
        "get_appointments",
        {"p_salon_id": ctx.salon_id, "p_customer_id": ctx.customer_id, "p_limit": 100},
    ).execute()

    return result.data if result.data else []


@router.get("/by-customer/{customer_id}")
async def get_appointments_by_customer(customer_id: str, ctx: UserContext = Depends(_staff_or_owner)):
    """Staff/owner viewing a specific customer's appointment history."""
    if not ctx.salon_id:
        return []

    result = (
        supabase_client.table("appointments")
        .select("*, customers(full_name)")
        .eq("salon_id", ctx.salon_id)
        .eq("customer_id", customer_id)
        .order("date", desc=True)
        .order("start_time", desc=True)
        .execute()
    )

    appointments = []
    for apt in result.data or []:
        customer = apt.get("customers") or {}
        appointments.append(
            {
                "id": apt.get("id"),
                "customer_name": customer.get("full_name", "Unknown"),
                "title": apt.get("title", "Service"),
                "date": apt.get("date"),
                "start_time": apt.get("start_time"),
                "status": apt.get("status", "requested"),
            }
        )
    return appointments


@router.get("/")
async def get_appointments(
    ctx: UserContext = Depends(_staff_or_owner),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
):
    """Salon-wide appointment list. Owner/staff only - this previously had
    no role check, so a customer's token could list every appointment for
    the entire salon, not just their own (use /customer/appointments for
    that)."""
    if not ctx.salon_id:
        return []

    result = supabase_client.rpc(
        "get_appointments",
        {
            "p_salon_id": ctx.salon_id,
            "p_start_date": start_date,
            "p_end_date": end_date,
            "p_status": status,
            "p_limit": limit,
        },
    ).execute()

    return result.data if result.data else []


# ============================================
# CREATE APPOINTMENT
#
# A customer creates a request for themselves. A staff member with the
# can_book permission may also create/book an appointment on behalf of a
# customer (e.g. a walk-in booked at the front desk).
# ============================================
@router.post("/")
async def create_appointment(appointment_data: AppointmentCreate, ctx: UserContext = Depends(get_current_user)):
    if ctx.role == "customer":
        if not ctx.salon_id or not ctx.customer_id:
            raise HTTPException(status_code=400, detail="No salon found for this user")
        if appointment_data.customer_id != ctx.customer_id:
            raise HTTPException(status_code=403, detail="You can only book appointments for yourself")
        salon_id = ctx.salon_id

    elif ctx.role in ("owner", "staff"):
        if not ctx.has_permission("can_book"):
            raise HTTPException(status_code=403, detail="You do not have permission to book appointments")
        if not ctx.salon_id:
            raise HTTPException(status_code=400, detail="No salon found")
        salon_id = ctx.salon_id

    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    customer_check = (
        supabase_client.table("customers")
        .select("id")
        .eq("id", appointment_data.customer_id)
        .eq("salon_id", salon_id)
        .execute()
    )
    if not customer_check.data:
        raise HTTPException(status_code=400, detail="Customer not found in your salon")

    # FIXED: this previously checked status == 'scheduled', which (like the
    # dashboard "next appointment" bug) never matches any real appointment
    # - so double-booking the same slot was never actually prevented.
    # 'approved' is the status that represents a confirmed, occupied slot.
    conflict_check = (
        supabase_client.table("appointments")
        .select("id")
        .eq("salon_id", salon_id)
        .eq("date", appointment_data.date)
        .eq("start_time", appointment_data.start_time)
        .eq("status", "approved")
        .execute()
    )
    if conflict_check.data:
        raise HTTPException(status_code=400, detail="Time slot already booked")

    result = supabase_client.rpc(
        "request_appointment",
        {
            "p_salon_id": salon_id,
            "p_customer_id": appointment_data.customer_id,
            "p_title": appointment_data.title,
            "p_date": appointment_data.date,
            "p_start_time": appointment_data.start_time,
            "p_end_time": appointment_data.end_time,
            "p_notes": appointment_data.notes,
            "p_service_id": appointment_data.service_id,
        },
    ).execute()

    return result.data


@router.put("/{appointment_id}")
async def update_appointment(
    appointment_id: str, appointment_data: AppointmentCreate, ctx: UserContext = Depends(_staff_or_owner)
):
    if not ctx.salon_id:
        raise HTTPException(status_code=400, detail="No salon found")

    result = supabase_client.rpc(
        "upsert_appointment",
        {
            "p_salon_id": ctx.salon_id,
            "p_id": appointment_id,
            "p_customer_id": appointment_data.customer_id,
            "p_title": appointment_data.title,
            "p_date": appointment_data.date,
            "p_start_time": appointment_data.start_time,
            "p_end_time": appointment_data.end_time,
            "p_status": appointment_data.status,
            "p_notes": appointment_data.notes,
            "p_service_id": appointment_data.service_id,
        },
    ).execute()

    return result.data


@router.patch("/{appointment_id}/approve")
async def approve_appointment(
    appointment_id: str, approve_data: ApproveAction, ctx: UserContext = Depends(_can_approve)
):
    """Staff/owner action. Requires the can_approve permission (owners
    always pass). The original file defined this route TWICE with the same
    path/method - the second definition silently shadowed the first,
    meaning the first implementation's slightly different behavior was
    dead code. Consolidated into one implementation here."""
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    apt = _fetch_appointment_or_404(appointment_id, ctx.salon_id)

    result = supabase_client.rpc(
        "approve_appointment",
        {
            "p_appointment_id": appointment_id,
            "p_approved_by": ctx.user_id,
            "p_new_date": approve_data.new_date,
            "p_new_start_time": approve_data.new_time,
            "p_reschedule_reason": approve_data.reason,
        },
    ).execute()

    return {
        "message": "Appointment approved successfully",
        "appointment": result.data,
        "redirect": {
            "url": f"/dashboard/billing/new?appointment_id={appointment_id}&customer_id={apt['customer_id']}",
            "customer_id": apt["customer_id"],
            "appointment_id": appointment_id,
            "title": apt.get("title", "Service"),
            "date": apt.get("date"),
            "start_time": apt.get("start_time"),
            "end_time": apt.get("end_time"),
        },
    }


@router.patch("/{appointment_id}/respond")
async def customer_respond(appointment_id: str, response_data: RespondAction, ctx: UserContext = Depends(_customer_only)):
    """Customer accepts/declines a proposed reschedule.

    FIXED IDOR: the original endpoint never checked that the appointment
    belonged to the calling customer before calling the RPC - any
    authenticated customer could accept or cancel *any other customer's*
    appointment by guessing/enumerating appointment IDs. Ownership is now
    verified first.
    """
    if not ctx.salon_id or not ctx.customer_id:
        raise HTTPException(status_code=400, detail="No salon found for this user")

    apt = _fetch_appointment_or_404(appointment_id, ctx.salon_id)
    if apt["customer_id"] != ctx.customer_id:
        raise HTTPException(status_code=403, detail="This appointment does not belong to you")

    result = supabase_client.rpc(
        "customer_respond_reschedule",
        {"p_appointment_id": appointment_id, "p_accept": response_data.accept},
    ).execute()

    return result.data


@router.patch("/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, status: str, ctx: UserContext = Depends(_staff_or_owner)):
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Appointment not found")

    result = supabase_client.rpc(
        "update_appointment_status",
        {"p_salon_id": ctx.salon_id, "p_appointment_id": appointment_id, "p_status": status},
    ).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return {"message": f"Status updated to {status}", "appointment": result.data}


@router.get("/{appointment_id}")
async def get_appointment(appointment_id: str, ctx: UserContext = Depends(get_current_user)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # NOTE: the original code called this RPC with p_limit=1, then searched
    # the (single-item) result for a matching id - meaning it could only
    # ever "find" the single most recent appointment in the salon, and
    # every other valid appointment_id incorrectly 404'd. Raised the limit
    # so lookups actually work; a dedicated "get one appointment" RPC would
    # be more efficient still (see accompanying SQL suggestions).
    result = supabase_client.rpc(
        "get_appointments", {"p_salon_id": ctx.salon_id, "p_limit": 1000}
    ).execute()

    for apt in result.data or []:
        if apt.get("id") == appointment_id:
            # Customers may only view their own appointment even though the
            # RPC above returns the whole salon's list internally.
            if ctx.role == "customer" and apt.get("customer_id") != ctx.customer_id:
                raise HTTPException(status_code=404, detail="Appointment not found")
            return apt

    raise HTTPException(status_code=404, detail="Appointment not found")
