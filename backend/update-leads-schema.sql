-- Migration: Update leads table to use client_relation instead of patient_contact and patient_email
-- Date: 2026-02-12
-- Description: Remove patient_contact and patient_email columns, add client_relation column

-- Add the new client_relation column
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS client_relation TEXT;

-- Drop the old columns
ALTER TABLE leads
DROP COLUMN IF EXISTS patient_contact,
DROP COLUMN IF EXISTS patient_email;

-- Add a comment to document the change
COMMENT ON COLUMN leads.client_relation IS 'Relationship of the patient to the client (e.g., self, spouse, parent, child)';
