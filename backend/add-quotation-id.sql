-- add-quotation-id-migration.sql
-- Run this in Supabase SQL editor to fix the CRM sync error AND the Cases page display issue

-- 1. Add to leads table for CRM sync
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS quotation_id TEXT;

COMMENT ON COLUMN leads.quotation_id IS 'Synchronized Quotation ID from Zoho CRM';

-- 2. Add to cases table for UI display and tracking
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS quotation_id TEXT;

COMMENT ON COLUMN cases.quotation_id IS 'Associated Quotation ID for the case';
