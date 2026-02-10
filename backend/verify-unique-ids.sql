-- =====================================================
-- VERIFICATION: Check for unique Zoho Lead IDs
-- =====================================================

-- 1. Check for duplicate Zoho IDs (should be empty if all unique)
SELECT zoho_lead_id, COUNT(*) 
FROM leads 
WHERE zoho_lead_id IS NOT NULL 
GROUP BY zoho_lead_id 
HAVING COUNT(*) > 1;

-- 2. Show most recent CRM leads and their unique IDs
SELECT id, name, email, zoho_lead_id, created_at
FROM leads 
WHERE zoho_lead_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check specific lead "Tushar testing 101"
SELECT id, name, zoho_lead_id 
FROM leads 
WHERE name LIKE '%Tushar testing 101%';
