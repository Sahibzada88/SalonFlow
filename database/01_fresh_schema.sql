-- ============================================================
-- SalonFlow - Fresh single-salon schema
-- ============================================================
-- Run this once in the Supabase SQL Editor, on a clean project.
-- If you're resetting an EXISTING project, run 00_drop_existing.sql
-- FIRST, then run this file.
--
-- DESIGN: this deployment serves exactly ONE salon. Every
-- customer, staff member, service, appointment, and invoice
-- belongs to that single salon automatically - there is no
-- salon-selection step anywhere, and no "which salon does this
-- belong to" ambiguity. See assign_single_salon() below.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- USERS
-- ============================================================
-- `role` is the single source of truth for what kind of account
-- this is. (The original app also had is_owner/is_staff/is_customer
-- boolean columns; those were dropped here because they could get
-- out of sync with `role` in practice and caused real bugs.)
create table public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    username text unique,
    full_name text not null,
    phone text,
    role text not null default 'customer' check (role in ('owner', 'staff', 'customer')),
    is_active boolean not null default true,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================
-- SALON (singleton - see enforce_single_salon() trigger below)
-- ============================================================
create table public.salons (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_id uuid not null references public.users(id),
    address text,
    city text,
    phone text,
    email text,
    logo_url text,
    opening_time time not null default '09:00:00',
    closing_time time not null default '21:00:00',
    timezone text not null default 'Asia/Karachi',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.enforce_single_salon()
returns trigger
language plpgsql
as $$
begin
    if (select count(*) from public.salons) >= 1 then
        raise exception 'Only one salon is allowed in this deployment';
    end if;
    return new;
end;
$$;

create trigger trg_enforce_single_salon
before insert on public.salons
for each row execute function public.enforce_single_salon();

-- ============================================================
-- Helper: auto-assign the single salon's id whenever a row that
-- belongs to "the salon" is inserted without one specified.
-- Used by customers/staff/services/appointments/invoices below,
-- so the application layer never has to look up or pass salon_id
-- for these inserts - there's only ever one possible value.
-- ============================================================
create or replace function public.assign_single_salon()
returns trigger
language plpgsql
security definer
as $$
declare
    v_salon_id uuid;
begin
    if new.salon_id is null then
        select id into v_salon_id from public.salons limit 1;
        new.salon_id := v_salon_id;
    end if;
    return new;
end;
$$;

-- ============================================================
-- STAFF
-- ============================================================
create table public.staff (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references public.users(id) on delete cascade,
    salon_id uuid references public.salons(id) on delete cascade,
    position text,
    permissions jsonb not null default '{"can_book": true, "can_approve": true, "can_bill": true}'::jsonb,
    is_active boolean not null default true,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger trg_staff_assign_salon
before insert on public.staff
for each row execute function public.assign_single_salon();

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table public.customers (
    id uuid primary key default gen_random_uuid(),
    salon_id uuid references public.salons(id) on delete cascade,
    full_name text not null,
    email text,
    phone text,
    address text,
    notes text,
    total_visits int not null default 0,
    total_spent int not null default 0,
    last_visit date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger trg_customers_assign_salon
before insert on public.customers
for each row execute function public.assign_single_salon();

-- ============================================================
-- SERVICES  (new: owner-managed service catalog)
-- ============================================================
create table public.services (
    id uuid primary key default gen_random_uuid(),
    salon_id uuid references public.salons(id) on delete cascade,
    name text not null,
    description text,
    duration int not null default 30,   -- minutes
    price int not null default 0,
    category text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger trg_services_assign_salon
before insert on public.services
for each row execute function public.assign_single_salon();

-- ============================================================
-- APPOINTMENTS
-- ============================================================
-- NOTE ON STATUS VALUES: the original schema allowed a 'scheduled'
-- status that the real booking flow never actually produced
-- (requested -> approved/rescheduled_pending -> approved/cancelled/
-- completed), which silently broke the dashboard's "next
-- appointment" widget and the customer-stats trigger (both filtered
-- on 'scheduled'). 'scheduled' has been removed from the valid set
-- here; every function/trigger below is written against the
-- statuses that are actually reachable.
create table public.appointments (
    id uuid primary key default gen_random_uuid(),
    salon_id uuid references public.salons(id) on delete cascade,
    customer_id uuid references public.customers(id) on delete cascade,
    staff_id uuid references public.staff(id),
    service_id uuid references public.services(id),
    title text,
    date date not null,
    start_time time not null,
    end_time time not null,
    status text not null default 'requested'
        check (status in ('requested', 'approved', 'rescheduled_pending', 'completed', 'cancelled', 'no-show')),
    notes text,
    requested_by uuid references public.users(id),
    approved_by uuid references public.users(id),
    approved_at timestamptz,
    original_date date,
    original_start_time time,
    reschedule_reason text,
    customer_accepted boolean,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger trg_appointments_assign_salon
before insert on public.appointments
for each row execute function public.assign_single_salon();

-- ============================================================
-- INVOICES / INVOICE ITEMS / PAYMENTS
-- ============================================================
create table public.invoices (
    id uuid primary key default gen_random_uuid(),
    salon_id uuid references public.salons(id) on delete cascade,
    appointment_id uuid references public.appointments(id),
    customer_id uuid not null references public.customers(id),
    invoice_number text not null,
    date date not null default current_date,
    subtotal int not null default 0,
    discount int not null default 0,
    tax int not null default 0,
    total int not null default 0,
    status text not null default 'pending',
    payment_method text not null default 'cash',
    notes text,
    amount_paid int not null default 0,
    balance_due int not null default 0,
    payment_status text not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger trg_invoices_assign_salon
before insert on public.invoices
for each row execute function public.assign_single_salon();

create table public.invoice_items (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references public.invoices(id) on delete cascade,
    description text not null,
    quantity int not null default 1,
    unit_price int not null default 0,
    total int not null default 0,
    created_at timestamptz not null default now()
);

create table public.payments (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references public.invoices(id) on delete cascade,
    amount int not null,
    payment_date date not null default current_date,
    payment_method text not null default 'cash',
    reference text,
    notes text,
    created_at timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    title text not null,
    message text not null,
    type text not null,
    read boolean not null default false,
    link text,
    created_at timestamptz not null default now()
);

-- ============================================================
-- FEEDBACK  (new: customer reviews, tied to a specific completed appointment)
-- ============================================================
create table public.feedback (
    id uuid primary key default gen_random_uuid(),
    salon_id uuid references public.salons(id) on delete cascade,
    appointment_id uuid not null unique references public.appointments(id) on delete cascade,
    customer_id uuid not null references public.customers(id) on delete cascade,
    service_id uuid references public.services(id),
    rating int not null check (rating between 1 and 5),
    comment text,
    created_at timestamptz not null default now()
);

create trigger trg_feedback_assign_salon
before insert on public.feedback
for each row execute function public.assign_single_salon();

-- ============================================================
-- handle_new_user - creates the public.users row when someone
-- signs up via Supabase Auth. Does NOT touch customers/staff -
-- those are created explicitly by the backend (register_customer,
-- staff creation), which is where full_name/etc. from the actual
-- form data is available.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.users (id, email, full_name, phone, role, is_active)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.email),
        new.raw_user_meta_data->>'phone',
        coalesce(new.raw_user_meta_data->>'role', 'customer'),
        true
    );
    return new;
end;
$$;

create trigger trg_handle_new_user
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- Stats triggers (fixed to match the real status lifecycle)
-- ============================================================
create or replace function public.update_customer_stats()
returns trigger
language plpgsql
security definer
as $$
begin
    update public.customers
    set
        total_visits = (
            select count(*) from public.appointments
            where customer_id = coalesce(new.customer_id, old.customer_id)
                and status in ('approved', 'completed')
        ),
        last_visit = (
            select max(date) from public.appointments
            where customer_id = coalesce(new.customer_id, old.customer_id)
                and status in ('approved', 'completed')
        )
    where id = coalesce(new.customer_id, old.customer_id);
    return coalesce(new, old);
end;
$$;

create trigger trg_update_customer_stats
after insert or update or delete on public.appointments
for each row execute function public.update_customer_stats();

create or replace function public.update_customer_spent()
returns trigger
language plpgsql
security definer
as $$
begin
    update public.customers
    set total_spent = (
        select coalesce(sum(total), 0) from public.invoices
        where customer_id = new.customer_id and status = 'paid'
    )
    where id = new.customer_id;
    return new;
end;
$$;

create trigger trg_update_customer_spent
after insert or update or delete on public.invoices
for each row execute function public.update_customer_spent();

create or replace function public.update_invoice_payment_status()
returns trigger
language plpgsql
as $$
declare
    total_paid int;
    invoice_total int;
begin
    select coalesce(sum(amount), 0) into total_paid
    from public.payments where invoice_id = new.invoice_id;

    select total into invoice_total from public.invoices where id = new.invoice_id;

    update public.invoices
    set
        amount_paid = total_paid,
        balance_due = invoice_total - total_paid,
        payment_status = case
            when invoice_total - total_paid <= 0 then 'paid'
            when total_paid > 0 then 'partially_paid'
            else 'pending'
        end,
        status = case when invoice_total - total_paid <= 0 then 'paid' else 'pending' end
    where id = new.invoice_id;

    return new;
end;
$$;

create trigger trg_update_invoice_payment_status
after insert or update or delete on public.payments
for each row execute function public.update_invoice_payment_status();

-- ============================================================
-- RPCs used by the backend
-- ============================================================

create or replace function public.get_customers(
    p_salon_id uuid, p_search text default null, p_limit int default 50, p_offset int default 0
) returns jsonb language plpgsql security definer as $$
declare v_result jsonb;
begin
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'salon_id', salon_id, 'full_name', full_name, 'email', email,
        'phone', phone, 'address', address, 'notes', notes, 'total_visits', total_visits,
        'total_spent', total_spent, 'last_visit', last_visit, 'created_at', created_at
    ) order by full_name), '[]'::jsonb) into v_result
    from public.customers
    where salon_id = p_salon_id
        and (p_search is null or full_name ilike '%' || p_search || '%' or email ilike '%' || p_search || '%')
    limit p_limit offset p_offset;
    return v_result;
