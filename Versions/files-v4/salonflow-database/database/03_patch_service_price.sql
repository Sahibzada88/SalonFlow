-- ============================================================
-- Patch: add service_price to get_appointments()
-- ============================================================
-- Only run this if you already ran 01_fresh_schema.sql before this
-- update. If you're running the schema fresh, skip this file - the
-- change is already included in 01_fresh_schema.sql.
--
-- Lets the invoice-creation screen show/lock the service's current
-- price without an extra API round-trip to fetch the services list.
-- ============================================================

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
