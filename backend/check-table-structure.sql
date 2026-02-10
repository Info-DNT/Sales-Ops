-- Check what columns exist in lead_history table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lead_history' 
AND table_schema = 'public';

-- Check what columns exist in crm_lead_registry table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'crm_lead_registry' 
AND table_schema = 'public';
