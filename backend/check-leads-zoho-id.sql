-- Check if zoho_lead_id column exists in leads table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name = 'zoho_lead_id';

-- If the above returns empty, run this to add the column:
-- ALTER TABLE leads ADD COLUMN zoho_lead_id VARCHAR(50);

-- Check all columns in leads table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads' 
ORDER BY ordinal_position;
