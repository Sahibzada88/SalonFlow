-- ============================================================
-- SalonFlow - Drop old schema
-- ============================================================
-- Run this FIRST in the Supabase SQL Editor to wipe everything from
-- the old multi-salon schema (tables, functions, triggers, RLS
-- policies). Then run schema.sql to create the fresh single-salon
-- schema from scratch.
--
-- Safe to run even if some of these objects don't exist - every
-- statement uses IF EXISTS.
-- ============================================================

-- Trigger on auth.users isn't dropped by cascading from public
-- tables (auth.users isn't part of our schema), so drop it explicitly.
drop trigger if exists trg_handle_new_user on auth.users;
drop trigger if exists on_auth_user_created on auth.users;  -- old project may have used this name instead

-- Tables (CASCADE removes their triggers, RLS policies, and FKs
-- automatically; does NOT remove standalone functions, which are
-- dropped explicitly below).
drop table if exists public.feedback cascade;
drop table if exists public.notifications cascade;
drop table if exists public.payments cascade;
drop table if exists public.invoice_items cascade;
drop table if exists public.invoices cascade;
drop table if exists public.appointments cascade;
drop table if exists public.services cascade;
drop table if exists public.customers cascade;
drop table if exists public.staff cascade;
drop table if exists public.salons cascade;
drop table if exists public.users cascade;

-- RPC / trigger functions from the old schema.
drop function if exists public.get_customers(uuid, text, int, int);
drop function if exists public.upsert_customer(uuid, text, text, text, text, text, uuid);
drop function if exists public.delete_customer(uuid, uuid);
drop function if exists public.get_appointments(uuid, uuid, date, date, text, int);
drop function if exists public.request_appointment(uuid, uuid, text, date, time, time, text);
drop function if exists public.request_appointment(uuid, uuid, text, date, time, time, text, uuid);
drop function if exists public.upsert_appointment(uuid, uuid, date, time, time, text, text, text, uuid, uuid, uuid);
drop function if exists public.approve_appointment(uuid, uuid, date, time, text);
drop function if exists public.customer_respond_reschedule(uuid, boolean);
drop function if exists public.update_appointment_status(uuid, uuid, text);
drop function if exists public.record_payment(uuid, uuid, int, text, date, text, text);
drop function if exists public.get_invoice_stats(uuid);
drop function if exists public.get_invoice_with_payments(uuid, uuid);
drop function if exists public.get_invoices(uuid, uuid, date, date, text, int);
drop function if exists public.get_dashboard_stats(uuid);
drop function if exists public.handle_new_user();
drop function if exists public.update_customer_stats();
drop function if exists public.update_customer_spent();
drop function if exists public.update_invoice_payment_status();
drop function if exists public.enforce_single_salon();
drop function if exists public.assign_single_salon();
drop function if exists public.is_owner_or_staff(uuid);

-- Old models/leftover objects, if they exist from a previous attempt.
drop function if exists public.get_customer_stats(uuid, uuid);
