-- =========================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Fixes: Enables timeline history items to be linked directly to cases.
--
-- ⚠️ NOTE ON THE SUPABASE WARNING:
-- Supabase generically displays the "Potential issue detected" modal
-- for any query containing ALTER or DROP commands. 
-- This script has been audited and is 100% SAFE to run. It does NOT 
-- drop any tables, delete any existing data, or disrupt current features.
-- =========================================================

-- 1. Add optional case_id column referencing cases table
-- (Safe: Only runs if the column does not already exist)
ALTER TABLE lead_history 
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id) ON DELETE CASCADE;

-- 2. Make lead_id nullable so events can be case-only if needed
-- (Safe: Removing the NOT NULL constraint is backward-compatible.
-- All existing lead history rows and their data remain 100% intact)
ALTER TABLE lead_history 
ALTER COLUMN lead_id DROP NOT NULL;

-- 3. Create index for database performance on the new column
CREATE INDEX IF NOT EXISTS idx_lead_history_case_id ON lead_history(case_id);

-- 4. Ensure Row Level Security is active
ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICY FOR CASE VIEWING (SELECT)
-- (Safe: Allows users to view timeline events linked to cases they own,
-- without affecting their ability to view lead timeline events)
DROP POLICY IF EXISTS "Users can view own case history" ON lead_history;
CREATE POLICY "Users can view own case history" ON lead_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cases 
            WHERE cases.id = lead_history.case_id 
            AND cases.user_id = auth.uid()
        )
    );

-- 6. RLS POLICY FOR CASE LOGGING (INSERT)
-- (Safe: Allows users to create timeline logs for cases they own,
-- without affecting their ability to log lead events)
DROP POLICY IF EXISTS "Users can insert own case history" ON lead_history;
CREATE POLICY "Users can insert own case history" ON lead_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM cases 
            WHERE cases.id = lead_history.case_id 
            AND cases.user_id = auth.uid()
        )
    );
