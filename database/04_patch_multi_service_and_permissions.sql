-- ============================================================
-- Patch: multi-service appointments + expanded staff permissions
-- ============================================================
-- Only run this if you already ran 01_fresh_schema.sql before this
-- update. If you're running the schema fresh, skip this file - both
-- changes are already included in 01_fresh_schema.sql.
-- ============================================================

-- 1. New junction table: one appointment can now cover several services.
create table if not exists public.appointment_services (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid not null references public.appointments(id) on delete cascade,
    service_id uuid references public.services(id),
    service_name text not null,
    price int not null default 0,
    duration int not null default 30,
    created_at timestamptz not null default now()
);

create index if not exists idx_appointment_services_appointment_id
    on public.appointment_services(appointment_id);

alter table public.appointment_services enable row level security;

drop policy if exists "appointment_services_all_owner_staff" on public.appointment_services;
create policy "appointment_services_all_owner_staff" on public.appointment_services for all using (
    public.is_owner_or_staff(auth.uid())
);

drop policy if exists "appointment_services_select_own" on public.appointment_services;
create policy "appointment_services_select_own" on public.appointment_services for select using (
    exists (select 1 from public.appointments a where a.id = appointment_id and a.customer_id = auth.uid())
);

-- Backfill: give existing single-service appointments a row in the new
-- table too, so they show up consistently once the frontend/backend
-- switch to reading the `services` array.
insert into public.appointment_services (appointment_id, service_id, service_name, price, duration)
select a.id, s.id, s.name, s.price, s.duration
from public.appointments a
join public.services s on s.id = a.service_id
where a.service_id is not null
  and not exists (
      select 1 from public.appointment_services aps where aps.appointment_id = a.id
  );

-- 2. Expanded staff permissions (adds can_manage_customers/can_manage_services
-- to the default for any NEW staff created after this patch).
alter table public.staff
    alter column permissions
    set default '{"can_book": true, "can_approve": true, "can_bill": true, "can_manage_customers": true, "can_manage_services": false}'::jsonb;

-- Backfill: add the two new permission keys to EXISTING staff rows that
-- don't have them yet, so an owner doesn't have to manually re-save every
-- staff member's permissions after this patch. Existing can_book/
-- can_approve/can_bill values are left untouched.
update public.staff
set permissions = permissions
    || jsonb_build_object('can_manage_customers', coalesce(permissions->'can_manage_customers', 'true'::jsonb))
    || jsonb_build_object('can_manage_services', coalesce(permissions->'can_manage_services', 'false'::jsonb))
where not (permissions ? 'can_manage_customers') or not (permissions ? 'can_manage_services');

-- 3. Updated RPCs - CREATE OR REPLACE is safe to re-run.
create or replace function public.get_appointments(
    p_salon_id uuid, p_customer_id uuid default null, p_start_date date default null,
    p_end_date date default null, p_status text default null, p_limit int default 100
) returns jsonb language plpgsql security definer as $$
declare v_result jsonb;
begin
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'customer_id', a.customer_id, 'customer_name', coalesce(c.full_name, 'Unknown'),
        'service_id', a.service_id, 'service_name', coalesce(s.name, ''), 'service_price', s.price,
        'services', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', aps.id, 'service_id', aps.service_id, 'name', aps.service_name,
                'price', aps.price, 'duration', aps.duration
            ) order by aps.created_at)
            from public.appointment_services aps
            where aps.appointment_id = a.id
        ), '[]'::jsonb),
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
    p_end_time time, p_notes text default null, p_service_id uuid default null,
    p_service_ids uuid[] default null
) returns jsonb language plpgsql security definer as $$
declare
    v_result jsonb;
    v_appointment_id uuid;
    v_first_service_id uuid;
    v_service_id uuid;
begin
    if p_service_ids is not null and array_length(p_service_ids, 1) > 0 then
        v_first_service_id := p_service_ids[1];
    else
        v_first_service_id := p_service_id;
    end if;

    insert into public.appointments (
        salon_id, customer_id, service_id, title, date, start_time, end_time, status, requested_by, notes
    ) values (
        p_salon_id, p_customer_id, v_first_service_id, p_title, p_date, p_start_time, p_end_time,
        'requested', p_customer_id, p_notes
    ) returning id into v_appointment_id;

    if p_service_ids is not null then
        foreach v_service_id in array p_service_ids loop
            insert into public.appointment_services (appointment_id, service_id, service_name, price, duration)
            select v_appointment_id, sv.id, sv.name, sv.price, sv.duration
            from public.services sv where sv.id = v_service_id;
        end loop;
    elsif p_service_id is not null then
        insert into public.appointment_services (appointment_id, service_id, service_name, price, duration)
        select v_appointment_id, sv.id, sv.name, sv.price, sv.duration
        from public.services sv where sv.id = p_service_id;
    end if;

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
    p_service_id uuid default null, p_staff_id uuid default null, p_id uuid default null,
    p_service_ids uuid[] default null
) returns jsonb language plpgsql security definer as $$
declare
    v_result jsonb;
    v_appointment_id uuid;
    v_first_service_id uuid;
    v_service_id uuid;
begin
    if p_service_ids is not null and array_length(p_service_ids, 1) > 0 then
        v_first_service_id := p_service_ids[1];
    else
        v_first_service_id := p_service_id;
    end if;

    if p_id is not null then
        update public.appointments set customer_id = p_customer_id, title = p_title, date = p_date,
            start_time = p_start_time, end_time = p_end_time, status = p_status, notes = p_notes,
            service_id = v_first_service_id, staff_id = p_staff_id, updated_at = now()
        where id = p_id and salon_id = p_salon_id
        returning id into v_appointment_id;
    end if;

    if v_appointment_id is null and p_id is null then
        insert into public.appointments (
            salon_id, customer_id, title, date, start_time, end_time, status, notes, service_id, staff_id
        ) values (
            p_salon_id, p_customer_id, p_title, p_date, p_start_time, p_end_time, p_status, p_notes,
            v_first_service_id, p_staff_id
        ) returning id into v_appointment_id;
    end if;

    if v_appointment_id is null then
        return null;
    end if;

    if p_service_ids is not null then
        delete from public.appointment_services where appointment_id = v_appointment_id;
        foreach v_service_id in array p_service_ids loop
            insert into public.appointment_services (appointment_id, service_id, service_name, price, duration)
            select v_appointment_id, sv.id, sv.name, sv.price, sv.duration
            from public.services sv where sv.id = v_service_id;
        end loop;
    end if;

    select jsonb_build_object(
        'id', a.id, 'customer_id', a.customer_id, 'customer_name', coalesce(c.full_name, 'Unknown'),
        'title', coalesce(a.title, 'Service'), 'date', a.date, 'start_time', left(a.start_time::text, 5),
        'end_time', left(a.end_time::text, 5), 'status', a.status, 'notes', a.notes, 'created_at', a.created_at
    ) into v_result from public.appointments a left join public.customers c on a.customer_id = c.id
    where a.id = v_appointment_id;
    return v_result;
end; $$;
