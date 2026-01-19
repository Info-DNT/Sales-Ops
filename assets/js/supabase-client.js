// =============================================
// SUPABASE CLIENT CONFIGURATION
// =============================================

// Supabase Project Credentials
const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZWRqa3lhZnNodWZ4aGp5d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTgwNTAsImV4cCI6MjA4NDAzNDA1MH0.RqL0cdmv259m_txWrpIZoFB9vJ40R_vStxxoZz3ICv0';

// Initialize Supabase client
let supabaseClient = null;

function initSupabase() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

// =============================================
// AUTHENTICATION FUNCTIONS
// =============================================

/**
 * Login with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} User data with role
 */
async function loginWithSupabase(email, password) {
    const client = initSupabase();

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (authError) {
        throw new Error(authError.message);
    }

    // Get user profile with role
    const { data: userData, error: userError } = await client
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (userError) {
        // If user doesn't exist in users table, create them
        const { data: newUser, error: insertError } = await client
            .from('users')
            .insert({
                id: authData.user.id,
                email: authData.user.email,
                role: 'user'
            })
            .select()
            .single();

        if (insertError) {
            throw new Error('Failed to create user profile');
        }

        // Save session to localStorage
        const session = {
            userId: authData.user.id,
            email: authData.user.email,
            name: newUser.name || authData.user.email.split('@')[0],
            role: newUser.role
        };
        localStorage.setItem('salesAppSession', JSON.stringify(session));

        return session;
    }

    // Save session to localStorage
    const session = {
        userId: authData.user.id,
        email: userData.email,
        name: userData.name || authData.user.email.split('@')[0],
        role: userData.role
    };
    localStorage.setItem('salesAppSession', JSON.stringify(session));

    return session;
}

/**
 * Logout from Supabase
 */
async function logoutFromSupabase() {
    const client = initSupabase();

    const { error } = await client.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
    }

    // Clear local session
    localStorage.removeItem('salesAppSession');
}

/**
 * Get current authenticated user
 */
async function getCurrentUser() {
    const client = initSupabase();
    const { data: { user } } = await client.auth.getUser();
    return user;
}

// =============================================
// USER DETAILS FUNCTIONS
// =============================================

/**
 * Get user details
 * @param {string} userId 
 */
async function getUserDetails(userId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('user_details')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
    }

    return data;
}

/**
 * Save or update user details
 * @param {string} userId 
 * @param {object} details 
 */
