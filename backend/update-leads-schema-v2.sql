-- =====================================================
-- Migration: Add Enhanced Zoho CRM Fields to Leads
-- =====================================================

DO $$ 
BEGIN
    -- Add company column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'company') THEN
        ALTER TABLE leads ADD COLUMN company TEXT;
    END IF;

    -- Add client_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'client_name') THEN
        ALTER TABLE leads ADD COLUMN client_name TEXT;
    END IF;

    -- Add client_phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'client_phone') THEN
        ALTER TABLE leads ADD COLUMN client_phone TEXT;
    END IF;

    -- Add client_email column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'client_email') THEN
        ALTER TABLE leads ADD COLUMN client_email TEXT;
    END IF;

    -- Add requested_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'requested_by') THEN
        ALTER TABLE leads ADD COLUMN requested_by TEXT;
    END IF;

    -- Add requested_to column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'requested_to') THEN
        ALTER TABLE leads ADD COLUMN requested_to TEXT;
    END IF;

    -- Add referring_hospital column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'referring_hospital') THEN
        ALTER TABLE leads ADD COLUMN referring_hospital TEXT;
    END IF;

    -- Add receiving_hospital column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'receiving_hospital') THEN
        ALTER TABLE leads ADD COLUMN receiving_hospital TEXT;
    END IF;

    -- Add quotation_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'quotation_type') THEN
        ALTER TABLE leads ADD COLUMN quotation_type TEXT;
    END IF;

END $$;

-- Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name IN (
    'company', 'client_name', 'client_phone', 'client_email', 
    'requested_by', 'requested_to', 'referring_hospital', 
    'receiving_hospital', 'quotation_type'
)
ORDER BY column_name;
