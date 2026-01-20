-- ================================================================
-- ADD ADMIN POLICIES - Allow admin users to view ALL data
-- ================================================================
-- Run this in Supabase SQL Editor to allow admins to see all user data

-- USERS TABLE - Admin can view all users
CREATE POLICY "admin_view_all_users" ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users AS u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

-- USER_DETAILS TABLE - Admin can view all user details
CREATE POLICY "admin_view_all_user_details" ON user_details
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- WORK_REPORTS TABLE - Admin can view all work reports
CREATE POLICY "admin_view_all_work_reports" ON work_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- LEADS TABLE - Admin can view all leads
CREATE POLICY "admin_view_all_leads" ON leads
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- QUOTATIONS TABLE - Admin can view all quotations
CREATE POLICY "admin_view_all_quotations" ON quotations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- ATTENDANCE TABLE - Admin can view all attendance records
CREATE POLICY "admin_view_all_attendance" ON attendance
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- After running this, logout and login again as admin
-- You should now be able to see all user data!
