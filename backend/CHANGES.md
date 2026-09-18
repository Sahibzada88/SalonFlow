# Changes from the original backend

## Security fixes

1. **Broken access control on billing (critical).** `GET /billing/invoices`,
   `/billing/stats`, `/billing/invoices/{id}`, and the PDF endpoints
   previously had no role check at all - only "does this token map to a
   salon_id" (which is also true for customers). Any registered customer
   could list/download every invoice, every payment, and revenue stats for
   the entire salon. Fixed: the whole billing router now requires
   `owner`/`staff`, and money-moving actions additionally require the
   `can_bill` staff permission.

2. **Broken access control on appointments (critical).** `GET
   /appointments/` had the same gap - a customer could list every
   appointment in the salon. Fixed: that route is now `owner`/`staff` only;
   customers use `/appointments/customer/appointments`, which is scoped to
   `customer_id`.

3. **IDOR on reschedule response.** `PATCH /appointments/{id}/respond`
   never verified the appointment belonged to the calling customer before
   accepting/cancelling it - any customer could act on any other
   customer's appointment by ID. Fixed: ownership is checked before calling
   the RPC.

4. **Staff could delete other staff.** `DELETE /staff/{id}` checked "same
   salon" but not `is_owner`. Fixed: now requires the `owner` role.

5. **Staff were locked out of customer management.** `customers.py`
   resolved salon scope via `salons.owner_id` only, so staff accounts got
   empty lists / 400s. Fixed: resolved via the same `UserContext.salon_id`
   used everywhere else, which correctly covers staff.

6. **CORS misconfiguration.** `allow_origins=["*"]` with
   `allow_credentials=True`. Fixed: real allowlist via `CORS_ALLOWED_ORIGINS`
   env var.

7. **Weak/absent secret handling.** `JWT_SECRET_KEY` had a hardcoded
   placeholder default and `DEBUG` defaulted to `True`. Fixed: no default
   secret (app fails to start if missing from env), `DEBUG` now defaults to
   `False`. `.env.example` added; `.gitignore` (previously empty in both
   frontend and backend) now actually excludes `.env` and other secrets.

8. **Weak temporary passwords.** Staff temp passwords were generated with
   `random.choices()`, which is not cryptographically secure. Fixed: uses
   `secrets.choice()`.

9. **No login rate limiting.** Added a small in-memory limiter (5 attempts /
   60s per IP+identifier). This is process-local, not distributed - fine as
   a first line of defense, but put a real rate limiter (Redis-backed, or
   at your reverse proxy) in front of this in production with multiple
   instances.

10. **Information leakage via error responses.** Every route wrapped its
    body in `except Exception as e: raise HTTPException(400, str(e))`,
    collapsing every failure into HTTP 400 and echoing raw exception text
    (including DB errors) to the client. Fixed: routes let `HTTPException`s
    propagate with their real status codes; anything unexpected is caught by
    a global handler that logs the full traceback server-side and returns a
    generic message to the client (unless `DEBUG=true`).

## Bug fixes (not security, but real bugs)

11. **Route-ordering bug hid `/appointments/notifications`.**
    `GET /{appointment_id}` was declared before `GET /notifications` in the
    same router. Since routes are matched in declaration order and
    `/notifications` is a single path segment, it satisfied
    `{appointment_id}` first and was captured by `get_appointment("notifications")`.
    Fixed by declaring all fixed-path routes before any `/{appointment_id}...`
    route.

12. **`GET /appointments/{id}` could never find most appointments.** It
    called the `get_appointments` RPC with `p_limit=1`, then searched that
    single-row result for a match - meaning only the single most recent
    appointment in the salon was ever retrievable by ID. Fixed: raised the
    limit (a dedicated single-row RPC would be the ideal long-term fix; see
    the SQL notes).

13. **Duplicate route definition.** `PATCH /appointments/{id}/approve` was
    defined twice with identical path/method; the second silently shadowed
    the first. Consolidated into one implementation.

14. **Dead/unused code removed.** `app/core/security.py` (a full
    JWT-issuing + bcrypt password-hashing implementation) was never
    actually used - login goes through Supabase Auth, not this code. The
    SQLAlchemy models in `app/models/` (with a `UserRole` enum that doesn't
    even match the real roles in use - `reception`/`admin` vs. the actual
    `owner`/`staff`/`customer`) and `app/core/database.py` were similarly
    unused; no route ever queried through them. Removed both, along with
    the now-unneeded `sqlalchemy`/`alembic`/`psycopg2-binary` dependencies,
    to reduce confusion about which code path is actually live.

15. **Duplicate/garbled `requirements1.txt`** (UTF-16-encoded, redundant
    with `requirements.txt`) removed. **Empty `Dockerfile`** (0 bytes in the
    original) replaced with a working one. Duplicate Vercel entrypoint
    (`app/api/index.py` and `api/index.py`, near-identical) reduced to one.

