-- ===================================================================
-- TEAM-BASED SHARED ACCESS SYSTEM MIGRATION
-- ===================================================================

-- 1. Create Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by  UUID REFERENCES users(id)
);

-- 2. Add team_id to users table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'team_id') THEN
        ALTER TABLE users ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Update user_permissions table for team visibility
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_permissions' AND COLUMN_NAME = 'can_view_team') THEN
        ALTER TABLE user_permissions ADD COLUMN can_view_team BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. Create Universal Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module          TEXT NOT NULL,
    record_id       UUID NOT NULL,
    record_owner_id UUID NOT NULL REFERENCES users(id),
    user_id         UUID NOT NULL REFERENCES users(id), -- Who performed the action
    action          TEXT NOT NULL, -- 'CREATED', 'UPDATED', 'DELETED'
    details         JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS on new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 6. Helper Function to avoid RLS Recursion on Users table
CREATE OR REPLACE FUNCTION get_my_team_id() 
RETURNS UUID AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 7. Basic RLS Policies for Teams
DROP POLICY IF EXISTS "Anyone can view teams" ON teams;
CREATE POLICY "Anyone can view teams" ON teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super admins manage teams" ON teams;
CREATE POLICY "Super admins manage teams" ON teams FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
);

-- 8. Updated RLS Policies for Users (CRITICAL: Allow seeing teammates)
DROP POLICY IF EXISTS "user_read_own" ON users;
DROP POLICY IF EXISTS "user_read_teammates" ON users;
CREATE POLICY "user_read_teammates" ON users FOR SELECT USING (
    auth.uid() = id 
    OR 
    (team_id IS NOT NULL AND team_id = get_my_team_id())
);

-- 9. Basic RLS Policies for Activity Log
DROP POLICY IF EXISTS "Users can view relevant activity" ON activity_log;
CREATE POLICY "Users can view relevant activity" ON activity_log FOR SELECT USING (
    auth.uid() = user_id -- Own actions
    OR auth.uid() = record_owner_id -- Actions on own records
    OR EXISTS ( -- Actions by teammates if shared view enabled
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
          AND module = activity_log.module 
          AND can_view_team = true
          AND EXISTS (
              SELECT 1 FROM users u_me 
              WHERE u_me.id = auth.uid() 
                AND u_me.team_id IS NOT NULL 
                AND u_me.team_id = (SELECT team_id FROM users WHERE id = activity_log.user_id)
          )
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Anyone can log activity" ON activity_log;
CREATE POLICY "Anyone can log activity" ON activity_log FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- 10. UPDATE RLS FOR EXISTING MODULES (LEADS, CASES, ETC.)
-- Function to apply team-based RLS to a table
CREATE OR REPLACE FUNCTION apply_team_rls(target_table TEXT, target_module TEXT) RETURNS VOID AS $$
BEGIN
    -- We use a SECURITY DEFINER check here to ensure the join works even if RLS is strict
    EXECUTE format('DROP POLICY IF EXISTS "team_select_%I" ON %I', target_table, target_table);
    EXECUTE format('CREATE POLICY "team_select_%I" ON %I FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_permissions perms
            WHERE perms.user_id = auth.uid() 
              AND perms.module = %L
              AND perms.can_view_team = true
              AND (SELECT team_id FROM users WHERE id = auth.uid()) = (SELECT team_id FROM users WHERE id = %I.user_id)
              AND (SELECT team_id FROM users WHERE id = auth.uid()) IS NOT NULL
        )
    )', target_table, target_table, target_module, target_table);

    EXECUTE format('DROP POLICY IF EXISTS "team_update_%I" ON %I', target_table, target_table);
    EXECUTE format('CREATE POLICY "team_update_%I" ON %I FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_permissions perms
            WHERE perms.user_id = auth.uid() 
              AND perms.module = %L
              AND perms.can_view_team = true
              AND perms.can_edit = true
              AND (SELECT team_id FROM users WHERE id = auth.uid()) = (SELECT team_id FROM users WHERE id = %I.user_id)
              AND (SELECT team_id FROM users WHERE id = auth.uid()) IS NOT NULL
        )
    )', target_table, target_table, target_module, target_table);
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
SELECT apply_team_rls('leads', 'leads');
SELECT apply_team_rls('cases', 'cases');
SELECT apply_team_rls('calls', 'calls');
SELECT apply_team_rls('meetings', 'meetings');
SELECT apply_team_rls('expenses', 'expenses');
SELECT apply_team_rls('attendance', 'attendance');
SELECT apply_team_rls('work_reports', 'work_report');

