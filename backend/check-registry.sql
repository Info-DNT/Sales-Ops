-- Check what's in crm_lead_registry
SELECT * FROM crm_lead_registry LIMIT 10;

-- Check if any leads have zoho IDs stored anywhere
SELECT 
    id,
    name, 
    email,
    lead_source,
    created_at
FROM leads 
WHERE lead_source = 'Zoho CRM'
ORDER BY created_at DESC;
