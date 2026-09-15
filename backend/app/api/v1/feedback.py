from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.core.supabase_client import supabase_client
from app.core.auth_deps import require_roles, UserContext

router = APIRouter()

_owner_or_staff = require_roles("owner", "staff")
_customer_only = require_roles("customer")


class FeedbackCreate(BaseModel):
    appointment_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


@router.post("/")
async def create_feedback(feedback_data: FeedbackCreate, ctx: UserContext = Depends(_customer_only)):
    """A customer may leave exactly one piece of feedback per appointment,
    and only for an appointment that's theirs and marked completed - tying
    feedback to a specific visit rather than a free-floating service
    review."""
    if not ctx.salon_id or not ctx.customer_id:
        raise HTTPException(status_code=400, detail="No salon found for this user")

    appointment = (
        supabase_client.table("appointments")
        .select("id, customer_id, salon_id, service_id, status")
        .eq("id", feedback_data.appointment_id)
        .eq("salon_id", ctx.salon_id)
        .execute()
    )
    if not appointment.data:
        raise HTTPException(status_code=404, detail="Appointment not found")

    apt = appointment.data[0]
    if apt["customer_id"] != ctx.customer_id:
        raise HTTPException(status_code=403, detail="This appointment does not belong to you")
    if apt["status"] != "completed":
        raise HTTPException(status_code=400, detail="You can only leave feedback for a completed appointment")

    existing = (
        supabase_client.table("feedback")
        .select("id")
        .eq("appointment_id", feedback_data.appointment_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="You've already left feedback for this appointment")

    result = (
        supabase_client.table("feedback")
        .insert(
            {
                "salon_id": ctx.salon_id,
                "appointment_id": feedback_data.appointment_id,
                "customer_id": ctx.customer_id,
                "service_id": apt.get("service_id"),
                "rating": feedback_data.rating,
                "comment": feedback_data.comment,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to submit feedback")
    return result.data[0]


@router.get("/")
async def get_feedback(ctx: UserContext = Depends(_owner_or_staff), service_id: Optional[str] = None):
    """Owner/staff view: all feedback for the salon, newest first."""
    if not ctx.salon_id:
        return []

    query = (
        supabase_client.table("feedback")
        .select("*, customers(full_name), services(name)")
        .eq("salon_id", ctx.salon_id)
        .order("created_at", desc=True)
    )
    if service_id:
        query = query.eq("service_id", service_id)

    result = query.execute()
    feedback_list = []
    for row in result.data or []:
        customer = row.pop("customers", None) or {}
        service = row.pop("services", None) or {}
        row["customer_name"] = customer.get("full_name", "Unknown")
        row["service_name"] = service.get("name")
        feedback_list.append(row)
    return feedback_list


@router.get("/my-feedback")
async def get_my_feedback(ctx: UserContext = Depends(_customer_only)):
    """Customer view: feedback they've personally left."""
    if not ctx.salon_id or not ctx.customer_id:
        return []

    result = (
        supabase_client.table("feedback")
        .select("*, services(name)")
        .eq("customer_id", ctx.customer_id)
        .order("created_at", desc=True)
        .execute()
    )
    feedback_list = []
    for row in result.data or []:
        service = row.pop("services", None) or {}
        row["service_name"] = service.get("name")
        feedback_list.append(row)
    return feedback_list