## Addendum (added alongside the frontend rewrite)

16. **Added `POST /auth/register-owner`.** The frontend's owner
    registration page originally posted to `/auth/register`, which never
    existed on this backend - that flow was completely broken. Rather than
    resurrecting a generic `/register` endpoint that accepts a client-chosen
    `role` (a privilege-escalation risk), a dedicated endpoint was added
    that always creates an `owner` account with no salon attached; the new
    owner is then sent to the already owner-gated `POST /salons/setup` to
    create their own salon.

## Addendum 2: httpOnly session cookie (fixes the localStorage XSS risk)

17. **Token storage moved from client-readable to httpOnly cookie.**
    `POST /auth/login` no longer returns `access_token` in the JSON body at
    all - it's set as an `httpOnly`, `Secure` (in production), cookie
    instead. This means client-side JavaScript (including any XSS payload
    that might ever get injected into the frontend) can no longer read the
    session token. `get_current_user` now reads the token from that cookie
    first, falling back to a Bearer `Authorization` header only for
    non-browser API clients (curl/Postman/etc). A new `POST /auth/logout`
    endpoint was added to clear the cookie server-side, since the frontend
    can no longer just delete it from localStorage itself.

    Cookie attributes (`COOKIE_SECURE`, `COOKIE_SAMESITE`) are
    environment-driven in `app/core/config.py` - production defaults to
    `Secure=true; SameSite=None` (required for a frontend and backend on
    different domains, e.g. Vercel + Render), local dev defaults to
    `Secure=false; SameSite=lax` when `DEBUG=true`. Override via env vars if
    your deployment topology differs (e.g. frontend/backend on the same
    parent domain, where `SameSite=lax` would still work in production too).

## Addendum 3: owner self-registration removed, customer billing view added

18. **Removed `POST /auth/register-owner`.** Per product decision, owners
    and staff no longer self-register through the app at all - only login.
    Owner accounts go back to being provisioned the original way (see
    `database/owner_creation_script.md`), and staff accounts are created by
    an owner via `POST /auth/staff` (unchanged). The `OwnerCreate` schema
    and endpoint added in Addendum 1 were deleted entirely rather than left
    disabled, so there's no dead/confusing code path left behind.

19. **Added customer-scoped invoice endpoints**: `GET /billing/my-invoices`,
    `GET /billing/my-invoices/{id}`, `GET /billing/my-invoices/{id}/pdf`.
    These are intentionally separate routes from the owner/staff
    `/billing/invoices...` routes rather than a relaxed role check on those
    - every query filters by both `salon_id` AND `customer_id` matching the
    calling customer, so a customer can only ever see their own invoices.
    This is the properly-scoped version of the exact vulnerability
    described in Security fix #1 above (any customer could previously see
    every invoice in the salon); the fix there was to block customer access
    to billing entirely, and this addendum restores customer access the
    correct way instead of leaving it closed off.

## Addendum 4: self-healing customer salon assignment (single-salon-per-deployment model)

