-- Lead Assignment Feature - Database Policies
-- This script updates RLS policies to support lead assignment
-- SAFE: Does not modify existing data or break CRM integration

-- ============================================
-- STEP 1: Update RLS Policy for Lead Visibility
-- ============================================

-- Drop old policy if exists
DROP POLICY IF EXISTS "Users can view their assigned leads" ON leads;

-- Create new policy: Users see leads assigned to them OR if they are admin
CREATE POLICY "Users can view their assigned leads"
ON leads FOR SELECT
USING (
    -- User can see leads assigned to them
    user_id = auth.uid()
    OR
    -- Admins can see all leads
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- ============================================
-- STEP 2: Ensure Update Policy Exists
-- ============================================

-- Drop old update policy if exists
DROP POLICY IF EXISTS "Users can update their leads" ON leads;

-- Users can update leads assigned to them, admins can update all
CREATE POLICY "Users can update their leads"
ON leads FOR UPDATE
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- ============================================
-- STEP 3: Create Index for Performance
-- ============================================

-- Add index on user_id for faster queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these after applying to verify:

-- 1. Check that policies exist
-- SELECT * FROM pg_policies WHERE tablename = 'leads';

-- 2. Check index exists
-- SELECT * FROM pg_indexes WHERE tablename = 'leads' AND indexname = 'idx_leads_user_id';

-- ============================================
-- NOTES
-- ============================================

-- ✅ SAFE: Does not modify existing data
-- ✅ SAFE: Does not affect CRM integration (crm-receiver uses Service Role Key, bypasses RLS)
-- ✅ SAFE: Existing leads remain visible to admins
-- ✅ NEW: Users can now see leads assigned to them via user_id field