async function saveUserDetails(userId, details) {
    const client = initSupabase();

    const { data, error } = await client
        .from('user_details')
        .upsert({
            user_id: userId,
            name: details.name,
            designation: details.designation,
            contact: details.contact,
            email: details.email,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// =============================================
// WORK REPORTS FUNCTIONS
// =============================================

/**
 * Get work report for a specific date
 * @param {string} userId 
 * @param {string} date - YYYY-MM-DD format
 */
async function getWorkReport(userId, date) {
    const client = initSupabase();

    const { data, error } = await client
        .from('work_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('report_date', date)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data;
}

/**
 * Get all work reports for a user
 * @param {string} userId 
 */
async function getAllWorkReports(userId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('work_reports')
        .select('*')
        .eq('user_id', userId)
        .order('report_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Save work report
 * @param {string} userId 
 * @param {object} report 
 */
async function saveWorkReport(userId, report) {
    const client = initSupabase();

    const { data, error } = await client
        .from('work_reports')
        .upsert({
            user_id: userId,
            report_date: report.date,
            total_calls: report.totalCalls,
            total_meetings: report.totalMeetings,
            total_leads: report.totalLeads,
            new_leads_generated: report.newLeadsGenerated,
            leads_in_pipeline: report.leadsInPipeline
        }, {
            onConflict: 'user_id,report_date'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// =============================================
// LEADS FUNCTIONS
// =============================================

/**
 * Get all leads for a user
 * @param {string} userId 
 * @param {object} filters - Optional filters
 */
async function getLeads(userId, filters = {}) {
    const client = initSupabase();

    let query = client
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    // Apply date filter if provided
    if (filters.date) {
        query = query.eq('created_at::date', filters.date);
    }

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
}

/**
 * Create a new lead
 * @param {string} userId 
 * @param {object} lead 
 */
async function createLead(userId, lead) {
    const client = initSupabase();

    const { data, error } = await client
        .from('leads')
        .insert({
            user_id: userId,
            name: lead.name,
            contact: lead.contact,
            email: lead.email,
            owner: lead.owner,
            status: lead.status,
            account_name: lead.accountName,
            follow_up_date: lead.followUpDate || null,
            next_action: lead.nextAction,
            expected_close: lead.expectedClose || null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a lead
 * @param {string} leadId 
 * @param {object} updates 
 */
async function updateLead(leadId, updates) {
    const client = initSupabase();

    const { data, error } = await client
        .from('leads')
        .update({
            name: updates.name,
            contact: updates.contact,
            email: updates.email,
            owner: updates.owner,
            status: updates.status,
            account_name: updates.accountName,
            follow_up_date: updates.followUpDate,
            next_action: updates.nextAction,
            expected_close: updates.expectedClose
        })
        .eq('id', leadId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a lead
 * @param {string} leadId 
 */
async function deleteLead(leadId) {
    const client = initSupabase();

    const { error } = await client
        .from('leads')
        .delete()
        .eq('id', leadId);

    if (error) throw error;
    return true;
}

// =============================================
// QUOTATIONS FUNCTIONS
// =============================================

/**
 * Get all quotations for a user
 * @param {string} userId 
 */
async function getQuotations(userId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('quotations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Create a quotation
 * @param {string} userId 
 * @param {object} quotation 
 */
async function createQuotation(userId, quotation) {
    const client = initSupabase();

    const { data, error } = await client
        .from('quotations')
        .insert({
            user_id: userId,
            client_name: quotation.clientName,
            amount: quotation.amount,
            description: quotation.description
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// =============================================
// ATTENDANCE FUNCTIONS
// =============================================

/**
 * Get attendance record for a date
 * @param {string} userId 
 * @param {string} date 
 */
async function getAttendance(userId, date) {
    const client = initSupabase();

    const { data, error } = await client
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data;
}

/**
 * Get all attendance records for a user
 * @param {string} userId 
 */
async function getAllAttendance(userId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Clock in
 * @param {string} userId 
 */
async function clockIn(userId) {
    const client = initSupabase();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    const { data, error } = await client
        .from('attendance')
        .upsert({
            user_id: userId,
            date: today,
            clock_in: now
        }, {
            onConflict: 'user_id,date'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Clock out
 * @param {string} userId 
 */
async function clockOut(userId) {
    const client = initSupabase();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    // Get today's attendance record
    const { data: existing } = await client
        .from('attendance')
        .select('clock_in')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

    // Calculate hours worked
    let hoursWorked = 0;
    if (existing && existing.clock_in) {
        const clockInTime = new Date(`2000-01-01 ${existing.clock_in}`);
        const clockOutTime = new Date(`2000-01-01 ${now}`);
        hoursWorked = ((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2);
    }

    const { data, error } = await client
        .from('attendance')
        .update({
            clock_out: now,
            hours_worked: hoursWorked
        })
        .eq('user_id', userId)
        .eq('date', today)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// =============================================
// ADMIN FUNCTIONS
// =============================================

/**
 * Get all users (admin only)
 */
async function getAllUsers() {
    const client = initSupabase();

    const { data, error } = await client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get user by ID (admin only)
 * @param {string} userId 
 */
async function getUserById(userId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get all leads (admin only)
 */
async function getAllLeadsAdmin() {
    const client = initSupabase();

    const { data, error } = await client
        .from('leads')
        .select(`
            *,
            users (name, email)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get all work reports (admin only)
 */
async function getAllWorkReportsAdmin() {
    const client = initSupabase();

    const { data, error } = await client
        .from('work_reports')
        .select(`
            *,
            users (name, email)
        `)
        .order('report_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get all attendance records (admin only)
 */
async function getAllAttendanceAdmin() {
    const client = initSupabase();

    const { data, error } = await client
        .from('attendance')
        .select(`
            *,
            users (name, email)
        `)
        .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get all quotations (admin only)
 */
async function getAllQuotationsAdmin() {
    const client = initSupabase();

    const { data, error } = await client
        .from('quotations')
        .select(`
            *,
            users (name, email)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get admin dashboard stats
 */
async function getAdminDashboardStats() {
    const client = initSupabase();
    const today = new Date().toISOString().split('T')[0];

    // Get counts
    const [usersRes, leadsRes, quotationsRes, attendanceRes] = await Promise.all([
        client.from('users').select('id', { count: 'exact' }),
        client.from('leads').select('id', { count: 'exact' }),
        client.from('quotations').select('id', { count: 'exact' }),
        client.from('attendance').select('id', { count: 'exact' }).eq('date', today)
    ]);

    // Get work report totals
    const { data: workReports } = await client
        .from('work_reports')
        .select('total_calls, total_meetings');

    let totalCalls = 0;
    let totalMeetings = 0;
    if (workReports) {
        workReports.forEach(report => {
            totalCalls += report.total_calls || 0;
            totalMeetings += report.total_meetings || 0;
        });
    }

    return {
        totalUsers: usersRes.count || 0,
        totalLeads: leadsRes.count || 0,
        totalQuotations: quotationsRes.count || 0,
        activeToday: attendanceRes.count || 0,
        totalCalls: totalCalls,
        totalMeetings: totalMeetings
    };
}

/**
 * Create a new user (admin only)
 * Note: This requires Supabase Admin API or invite flow
 * For now, we'll use the invite method
 */
async function createUserByAdmin(email, name, role = 'user') {
    const client = initSupabase();

    // First, send an invite (user will set their own password)
    const { data: authData, error: authError } = await client.auth.admin.inviteUserByEmail(email);

    if (authError) {
        // If admin API not available, return error
        throw new Error('User creation requires Supabase Admin API. Please create users via Supabase Dashboard.');
    }

    // Create user profile
    const { data, error } = await client
        .from('users')
        .insert({
            id: authData.user.id,
            email: email,
            name: name,
            role: role
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});
