-- ===================================================================
-- FIX: "Failed to create user profile" Error
-- ===================================================================
-- This error means the user exists in auth.users but not in public.users table
-- Run these queries in Supabase SQL Editor to fix it

-- STEP 1: Check if admin user exists in users table
SELECT * FROM users WHERE email = 'nitin@airmedical24x7.com';

-- If the above returns NO ROWS, run STEP 2
-- If it returns a row, the issue is elsewhere (skip to STEP 3)

-- STEP 2: Insert admin user into users table
INSERT INTO users (id, email, name, role)
VALUES (
    'dc6de4ef-a1d3-46a6-8699-6a3a18ab7692',
    'nitin@airmedical24x7.com',
    'Admin',
    'admin'
) ON CONFLICT (id) DO UPDATE 
SET role = 'admin', name = 'Admin';

-- STEP 3: Verify the fix
SELECT * FROM users WHERE email = 'nitin@airmedical24x7.com';

-- You should see:
-- id: dc6de4ef-a1d3-46a6-8699-6a3a18ab7692
-- email: nitin@airmedical24x7.com  
-- name: Admin
-- role: admin

-- STEP 4: After running this, try logging in again
-- The error should be resolved
