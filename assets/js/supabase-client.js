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

    const insertData = {
        user_id: userId,
        name: lead.name,
        contact: lead.contact,
        email: lead.email,
        owner: lead.owner,
        status: lead.status,
        follow_up_date: lead.followUpDate || null,
        next_action: lead.nextAction,
        expected_close: lead.expectedClose || null,
        lead_source: lead.leadSource || null, // Added
        field: lead.leadField || null       // Added
    };

    const { data, error } = await client
        .from('leads')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error('Supabase Insert Error:', error);
        throw error;
    }

    // Log creation in history
    await logLeadActivity(data.id, userId, 'Lead Created', {
        name: lead.name,
        status: lead.status
    });

    return data;
}

/**
 * Update a lead with history logging
 * @param {string} leadId 
 * @param {object} updates 
 * @param {string} userId - ID of the user performing the update
 */
async function updateLead(leadId, updates, userId) {
    const client = initSupabase();

    // Get current lead data to compare changes
    const { data: currentLead } = await client
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

    const { data, error } = await client
        .from('leads')
        .update({
            name: updates.name,
            contact: updates.contact,
            email: updates.email,
            owner: updates.owner,
            user_id: updates.userId || currentLead.user_id,
            status: updates.status,
            follow_up_date: updates.followUpDate,
            next_action: updates.nextAction,
            expected_close: updates.expectedClose
        })
        .eq('id', leadId)
        .select()
        .single();

    if (error) throw error;

    // Detect changes and log to history
    if (currentLead) {
        let changedFields = [];
        if (currentLead.status !== updates.status) changedFields.push(`Status changed to ${updates.status}`);
        if (currentLead.owner !== updates.owner) changedFields.push(`Owner updated`);
        if (currentLead.next_action !== updates.next_action) changedFields.push(`Next action updated`);

        if (changedFields.length > 0) {
            await logLeadActivity(leadId, userId, 'Lead Updated', {
                changes: changedFields,
                summary: changedFields.join(', ')
            });
        }
    }

    // BIDIRECTIONAL SYNC: Push updates back to Zoho CRM (if Zoho ID exists)
    if (currentLead?.zoho_lead_id) {
        try {
            // Fire-and-forget async request to sync back to CRM
            fetch('/.netlify/functions/crm-updater', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    zohoLeadId: currentLead.zoho_lead_id,
                    updates: {
                        name: updates.name,
                        email: updates.email,
                        contact: updates.contact,
                        status: updates.status,
                        account_name: updates.accountName,
                        next_action: updates.nextAction,
                        assignedTo: updates.owner,
                        followUpDate: updates.followUpDate,
                        expectedClose: updates.expectedClose
                    }
                })
            }).catch(err => {
                // Log error but don't block the UI
                console.warn('CRM sync failed (non-blocking):', err);
            });
        } catch (err) {
            // Graceful degradation - don't fail the update if CRM sync fails
            console.warn('CRM sync error:', err);
        }
    }

    return data;
}

/**
 * Log activity to lead history
 * @param {string} leadId 
 * @param {string} userId 
 * @param {string} action 
 * @param {object} details 
 */
async function logLeadActivity(leadId, userId, action, details = {}) {
    const client = initSupabase();

    const { error } = await client
        .from('lead_history')
        .insert({
            lead_id: leadId,
            user_id: userId,
            action: action,
            details: details
        });

    if (error) console.error('Error logging activity:', error);
}

/**
 * Get lead history for timeline
 * @param {string} leadId 
 */
