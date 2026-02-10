-- =====================================================
-- Create Missing Tables for CRM Integration (FIXED)
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, let's check what exists and create only what's missing

-- 1. Create crm_lead_registry table (WITHOUT foreign keys first)
CREATE TABLE IF NOT EXISTS crm_lead_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zoho_lead_id VARCHAR(50) UNIQUE NOT NULL,
    lead_id UUID,
    user_id UUID,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_at TIMESTAMP WITH TIME ZONE,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create lead_history table (WITHOUT foreign keys first)
CREATE TABLE IF NOT EXISTS lead_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_registry_zoho_id ON crm_lead_registry(zoho_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_lead_id ON lead_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_created ON lead_history(created_at DESC);

-- 4. Enable RLS on new tables
ALTER TABLE crm_lead_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated read crm_registry" ON crm_lead_registry;
DROP POLICY IF EXISTS "Allow authenticated insert crm_registry" ON crm_lead_registry;
DROP POLICY IF EXISTS "Allow authenticated update crm_registry" ON crm_lead_registry;
DROP POLICY IF EXISTS "Users view own lead history" ON lead_history;
DROP POLICY IF EXISTS "Users insert own lead history" ON lead_history;
DROP POLICY IF EXISTS "Admins insert any lead history" ON lead_history;

-- 6. RLS Policies for crm_lead_registry - Allow all authenticated users
CREATE POLICY "Allow authenticated read crm_registry" ON crm_lead_registry
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert crm_registry" ON crm_lead_registry
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update crm_registry" ON crm_lead_registry
    FOR UPDATE TO authenticated USING (true);

-- 7. RLS Policies for lead_history - Allow all authenticated users
CREATE POLICY "Users view own lead history" ON lead_history
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own lead history" ON lead_history
    FOR INSERT TO authenticated WITH CHECK (true);

-- Done! Tables created successfully
SELECT 'Tables created successfully!' as status;
