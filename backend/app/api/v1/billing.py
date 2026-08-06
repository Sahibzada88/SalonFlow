from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.core.supabase_client import supabase_client
from app.api.v1.auth import oauth2_scheme

router = APIRouter()

# ========== Pydantic Schemas ==========

class InvoiceItemCreate(BaseModel):
    description: str
    quantity: int = 1
    unit_price: int = 0

class InvoiceCreate(BaseModel):
    appointment_id: Optional[str] = None
    customer_id: str
    date: str
    subtotal: int = 0
    discount: int = 0
    tax: int = 0
    total: int = 0
    status: str = "paid"
    payment_method: str = "cash"
    notes: Optional[str] = None
    items: List[InvoiceItemCreate] = []

class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    customer_id: str
    customer_name: Optional[str] = None
    date: str
    subtotal: int
    discount: int
    tax: int
    total: int
    status: str
    payment_method: str
    notes: Optional[str]
    created_at: str
    items: Optional[List[dict]] = []

# ========== Helper Functions ==========

async def get_salon_id(user_id: str):
    response = supabase_client.table("salons")\
        .select("id")\
        .eq("owner_id", user_id)\
        .execute()
    if not response.data:
        return None
    return response.data[0]["id"]

async def generate_invoice_number(salon_id: str):
    """Generate a unique invoice number"""
    today = date.today().strftime("%Y%m%d")
    # Count invoices for today
    result = supabase_client.table("invoices")\
        .select("*", count="exact")\
        .eq("salon_id", salon_id)\
        .gte("created_at", f"{date.today().isoformat()}T00:00:00")\
        .execute()
    
    count = result.count if result.count is not None else 0
    return f"INV-{today}-{count + 1:04d}"

# ========== CRUD Endpoints ==========

@router.post("/invoices")
async def create_invoice(
    invoice_data: InvoiceCreate,
    token: str = Depends(oauth2_scheme)
):
    """Create a new invoice"""
    try:
        # Get user
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get salon ID
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=400, detail="No salon found")
        
        # Generate invoice number
        invoice_number = await generate_invoice_number(salon_id)
        
        # Create invoice
        invoice_dict = {
            "salon_id": salon_id,
            "invoice_number": invoice_number,
            "customer_id": invoice_data.customer_id,
            "appointment_id": invoice_data.appointment_id,
            "date": invoice_data.date,
            "subtotal": invoice_data.subtotal,
            "discount": invoice_data.discount,
            "tax": invoice_data.tax,
            "total": invoice_data.total,
            "status": invoice_data.status,
            "payment_method": invoice_data.payment_method,
            "notes": invoice_data.notes
        }
        
        response = supabase_client.table("invoices").insert(invoice_dict).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create invoice")
        
        invoice_id = response.data[0]["id"]
        
        # Create invoice items
        if invoice_data.items:
            for item in invoice_data.items:
                item_dict = {
                    "invoice_id": invoice_id,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total": item.quantity * item.unit_price
                }
                supabase_client.table("invoice_items").insert(item_dict).execute()
        
        # Get customer name
        customer = supabase_client.table("customers")\
            .select("full_name")\
            .eq("id", invoice_data.customer_id)\
            .execute()
        
        customer_name = customer.data[0]["full_name"] if customer.data else None
        
        return {
            "message": "Invoice created successfully",
            "invoice": {
                **response.data[0],
                "customer_name": customer_name
            }
        }
        
    except Exception as e:
        print(f"Create invoice error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/invoices")
