-- Deep analysis of lead data to debug CRM sync
-- Run this to see EXACTLY what's in the database

-- 1. Show the "Test Sync" lead with ALL fields
SELECT 
    id,
    name,
    email,
    contact,
    zoho_lead_id,
    lead_source,
    status,
    created_at,
    updated_at
FROM leads 
WHERE name LIKE '%Test Sync%'
OR name LIKE '%Tushar%'
ORDER BY created_at DESC;

-- 2. Check if ANY leads have zoho_lead_id populated
SELECT 
    COUNT(*) as total_leads,
    COUNT(zoho_lead_id) as leads_with_zoho_id,
    COUNT(CASE WHEN lead_source = 'Zoho CRM' THEN 1 END) as crm_source_leads
FROM leads;

-- 3. Show a sample of leads with their zoho_lead_id status
SELECT 
    name,
    email,
    lead_source,
    zoho_lead_id,
    CASE 
        WHEN zoho_lead_id IS NOT NULL THEN 'HAS ID'
        ELSE 'NO ID'
    END as id_status
FROM leads
WHERE lead_source = 'Zoho CRM'
   OR zoho_lead_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
