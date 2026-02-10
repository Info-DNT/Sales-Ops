-- Manually set zoho_lead_id for Test Sync lead so you can test immediately
-- This is a temporary fix for existing leads

UPDATE leads 
SET zoho_lead_id = '32'
WHERE name = 'Test Sync';

-- Verify it worked
SELECT name, email, zoho_lead_id 
FROM leads 
WHERE name = 'Test Sync';