async def get_invoices(
    token: str = Depends(oauth2_scheme),
    customer_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100)
):
    """Get all invoices"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            return []
        
        query = supabase_client.table("invoices")\
            .select("*")\
            .eq("salon_id", salon_id)\
            .order("date", desc=True)\
            .limit(limit)
        
        if customer_id:
            query = query.eq("customer_id", customer_id)
        if start_date:
            query = query.gte("date", start_date)
        if end_date:
            query = query.lte("date", end_date)
        
        response = query.execute()
        results = response.data if response.data else []
        
        # Get customer names
        for inv in results:
            customer = supabase_client.table("customers")\
                .select("full_name")\
                .eq("id", inv["customer_id"])\
                .execute()
            inv["customer_name"] = customer.data[0]["full_name"] if customer.data else None
        
        return results
        
    except Exception as e:
        print(f"Get invoices error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get a single invoice with items"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get invoice
        response = supabase_client.table("invoices")\
            .select("*")\
            .eq("id", invoice_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        invoice = response.data[0]
        
        # Get customer name
        customer = supabase_client.table("customers")\
            .select("full_name")\
            .eq("id", invoice["customer_id"])\
            .execute()
        invoice["customer_name"] = customer.data[0]["full_name"] if customer.data else None
        
        # Get invoice items
        items_response = supabase_client.table("invoice_items")\
            .select("*")\
            .eq("invoice_id", invoice_id)\
            .execute()
        invoice["items"] = items_response.data if items_response.data else []
        
        return invoice
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get invoice error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Delete an invoice"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Delete invoice (items will be deleted via CASCADE)
        response = supabase_client.table("invoices")\
            .delete()\
            .eq("id", invoice_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        return {"message": "Invoice deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete invoice error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/stats")
async def get_billing_stats(
    token: str = Depends(oauth2_scheme),
    period: str = Query("month", description="day, week, month, year")
):
    """Get billing statistics"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            return {"error": "No salon found"}
        
        # Get total revenue
        result = supabase_client.table("invoices")\
            .select("total")\
            .eq("salon_id", salon_id)\
            .eq("status", "paid")\
            .execute()
        
        total_revenue = sum(inv.get("total", 0) for inv in (result.data or []))
        
        # Get invoice count
        count_result = supabase_client.table("invoices")\
            .select("*", count="exact")\
            .eq("salon_id", salon_id)\
            .execute()
        total_invoices = count_result.count if count_result.count is not None else 0
        
        return {
            "total_revenue": total_revenue,
            "total_invoices": total_invoices,
            "average_invoice": total_revenue / total_invoices if total_invoices > 0 else 0
        }
        
    except Exception as e:
        print(f"Get billing stats error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


from fastapi.responses import Response, StreamingResponse
from app.utils.invoice_pdf import generate_invoice_pdf

@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Download invoice as PDF"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get invoice
        response = supabase_client.table("invoices")\
            .select("*")\
            .eq("id", invoice_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        invoice = response.data[0]
        
        # Get customer name
        customer = supabase_client.table("customers")\
            .select("full_name, phone, email")\
            .eq("id", invoice["customer_id"])\
            .execute()
        
        customer_name = customer.data[0]["full_name"] if customer.data else "Unknown"
        customer_phone = customer.data[0].get("phone") if customer.data else None
        customer_email = customer.data[0].get("email") if customer.data else None
        
        # Get invoice items (handle empty)
        items_response = supabase_client.table("invoice_items")\
            .select("*")\
            .eq("invoice_id", invoice_id)\
            .execute()
        
        items = items_response.data if items_response.data else []
        
        # Prepare data for PDF
        invoice_data = {
            "invoice_number": invoice.get("invoice_number", "N/A"),
            "date": invoice.get("date", ""),
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "items": items,  # Will handle empty in PDF generator
            "subtotal": invoice.get("subtotal", 0),
            "discount": invoice.get("discount", 0),
            "tax": invoice.get("tax", 0),
            "total": invoice.get("total", 0),
            "payment_method": invoice.get("payment_method", "cash"),
            "status": invoice.get("status", "paid"),
            "notes": invoice.get("notes", "")
        }
        
        # Generate PDF
        pdf_buffer = generate_invoice_pdf(invoice_data)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Invoice_{invoice.get("invoice_number", "N/A")}.pdf"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"PDF generation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/invoices/{invoice_id}/print")
async def print_invoice_pdf(
    invoice_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get invoice PDF for printing (opens in browser)"""
    try:
        user = supabase_client.auth.get_user(token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        salon_id = await get_salon_id(user.user.id)
        if not salon_id:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get invoice
        response = supabase_client.table("invoices")\
            .select("*")\
            .eq("id", invoice_id)\
            .eq("salon_id", salon_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        invoice = response.data[0]
        
        # Get customer name
        customer = supabase_client.table("customers")\
            .select("full_name, phone, email")\
            .eq("id", invoice["customer_id"])\
            .execute()
        
        customer_name = customer.data[0]["full_name"] if customer.data else "Unknown"
        customer_phone = customer.data[0].get("phone") if customer.data else None
        customer_email = customer.data[0].get("email") if customer.data else None
        
        # Get invoice items (handle empty)
        items_response = supabase_client.table("invoice_items")\
            .select("*")\
            .eq("invoice_id", invoice_id)\
            .execute()
        
        items = items_response.data if items_response.data else []
        
        # Prepare data for PDF
        invoice_data = {
            "invoice_number": invoice.get("invoice_number", "N/A"),
            "date": invoice.get("date", ""),
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "items": items,
            "subtotal": invoice.get("subtotal", 0),
            "discount": invoice.get("discount", 0),
            "tax": invoice.get("tax", 0),
            "total": invoice.get("total", 0),
            "payment_method": invoice.get("payment_method", "cash"),
            "status": invoice.get("status", "paid"),
            "notes": invoice.get("notes", "")
        }
        
        # Generate PDF
        pdf_buffer = generate_invoice_pdf(invoice_data)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="Invoice_{invoice.get("invoice_number", "N/A")}.pdf"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Print PDF error: {e}")
        raise HTTPException(status_code=400, detail=str(e))