-- =====================================================
-- FINAL DATABASE PATCH: Leads Table Synchronization
-- =====================================================

DO $$ 
BEGIN
    -- 1. Add MISSING COLUMNS if they don't exist
    -- Lead Source & Field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_source') THEN
        ALTER TABLE leads ADD COLUMN lead_source TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'field') THEN
        ALTER TABLE leads ADD COLUMN field TEXT;
    END IF;

    -- Patient Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'patient_name') THEN
        ALTER TABLE leads ADD COLUMN patient_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'patient_email') THEN
        ALTER TABLE leads ADD COLUMN patient_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'patient_contact') THEN
        ALTER TABLE leads ADD COLUMN patient_contact TEXT;
    END IF;

    -- Travel/Location Details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'source_location') THEN
        ALTER TABLE leads ADD COLUMN source_location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'destination_location') THEN
        ALTER TABLE leads ADD COLUMN destination_location TEXT;
    END IF;

    -- CRM Integration (if missing)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'zoho_lead_id') THEN
        ALTER TABLE leads ADD COLUMN zoho_lead_id TEXT;
    END IF;

    -- 2. Update status constraint to include 'Not Converted'
    ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
    ALTER TABLE leads ADD CONSTRAINT leads_status_check 
        CHECK (status IN ('New', 'In Progress', 'Qualified', 'Closed', 'Not Converted'));

    RAISE NOTICE 'Leads table schema updated successfully.';
END $$;

-- 3. Update RLS Policies (Fixing Admin Permissions)
DROP POLICY IF EXISTS "Users can manage own leads" ON leads;
CREATE POLICY "Users can manage own leads" ON leads
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;
CREATE POLICY "Admins can manage all leads" ON leads
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Final Schema Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name IN ('lead_source', 'field', 'patient_name', 'source_location', 'destination_location', 'zoho_lead_id', 'status')
ORDER BY column_name;
