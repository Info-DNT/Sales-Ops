-- =============================================
-- LEAD FILES TABLE
-- Stores quotation/document attachments per lead
-- Populated automatically via Make.com + quotation-webhook Netlify function
-- =============================================

CREATE TABLE IF NOT EXISTS lead_files (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  source      TEXT DEFAULT 'drive',   -- 'drive' = auto-uploaded, 'manual' = future manual upload
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lead lookups
CREATE INDEX IF NOT EXISTS idx_lead_files_lead_id ON lead_files(lead_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE lead_files ENABLE ROW LEVEL SECURITY;

-- Users can see files belonging to their own leads
CREATE POLICY "Users can view their own lead files"
  ON lead_files FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE user_id = auth.uid()
    )
  );

-- Admins can view all lead files
CREATE POLICY "Admins can view all lead files"
  ON lead_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role (used by Netlify webhook) can insert without restriction
-- Note: The webhook uses SUPABASE_SERVICE_KEY which bypasses RLS automatically.
-- This policy is for completeness only.
CREATE POLICY "Service role insert"
  ON lead_files FOR INSERT
  WITH CHECK (true);
