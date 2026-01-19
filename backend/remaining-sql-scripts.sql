-- =============================================
-- STEP 2: ENABLE ROW LEVEL SECURITY (RLS)
-- Copy and paste this entire block, then click Run
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all users" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users update own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins insert users" ON users FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users manage details" ON user_details FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins view details" ON user_details FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users manage reports" ON work_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins view reports" ON work_reports FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users manage leads" ON leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins view leads" ON leads FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users manage quotes" ON quotations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins view quotes" ON quotations FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users manage attend" ON attendance FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins view attend" ON attendance FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));


-- =============================================
-- STEP 3: CREATE TRIGGER FOR NEW USER SIGNUP
-- Copy and paste this entire block, then click Run
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, role)
    VALUES (NEW.id, NEW.email, 'user')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
