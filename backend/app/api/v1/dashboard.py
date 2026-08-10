from fastapi import APIRouter, HTTPException, Depends
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(token: str = Depends(oauth2_scheme)):
    """Get dashboard statistics using stored procedure"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon
        salon_response = supabase_client.table("salons")\
            .select("id, name, city, phone")\
            .eq("owner_id", user.user.id)\
            .execute()
        
        if not salon_response.data:
            return {
                "salon_exists": False,
                "message": "No salon found. Please set up your salon."
            }
        
        salon = salon_response.data[0]
        salon_id = salon["id"]
        
        # Call the stored procedure
        result = supabase_client.rpc(
            "get_dashboard_stats",
            {"p_salon_id": salon_id}
        ).execute()
        
        stats_data = result.data if result.data else {}
        
        return {
            "salon_exists": True,
            "salon": {
                "id": salon["id"],
                "name": salon["name"],
                "city": salon.get("city", ""),
                "phone": salon.get("phone", "")
            },
            "stats": {
                "today_revenue": stats_data.get("total_revenue", 0),
                "today_appointments": stats_data.get("today_appointments", 0),
                "total_customers": stats_data.get("total_customers", 0),
                "upcoming_appointments": stats_data.get("upcoming_appointments", 0),
                "revenue_growth": stats_data.get("revenue_growth", 0),
                "appointment_growth": stats_data.get("appointment_growth", 0),
                "customer_growth": stats_data.get("customer_growth", 0),
                "next_appointment": stats_data.get("next_appointment")
            },
            "recent_appointments": stats_data.get("recent_appointments", [])
        }
        
    except Exception as e:
        print(f"Dashboard error: {e}")
        raise HTTPException(status_code=400, detail=str(e))