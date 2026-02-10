-- Manually set zoho_lead_id for "Tushar testing 101" lead so you can test immediately
-- I am using the actual record ID from your logs: 1036312000000906064

UPDATE leads 
SET zoho_lead_id = '1036312000000906064'
WHERE name LIKE '%Tushar testing 101%';

-- Also update "Test Sync" if you used that name
UPDATE leads 
SET zoho_lead_id = '1036312000000906064'
WHERE name = 'Test Sync';

-- Verify it worked
SELECT name, email, zoho_lead_id 
FROM leads 
WHERE zoho_lead_id = '1036312000000906064';
