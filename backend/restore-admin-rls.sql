-- ===================================================================
-- RESTORE ADMIN RLS POLICIES
-- ===================================================================
-- Purpose: Grant Admins full read access across all tables so the
--          Admin Dashboard shows complete team data (leads, attendance,
--          work reports, users, cases, calls, meetings).
--
-- HOW TO RUN: Go to Supabase Dashboard → SQL Editor → Paste & Run
--
-- SAFE TO RUN: These are additive policies. Existing user policies
--              remain untouched. Nothing will break.
-- ===================================================================

-- --- USERS TABLE ---
DROP POLICY IF EXISTS "admin_select_all_users" ON users;
CREATE POLICY "admin_select_all_users" ON users
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- USER DETAILS TABLE ---
DROP POLICY IF EXISTS "admin_select_all_user_details" ON user_details;
CREATE POLICY "admin_select_all_user_details" ON user_details
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- LEADS TABLE ---
DROP POLICY IF EXISTS "admin_select_all_leads" ON leads;
CREATE POLICY "admin_select_all_leads" ON leads
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "admin_update_all_leads" ON leads;
CREATE POLICY "admin_update_all_leads" ON leads
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- WORK REPORTS TABLE ---
DROP POLICY IF EXISTS "admin_select_all_work_reports" ON work_reports;
CREATE POLICY "admin_select_all_work_reports" ON work_reports
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- ATTENDANCE TABLE ---
DROP POLICY IF EXISTS "admin_select_all_attendance" ON attendance;
CREATE POLICY "admin_select_all_attendance" ON attendance
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- QUOTATIONS TABLE ---
DROP POLICY IF EXISTS "admin_select_all_quotations" ON quotations;
CREATE POLICY "admin_select_all_quotations" ON quotations
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- CALLS TABLE (if exists) ---
DROP POLICY IF EXISTS "admin_select_all_calls" ON calls;
CREATE POLICY "admin_select_all_calls" ON calls
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- MEETINGS TABLE (if exists) ---
DROP POLICY IF EXISTS "admin_select_all_meetings" ON meetings;
CREATE POLICY "admin_select_all_meetings" ON meetings
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- CASES TABLE (if exists) ---
DROP POLICY IF EXISTS "admin_select_all_cases" ON cases;
CREATE POLICY "admin_select_all_cases" ON cases
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- ===================================================================
-- DONE! Admin users will now see all team data in the dashboard.
-- Regular users are unaffected — they still only see their own data.
-- ===================================================================