async function getLeadHistory(leadId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('lead_history')
        .select(`
            *,
            users (name, email)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading history:', error);
        return [];
    }
    return data || [];
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

    // Get counts from actual tables
    const [usersRes, leadsRes, quotationsRes, attendanceRes, callsRes, meetingsRes] = await Promise.all([
        client.from('users').select('id', { count: 'exact' }),
        client.from('leads').select('id', { count: 'exact' }),
        client.from('quotations').select('id', { count: 'exact' }),
        client.from('attendance').select('id', { count: 'exact' }).eq('date', today),
        client.from('calls').select('id', { count: 'exact' }),
        client.from('meetings').select('id', { count: 'exact' })
    ]);

    return {
        totalUsers: usersRes.count || 0,
        totalLeads: leadsRes.count || 0,
        totalQuotations: quotationsRes.count || 0,
        activeToday: attendanceRes.count || 0,
        totalCalls: callsRes.count || 0,
        totalMeetings: meetingsRes.count || 0
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

// =============================================
// CALLS FUNCTIONS
// =============================================

/**
 * Get all calls for a user
 * @param {string} userId 
 * @param {object} filters - Optional filters
 */
async function getCalls(userId, filters = {}) {
    const client = initSupabase();

    let query = client
        .from('calls')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    // Apply date filter if provided
    if (filters.date) {
        query = query.eq('created_at::date', filters.date);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
}

/**
 * Create a new call
 * @param {string} userId 
 * @param {object} call 
 */
async function createCall(userId, call) {
    const client = initSupabase();

    const { data, error } = await client
        .from('calls')
        .insert({
            user_id: userId,
            name: call.name,
            phone: call.phone,
            designation: call.designation,
            hospital_name: call.hospitalName,
            call_date: call.callDate || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a call
 * @param {string} callId 
 * @param {object} updates 
 */
async function updateCall(callId, updates) {
    const client = initSupabase();

    const { data, error } = await client
        .from('calls')
        .update({
            name: updates.name,
            phone: updates.phone,
            designation: updates.designation,
            hospital_name: updates.hospitalName
        })
        .eq('id', callId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a call
 * @param {string} callId 
 */
async function deleteCall(callId) {
    const client = initSupabase();

    const { error } = await client
        .from('calls')
        .delete()
        .eq('id', callId);

    if (error) throw error;
    return true;
}

/**
 * Get all calls (admin only)
 */
async function getAllCallsAdmin() {
    const client = initSupabase();

    const { data, error } = await client
        .from('calls')
        .select(`
            *,
            users (name, email)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// =============================================
// MEETINGS FUNCTIONS
// =============================================

/**
 * Get all meetings for a user
 * @param {string} userId 
 * @param {object} filters - Optional filters
 */
async function getMeetings(userId, filters = {}) {
    const client = initSupabase();

    let query = client
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    // Apply date filter if provided
    if (filters.date) {
        query = query.eq('created_at::date', filters.date);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
}

/**
 * Create a new meeting
 * @param {string} userId 
 * @param {object} meeting 
 */
async function createMeeting(userId, meeting) {
    const client = initSupabase();

    const { data, error } = await client
        .from('meetings')
        .insert({
            user_id: userId,
            meeting_with: meeting.meetingWith,
            client_name: meeting.clientName,
            agenda: meeting.agenda,
            outcome: meeting.outcome || '',
            meeting_date: meeting.meetingDate || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a meeting
 * @param {string} meetingId 
 * @param {object} updates 
 */
async function updateMeeting(meetingId, updates) {
    const client = initSupabase();

    const { data, error } = await client
        .from('meetings')
        .update({
            meeting_with: updates.meetingWith,
            client_name: updates.clientName,
            agenda: updates.agenda,
            outcome: updates.outcome
        })
        .eq('id', meetingId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a meeting
 * @param {string} meetingId 
 */
async function deleteMeeting(meetingId) {
    const client = initSupabase();

    const { error } = await client
        .from('meetings')
        .delete()
        .eq('id', meetingId);

    if (error) throw error;
    return true;
}

/**
 * Get all meetings (admin only)
 */
async function getAllMeetingsAdmin() {
    const client = initSupabase();

    const { data, error } = await client
        .from('meetings')
        .select(`
            *,
            users (name, email)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});
