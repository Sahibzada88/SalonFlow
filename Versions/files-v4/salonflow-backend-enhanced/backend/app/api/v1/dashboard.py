from fastapi import APIRouter, Depends

from app.core.supabase_client import supabase_client
from app.core.auth_deps import require_roles, UserContext

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(ctx: UserContext = Depends(require_roles("owner", "staff"))):
    """Get dashboard statistics using the get_dashboard_stats() stored
    procedure. Restricted to owner/staff - this is salon-management data,
    not something a customer token should be able to fetch.

    The "next appointment"/"scheduled" status mismatch that used to live
    here has been fixed at the SQL level - see
    database/01_fresh_schema.sql, which filters on 'approved' (the status
    the real booking flow actually produces) instead of the unreachable
    'scheduled' value.
    """
    if not ctx.salon_id:
        return {"salon_exists": False, "message": "No salon found. Please set up your salon."}

    salon_response = (
        supabase_client.table("salons").select("id, name, city, phone").eq("id", ctx.salon_id).execute()
    )
    if not salon_response.data:
        return {"salon_exists": False, "message": "No salon found. Please set up your salon."}

    salon = salon_response.data[0]

    result = supabase_client.rpc("get_dashboard_stats", {"p_salon_id": ctx.salon_id}).execute()
    stats_data = result.data if result.data else {}

    return {
        "salon_exists": True,
        "salon": {
            "id": salon["id"],
            "name": salon["name"],
            "city": salon.get("city", ""),
            "phone": salon.get("phone", ""),
        },
        "stats": {
            "today_revenue": stats_data.get("total_revenue", 0),
            "today_appointments": stats_data.get("today_appointments", 0),
            "total_customers": stats_data.get("total_customers", 0),
            "upcoming_appointments": stats_data.get("upcoming_appointments", 0),
            "revenue_growth": stats_data.get("revenue_growth", 0),
            "appointment_growth": stats_data.get("appointment_growth", 0),
            "customer_growth": stats_data.get("customer_growth", 0),
            "next_appointment": stats_data.get("next_appointment"),
        },
        "recent_appointments": stats_data.get("recent_appointments", []),
    }
