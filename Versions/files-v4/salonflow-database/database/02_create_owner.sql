-- ============================================================
-- Create the owner account + the salon (single-salon deployment)
-- ============================================================
-- Owner/staff accounts are no longer self-registered through the app -
-- only login exists for them. This script is how you create the first
-- (and only) owner account.
--
-- STEP 1 - create the Auth user first, in the Supabase Dashboard:
--   Authentication -> Users -> Add User
--   Set email + password. Copy the generated User UID - you'll need it
--   below. (Do NOT insert directly into auth.users via SQL.)
--
-- STEP 2 - run this script in the SQL Editor, replacing the three
-- placeholder values below with your own.
-- ============================================================

do $$
declare
    v_owner_auth_id uuid := '00000000-0000-0000-0000-000000000000';  -- <-- paste the User UID from Step 1
    v_owner_email text := 'owner@example.com';                        -- <-- same email used in Step 1
    v_owner_name text := 'Salon Owner';
    v_salon_name text := 'My Salon';
begin
    -- public.users row (the handle_new_user trigger already created one
    -- when you added the Auth user in Step 1 - this upserts on top of it
    -- to make sure role/name are set correctly).
    insert into public.users (id, email, username, full_name, role, is_active)
    values (v_owner_auth_id, v_owner_email, 'owner', v_owner_name, 'owner', true)
    on conflict (id) do update set role = 'owner', full_name = excluded.full_name, is_active = true;

    -- The salon itself - remember, only one is ever allowed
    -- (enforce_single_salon() will raise an error if one already exists).
    insert into public.salons (owner_id, name, opening_time, closing_time)
    values (v_owner_auth_id, v_salon_name, '09:00:00', '21:00:00');
end $$;

-- Verify:
select u.id, u.email, u.role, s.id as salon_id, s.name as salon_name
from public.users u
join public.salons s on s.owner_id = u.id
where u.role = 'owner';
