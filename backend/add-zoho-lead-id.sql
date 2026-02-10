-- =====================================================
-- Add Zoho Lead ID Column for Bidirectional Sync
-- =====================================================
-- This migration adds a column to store the Zoho CRM Lead ID
-- so we can sync updates back to the correct lead in Zoho

-- Add zoho_lead_id column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS zoho_lead_id TEXT;

-- Create index for faster lookups when syncing back to Zoho
CREATE INDEX IF NOT EXISTS idx_leads_zoho_lead_id 
ON leads(zoho_lead_id) 
WHERE zoho_lead_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.zoho_lead_id IS 'Zoho CRM Lead ID for bidirectional sync';
