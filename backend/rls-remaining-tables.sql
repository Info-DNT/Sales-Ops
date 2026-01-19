-- Apply RLS to remaining 5 tables
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage details" ON user_details;
DROP POLICY IF EXISTS "Admins view details" ON user_details;
CREATE POLICY "user_details_all_own" ON user_details FOR ALL USING (auth.uid() = user_id);

ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage reports" ON work_reports;
DROP POLICY IF EXISTS "Admins view reports" ON work_reports;
CREATE POLICY "work_reports_all_own" ON work_reports FOR ALL USING (auth.uid() = user_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage leads" ON leads;
DROP POLICY IF EXISTS "Admins view leads" ON leads;
CREATE POLICY "leads_all_own" ON leads FOR ALL USING (auth.uid() = user_id);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage quotes" ON quotations;
DROP POLICY IF EXISTS "Admins view quotes" ON quotations;
CREATE POLICY "quotations_all_own" ON quotations FOR ALL USING (auth.uid() = user_id);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage attend" ON attendance;
DROP POLICY IF EXISTS "Admins view attend" ON attendance;
CREATE POLICY "attendance_all_own" ON attendance FOR ALL USING (auth.uid() = user_id);
