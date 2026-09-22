# SalonFlow Database

Single-salon schema: one salon per deployment, every customer/staff
member/appointment/invoice/service automatically belongs to it.

## Run order (Supabase SQL Editor)

1. **`00_drop_existing.sql`** - only if you're resetting an existing
   project (wipes old tables/functions/triggers). Skip on a brand new
   Supabase project.
2. **`01_fresh_schema.sql`** - creates everything: tables, triggers
   (including the single-salon auto-assignment and enforcement logic),
   RPC functions the backend calls, and RLS policies. Already includes
   everything from the patch files below - only run those separately if
   you already had `01_fresh_schema.sql` running before this update.
3. **`02_create_owner.sql`** - creates the one owner account and the one
   salon. Read the instructions at the top of the file first - it
   requires you to create the Auth user via the Supabase Dashboard
   before running this script.

### Patches (only if upgrading an existing database)

If you already ran `01_fresh_schema.sql` before a given feature was
added, run its patch file once instead of the whole schema:

- **`03_patch_service_price.sql`** - adds `service_price` to the
  `get_appointments()` RPC output.
- **`04_patch_multi_service_and_permissions.sql`** - adds the
  `appointment_services` table (multi-service appointments) and the two
  new staff permission keys (`can_manage_customers`, `can_manage_services`),
  including backfilling both for existing appointments/staff rows.

After that, start the backend (see `../backend/README.md`) and the
frontend (see `../frontend/README.md`). Customers register themselves
through the app as normal and are attached to the salon automatically.

## What changed vs. the original schema

See `../backend/CHANGES.md` (Addendum 7 onward) for the full reasoning:
no more `is_owner`/`is_staff`/`is_customer` boolean columns (replaced
entirely by the single `role` column), a real single-salon guarantee
enforced at the database level, new `services` and `feedback` tables, a
fixed appointment status lifecycle (the dead `'scheduled'` status is
gone), multi-service appointments (`appointment_services`), and expanded,
owner-customizable staff permissions.
