-- ============================================
-- COMPLETE RESET - OWNER + SALON
-- ============================================

-- 1. Delete existing data
DELETE FROM salons WHERE owner_id IN (
    SELECT id FROM users WHERE role = 'owner'
);
DELETE FROM users WHERE role = 'owner';
DELETE FROM customers WHERE email LIKE '%@%';
DELETE FROM users WHERE role = 'customer';

-- 2. Insert Owner with correct auth ID
INSERT INTO users (
    id,
    email,
    username,
    full_name,
    phone,
    role,
    is_owner,
    is_staff,
    is_customer,
    is_active,
    created_at,
    updated_at
) VALUES (
    'a5cbe83b-2d4e-406f-b19b-abb238315cd2',  -- Your auth user ID
    'owner@salon.com',
    'owner',
    'Salon Owner',
    '03123456789',
    'owner',
    true,
    false,
    false,
    true,
    NOW(),
    NOW()
);

-- 3. Create Salon
INSERT INTO salons (
    id,
    owner_id,
    name,
    address,
    city,
    phone,
    email,
    opening_time,
    closing_time,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'a5cbe83b-2d4e-406f-b19b-abb238315cd2',
    'Test Salon',
    'Street 1, City',
    'Test City',
    '03123456789',
    'owner@salon.com',
    '09:00:00',
    '21:00:00',
    true,
    NOW(),
    NOW()
);

-- 4. Verify
SELECT 
    u.id,
    u.email,
    u.role,
    u.is_owner,
    s.id as salon_id,
    s.name as salon_name
FROM users u
JOIN salons s ON s.owner_id = u.id
WHERE u.role = 'owner';