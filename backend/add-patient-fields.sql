-- =====================================================
-- Migration: Add Patient Information Columns to Leads
-- =====================================================

DO $$ 
BEGIN
    -- 1. Add patient_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' 
        AND column_name = 'patient_name'
    ) THEN
        ALTER TABLE leads ADD COLUMN patient_name TEXT;
        RAISE NOTICE 'Added patient_name column to leads';
    END IF;

    -- 2. Add patient_email column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' 
        AND column_name = 'patient_email'
    ) THEN
        ALTER TABLE leads ADD COLUMN patient_email TEXT;
        RAISE NOTICE 'Added patient_email column to leads';
    END IF;

    -- 3. Add patient_contact column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' 
        AND column_name = 'patient_contact'
    ) THEN
        ALTER TABLE leads ADD COLUMN patient_contact TEXT;
        RAISE NOTICE 'Added patient_contact column to leads';
    END IF;
END $$;

-- Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name IN ('name', 'contact', 'email', 'patient_name', 'patient_email', 'patient_contact')
ORDER BY column_name;
