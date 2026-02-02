-- =============================================
-- LEAD HISTORY / TIMELINE TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS lead_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- POLICIES
ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lead history" ON lead_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = lead_history.lead_id 
            AND leads.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all lead history" ON lead_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can insert own lead history" ON lead_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = lead_history.lead_id 
            AND leads.user_id = auth.uid()
        )
        OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );
