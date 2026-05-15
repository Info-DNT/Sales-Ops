-- ===================================================================
-- IMPLEMENTATION: TEAM-BASED SHARED ACCESS SYSTEM
-- This migration adds team support and granular team visibility
-- without breaking existing functionality.
-- ===================================================================

-- 1. Create Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add team_id to users table (Nullable, safe for existing users)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'users' AND column_name = 'team_id') THEN
        ALTER TABLE users ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Add can_view_team to user_permissions table (Default false, safe)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'user_permissions' AND column_name = 'can_view_team') THEN
        ALTER TABLE user_permissions ADD COLUMN can_view_team BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. Create Universal Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module              TEXT NOT NULL,           -- 'leads', 'cases', etc.
    record_id           UUID NOT NULL,           -- ID of the record changed
    record_owner_id     UUID,                    -- whose record was it
    user_id             UUID NOT NULL REFERENCES users(id), -- who did it
    action              TEXT NOT NULL,           -- 'created', 'updated', 'deleted'
    details             JSONB DEFAULT '{}'::jsonb, -- changes diff
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Super Admin sees all activity
DROP POLICY IF EXISTS "super_admin_all_activity_log" ON activity_log;
CREATE POLICY "super_admin_all_activity_log" ON activity_log FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- Users see their own activity or activity on their records
DROP POLICY IF EXISTS "user_view_relevant_activity" ON activity_log;
CREATE POLICY "user_view_relevant_activity" ON activity_log FOR SELECT USING (user_id = auth.uid() OR record_owner_id = auth.uid());

-- 5. Helper Function for Team Check (To avoid complex joins in RLS)
CREATE OR REPLACE FUNCTION is_team_member(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u_current
    JOIN users u_owner ON u_current.team_id = u_owner.team_id
    WHERE u_current.id = auth.uid() 
      AND u_owner.id = owner_id
      AND u_current.team_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- END OF SCHEMA UPDATE
-- =============================================
