-- ===================================================================
-- FIX RLS POLICIES - Run this in SQL Editor
-- ===================================================================
-- This will secure your database while allowing proper access

-- STEP 1: Re-enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- STEP 2: Drop any existing conflicting policies
DROP POLICY IF EXISTS "Users view own" ON users;
DROP POLICY IF EXISTS "Admins view all users" ON users;
DROP POLICY IF EXISTS "Users update own" ON users;
DROP POLICY IF EXISTS "Admins insert users" ON users;
DROP POLICY IF EXISTS "enable_read_own_user" ON users;
DROP POLICY IF EXISTS "enable_admin_read_all" ON users;
DROP POLICY IF EXISTS "enable_update_own_user" ON users;
DROP POLICY IF EXISTS "enable_insert_new_user" ON users;

-- STEP 3: Create simple, working policies
-- Policy 1: Allow users to read their own data
CREATE POLICY "users_select_own" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Policy 2: Allow users to update their own data
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    USING (auth.uid() = id);

-- Policy 3: Allow insert when user_id matches auth
CREATE POLICY "users_insert_own" ON users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- STEP 4: Apply same fix to other tables
-- User Details
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage details" ON user_details;
DROP POLICY IF EXISTS "Admins view details" ON user_details;
CREATE POLICY "user_details_all_own" ON user_details FOR ALL USING (auth.uid() = user_id);

-- Work Reports
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage reports" ON work_reports;
DROP POLICY IF EXISTS "Admins view reports" ON work_reports;
CREATE POLICY "work_reports_all_own" ON work_reports FOR ALL USING (auth.uid() = user_id);

-- Leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage leads" ON leads;
DROP POLICY IF EXISTS "Admins view leads" ON leads;
CREATE POLICY "leads_all_own" ON leads FOR ALL USING (auth.uid() = user_id);

-- Quotations
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage quotes" ON quotations;
DROP POLICY IF EXISTS "Admins view quotes" ON quotations;
CREATE POLICY "quotations_all_own" ON quotations FOR ALL USING (auth.uid() = user_id);

-- Attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage attend" ON attendance;
DROP POLICY IF EXISTS "Admins view attend" ON attendance;
CREATE POLICY "attendance_all_own" ON attendance FOR ALL USING (auth.uid() = user_id);

-- DONE! Now try logging in again - should work with RLS enabled!
