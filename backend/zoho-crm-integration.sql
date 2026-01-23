-- =====================================================
-- Zoho CRM Integration - Database Schema
-- =====================================================

-- Create CRM Lead Registry Table
-- Purpose: Track which CRM leads have been synced and prevent duplicates
CREATE TABLE IF NOT EXISTS crm_lead_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zoho_lead_id TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id),  -- NULL = not assigned to any user
    assigned_at TIMESTAMP WITH TIME ZONE,
    first_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE crm_lead_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read (to check for duplicates)
CREATE POLICY "Everyone can read CRM registry" 
ON crm_lead_registry FOR SELECT 
USING (true);

-- RLS Policy: Only admins can insert/update/delete
CREATE POLICY "Admins manage CRM registry" 
ON crm_lead_registry FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_crm_registry_zoho_id 
ON crm_lead_registry(zoho_lead_id);

CREATE INDEX IF NOT EXISTS idx_crm_registry_user 
ON crm_lead_registry(user_id);

CREATE INDEX IF NOT EXISTS idx_crm_registry_synced 
ON crm_lead_registry(first_synced_at);

-- Add new columns to leads table for app-created leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS field TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Create index on new columns
CREATE INDEX IF NOT EXISTS idx_leads_field ON leads(field);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(lead_source);

COMMENT ON TABLE crm_lead_registry IS 'Tracks Zoho CRM leads for duplicate prevention and assignment tracking';
COMMENT ON COLUMN crm_lead_registry.zoho_lead_id IS 'Unique Zoho CRM Lead ID';
COMMENT ON COLUMN crm_lead_registry.user_id IS 'User assigned to this CRM lead (NULL if unassigned)';
COMMENT ON COLUMN crm_lead_registry.assigned_at IS 'When lead was assigned to user';
COMMENT ON COLUMN crm_lead_registry.first_synced_at IS 'When lead was first synced from Zoho CRM';
