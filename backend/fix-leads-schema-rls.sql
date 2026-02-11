-- =====================================================
-- Migration: Fix Leads Schema and RLS Policies (Corrected)
-- =====================================================

DO $$ 
BEGIN
    -- 1. Add missing lead_source and field columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_source') THEN
        ALTER TABLE leads ADD COLUMN lead_source TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'field') THEN
        ALTER TABLE leads ADD COLUMN field TEXT;
    END IF;

    -- 2. Update status constraint
    ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
    ALTER TABLE leads ADD CONSTRAINT leads_status_check 
        CHECK (status IN ('New', 'In Progress', 'Qualified', 'Closed', 'Not Converted'));
    
    -- Print success message inside the block
    RAISE NOTICE 'Schema and constraints updated successfully';
END $$;

-- 3. Update RLS Policies
-- Regular users policy
DROP POLICY IF EXISTS "Users can manage own leads" ON leads;
CREATE POLICY "Users can manage own leads" ON leads
    FOR ALL USING (auth.uid() = user_id);

-- Admin policy
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;
CREATE POLICY "Admins can manage all leads" ON leads
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name IN ('lead_source', 'field', 'status');
