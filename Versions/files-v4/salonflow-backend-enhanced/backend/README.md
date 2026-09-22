# SalonFlow Backend (Hardened)

This is a security- and correctness-focused rewrite of the original
SalonFlow FastAPI backend. Functionality is unchanged from the user's
point of view; what changed is *who is allowed to call what*, plus several
bug fixes and cleanups. See `CHANGES.md` for the full list.

## Setup

```bash
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, CORS_ALLOWED_ORIGINS, etc.
pip install -r requirements.txt --break-system-packages   # or use a venv
uvicorn app.main:app --reload
```

The app will refuse to start if `SUPABASE_URL` or `SUPABASE_SERVICE_KEY`
are missing (previously it would silently boot with a broken/placeholder
config). No hardcoded fallback secrets remain anywhere.

## Database setup (required, run first)

This version uses a rebuilt, single-salon schema with new `services` and
`feedback` tables. In the Supabase SQL Editor, run, in order:

1. `../database/00_drop_existing.sql` - only if resetting an existing
   project; wipes the old tables/functions. Skip this on a brand new
   Supabase project.
2. `../database/01_fresh_schema.sql` - creates everything (tables,
   triggers, RPC functions, RLS policies) from scratch.

Then create the owner account and salon by running
`../database/02_create_owner.sql` (see the instructions in that file -
owner/staff accounts have no self-registration form anymore, only login,
so this SQL script is the only way to create the first owner). There is
only ever one salon per deployment; every customer that registers
afterward is attached to it automatically.

## Project layout

```
app/
  main.py                 FastAPI app, CORS, global error handler
  core/
    config.py             Settings (env-driven, fails fast if misconfigured)
    logging_config.py     Structured logging (replaces scattered print())
    supabase_client.py    Supabase client (service-role key)
    auth_deps.py          <-- the core fix: centralized identity/role/permission
  api/v1/
    auth.py                Registration, login, staff creation
    salons.py               Salon setup (owner only)
    dashboard.py             Dashboard stats (owner/staff only)
    customers.py           Customer CRUD (owner/staff only)
    appointments.py         Booking, approval, reschedule flow
    billing.py              Invoices & payments (owner/staff only)
    staff.py                 Staff list/removal (owner only for removal)
  utils/
    invoice_pdf.py          PDF generation (unchanged)
```

## The core architectural fix: `app/core/auth_deps.py`

Every route in the original code re-implemented its own auth/authorization
check inline, and they drifted out of sync with each other. Some resolved
"salon scope" via `salons.owner_id` only (locking staff out), others via a
helper that *also* resolves scope for customer accounts (letting customers
reach owner/staff-only data), and none of them checked role vs. permission
consistently.

`auth_deps.py` now resolves identity **once**, in one place:

```python
ctx: UserContext = Depends(get_current_user)              # any authenticated user
ctx: UserContext = Depends(require_roles("owner"))          # owner only
ctx: UserContext = Depends(require_roles("owner", "staff"))  # staff or owner
ctx: UserContext = Depends(require_permission("can_bill"))   # owner, or staff with that permission
```

`UserContext` carries `salon_id` (resolved correctly per role), and for
staff, the `staff.permissions` JSONB column (`can_book` / `can_approve` /
`can_bill`) is now actually enforced - previously that column existed in
the schema but nothing ever checked it.

See `CHANGES.md` for the specific bugs this closes.
