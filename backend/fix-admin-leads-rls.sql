-- =============================================
-- FIX LEADS RLS - Allow Admins to see all leads
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Ensure column exists (just in case)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT FALSE;

-- 2. Drop existing restrictive policies if needed (optional, depends on your setup)
-- DROP POLICY IF EXISTS "leads_all_own" ON leads;

-- 3. Create Admin View Policy
DROP POLICY IF EXISTS "Admins view all leads" ON leads;
CREATE POLICY "Admins view all leads" ON leads
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 4. Create User View Policy (already exists but just in case)
-- This allows regular users to see their assigned leads
DROP POLICY IF EXISTS "Users view own leads" ON leads;
CREATE POLICY "Users view own leads" ON leads
FOR ALL
USING (auth.uid() = user_id);

-- 5. Confirm Column Check
SELECT 
  column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('is_converted', 'converted_at', 'converted_case_id');
