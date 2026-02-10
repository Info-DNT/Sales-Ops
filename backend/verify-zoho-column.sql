-- =====================================================
-- VERIFICATION: Check if zoho_lead_id column exists and has data
-- =====================================================

-- 1. Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name = 'zoho_lead_id';

-- 2. Count how many leads have Zoho IDs
SELECT 
    COUNT(*) as total_leads,
    COUNT(zoho_lead_id) as leads_with_zoho_id,
    COUNT(*) - COUNT(zoho_lead_id) as leads_without_zoho_id
FROM leads;

-- 3. Show all CRM leads with their Zoho IDs
SELECT 
    id,
    name,
    email,
    contact,
    zoho_lead_id,
    lead_source,
    created_at
FROM leads 
WHERE lead_source = 'Zoho CRM'
ORDER BY created_at DESC;

-- 4. Show "Tushar Singh" specifically
SELECT 
    id,
    name,
    email,
    zoho_lead_id,
    lead_source
FROM leads 
WHERE name LIKE '%Tushar%'
ORDER BY created_at DESC;