20. **`get_current_user()` now self-heals a missing/broken `customers` row
    for customer accounts**, instead of leaving them permanently unable to
    book appointments, view invoices, etc. (they'd hit "No salon found for
    this user" on every action). Confirmed deployment model: each salon
    runs its own separate instance and database, so within any one
    database there is exactly one salon (or none yet, if the owner hasn't
    finished `/salon-setup`) - "which salon does this customer belong to"
    is therefore unambiguous. If a customer's `customers` row is missing or
    has a null `salon_id` (most likely from an interrupted registration -
    the same class of issue fixed for the `users` table earlier), they're
    now automatically attached to the one salon in the database, the same
    way `register_customer()` already does at signup time. This is
    read-repair, not a new capability: it only ever assigns the single
    salon that already exists in this deployment's database, never
    "picks" between multiple salons or attaches a customer to the wrong
    one.

## Addendum 5: role resolution was keying off the wrong field

21. **`get_current_user()` branched on `is_owner`/`is_staff`/`is_customer`
    booleans to decide how to resolve `salon_id` - but those booleans
    aren't the field the rest of the app actually treats as authoritative
    (`login()` reads/returns `role` as text; the DB trigger defaults
    `role` to `'customer'`; the frontend stores `user_role` from that same
    text field). In practice a real account was found where `role` was
    correctly `'customer'` but `is_customer` was `false` - so the
    if/elif chain matched nothing, `salon_id` was never resolved, and
    (notably) no diagnostic trail was left at all, since no customers-table
    query ever ran. Branching now happens on `role` (text) directly, with
    the boolean columns OR'd in as a secondary signal rather than being the
    sole source of truth - matching how the original codebase used `role`
    everywhere else.

## Addendum 6: adopted the original project's salon-resolution order exactly

22. **Replaced the `role`-gated branching in `get_current_user()` with the
    original project's unconditional table-check order.** Addendum 5 fixed
    one failure mode (booleans out of sync with `role`), but the same
    class of bug can happen with `role` itself being unreliable too. The
    original `core/helpers.py::get_user_salon_id()` never trusted any
    role/boolean column at all - it simply checked `customers` (by id),
    then `salons` (by owner_id), then `staff` (by user_id), in that fixed
    order, and used whichever table actually had a matching row. That
    exact order and approach is now what `get_current_user()` does, with
    the self-healing fallback from Addendum 4 kept as a last resort only
    when none of the three tables match anything and `role='customer'`.
    No SQL/database changes are required for this fix - it's purely an
    application-layer change, and confirmed compatible with the current
    RLS/service_role setup (the `salons` and `users` table reads already
    prove `service_role` bypass is working for plain SELECTs).

## Addendum 7: full single-salon rebuild (schema, services, feedback)

23. **Database rebuilt from scratch for a true single-salon model.** See
    `database/00_drop_existing.sql` + `database/01_fresh_schema.sql`. The
    `is_owner`/`is_staff`/`is_customer` boolean columns are gone entirely -
    `role` is now the only source of truth (this is what Addendum 5/6 were
    already working around; the new schema removes the inconsistency at
    its root instead of coding around it). A `salons` table trigger
    enforces there is ever only one row; a shared `assign_single_salon()`
    trigger auto-fills `salon_id` on insert for customers/staff/services/
    appointments/invoices, so the backend never needs to look up or pass a
    salon_id for these - see `auth.py`'s simplified `register_customer()`.
    The `'scheduled'` appointment status - never actually reachable by the
    real booking flow, and the root cause of two separate silent bugs
    (the dashboard's "next appointment" widget, and a double-booking
    conflict check in `appointments.py` that never actually fired) - has
    been removed from the valid status set.

24. **Added `services` (owner/staff-managed catalog, browsable by
    everyone) and `feedback` (customer reviews, one per completed
    appointment) tables**, with matching routers `app/api/v1/services.py`
    and `app/api/v1/feedback.py`. Feedback is intentionally tied to a
    specific `appointment_id` (unique constraint - one review per visit)
    rather than being a free-floating service review, and can only be
    submitted by the appointment's own customer once its status is
    `'completed'`.

25. **Added `PUT /staff/{id}`** for editing an existing staff member's
    position/permissions/phone/active-status - previously only create and
    delete existed.

## Addendum 8: session-contamination bug, CORS crash, invoice price locking

26. **Fixed a real bug where `register_customer()`/`login()`'s own
    Supabase Auth calls (`sign_up()`, `sign_in_with_password()`) were made
    on the same module-level `supabase_client` singleton used for every
    service-role table/RPC query.** supabase-py updates a client's
    Authorization header to the resulting session's access token after
    either call - so immediately after signup, that shared client started
    sending the new customer's token instead of the service-role key,
    and the very next line's `public.users`/`public.customers` inserts
    were rejected by RLS. This is what caused the "works for owner, not
    for this customer" and "RLS violation on register" symptoms chased in
    earlier addenda - the schema/role fixes were real and worth keeping,
    but this was the actual root cause. Fixed via a new
    `get_auth_client()` in `supabase_client.py` that returns a fresh,
    throwaway client for every sign_up/sign_in call, never reusing the
    shared service-role singleton (see the comments there for why a fresh
    client per call, not just a second shared one, is the correct fix).

27. **Fixed a startup crash**: `CORS_ALLOWED_ORIGINS` was typed
    `List[str]`, which makes pydantic-settings try to JSON-decode the raw
    `.env` value before any of our own parsing runs - a plain
    comma-separated value like `http://localhost:3000,http://127.0.0.1:3000`
    crashed the app at import time with `SettingsError: error parsing
    value for field "CORS_ALLOWED_ORIGINS"`. Fixed by keeping the setting
    as a plain `str` and exposing a `cors_allowed_origins` property that
    splits it - `main.py` updated to use the property.

28. **Invoice price locking**: `POST /billing/invoices` now looks up the
    linked appointment's service price fresh from the `services` table
    and uses it to build the invoice's line item itself, ignoring
    whatever price the request body submitted - only when
    `appointment_id` is provided and that appointment has a service
    attached. Services are owner-set, so their price shouldn't be
    something a client-side request can quietly override; discount and
    tax remain freely editable per invoice as before. A manual invoice
    with no appointment (or an appointment with no service) still uses
    the submitted items unchanged.

29. **Added `DELETE /appointments/{id}`** (owner/staff only) - this route
    didn't exist at all; the frontend's delete button called an endpoint
    that had never been implemented.

## Known limitation this backend change does NOT fix

Row Level Security is no longer purely decorative - `database/01_fresh_schema.sql`
includes real, correct policies (owner/staff full access, customer
own-data-only) - but it's still true that this backend's normal operation
never exercises them, since every query uses the service-role key. They
matter only if a future code path talks to Supabase directly from the
browser with the anon/authenticated key.
