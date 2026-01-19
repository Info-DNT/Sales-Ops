-- ===================================================================
-- DIAGNOSE AND FIX: "Failed to create user profile" Error
-- ===================================================================

-- STEP 1: Check if RLS is blocking the query
-- Run this to see what policies exist on users table
SELECT * FROM pg_policies WHERE tablename = 'users';

-- STEP 2: Temporarily test without RLS (for debugging only)
-- This will help us confirm if RLS is the problem
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- After running this, try logging in again
-- If login WORKS now, then RLS policies are the problem

-- STEP 3: If login worked, re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- STEP 4: Add missing policy for users to read their own data
-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users view own" ON users;
DROP POLICY IF EXISTS "Admins view all users" ON users;
DROP POLICY IF EXISTS "Users update own" ON users;
DROP POLICY IF EXISTS "Admins insert users" ON users;

-- Create fresh, correct policies
CREATE POLICY "enable_read_own_user" ON users
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "enable_admin_read_all" ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "enable_update_own_user" ON users
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "enable_insert_new_user" ON users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- STEP 5: Verify policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- STEP 6: Test the fix
-- Try logging in again - should work now!
