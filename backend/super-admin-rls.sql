-- ===================================================================
-- SUPER ADMIN & GRANULAR PERMISSIONS MIGRATION
-- ===================================================================

-- 1. Update the users table role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'admin', 'super_admin'));

-- 2. Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module      TEXT NOT NULL,
    enabled     BOOLEAN DEFAULT true,
    can_view    BOOLEAN DEFAULT true,
    can_create  BOOLEAN DEFAULT true,
    can_edit    BOOLEAN DEFAULT true,
    can_delete  BOOLEAN DEFAULT false,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, module)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own permissions
DROP POLICY IF EXISTS "user_read_own_permissions" ON user_permissions;
CREATE POLICY "user_read_own_permissions" ON user_permissions
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Only super_admin can manage permissions
DROP POLICY IF EXISTS "super_admin_manage_permissions" ON user_permissions;
CREATE POLICY "super_admin_manage_permissions" ON user_permissions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
    );

-- 3. Super Admin Policies (Full Access to All Tables)
-- We need to ensure super_admin has 'ALL' access to every table.

DO $$
DECLARE
    table_name TEXT;
    tables TEXT[] := ARRAY['users', 'user_details', 'leads', 'cases', 'calls', 'meetings', 'attendance', 'expenses', 'quotations', 'work_reports', 'case_files', 'case_invoices', 'case_receipts', 'lead_history'];
BEGIN
    FOREACH table_name IN ARRAY tables
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "super_admin_all_%I" ON %I', table_name, table_name);
        EXECUTE format('CREATE POLICY "super_admin_all_%I" ON %I FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''super_admin''))', table_name, table_name);
    END LOOP;
END $$;

-- 4. Strip DELETE from Admin RLS
-- We need to find all policies that grant 'ALL' to admins and replace them with SELECT, INSERT, UPDATE only.

-- Leads
DROP POLICY IF EXISTS "admin_all_leads" ON leads;
DROP POLICY IF EXISTS "admin_select_all_leads" ON leads;
DROP POLICY IF EXISTS "admin_update_all_leads" ON leads;

CREATE POLICY "admin_select_leads" ON leads FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_insert_leads" ON leads FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_update_leads" ON leads FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Cases
DROP POLICY IF EXISTS "Admins manage all cases" ON cases;
DROP POLICY IF EXISTS "admin_select_all_cases" ON cases;

CREATE POLICY "admin_select_cases" ON cases FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_insert_cases" ON cases FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_update_cases" ON cases FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Calls
DROP POLICY IF EXISTS "admin_select_all_calls" ON calls;
CREATE POLICY "admin_select_calls" ON calls FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_insert_calls" ON calls FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_update_calls" ON calls FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Meetings
DROP POLICY IF EXISTS "admin_select_all_meetings" ON meetings;
CREATE POLICY "admin_select_meetings" ON meetings FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_insert_meetings" ON meetings FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_update_meetings" ON meetings FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Expenses
DROP POLICY IF EXISTS "admin_select_all_expenses" ON expenses;
DROP POLICY IF EXISTS "admin_select_expenses" ON expenses;
DROP POLICY IF EXISTS "admin_insert_expenses" ON expenses;
DROP POLICY IF EXISTS "admin_update_expenses" ON expenses;
DROP POLICY IF EXISTS "super_admin_all_expenses" ON expenses;

CREATE POLICY "admin_select_expenses" ON expenses FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "admin_insert_expenses" ON expenses FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "admin_update_expenses" ON expenses FOR UPDATE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "super_admin_delete_expenses" ON expenses FOR DELETE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- User Management (Admin can still read/update users but not delete)
DROP POLICY IF EXISTS "admin_select_all_users" ON users;
CREATE POLICY "admin_select_users" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_update_users" ON users FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Note: attendance, quotations, work_reports, user_details are mostly managed by the users themselves 
-- but admins have SELECT access which we should keep.

-- Done!
