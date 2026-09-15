# SalonFlow Database

Single-salon schema: one salon per deployment, every customer/staff
member/appointment/invoice/service automatically belongs to it.

## Run order (Supabase SQL Editor)

1. **`00_drop_existing.sql`** - only if you're resetting an existing
   project (wipes old tables/functions/triggers). Skip on a brand new
   Supabase project.
2. **`01_fresh_schema.sql`** - creates everything: tables, triggers
   (including the single-salon auto-assignment and enforcement logic),
   RPC functions the backend calls, and RLS policies.
3. **`02_create_owner.sql`** - creates the one owner account and the one
   salon. Read the instructions at the top of the file first - it
   requires you to create the Auth user via the Supabase Dashboard
   before running this script.

After that, start the backend (see `../backend/README.md`) and the
frontend (see `../frontend/README.md`). Customers register themselves
through the app as normal and are attached to the salon automatically.

## What changed vs. the original schema

See `../backend/CHANGES.md` (Addendum 7 and around) for the full
reasoning: no more `is_owner`/`is_staff`/`is_customer` boolean columns
(replaced entirely by the single `role` column), a real single-salon
guarantee enforced at the database level, new `services` and `feedback`
tables, and a fixed appointment status lifecycle (the dead `'scheduled'`
status is gone).
