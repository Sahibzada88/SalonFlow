from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

from app.core.supabase_client import supabase_client
from app.core.auth_deps import require_roles, require_permission, UserContext
from app.core.logging_config import get_logger
from app.utils.invoice_pdf import generate_invoice_pdf

router = APIRouter()
logger = get_logger(__name__)

# This whole router previously resolved salon scope with the same helper
# used for customers, appointments, etc. (get_user_salon_id), which also
# matches customer accounts. None of these routes checked role at all, so
# any logged-in customer could call GET /billing/invoices, /billing/stats,
# or download any invoice PDF for the ENTIRE salon - not just their own.
# That is now closed: every route requires owner or staff, and
# money-moving actions additionally require the `can_bill` staff permission
# (owners always pass; see UserContext.has_permission).
_staff_or_owner = require_roles("owner", "staff")
_can_bill = require_permission("can_bill")


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
    status: str = "pending"
    payment_method: str = "cash"
    notes: Optional[str] = None
    items: List[InvoiceItemCreate] = []


class PaymentCreate(BaseModel):
    amount: int
    payment_date: Optional[str] = None
    payment_method: str = "cash"
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    invoice_id: str
    amount: int
    payment_date: str
    payment_method: str
    reference: Optional[str]
    notes: Optional[str]
    created_at: str


async def generate_invoice_number(salon_id: str) -> str:
    today = date.today().strftime("%Y%m%d")
    result = (
        supabase_client.table("invoices")
        .select("*", count="exact")
        .eq("salon_id", salon_id)
        .gte("created_at", f"{date.today().isoformat()}T00:00:00")
        .execute()
    )
    count = result.count if result.count is not None else 0
    return f"INV-{today}-{count + 1:04d}"


