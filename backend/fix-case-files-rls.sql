-- =============================================
-- FIX: case_files RLS Policies
-- Problem: INSERT/SELECT policies used nested subqueries on 'cases' table
-- which triggers nested RLS evaluation in Supabase and fails silently.
-- Fix: Use direct column checks (uploaded_by = auth.uid()) instead of subqueries.
-- Run this in Supabase SQL Editor.
-- =============================================

-- Fix INSERT policy (this was causing "violates row-level security policy" on upload)
DROP POLICY IF EXISTS "Users insert own case files" ON case_files;
CREATE POLICY "Users insert own case files" ON case_files
FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Fix SELECT policy (same subquery issue)
DROP POLICY IF EXISTS "Users view own case files" ON case_files;
CREATE POLICY "Users view own case files" ON case_files
FOR SELECT USING (
    uploaded_by = auth.uid()
    OR case_id IN (SELECT id FROM cases WHERE user_id = auth.uid())
);

-- Fix DELETE policy (simplify)
DROP POLICY IF EXISTS "Users delete own case files" ON case_files;
CREATE POLICY "Users delete own case files" ON case_files
FOR DELETE USING (uploaded_by = auth.uid());

-- Admin policy stays the same (already correct)
DROP POLICY IF EXISTS "Admins manage all case files" ON case_files;
CREATE POLICY "Admins manage all case files" ON case_files FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Verify policies are set
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'case_files';