end; $$;

create or replace function public.upsert_customer(
    p_salon_id uuid, p_full_name text, p_email text default null, p_phone text default null,
    p_address text default null, p_notes text default null, p_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_customer_id uuid;
begin
    if p_id is not null then
        update public.customers set full_name = p_full_name, email = p_email, phone = p_phone,
            address = p_address, notes = p_notes, updated_at = now()
        where id = p_id and salon_id = p_salon_id
        returning id into v_customer_id;
    end if;

    if v_customer_id is null and p_id is null then
        insert into public.customers (salon_id, full_name, email, phone, address, notes)
        values (p_salon_id, p_full_name, p_email, p_phone, p_address, p_notes)
        returning id into v_customer_id;
    end if;

    if v_customer_id is null then
        return null;
    end if;

    select jsonb_build_object(
        'id', id, 'salon_id', salon_id, 'full_name', full_name, 'email', email, 'phone', phone,
        'address', address, 'notes', notes, 'total_visits', total_visits, 'total_spent', total_spent,
        'last_visit', last_visit, 'created_at', created_at
    ) into v_result from public.customers where id = v_customer_id;
    return v_result;
end; $$;

create or replace function public.delete_customer(p_salon_id uuid, p_customer_id uuid)
returns boolean language plpgsql security definer as $$
begin
    delete from public.customers where id = p_customer_id and salon_id = p_salon_id;
    return found;
end; $$;

create or replace function public.get_appointments(
    p_salon_id uuid, p_customer_id uuid default null, p_start_date date default null,
    p_end_date date default null, p_status text default null, p_limit int default 100
) returns jsonb language plpgsql security definer as $$
declare v_result jsonb;
begin
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'customer_id', a.customer_id, 'customer_name', coalesce(c.full_name, 'Unknown'),
        'service_id', a.service_id, 'service_name', coalesce(s.name, ''), 'service_price', s.price,
        'title', coalesce(a.title, 'Service'), 'date', a.date,
        'start_time', left(a.start_time::text, 5), 'end_time', left(a.end_time::text, 5),
        'status', a.status, 'notes', a.notes, 'created_at', a.created_at,
        'original_date', a.original_date, 'original_start_time', left(a.original_start_time::text, 5),
        'reschedule_reason', a.reschedule_reason, 'customer_accepted', a.customer_accepted
    ) order by a.date desc, a.start_time desc), '[]'::jsonb) into v_result
    from public.appointments a
    left join public.customers c on a.customer_id = c.id
    left join public.services s on a.service_id = s.id
    where a.salon_id = p_salon_id
        and (p_customer_id is null or a.customer_id = p_customer_id)
        and (p_start_date is null or a.date >= p_start_date)
        and (p_end_date is null or a.date <= p_end_date)
        and (p_status is null or a.status = p_status)
    limit p_limit;
    return v_result;
