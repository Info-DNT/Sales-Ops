-- =====================================================
-- Migration: Add Location Columns to Leads
-- =====================================================

DO $$ 
BEGIN
    -- 1. Add source_location column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' 
        AND column_name = 'source_location'
    ) THEN
        ALTER TABLE leads ADD COLUMN source_location TEXT;
        RAISE NOTICE 'Added source_location column to leads';
    END IF;

    -- 2. Add destination_location column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' 
        AND column_name = 'destination_location'
    ) THEN
        ALTER TABLE leads ADD COLUMN destination_location TEXT;
        RAISE NOTICE 'Added destination_location column to leads';
    END IF;
END $$;

-- Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name IN ('source_location', 'destination_location')
ORDER BY column_name;