def _fetch_invoice_or_404(invoice_id: str, salon_id: str) -> dict:
    response = (
        supabase_client.table("invoices").select("*").eq("id", invoice_id).eq("salon_id", salon_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return response.data[0]


# ========== CRUD Endpoints ==========


@router.post("/invoices")
async def create_invoice(invoice_data: InvoiceCreate, ctx: UserContext = Depends(_can_bill)):
    if not ctx.salon_id:
        raise HTTPException(status_code=400, detail="No salon found")
    salon_id = ctx.salon_id

    customer_check = (
        supabase_client.table("customers")
        .select("id")
        .eq("id", invoice_data.customer_id)
        .eq("salon_id", salon_id)
        .execute()
    )
    if not customer_check.data:
        raise HTTPException(status_code=400, detail="Customer not found in your salon")

    if invoice_data.appointment_id:
        appointment_check = (
            supabase_client.table("appointments")
            .select("id, customer_id, service_id")
            .eq("id", invoice_data.appointment_id)
            .eq("salon_id", salon_id)
            .execute()
        )
        if not appointment_check.data:
            raise HTTPException(status_code=400, detail="Appointment not found")
        if appointment_check.data[0]["customer_id"] != invoice_data.customer_id:
            raise HTTPException(status_code=400, detail="Appointment does not belong to this customer")

    # If this invoice is tied to an appointment that has a service on it,
    # the price is NOT trusted from the client - it's looked up fresh from
    # the service catalog and used to build the invoice's one line item
    # here, overriding whatever the request submitted. Services are owner-
    # set, so once a service exists its price shouldn't be something a
    # client-side request can silently change; only discount/tax remain
    # freely editable per invoice. (A manual invoice with no appointment_id,
    # or an appointment with no service attached, still uses the
    # client-submitted items as before - this only locks the price when
    # there's an actual service to look up.)
    items_to_insert = invoice_data.items
    subtotal = invoice_data.subtotal
    if invoice_data.appointment_id:
        service_id = appointment_check.data[0].get("service_id")
        if service_id:
            service_resp = (
                supabase_client.table("services")
                .select("name, price")
                .eq("id", service_id)
                .eq("salon_id", salon_id)
                .execute()
            )
            if service_resp.data:
                service = service_resp.data[0]
                items_to_insert = [
                    InvoiceItemCreate(description=service["name"], quantity=1, unit_price=service["price"])
                ]
                subtotal = service["price"]

    total = subtotal - invoice_data.discount + invoice_data.tax

    invoice_number = await generate_invoice_number(salon_id)

    invoice_dict = {
        "salon_id": salon_id,
        "invoice_number": invoice_number,
        "customer_id": invoice_data.customer_id,
        "appointment_id": invoice_data.appointment_id,
        "date": invoice_data.date,
        "subtotal": subtotal,
        "discount": invoice_data.discount,
        "tax": invoice_data.tax,
        "total": total,
        "status": invoice_data.status,
        "payment_method": invoice_data.payment_method,
        "notes": invoice_data.notes,
        "amount_paid": 0,
        "balance_due": total,
        "payment_status": "pending",
    }

    response = supabase_client.table("invoices").insert(invoice_dict).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create invoice")

    invoice_id = response.data[0]["id"]

    for item in items_to_insert:
        supabase_client.table("invoice_items").insert(
            {
                "invoice_id": invoice_id,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total": item.quantity * item.unit_price,
            }
        ).execute()

    customer = supabase_client.table("customers").select("full_name").eq("id", invoice_data.customer_id).execute()
    customer_name = customer.data[0]["full_name"] if customer.data else None

    return {
        "message": "Invoice created successfully",
        "invoice": {**response.data[0], "customer_name": customer_name},
    }


@router.get("/invoices")
async def get_invoices(
    ctx: UserContext = Depends(_staff_or_owner),
    customer_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    if not ctx.salon_id:
        return []

    query = (
        supabase_client.table("invoices")
        .select("*")
        .eq("salon_id", ctx.salon_id)
        .order("date", desc=True)
        .limit(limit)
    )
    if customer_id:
        query = query.eq("customer_id", customer_id)
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    response = query.execute()
    results = response.data if response.data else []

    for inv in results:
        customer = supabase_client.table("customers").select("full_name").eq("id", inv["customer_id"]).execute()
        inv["customer_name"] = customer.data[0]["full_name"] if customer.data else None

    return results


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, ctx: UserContext = Depends(_staff_or_owner)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = _fetch_invoice_or_404(invoice_id, ctx.salon_id)

    customer = supabase_client.table("customers").select("full_name").eq("id", invoice["customer_id"]).execute()
    invoice["customer_name"] = customer.data[0]["full_name"] if customer.data else None

    items_response = supabase_client.table("invoice_items").select("*").eq("invoice_id", invoice_id).execute()
    invoice["items"] = items_response.data if items_response.data else []

    payments_response = (
        supabase_client.table("payments")
        .select("*")
        .eq("invoice_id", invoice_id)
        .order("payment_date", desc=True)
        .execute()
    )
    invoice["payments"] = payments_response.data if payments_response.data else []

    total_paid = sum(p.get("amount", 0) for p in invoice["payments"])
    balance_due = invoice.get("total", 0) - total_paid

    invoice["amount_paid"] = total_paid
    invoice["balance_due"] = balance_due
    invoice["payment_status"] = (
        "paid" if balance_due <= 0 else ("partially_paid" if total_paid > 0 else "pending")
    )

    supabase_client.table("invoices").update(
        {
            "amount_paid": total_paid,
            "balance_due": balance_due,
            "payment_status": invoice["payment_status"],
            "status": invoice["payment_status"],
        }
    ).eq("id", invoice_id).execute()

    return invoice


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, ctx: UserContext = Depends(_can_bill)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    response = (
        supabase_client.table("invoices").delete().eq("id", invoice_id).eq("salon_id", ctx.salon_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return {"message": "Invoice deleted successfully"}


# ========== Payment Endpoints ==========


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentResponse)
async def add_payment(invoice_id: str, payment_data: PaymentCreate, ctx: UserContext = Depends(_can_bill)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = _fetch_invoice_or_404(invoice_id, ctx.salon_id)

    balance = invoice.get("total", 0) - invoice.get("amount_paid", 0)
    if payment_data.amount > balance:
        raise HTTPException(status_code=400, detail=f"Payment amount cannot exceed balance due (Rs. {balance})")

    payment_dict = payment_data.dict()
    payment_dict["invoice_id"] = invoice_id
    if not payment_dict.get("payment_date"):
        payment_dict["payment_date"] = date.today().isoformat()

    response = supabase_client.table("payments").insert(payment_dict).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to record payment")

    total_paid = invoice.get("amount_paid", 0) + payment_data.amount
    balance_due = invoice.get("total", 0) - total_paid

    supabase_client.table("invoices").update(
        {
            "amount_paid": total_paid,
            "balance_due": balance_due,
            "payment_status": "paid" if balance_due <= 0 else "partially_paid",
            "status": "paid" if balance_due <= 0 else "pending",
        }
    ).eq("id", invoice_id).execute()

    return response.data[0]


@router.get("/invoices/{invoice_id}/payments")
async def get_invoice_payments(invoice_id: str, ctx: UserContext = Depends(_staff_or_owner)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    _fetch_invoice_or_404(invoice_id, ctx.salon_id)

    response = (
        supabase_client.table("payments")
        .select("*")
        .eq("invoice_id", invoice_id)
        .order("payment_date", desc=True)
        .execute()
    )
    return response.data if response.data else []


# ========== Stats Endpoint ==========


@router.get("/stats")
async def get_billing_stats(ctx: UserContext = Depends(_staff_or_owner), period: str = Query("month")):
    if not ctx.salon_id:
        return {"error": "No salon found"}

    result = (
        supabase_client.table("invoices")
        .select("total")
        .eq("salon_id", ctx.salon_id)
        .eq("status", "paid")
        .execute()
    )
    total_revenue = sum(inv.get("total", 0) for inv in (result.data or []))

    count_result = (
        supabase_client.table("invoices").select("*", count="exact").eq("salon_id", ctx.salon_id).execute()
    )
    total_invoices = count_result.count if count_result.count is not None else 0

    return {
        "total_revenue": total_revenue,
        "total_invoices": total_invoices,
        "average_invoice": total_revenue / total_invoices if total_invoices > 0 else 0,
    }


# ========== PDF Endpoints ==========


def _build_invoice_pdf_payload(invoice_id: str, salon_id: str) -> dict:
    invoice = _fetch_invoice_or_404(invoice_id, salon_id)

    customer = (
        supabase_client.table("customers")
        .select("full_name, phone, email")
        .eq("id", invoice["customer_id"])
        .execute()
    )
    customer_name = customer.data[0]["full_name"] if customer.data else "Unknown"
    customer_phone = customer.data[0].get("phone") if customer.data else None
    customer_email = customer.data[0].get("email") if customer.data else None

    items_response = supabase_client.table("invoice_items").select("*").eq("invoice_id", invoice_id).execute()
    items = items_response.data if items_response.data else []

    return {
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
        "notes": invoice.get("notes", ""),
        "invoice_number_for_filename": invoice.get("invoice_number", "N/A"),
    }


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str, ctx: UserContext = Depends(_staff_or_owner)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice_data = _build_invoice_pdf_payload(invoice_id, ctx.salon_id)
    pdf_buffer = generate_invoice_pdf(invoice_data)

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Invoice_{invoice_data["invoice_number_for_filename"]}.pdf"'
        },
    )


@router.get("/invoices/{invoice_id}/print")
async def print_invoice_pdf(invoice_id: str, ctx: UserContext = Depends(_staff_or_owner)):
    if not ctx.salon_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice_data = _build_invoice_pdf_payload(invoice_id, ctx.salon_id)
    pdf_buffer = generate_invoice_pdf(invoice_data)

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="Invoice_{invoice_data["invoice_number_for_filename"]}.pdf"'
        },
    )


# ============================================
# CUSTOMER-SCOPED ENDPOINTS
#
# These are deliberately separate from the owner/staff `/invoices...`
# routes above rather than just relaxing the role check on those routes:
# a customer must only ever see their OWN invoices, never the salon's
# full list - that exact mistake (any customer could list every invoice
# for the whole salon) was the original vulnerability this router was
# rewritten to close. Keeping the routes separate makes that boundary
# structural rather than a runtime "if role == customer, filter by
# customer_id" branch that could be forgotten later.
# ============================================
_customer_only = require_roles("customer")


def _fetch_customer_invoice_or_404(invoice_id: str, salon_id: str, customer_id: str) -> dict:
    response = (
        supabase_client.table("invoices")
        .select("*")
        .eq("id", invoice_id)
        .eq("salon_id", salon_id)
        .eq("customer_id", customer_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return response.data[0]


@router.get("/my-invoices")
async def get_my_invoices(
    ctx: UserContext = Depends(_customer_only),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    if not ctx.salon_id or not ctx.customer_id:
        return []

    query = (
        supabase_client.table("invoices")
        .select("*")
        .eq("salon_id", ctx.salon_id)
        .eq("customer_id", ctx.customer_id)
        .order("date", desc=True)
        .limit(limit)
    )
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    response = query.execute()
    return response.data if response.data else []


@router.get("/my-invoices/{invoice_id}")
async def get_my_invoice(invoice_id: str, ctx: UserContext = Depends(_customer_only)):
    if not ctx.salon_id or not ctx.customer_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = _fetch_customer_invoice_or_404(invoice_id, ctx.salon_id, ctx.customer_id)

    items_response = supabase_client.table("invoice_items").select("*").eq("invoice_id", invoice_id).execute()
    invoice["items"] = items_response.data if items_response.data else []

    payments_response = (
        supabase_client.table("payments")
        .select("amount, payment_method, payment_date")
        .eq("invoice_id", invoice_id)
        .order("payment_date", desc=True)
        .execute()
    )
    invoice["payments"] = payments_response.data if payments_response.data else []

    return invoice


@router.get("/my-invoices/{invoice_id}/pdf")
async def download_my_invoice_pdf(invoice_id: str, ctx: UserContext = Depends(_customer_only)):
    if not ctx.salon_id or not ctx.customer_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Confirms ownership before building the PDF - _build_invoice_pdf_payload
    # only checks salon_id, so a customer_id check happens here first.
    _fetch_customer_invoice_or_404(invoice_id, ctx.salon_id, ctx.customer_id)

    invoice_data = _build_invoice_pdf_payload(invoice_id, ctx.salon_id)
    pdf_buffer = generate_invoice_pdf(invoice_data)

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Invoice_{invoice_data["invoice_number_for_filename"]}.pdf"'
        },
    )