end; $$;

create or replace function public.request_appointment(
    p_salon_id uuid, p_customer_id uuid, p_title text, p_date date, p_start_time time,
    p_end_time time, p_notes text default null, p_service_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_appointment_id uuid;
begin
    insert into public.appointments (
        salon_id, customer_id, service_id, title, date, start_time, end_time, status, requested_by, notes
    ) values (
        p_salon_id, p_customer_id, p_service_id, p_title, p_date, p_start_time, p_end_time,
        'requested', p_customer_id, p_notes
    ) returning id into v_appointment_id;

    insert into public.notifications (user_id, title, message, type, link)
    select s.owner_id, 'New Appointment Request', 'Customer has requested an appointment',
        'appointment_request', '/dashboard/appointments'
    from public.salons s where s.id = p_salon_id;

    select jsonb_build_object(
        'id', id, 'customer_id', customer_id, 'service_id', service_id, 'title', title, 'date', date,
        'start_time', start_time, 'end_time', end_time, 'status', status, 'notes', notes, 'created_at', created_at
    ) into v_result from public.appointments where id = v_appointment_id;
    return v_result;
end; $$;

create or replace function public.upsert_appointment(
    p_salon_id uuid, p_customer_id uuid, p_date date, p_start_time time, p_end_time time,
    p_title text default null, p_status text default 'requested', p_notes text default null,
    p_service_id uuid default null, p_staff_id uuid default null, p_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_appointment_id uuid;
begin
    if p_id is not null then
        update public.appointments set customer_id = p_customer_id, title = p_title, date = p_date,
            start_time = p_start_time, end_time = p_end_time, status = p_status, notes = p_notes,
            service_id = p_service_id, staff_id = p_staff_id, updated_at = now()
        where id = p_id and salon_id = p_salon_id
        returning id into v_appointment_id;
    end if;

    if v_appointment_id is null and p_id is null then
        insert into public.appointments (
            salon_id, customer_id, title, date, start_time, end_time, status, notes, service_id, staff_id
        ) values (
            p_salon_id, p_customer_id, p_title, p_date, p_start_time, p_end_time, p_status, p_notes,
            p_service_id, p_staff_id
        ) returning id into v_appointment_id;
    end if;

    if v_appointment_id is null then
        return null;
    end if;

    select jsonb_build_object(
        'id', a.id, 'customer_id', a.customer_id, 'customer_name', coalesce(c.full_name, 'Unknown'),
        'title', coalesce(a.title, 'Service'), 'date', a.date, 'start_time', left(a.start_time::text, 5),
        'end_time', left(a.end_time::text, 5), 'status', a.status, 'notes', a.notes, 'created_at', a.created_at
    ) into v_result from public.appointments a left join public.customers c on a.customer_id = c.id
    where a.id = v_appointment_id;
    return v_result;
end; $$;

create or replace function public.approve_appointment(
    p_appointment_id uuid, p_approved_by uuid, p_new_date date default null,
    p_new_start_time time default null, p_reschedule_reason text default null
) returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_customer_id uuid; v_is_reschedule boolean;
begin
    select customer_id into v_customer_id from public.appointments where id = p_appointment_id;
    v_is_reschedule := (p_new_date is not null or p_new_start_time is not null);

    update public.appointments set
        status = case when v_is_reschedule then 'rescheduled_pending' else 'approved' end,
        approved_by = p_approved_by, approved_at = now(),
        original_date = case when v_is_reschedule then date else null end,
        original_start_time = case when v_is_reschedule then start_time else null end,
        date = coalesce(p_new_date, date), start_time = coalesce(p_new_start_time, start_time),
        reschedule_reason = p_reschedule_reason, updated_at = now()
    where id = p_appointment_id
    returning jsonb_build_object('id', id, 'status', status, 'date', date, 'start_time', start_time, 'end_time', end_time)
    into v_result;

    insert into public.notifications (user_id, title, message, type, link)
    values (
        v_customer_id,
        case when v_is_reschedule then 'Appointment Rescheduled' else 'Appointment Approved' end,
        case when v_is_reschedule then 'Your appointment has been rescheduled. Please confirm or cancel.'
             else 'Your appointment has been confirmed!' end,
        case when v_is_reschedule then 'appointment_rescheduled' else 'appointment_approved' end,
        '/customer/appointments'
    );
    return v_result;
end; $$;

create or replace function public.customer_respond_reschedule(p_appointment_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer as $$
declare v_result jsonb;
begin
    update public.appointments set
        status = case when p_accept then 'approved' else 'cancelled' end,
        customer_accepted = p_accept, updated_at = now()
    where id = p_appointment_id
    returning jsonb_build_object('id', id, 'status', status, 'customer_accepted', customer_accepted) into v_result;
    return v_result;
end; $$;

create or replace function public.update_appointment_status(p_salon_id uuid, p_appointment_id uuid, p_status text)
returns jsonb language plpgsql security definer as $$
declare v_result jsonb;
begin
    update public.appointments set status = p_status, updated_at = now()
    where id = p_appointment_id and salon_id = p_salon_id
    returning jsonb_build_object('id', id, 'status', status, 'updated_at', updated_at) into v_result;
    return v_result;
end; $$;

create or replace function public.record_payment(
    p_salon_id uuid, p_invoice_id uuid, p_amount int, p_payment_method text default 'cash',
    p_payment_date date default current_date, p_reference text default null, p_notes text default null
) returns jsonb language plpgsql security definer as $$
declare v_invoice_total int; v_current_paid int; v_new_balance int; v_payment_id uuid; v_result jsonb;
begin
    select total, coalesce(amount_paid, 0) into v_invoice_total, v_current_paid
    from public.invoices where id = p_invoice_id and salon_id = p_salon_id;

    if not found then
        raise exception 'Invoice not found';
    end if;

    if p_amount > (v_invoice_total - v_current_paid) then
        raise exception 'Payment amount exceeds balance due';
    end if;

    insert into public.payments (invoice_id, amount, payment_method, payment_date, reference, notes)
    values (p_invoice_id, p_amount, p_payment_method, p_payment_date, p_reference, p_notes)
    returning id into v_payment_id;

    v_new_balance := v_invoice_total - v_current_paid - p_amount;

    select jsonb_build_object(
        'id', p_invoice_id, 'amount_paid', v_current_paid + p_amount, 'balance_due', v_new_balance,
        'payment_status', case when v_new_balance <= 0 then 'paid' else 'partially_paid' end,
        'payment_id', v_payment_id
    ) into v_result;
    return v_result;
end; $$;

create or replace function public.get_invoice_stats(p_salon_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_total_revenue int := 0; v_total_invoices int := 0; v_pending_invoices int := 0;
    v_paid_invoices int := 0; v_avg_invoice int := 0;
begin
    select coalesce(sum(total), 0) into v_total_revenue from public.invoices where salon_id = p_salon_id and status = 'paid';
    select count(*) into v_total_invoices from public.invoices where salon_id = p_salon_id;
    select count(*) into v_pending_invoices from public.invoices where salon_id = p_salon_id and payment_status in ('pending', 'partially_paid');
    select count(*) into v_paid_invoices from public.invoices where salon_id = p_salon_id and status = 'paid';
    if v_paid_invoices > 0 then v_avg_invoice := round(v_total_revenue::numeric / v_paid_invoices); end if;
    return jsonb_build_object('total_revenue', v_total_revenue, 'total_invoices', v_total_invoices,
        'pending_invoices', v_pending_invoices, 'paid_invoices', v_paid_invoices, 'avg_invoice', v_avg_invoice);
end; $$;

create or replace function public.get_dashboard_stats(p_salon_id uuid)
returns jsonb language plpgsql security definer as $$
declare
    v_today date := current_date; v_yesterday date := current_date - 1;
    v_this_month date := date_trunc('month', current_date)::date;
    v_total_revenue int := 0; v_today_revenue int := 0; v_yesterday_revenue int := 0;
    v_revenue_growth int := 0; v_today_appointments int := 0; v_yesterday_appointments int := 0;
    v_appointment_growth int := 0; v_upcoming_appointments int := 0; v_total_customers int := 0;
    v_new_customers int := 0; v_customer_growth int := 0; v_next_appointment jsonb; v_recent_appointments jsonb;
begin
    select coalesce(sum(total), 0) into v_total_revenue from public.invoices where salon_id = p_salon_id and status = 'paid';
    select coalesce(sum(total), 0) into v_today_revenue from public.invoices where salon_id = p_salon_id and date = v_today and status = 'paid';
    select coalesce(sum(total), 0) into v_yesterday_revenue from public.invoices where salon_id = p_salon_id and date = v_yesterday and status = 'paid';

    if v_yesterday_revenue = 0 then
        v_revenue_growth := case when v_today_revenue > 0 then 100 else 0 end;
    else
        v_revenue_growth := round(((v_today_revenue - v_yesterday_revenue)::numeric / v_yesterday_revenue) * 100);
    end if;

    select count(*) into v_today_appointments from public.appointments where salon_id = p_salon_id and date = v_today;
    select count(*) into v_yesterday_appointments from public.appointments where salon_id = p_salon_id and date = v_yesterday;

    if v_yesterday_appointments = 0 then
        v_appointment_growth := case when v_today_appointments > 0 then 100 else 0 end;
    else
        v_appointment_growth := round(((v_today_appointments - v_yesterday_appointments)::numeric / v_yesterday_appointments) * 100);
    end if;

    select count(*) into v_upcoming_appointments from public.appointments
        where salon_id = p_salon_id and date >= v_today and status in ('requested', 'approved', 'rescheduled_pending');

    select count(*) into v_total_customers from public.customers where salon_id = p_salon_id;
    select count(*) into v_new_customers from public.customers where salon_id = p_salon_id and created_at >= (current_date - interval '30 days');

    if v_total_customers = 0 then
        v_customer_growth := 0;
    else
        v_customer_growth := round((v_new_customers::numeric / v_total_customers) * 100);
    end if;

    -- FIXED (see design note above): was filtering on status='scheduled',
    -- which the real booking flow never produces.
    select jsonb_build_object('date', date, 'start_time', left(start_time::text, 5), 'customer_name', coalesce(c.full_name, 'Unknown'))
    into v_next_appointment
    from public.appointments a left join public.customers c on a.customer_id = c.id
    where a.salon_id = p_salon_id and a.status = 'approved' and a.date >= v_today
    order by a.date asc, a.start_time asc limit 1;

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'customer_name', coalesce(c.full_name, 'Unknown'), 'title', coalesce(a.title, 'Service'),
        'date', a.date, 'start_time', left(a.start_time::text, 5), 'status', a.status
    ) order by a.date desc, a.start_time desc), '[]'::jsonb) into v_recent_appointments
    from public.appointments a left join public.customers c on a.customer_id = c.id
    where a.salon_id = p_salon_id limit 5;

    return jsonb_build_object(
        'total_revenue', v_total_revenue, 'today_revenue', v_today_revenue, 'revenue_growth', v_revenue_growth,
        'today_appointments', v_today_appointments, 'appointment_growth', v_appointment_growth,
        'total_customers', v_total_customers, 'customer_growth', v_customer_growth,
        'upcoming_appointments', v_upcoming_appointments, 'next_appointment', v_next_appointment,
        'recent_appointments', v_recent_appointments
    );
end; $$;

create or replace function public.get_invoice_with_payments(p_salon_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_invoice jsonb; v_payments jsonb; v_result jsonb; v_total_paid int := 0;
begin
    select jsonb_build_object(
        'id', i.id, 'invoice_number', i.invoice_number, 'customer_id', i.customer_id,
        'customer_name', coalesce(c.full_name, 'Unknown'), 'date', i.date, 'subtotal', i.subtotal,
        'discount', i.discount, 'tax', i.tax, 'total', i.total, 'amount_paid', coalesce(i.amount_paid, 0),
        'balance_due', coalesce(i.balance_due, i.total), 'status', i.status,
        'payment_status', coalesce(i.payment_status, 'pending'), 'payment_method', i.payment_method,
        'notes', i.notes, 'created_at', i.created_at,
        'items', coalesce((select jsonb_agg(jsonb_build_object(
            'id', it.id, 'description', it.description, 'quantity', it.quantity,
            'unit_price', it.unit_price, 'total', it.total
        )) from public.invoice_items it where it.invoice_id = i.id), '[]'::jsonb)
    ) into v_invoice
    from public.invoices i left join public.customers c on i.customer_id = c.id
    where i.id = p_invoice_id and i.salon_id = p_salon_id;

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'amount', amount, 'payment_method', payment_method, 'payment_date', payment_date,
        'reference', reference, 'notes', notes, 'created_at', created_at
    ) order by payment_date desc, created_at desc), '[]'::jsonb) into v_payments
    from public.payments where invoice_id = p_invoice_id;

    select coalesce(sum(amount), 0) into v_total_paid from public.payments where invoice_id = p_invoice_id;

    v_result := v_invoice || jsonb_build_object('payments', v_payments, 'amount_paid', v_total_paid,
        'balance_due', (v_invoice->>'total')::int - v_total_paid);
    return v_result;
