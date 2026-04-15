-- =============================================
-- ADD LEAD FIELDS TO CASES TABLE
-- Safe to run anytime — uses IF NOT EXISTS
-- Does NOT affect existing data or running code
-- =============================================

ALTER TABLE cases ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_relation TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_location TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS destination_location TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS zoho_lead_id TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS serial_no_1 TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS serial_no_2 TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS field TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS expected_close DATE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS next_action TEXT;

-- Verify all columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cases'
ORDER BY ordinal_position;
