# Supabase Setup Guide

## Project Details

- **Project URL**: `https://lgedjkyafshufxhjywhk.supabase.co`
- **Admin Email**: `info@digitalnextworld.com`
- **Admin Password**: `digitalnextworld2026`

---

## Step 1: Create Database Tables

Run the following SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- =============================================
-- SALES OPS DATABASE SCHEMA
-- =============================================

-- 1. USERS TABLE
-- Stores user profiles linked to Supabase Auth
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    designation TEXT,
    contact TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. USER DETAILS TABLE
-- Extended profile information
CREATE TABLE IF NOT EXISTS user_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    designation TEXT,
    contact TEXT,
    email TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 3. WORK REPORTS TABLE
-- Daily work metrics
CREATE TABLE IF NOT EXISTS work_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    total_meetings INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    new_leads_generated INTEGER DEFAULT 0,
    leads_in_pipeline INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, report_date)
);

-- 4. LEADS TABLE
-- Lead management
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    owner TEXT,
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Qualified', 'Closed')),
    account_name TEXT,
    follow_up_date DATE,
    next_action TEXT,
    expected_close DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. QUOTATIONS TABLE
-- Quotation records
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ATTENDANCE TABLE
-- Clock in/out records
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    hours_worked DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);
```

---

## Step 2: Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- USER DETAILS POLICIES
CREATE POLICY "Users can manage own details" ON user_details
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user details" ON user_details
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- WORK REPORTS POLICIES
CREATE POLICY "Users can manage own work reports" ON work_reports
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all work reports" ON work_reports
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- LEADS POLICIES
CREATE POLICY "Users can manage own leads" ON leads
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leads" ON leads
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- QUOTATIONS POLICIES
CREATE POLICY "Users can manage own quotations" ON quotations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all quotations" ON quotations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- ATTENDANCE POLICIES
CREATE POLICY "Users can manage own attendance" ON attendance
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance" ON attendance
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );
```

---

## Step 3: Create Admin User

### 3.1 Create Auth User
1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **Add User** → **Create New User**
3. Enter:
   - Email: `info@digitalnextworld.com`
   - Password: `digitalnextworld2026`
   - ✅ Auto Confirm User
4. Click **Create User**
5. **Copy the User UID** from the user list

### 3.2 Add Admin to Users Table

Replace `YOUR_ADMIN_UID` with the actual UUID:

```sql
INSERT INTO users (id, email, name, role)
VALUES (
    'YOUR_ADMIN_UID',
    'info@digitalnextworld.com',
    'Admin',
    'admin'
) ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

---

## Step 4: Create Trigger for New Users

This automatically creates a user record when someone signs up:

```sql
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, role)
    VALUES (NEW.id, NEW.email, 'user')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
```

---

## Authentication Flow

```
1. User enters email/password on login page
2. Application calls Supabase Auth signInWithPassword()
3. Supabase validates credentials and returns session
4. Application fetches user role from 'users' table
5. User redirected to appropriate dashboard (/admin or /user)
6. All subsequent API calls use the authenticated session
```

---

## Quick Reference

| Table | Purpose | User Access | Admin Access |
|-------|---------|-------------|--------------|
| users | Profiles | Own only | All |
| user_details | Extended info | Own only | All |
| work_reports | Daily metrics | Own only | All |
| leads | Lead management | Own only | All |
| quotations | Quotes | Own only | All |
| attendance | Clock in/out | Own only | All |

---

## Troubleshooting

### Login Fails
1. Check email/password are correct
2. Verify user exists in Authentication → Users
3. Ensure user is confirmed (not pending)
4. Check browser console for errors

### Data Not Loading
1. Verify RLS policies are created
2. Check user exists in 'users' table
3. Confirm user role is set correctly
4. Check Network tab for API errors

### Admin Can't See All Data
1. Verify admin user has `role = 'admin'` in users table
2. Re-run RLS policy SQL commands
3. Clear browser cache and re-login
