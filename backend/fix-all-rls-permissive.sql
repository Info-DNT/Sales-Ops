-- ===================================================================
-- FULL PERMISSIVE RLS FIX FOR SALES OPS PIPELINE
-- Run this script in the Supabase SQL Editor to grant full working access across all tables
-- ===================================================================

-- 1. LEADS TABLE
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_leads" ON public.leads;
DROP POLICY IF EXISTS "user_select_own_leads" ON public.leads;
DROP POLICY IF EXISTS "user_insert_own_leads" ON public.leads;
DROP POLICY IF EXISTS "user_update_own_leads" ON public.leads;
DROP POLICY IF EXISTS "admin_select_leads" ON public.leads;
DROP POLICY IF EXISTS "admin_insert_leads" ON public.leads;
DROP POLICY IF EXISTS "admin_update_leads" ON public.leads;
DROP POLICY IF EXISTS "super_admin_all_leads" ON public.leads;
CREATE POLICY "allow_all_leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- 2. USERS TABLE
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_users" ON public.users;
DROP POLICY IF EXISTS "user_read_own" ON public.users;
DROP POLICY IF EXISTS "user_update_own" ON public.users;
DROP POLICY IF EXISTS "admin_select_users" ON public.users;
DROP POLICY IF EXISTS "admin_update_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_all_users" ON public.users;
CREATE POLICY "allow_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 3. MEDICAL ASSESSMENTS TABLE
ALTER TABLE IF EXISTS public.medical_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_medical_assessments" ON public.medical_assessments;
DROP POLICY IF EXISTS "user_select_own_ma" ON public.medical_assessments;
DROP POLICY IF EXISTS "user_insert_own_ma" ON public.medical_assessments;
DROP POLICY IF EXISTS "user_update_own_ma" ON public.medical_assessments;
DROP POLICY IF EXISTS "admin_select_ma" ON public.medical_assessments;
DROP POLICY IF EXISTS "admin_insert_ma" ON public.medical_assessments;
DROP POLICY IF EXISTS "admin_update_ma" ON public.medical_assessments;
DROP POLICY IF EXISTS "super_admin_all_ma" ON public.medical_assessments;
CREATE POLICY "allow_all_medical_assessments" ON public.medical_assessments FOR ALL USING (true) WITH CHECK (true);

-- 4. QUOTATION CONTROL TABLE
ALTER TABLE IF EXISTS public.quotation_control ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_quotation_control" ON public.quotation_control;
DROP POLICY IF EXISTS "user_select_own_qc" ON public.quotation_control;
DROP POLICY IF EXISTS "user_insert_own_qc" ON public.quotation_control;
DROP POLICY IF EXISTS "user_update_own_qc" ON public.quotation_control;
DROP POLICY IF EXISTS "admin_select_qc" ON public.quotation_control;
DROP POLICY IF EXISTS "admin_insert_qc" ON public.quotation_control;
DROP POLICY IF EXISTS "admin_update_qc" ON public.quotation_control;
DROP POLICY IF EXISTS "super_admin_all_qc" ON public.quotation_control;
CREATE POLICY "allow_all_quotation_control" ON public.quotation_control FOR ALL USING (true) WITH CHECK (true);

-- 5. USER PERMISSIONS TABLE
ALTER TABLE IF EXISTS public.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "user_read_own_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "super_admin_manage_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "super_admin_all_permissions" ON public.user_permissions;
CREATE POLICY "allow_all_user_permissions" ON public.user_permissions FOR ALL USING (true) WITH CHECK (true);

-- 6. REFERRAL MASTER TABLES
ALTER TABLE IF EXISTS public.hospital_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_hospitals" ON public.hospital_referrals;
CREATE POLICY "allow_all_hospitals" ON public.hospital_referrals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.embassy_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_embassies" ON public.embassy_referrals;
CREATE POLICY "allow_all_embassies" ON public.embassy_referrals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.tpa_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_tpa" ON public.tpa_referrals;
CREATE POLICY "allow_all_tpa" ON public.tpa_referrals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.doctor_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_doctor_referrals" ON public.doctor_referrals;
CREATE POLICY "allow_all_doctor_referrals" ON public.doctor_referrals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.individual_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_individuals" ON public.individual_referrals;
CREATE POLICY "allow_all_individuals" ON public.individual_referrals FOR ALL USING (true) WITH CHECK (true);

-- 7. OTHER MODULE TABLES (CASES, CALLS, MEETINGS, EXPENSES, VENDORS, ATTENDANCE, WORK_REPORTS)
ALTER TABLE IF EXISTS public.cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_cases" ON public.cases;
CREATE POLICY "allow_all_cases" ON public.cases FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_calls" ON public.calls;
CREATE POLICY "allow_all_calls" ON public.calls FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_meetings" ON public.meetings;
CREATE POLICY "allow_all_meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_expenses" ON public.expenses;
CREATE POLICY "allow_all_expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_vendors" ON public.vendors;
CREATE POLICY "allow_all_vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_attendance" ON public.attendance;
CREATE POLICY "allow_all_attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.work_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_work_reports" ON public.work_reports;
CREATE POLICY "allow_all_work_reports" ON public.work_reports FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  RAISE NOTICE 'Full permissive RLS policies applied successfully across all pipeline tables!';
END $$;
