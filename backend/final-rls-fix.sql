-- ===================================================================
-- BULLETPROOF RLS FIX - Each statement is independent
-- Run this in Supabase SQL Editor
-- ===================================================================

-- STEP 1: Security Definer Functions
CREATE OR REPLACE FUNCTION public.check_user_is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_user_is_super_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===================================================================
-- STEP 2: FIX CALLS TABLE
-- ===================================================================
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy on calls
DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'calls'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON calls', pol.policyname);
  END LOOP;
END $$;

-- User: own data
CREATE POLICY "user_select_own_calls" ON calls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_calls" ON calls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_calls" ON calls FOR UPDATE USING (auth.uid() = user_id);
-- Admin: all data (no delete)
CREATE POLICY "admin_select_calls" ON calls FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_calls" ON calls FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_calls" ON calls FOR UPDATE USING (public.check_user_is_admin());
-- Super Admin: full access
CREATE POLICY "super_admin_all_calls" ON calls FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 3: FIX LEADS TABLE
-- ===================================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'leads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_leads" ON leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_leads" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_leads" ON leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_leads" ON leads FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_leads" ON leads FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_leads" ON leads FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_leads" ON leads FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 4: FIX MEETINGS TABLE
-- ===================================================================
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'meetings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON meetings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_meetings" ON meetings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_meetings" ON meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_meetings" ON meetings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_meetings" ON meetings FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_meetings" ON meetings FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_meetings" ON meetings FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_meetings" ON meetings FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 5: FIX CASES TABLE
-- ===================================================================
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'cases'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON cases', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_cases" ON cases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_cases" ON cases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_cases" ON cases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_cases" ON cases FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_cases" ON cases FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_cases" ON cases FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_cases" ON cases FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 6: FIX EXPENSES TABLE
-- ===================================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'expenses'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON expenses', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_expenses" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_expenses" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_expenses" ON expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_expenses" ON expenses FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_expenses" ON expenses FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_expenses" ON expenses FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_expenses" ON expenses FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 7: FIX ATTENDANCE TABLE
-- ===================================================================
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'attendance'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON attendance', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_attendance" ON attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_attendance" ON attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_attendance" ON attendance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_attendance" ON attendance FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_attendance" ON attendance FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_attendance" ON attendance FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_attendance" ON attendance FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 8: FIX QUOTATIONS TABLE
-- ===================================================================
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'quotations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON quotations', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_quotations" ON quotations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_quotations" ON quotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_quotations" ON quotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_quotations" ON quotations FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_quotations" ON quotations FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_quotations" ON quotations FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_quotations" ON quotations FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 9: FIX WORK_REPORTS TABLE
-- ===================================================================
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'work_reports'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON work_reports', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_work_reports" ON work_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_work_reports" ON work_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_work_reports" ON work_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_work_reports" ON work_reports FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_work_reports" ON work_reports FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_work_reports" ON work_reports FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_work_reports" ON work_reports FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 10: FIX USERS TABLE
-- ===================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_read_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "user_update_own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_select_users" ON users FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_update_users" ON users FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_users" ON users FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 11: FIX USER_DETAILS TABLE
-- ===================================================================
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_details'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_details', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_read_own_details" ON user_details FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_details" ON user_details FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_details" ON user_details FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_select_user_details" ON user_details FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_update_user_details" ON user_details FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_user_details" ON user_details FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 12: FIX USER_PERMISSIONS TABLE
-- ===================================================================
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_permissions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_permissions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_read_own_permissions" ON user_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "super_admin_all_permissions" ON user_permissions FOR ALL USING (public.check_user_is_super_admin());

-- ===================================================================
-- STEP 13: FIX LEAD_HISTORY TABLE (may not exist - ignore errors)
-- ===================================================================
DO $$
BEGIN
  ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;
  
  -- Drop existing
  DECLARE pol RECORD;
  BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'lead_history'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON lead_history', pol.policyname);
    END LOOP;
  END;
  
  EXECUTE 'CREATE POLICY "user_select_own_lead_history" ON lead_history FOR SELECT USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "user_insert_own_lead_history" ON lead_history FOR INSERT WITH CHECK (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "admin_select_lead_history" ON lead_history FOR SELECT USING (public.check_user_is_admin())';
  EXECUTE 'CREATE POLICY "admin_insert_lead_history" ON lead_history FOR INSERT WITH CHECK (public.check_user_is_admin())';
  EXECUTE 'CREATE POLICY "super_admin_all_lead_history" ON lead_history FOR ALL USING (public.check_user_is_super_admin())';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'lead_history table does not exist, skipping';
END $$;

-- DONE! Try adding a call now.