end; $$;

-- ============================================================
-- Row Level Security (defense in depth - the backend uses the
-- service_role key for everything and enforces authorization in
-- app code; these policies matter only if something ever talks to
-- Supabase directly with the anon/authenticated key)
-- ============================================================
alter table public.users enable row level security;
alter table public.salons enable row level security;
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.feedback enable row level security;

create or replace function public.is_owner_or_staff(uid uuid)
returns boolean language sql stable security definer as $$
    select exists (select 1 from public.users where id = uid and role in ('owner', 'staff'));
$$;

-- users
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- salons: readable by anyone signed in (there's only one, and its
-- name/hours are not sensitive); only the owner can change it.
create policy "salons_select_authenticated" on public.salons for select using (auth.role() = 'authenticated');
create policy "salons_update_owner" on public.salons for update using (auth.uid() = owner_id);
create policy "salons_insert_owner" on public.salons for insert with check (auth.uid() = owner_id);

-- staff: owner/staff can see the staff list; only the owner manages it.
create policy "staff_select_owner_staff" on public.staff for select using (public.is_owner_or_staff(auth.uid()));
create policy "staff_all_owner" on public.staff for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'owner')
);

-- services: anyone signed in can browse (customers need to see them to
-- book); only owner/staff manage them.
create policy "services_select_authenticated" on public.services for select using (auth.role() = 'authenticated');
create policy "services_write_owner_staff" on public.services for insert with check (public.is_owner_or_staff(auth.uid()));
create policy "services_update_owner_staff" on public.services for update using (public.is_owner_or_staff(auth.uid()));
create policy "services_delete_owner_staff" on public.services for delete using (public.is_owner_or_staff(auth.uid()));

-- customers: owner/staff see all; a customer sees only their own row.
create policy "customers_select_owner_staff" on public.customers for select using (public.is_owner_or_staff(auth.uid()));
create policy "customers_select_own" on public.customers for select using (auth.uid() = id);
create policy "customers_write_owner_staff" on public.customers for insert with check (public.is_owner_or_staff(auth.uid()));
create policy "customers_update_owner_staff" on public.customers for update using (public.is_owner_or_staff(auth.uid()));
create policy "customers_delete_owner_staff" on public.customers for delete using (public.is_owner_or_staff(auth.uid()));

-- appointments: owner/staff see & manage all; customer sees & creates own only.
create policy "appointments_all_owner_staff" on public.appointments for all using (public.is_owner_or_staff(auth.uid()));
create policy "appointments_select_own" on public.appointments for select using (auth.uid() = customer_id);
create policy "appointments_insert_own" on public.appointments for insert with check (auth.uid() = customer_id);

-- invoices / invoice_items / payments: owner/staff full access; customer read-only, own invoices only.
create policy "invoices_all_owner_staff" on public.invoices for all using (public.is_owner_or_staff(auth.uid()));
create policy "invoices_select_own" on public.invoices for select using (auth.uid() = customer_id);

create policy "invoice_items_all_owner_staff" on public.invoice_items for all using (
    public.is_owner_or_staff(auth.uid())
);
create policy "invoice_items_select_own" on public.invoice_items for select using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.customer_id = auth.uid())
);

create policy "payments_all_owner_staff" on public.payments for all using (public.is_owner_or_staff(auth.uid()));
create policy "payments_select_own" on public.payments for select using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.customer_id = auth.uid())
);

-- notifications: strictly own.
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);

-- feedback: owner/staff see all; customer sees & creates own only.
create policy "feedback_select_owner_staff" on public.feedback for select using (public.is_owner_or_staff(auth.uid()));
create policy "feedback_select_own" on public.feedback for select using (auth.uid() = customer_id);
create policy "feedback_insert_own" on public.feedback for insert with check (auth.uid() = customer_id);

-- ============================================================
-- NOTE ON service_role and RLS bypass
-- ============================================================
-- `service_role` is a reserved Supabase role - only Supabase's own
-- superuser can modify it, so `ALTER ROLE service_role BYPASSRLS;`
-- (an earlier version of this script tried that) fails with
-- "42501: service_role is a reserved role, only superusers can
-- modify it". It's also unnecessary: service_role bypasses RLS by
-- default on every Supabase project, no configuration needed. If a
-- service-role request is ever unexpectedly blocked by RLS, the
-- real cause is almost always that the request wasn't actually sent
-- with the service-role key/session (see backend
-- app/core/supabase_client.py's note on not reusing one Supabase
-- client for both auth sessions and service-role queries).
