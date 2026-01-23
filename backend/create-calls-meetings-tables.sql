-- =============================================
-- CALLS AND MEETINGS TABLES WITH DATE FIELDS
-- =============================================

-- 1. CALLS TABLE
-- Stores call records with contact information and date
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    designation TEXT NOT NULL,
    hospital_name TEXT NOT NULL,
    call_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MEETINGS TABLE
-- Stores meeting records with agenda, outcome and date
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    meeting_with TEXT NOT NULL,
    client_name TEXT NOT NULL,
    agenda TEXT NOT NULL,
    outcome TEXT,
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. UPDATE LEADS TABLE TO ADD DATE FIELD
-- Add lead_date column to existing leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on tables
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- CALLS TABLE POLICIES
CREATE POLICY "Users can manage own calls" ON calls
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all calls" ON calls
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- MEETINGS TABLE POLICIES
CREATE POLICY "Users can manage own meetings" ON meetings
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all meetings" ON meetings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );
