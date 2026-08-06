from fastapi import APIRouter, HTTPException, Depends
from datetime import date, timedelta
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(token: str = Depends(oauth2_scheme)):
    """Get dashboard statistics for the authenticated user's salon"""
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
        
        # Today's date
        today = date.today().isoformat()
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        
        # Get today's appointments
        today_result = supabase_client.table("appointments")\
            .select("*", count="exact")\
            .eq("salon_id", salon_id)\
            .eq("date", today)\
            .execute()
        today_count = today_result.count if today_result.count is not None else 0
        
        # Get yesterday's appointments
        yesterday_result = supabase_client.table("appointments")\
            .select("*", count="exact")\
            .eq("salon_id", salon_id)\
            .eq("date", yesterday)\
            .execute()
        yesterday_count = yesterday_result.count if yesterday_result.count is not None else 0
        
        # Calculate growth (safe)
        if yesterday_count == 0:
            growth = 100 if today_count > 0 else 0
        else:
            growth = int(((today_count - yesterday_count) / yesterday_count) * 100)
        
        # Get total customers
        customers_result = supabase_client.table("customers")\
            .select("*", count="exact")\
            .eq("salon_id", salon_id)\
            .execute()
        total_customers = customers_result.count if customers_result.count is not None else 0
        
        # Get new customers this month
        last_month = (date.today() - timedelta(days=30)).isoformat()
        new_customers_result = supabase_client.table("customers")\
            .select("*", count="exact")\
            .eq("salon_id", salon_id)\
            .gte("created_at", last_month)\
            .execute()
        new_customers = new_customers_result.count if new_customers_result.count is not None else 0
        
        # Calculate customer growth
        if total_customers == 0:
            customer_growth = 0
        else:
            customer_growth = int((new_customers / total_customers) * 100)
        
        # Get upcoming appointments
        upcoming_result = supabase_client.table("appointments")\
            .select("*", count="exact")\
            .eq("salon_id", salon_id)\
            .gte("date", today)\
            .execute()
        upcoming_count = upcoming_result.count if upcoming_result.count is not None else 0
        
        # Get next appointment - FORMATTED AS STRING
        next_appointment = None
        try:
            next_result = supabase_client.table("appointments")\
                .select("*")\
                .eq("salon_id", salon_id)\
                .eq("status", "scheduled")\
                .gte("date", today)\
                .order("date")\
                .order("start_time")\
                .limit(1)\
                .execute()
            
            if next_result.data:
                apt = next_result.data[0]
                apt_date = apt.get('date', '')
                apt_time = apt.get('start_time', '')
                # Format time to HH:MM
                if apt_time and len(apt_time) > 5:
                    apt_time = apt_time[:5]
                # Create formatted string
                if apt_date and apt_time:
                    next_appointment = f"{apt_date} at {apt_time}"
                elif apt_date:
                    next_appointment = apt_date
                else:
                    next_appointment = "Upcoming"
        except Exception as e:
            print(f"Error getting next appointment: {e}")
            next_appointment = None
        
        # Get recent appointments (last 5)
        recent_result = supabase_client.table("appointments")\
            .select("*, customers(full_name)")\
            .eq("salon_id", salon_id)\
            .order("date", desc=True)\
            .order("start_time", desc=True)\
            .limit(5)\
            .execute()
        
        recent_appointments = []
        if recent_result.data:
            for apt in recent_result.data:
                customer = apt.get("customers", {})
                customer_name = customer.get("full_name") if customer else "Unknown"
                
                start_time = apt.get("start_time", "")
                if start_time and len(start_time) > 5:
                    start_time = start_time[:5]
                
                recent_appointments.append({
                    "id": apt.get("id"),
                    "customer_name": customer_name,
                    "title": apt.get("title", "Service"),
                    "date": apt.get("date"),
                    "start_time": start_time,
                    "status": apt.get("status", "scheduled")
                })
        
        # Return response
        return {
            "salon_exists": True,
            "salon": {
                "id": salon["id"],
                "name": salon["name"],
                "city": salon.get("city", ""),
                "phone": salon.get("phone", "")
            },
            "stats": {
                "today_revenue": 0,
                "today_appointments": today_count,
                "total_customers": total_customers,
                "upcoming_appointments": upcoming_count,
                "revenue_growth": 0,
                "appointment_growth": growth,
                "customer_growth": customer_growth,
                "next_appointment": next_appointment  # Now this is a string, not an object
            },
            "recent_appointments": recent_appointments
        }
        
    except Exception as e:
        print(f"Dashboard error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))