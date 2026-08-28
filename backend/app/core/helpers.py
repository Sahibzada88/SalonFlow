from app.core.supabase_client import supabase_client

async def get_user_salon_id(user_id: str):
    """
    Get salon_id for any user type:
    - Owner: from salons table (owner_id)
    - Staff: from staff table (salon_id)
    - Customer: from customers table (salon_id)
    """
    
    print(f"🔍 Looking for salon_id for user: {user_id}")
    
    # 1. Check if user is a customer
    customer = supabase_client.table("customers")\
        .select("salon_id")\
        .eq("id", user_id)\
        .execute()
    
    print(f"📊 Customer query result: {customer.data}")
    
    if customer.data and customer.data[0].get("salon_id"):
        salon_id = customer.data[0]["salon_id"]
        print(f"✅ Found salon_id from customers table: {salon_id}")
        return salon_id
    
    # 2. Check if user is a salon owner
    salon = supabase_client.table("salons")\
        .select("id")\
        .eq("owner_id", user_id)\
        .execute()
    
    print(f"📊 Salon owner query result: {salon.data}")
    
    if salon.data:
        salon_id = salon.data[0]["id"]
        print(f"✅ Found salon_id from salons table: {salon_id}")
        return salon_id
    
    # 3. Check if user is staff
    staff = supabase_client.table("staff")\
        .select("salon_id")\
        .eq("user_id", user_id)\
        .execute()
    
    print(f"📊 Staff query result: {staff.data}")
    
    if staff.data:
        salon_id = staff.data[0]["salon_id"]
        print(f"✅ Found salon_id from staff table: {salon_id}")
        return salon_id
    
    print(f"❌ No salon_id found for user: {user_id}")
    return None