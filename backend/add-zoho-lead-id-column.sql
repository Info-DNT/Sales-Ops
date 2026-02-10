-- =====================================================
-- COMPLETE FIX: Add zoho_lead_id to leads table
-- =====================================================

-- 1. Add zoho_lead_id column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zoho_lead_id VARCHAR(50);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_zoho_id ON leads(zoho_lead_id);

-- 3. Populate zoho_lead_id for existing CRM leads from crm_lead_registry
UPDATE leads 
SET zoho_lead_id = crm_lead_registry.zoho_lead_id
FROM crm_lead_registry
WHERE leads.id = crm_lead_registry.lead_id
AND leads.zoho_lead_id IS NULL;

-- 4. Verification
SELECT 'Column added and data populated!' as status;

-- Show leads with CRM IDs
SELECT id, name, email, zoho_lead_id 
FROM leads 
WHERE zoho_lead_id IS NOT NULL
LIMIT 5;
