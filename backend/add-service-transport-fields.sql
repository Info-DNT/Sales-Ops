-- Migration: Add Service Opt and Transport columns to leads table
-- Date: 2026-02-16
-- Description: Add service_opt and transport columns for Zoho CRM field mapping

-- Add the new columns
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS service_opt TEXT;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS transport TEXT;

-- Add comments to document the fields
COMMENT ON COLUMN leads.service_opt IS 'Service option selected by the lead (from Zoho CRM)';
COMMENT ON COLUMN leads.transport IS 'Transportation type or details (from Zoho CRM)';
