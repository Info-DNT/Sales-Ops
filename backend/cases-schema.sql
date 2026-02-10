-- =====================================================
-- Cases Table Schema
-- =====================================================

-- Create Cases Table
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT UNIQUE NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, In Progress, Completed, On Hold, Cancelled
    priority TEXT NOT NULL DEFAULT 'Medium', -- Low, Medium, High
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own cases
CREATE POLICY "Users can view own cases" 
ON cases FOR SELECT 
USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own cases
CREATE POLICY "Users can create own cases" 
ON cases FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own cases
CREATE POLICY "Users can update own cases" 
ON cases FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policy: Admins can do everything
CREATE POLICY "Admins manage all cases" 
ON cases FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_lead_id ON cases(lead_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_cases_updated_at
BEFORE UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION handle_cases_updated_at();

COMMENT ON TABLE cases IS 'Tracks support or sales cases assigned to users';
