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

        // Generate and register single-session token
        const sessionToken = crypto.randomUUID();
        await registerSessionToken(client, authData.user.id, sessionToken);

        // Save session to localStorage
        const session = {
            userId: authData.user.id,
            teamId: null,
            email: authData.user.email,
            name: newUser.name || authData.user.email.split('@')[0],
            role: newUser.role,
            sessionToken,
            permissions: {} // Default empty for new user
        };
        localStorage.setItem('salesAppSession', JSON.stringify(session));

        return session;
    }

    // Generate and register single-session token
    const sessionToken = crypto.randomUUID();
    await registerSessionToken(client, authData.user.id, sessionToken);

    // Save session to localStorage
    const session = {
        userId: authData.user.id,
        teamId: userData.team_id,
        email: userData.email,
        name: userData.name || authData.user.email.split('@')[0],
        role: userData.role,
        sessionToken,
        permissions: null
    };

    // For user role: fetch their custom permissions
    if (userData.role === 'user') {
        try {
            const { data: perms } = await client
                .from('user_permissions')
                .select('module, enabled, can_view, can_create, can_edit, can_delete, can_view_team')
                .eq('user_id', userData.id);

            if (perms) {
                session.permissions = {};
                perms.forEach(p => {
                    session.permissions[p.module] = {
                        enabled: p.enabled,
                        view: p.can_view,
                        create: p.can_create,
                        edit: p.can_edit,
                        delete: p.can_delete,
                        viewTeam: p.can_view_team
                    };
                });
            } else {
                session.permissions = {};
            }
        } catch (e) {
            console.warn('Error fetching user permissions:', e);
            session.permissions = {};
        }
    }

    localStorage.setItem('salesAppSession', JSON.stringify(session));

    return session;
}

/**
 * Logout from Supabase
 */
async function logoutFromSupabase() {
    const client = initSupabase();

    // Clear session token from DB before signing out
    try {
        const sessionData = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
        if (sessionData.userId) {
            await clearSessionToken(client, sessionData.userId);
        }
    } catch (e) { /* ignore */ }

    const { error } = await client.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
    }

    // Clear local session
    localStorage.removeItem('salesAppSession');
}

/**
 * Single-Session Helpers
 */
async function registerSessionToken(client, userId, token) {
    // Store the session token in the user's own Supabase auth metadata.
    // No extra DB table or SQL needed — auth.updateUser() writes server-side.
    try {
        await client.auth.updateUser({ data: { session_token: token } });
    } catch (e) {
        console.warn('Single-session: could not register token:', e.message);
    }
}

async function validateSessionToken(userId, token) {
    try {
        const client = initSupabase();
        // getUser() always fetches FRESH data from Supabase server — cannot be faked
        const { data: { user }, error } = await client.auth.getUser();

        if (error || !user) return true;  // can't reach server → keep session alive

        const storedToken = user.user_metadata?.session_token;
        if (!storedToken) return true;   // no token written yet → keep session alive

        return storedToken === token;     // false only on CONFIRMED mismatch → kick
    } catch (e) {
        return true; // any network error → keep session alive
    }
}

async function clearSessionToken(client, userId) {
    // Wipe the token from user metadata on logout
    try {
        await client.auth.updateUser({ data: { session_token: null } });
    } catch (e) { /* ignore — user is logging out anyway */ }
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
// SHARED ACCESS HELPERS
// =============================================

/**
 * Log activity to the universal activity log
 */
async function logActivity(module, recordId, ownerId, action, details = {}) {
    try {
        const client = initSupabase();
        const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
        
        await client.from('activity_log').insert({
            module,
            record_id: recordId,
            record_owner_id: ownerId,
            user_id: session.userId,
            action,
            details: {
                ...details,
                userName: session.name,
                timestamp: new Date().toISOString()
            }
        });
    } catch (e) {
        console.warn(`[logActivity] Failed to log ${action} for ${module}:`, e);
    }
}

/**
 * Get IDs of all members in the same team
 */
async function getTeamUserIds() {
    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    if (!session.teamId) return [session.userId];

    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('users')
            .select('id')
            .eq('team_id', session.teamId);
        
        if (error) throw error;
        const ids = data.map(u => u.id);
        return ids.length > 0 ? ids : [session.userId];
    } catch (e) {
        console.warn('[getTeamUserIds] Error:', e);
        return [session.userId];
    }
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

    // 1. Update/Upsert the extended profile
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

    // 2. Sync core fields back to the primary 'users' table 
    // This ensures names show up in the Admin's "All Users" list and shared lists.
    await client
        .from('users')
        .update({
            name: details.name,
            designation: details.designation,
            contact: details.contact
        })
        .eq('id', userId);

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

    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    let userIds = [userId];
    if (session.permissions?.work_report?.viewTeam && session.teamId) {
        userIds = await getTeamUserIds();
    }

    const { data, error } = await client
        .from('work_reports')
        .select('*, users(name, email)')
        .in('user_id', userIds)
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

    // UNIVERSAL ACTIVITY LOG
    await logActivity('work_report', data.user_id, data.user_id, 'UPDATED', {
        date: data.report_date
    });

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
    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');

    // Validate UUID to prevent Supabase 22P02 error
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
        console.error('[getLeads] Invalid or missing User ID:', userId);
        return [];
    }

    let query = client
        .from('leads')
        .select('*, users(name, email)')
        .eq('is_deleted', false)
        .not('is_converted', 'is', true)
        .order('created_at', { ascending: false });

    // TEAM ACCESS LOGIC
    const isAdmin = session.role === 'admin' || session.role === 'super_admin';
    if (isAdmin) {
        // Admins see everything
    } else if (session.permissions?.leads?.viewTeam && session.teamId) {
        const teamIds = await getTeamUserIds();
        query = query.in('user_id', teamIds);
    } else {
        query = query.eq('user_id', userId);
    }

    // Apply date filter if provided
    if (filters.date) {
        query = query.gte('created_at', `${filters.date}T00:00:00Z`)
                     .lte('created_at', `${filters.date}T23:59:59Z`);
    }

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    try {
        console.log(`[getLeads] Fetching leads for user: ${userId}`);
        const { data, error } = await query;
        if (error) {
            console.error('[getLeads] Supabase error:', JSON.stringify(error));
            throw error;
        }
        console.log(`[getLeads] Successfully fetched ${data ? data.length : 0} leads.`);
        return data || [];
    } catch (e) {
        console.error('[getLeads] Catch error:', e.message || JSON.stringify(e));
        throw e;
    }
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
        lead_source: lead.leadSource || null,
        field: lead.leadField || null,
        patient_name: lead.patientName || null,
        client_relation: lead.clientRelation || null,
        source_location: lead.sourceLocation || null,
        destination_location: lead.destinationLocation || null,
        // serial_no_2 removed here - now handled by database trigger for sequence
        company: lead.company || null,
        client_name: lead.clientName || null,
        client_phone: lead.clientPhone || null,
        client_email: lead.clientEmail || null,
        requested_by: lead.requestedBy || null,
        requested_to: lead.requestedTo || null,
        referring_hospital: lead.referringHospital || null,
        receiving_hospital: lead.receivingHospital || null,
        quotation_type: lead.quotationType || null
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

    const generatedSerialNo2 = data.serial_no_2;

    // Log creation in history
    await logLeadActivity(data.id, userId, 'Lead Created', {
        name: lead.name,
        status: lead.status,
        serial_no_2: generatedSerialNo2
    });

    // UNIVERSAL ACTIVITY LOG
    await logActivity('leads', data.id, userId, 'CREATED', {
        name: lead.name,
        source: lead.leadSource
    });

    // BIDIRECTIONAL SYNC: Create lead in Zoho CRM and capture ID
    data.crmSync = { success: false, message: 'Sync not started' };

    try {
        // Get Supabase session token for server-side auth validation
        const { data: sessionData } = await client.auth.getSession();
        const accessToken = sessionData?.session?.access_token || '';

        const response = await fetch('/.netlify/functions/crm-updater', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                updates: {
                    name: lead.name,
                    email: lead.email,
                    contact: lead.contact,
                    status: lead.status,
                    // Fix: Ensure account_name/Company is never empty for Zoho
                    account_name: lead.accountName || lead.name || 'Web App',
                    next_action: lead.nextAction,
                    assignedTo: lead.owner,
                    followUpDate: lead.followUpDate,
                    expectedClose: lead.expectedClose,
                    serial_no_2: generatedSerialNo2,
                    // Additional fields for CRM
                    patientName: lead.patientName,
                    clientRelation: lead.clientRelation,
                    sourceLocation: lead.sourceLocation,
                    destinationLocation: lead.destinationLocation,
                    leadSource: lead.leadSource,
                    field: lead.leadField,
                    company: lead.company,
                    clientName: lead.clientName,
                    clientPhone: lead.clientPhone,
                    clientEmail: lead.clientEmail,
                    requestedBy: lead.requestedBy,
                    requestedTo: lead.requestedTo,
                    referringHospital: lead.referringHospital,
                    receivingHospital: lead.receivingHospital,
                    quotation_type: lead.quotationType
                }
            })
        });

        const syncResult = await response.json();
        if (syncResult.success && syncResult.zohoLeadId) {
            // Update the lead with the newly created Zoho ID
            await client
                .from('leads')
                .update({ zoho_lead_id: syncResult.zohoLeadId })
                .eq('id', data.id);

            data.zoho_lead_id = syncResult.zohoLeadId;
            data.crmSync = { success: true, message: 'Synced to Zoho' };
        } else if (syncResult.isSkipped) {
            data.crmSync = { success: true, isSkipped: true, message: syncResult.message };
        } else {
            console.warn('CRM sync response success was false:', syncResult);
            data.crmSync = { success: false, message: syncResult.error || 'CRM rejected request' };
        }
    } catch (err) {
        console.warn('Initial CRM sync failed:', err);
        // Auto-detect local development without Netlify dev server
        if (window.location.port === '5500') {
            data.crmSync = { 
                success: true, 
                isSkipped: true, 
                message: 'CRM sync skipped (Live Server port 5500 cannot run backend functions)' 
            };
        } else {
            data.crmSync = { success: false, message: 'Connection to CRM system failed' };
        }
    }

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

    // Safety: Generate Serial No. 2 if missing (for older leads)
    let serialNo2 = currentLead?.serial_no_2;
    if (!serialNo2) {
        serialNo2 = String(Math.floor(100000 + Math.random() * 900000));
        updates.serial_no_2 = serialNo2;
    }

    const mergedUpdates = {
        name: updates.name !== undefined ? updates.name : currentLead?.name,
        contact: updates.contact !== undefined ? updates.contact : currentLead?.contact,
        email: updates.email !== undefined ? updates.email : currentLead?.email,
        owner: updates.owner !== undefined ? updates.owner : currentLead?.owner,
        user_id: updates.userId || currentLead?.user_id,
        status: updates.status !== undefined ? updates.status : currentLead?.status,
        follow_up_date: updates.followUpDate !== undefined ? (updates.followUpDate || null) : currentLead?.follow_up_date,
        next_action: updates.nextAction !== undefined ? updates.nextAction : currentLead?.next_action,
        expected_close: updates.expectedClose !== undefined ? (updates.expectedClose || null) : currentLead?.expected_close,
        patient_name: updates.patientName !== undefined ? updates.patientName : currentLead?.patient_name,
        client_relation: updates.clientRelation !== undefined ? updates.clientRelation : currentLead?.client_relation,
        source_location: updates.sourceLocation !== undefined ? updates.sourceLocation : currentLead?.source_location,
        destination_location: updates.destinationLocation !== undefined ? updates.destinationLocation : currentLead?.destination_location,
        lead_source: updates.leadSource !== undefined ? (updates.leadSource || null) : currentLead?.lead_source,
        field: updates.field !== undefined ? (updates.field || null) : currentLead?.field,
        serial_no_2: serialNo2, // Ensure it's saved/updated
        // Enhanced Zoho Fields
        company: updates.company !== undefined ? updates.company : currentLead?.company,
        client_name: updates.clientName !== undefined ? updates.clientName : currentLead?.client_name,
        client_phone: updates.clientPhone !== undefined ? updates.clientPhone : currentLead?.client_phone,
        client_email: updates.clientEmail !== undefined ? updates.clientEmail : currentLead?.client_email,
        requested_by: updates.requestedBy !== undefined ? updates.requestedBy : currentLead?.requested_by,
        requested_to: updates.requestedTo !== undefined ? updates.requestedTo : currentLead?.requested_to,
        referring_hospital: updates.referringHospital !== undefined ? updates.referringHospital : currentLead?.referring_hospital,
        receiving_hospital: updates.receivingHospital !== undefined ? updates.receivingHospital : currentLead?.receiving_hospital,
        quotation_type: updates.quotationType !== undefined ? updates.quotationType : currentLead?.quotation_type
    };

    const { data, error } = await client
        .from('leads')
        .update(mergedUpdates)
        .eq('id', leadId)
        .select()
        .single();

    if (error) throw error;

    // Detect changes and log to history
    if (currentLead) {
        let changedFields = [];
        if (updates.status !== undefined && currentLead.status !== updates.status) changedFields.push(`Status changed to ${updates.status}`);
        if (updates.owner !== undefined && currentLead.owner !== updates.owner) changedFields.push(`Owner updated`);
        if (updates.nextAction !== undefined && currentLead.next_action !== updates.nextAction) changedFields.push(`Next action updated`);
        if (!currentLead.serial_no_2 && serialNo2) changedFields.push(`Serial No. 2 generated: ${serialNo2}`);

        if (changedFields.length > 0) {
            await logLeadActivity(leadId, userId, 'Lead Updated', {
                changes: changedFields,
                summary: changedFields.join(', ')
            });

            // UNIVERSAL ACTIVITY LOG
            await logActivity('leads', leadId, currentLead.user_id, 'UPDATED', {
                changes: changedFields
            });
        }
    }

    // BIDIRECTIONAL SYNC: Push updates back to Zoho CRM (if Zoho ID exists)
    if (currentLead?.zoho_lead_id) {
        try {
            // Get Supabase session token for server-side auth validation
            const { data: sessionData } = await client.auth.getSession();
            const accessToken = sessionData?.session?.access_token || '';

            // Fire-and-forget async request to sync back to CRM
            fetch('/.netlify/functions/crm-updater', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    zohoLeadId: currentLead.zoho_lead_id,
                    updates: {
                        name: mergedUpdates.name,
                        email: mergedUpdates.email,
                        contact: mergedUpdates.contact,
                        status: mergedUpdates.status,
                        accountName: mergedUpdates.company || mergedUpdates.name || 'Web App',
                        nextAction: mergedUpdates.next_action || mergedUpdates.nextAction,
                        assignedTo: mergedUpdates.owner,
                        followUpDate: mergedUpdates.follow_up_date,
                        expectedClose: mergedUpdates.expected_close,
                        serialNo2: serialNo2,
                        // Additional fields
                        patientName: mergedUpdates.patient_name,
                        clientRelation: mergedUpdates.client_relation,
                        sourceLocation: mergedUpdates.source_location,
                        destinationLocation: mergedUpdates.destination_location,
                        leadSource: mergedUpdates.lead_source,
                        field: mergedUpdates.field,
                        // Enhanced Sync
                        company: mergedUpdates.company,
                        clientName: mergedUpdates.client_name,
                        clientPhone: mergedUpdates.client_phone,
                        clientEmail: mergedUpdates.client_email,
                        requestedBy: mergedUpdates.requested_by,
                        requestedTo: mergedUpdates.requested_to,
                        referringHospital: mergedUpdates.referring_hospital,
                        receivingHospital: mergedUpdates.receiving_hospital,
                        quotationType: mergedUpdates.quotation_type
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
 * Delete a lead (Soft Delete)
 * @param {string} leadId 
 */
async function deleteLead(leadId) {
    const client = initSupabase();

    // UNIVERSAL ACTIVITY LOG
    try {
        const { data: lead } = await client.from('leads').select('user_id').eq('id', leadId).single();
        if (lead) {
            await logActivity('leads', leadId, lead.user_id, 'DELETED');
        }
    } catch (e) {
        console.warn('Failed to log deletion:', e);
    }

    const { error } = await client
        .from('leads')
        .update({ is_deleted: true })
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

    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    let userIds = [userId];
    if (session.permissions?.quotations?.viewTeam && session.teamId) {
        userIds = await getTeamUserIds();
    }

    const { data, error } = await client
        .from('quotations')
        .select('*')
        .in('user_id', userIds)
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

    // 1. Fetch lead serial_no_2 for cross-sync
    let serialNo2 = null;
    if (quotation.leadId) {
        try {
            const { data: leadData } = await client
                .from('leads')
                .select('serial_no_2')
                .eq('id', quotation.leadId)
                .single();
            serialNo2 = leadData?.serial_no_2;
        } catch (e) {
            console.warn('Could not fetch lead serial_no_2:', e);
        }
    }

    // 2. Save to Supabase quotations table
    const { data, error } = await client
        .from('quotations')
        .insert({
            user_id: userId,
            lead_id: quotation.leadId || null,
            serial_no_2: serialNo2 || quotation.serialNo2 || null,
            client_name: quotation.clientName,
            client_phone: quotation.clientPhone || null,
            client_email: quotation.clientEmail || null,
            patient_name: quotation.patientName || null,
            amount: quotation.amount || null,
            description: quotation.description || ''
        })
        .select()
        .single();

    if (error) throw error;

    // 3. TRIGGER GOOGLE SHEET SYNC (Implicitly requested by user)
    // If SHEETS_API_URL is defined (usually in sheets-api.js)
    if (typeof SHEETS_API_URL !== 'undefined') {
        fetch(SHEETS_API_URL, {
            method: 'POST',
            mode: 'no-cors', // Basic Apps Script support
            body: JSON.stringify({
                action: 'saveQuotation',
                quotation: {
                    serial_no_2: serialNo2,
                    client_name: quotation.clientName,
                    patient_name: quotation.patientName,
                    amount: quotation.amount
                }
            })
        }).catch(err => console.warn('Silent Google Sheet sync failed:', err));
    }

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

    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    let userIds = [userId];
    if (session.permissions?.attendance?.viewTeam && session.teamId) {
        userIds = await getTeamUserIds();
    }

    const { data, error } = await client
        .from('attendance')
        .select('*')
        .in('user_id', userIds)
        .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Clock in
 * @param {string} userId 
 * @param {string} userName
 */
async function clockIn(userId, userName = null) {
    const client = initSupabase();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    const { data, error } = await client
        .from('attendance')
        .upsert({
            user_id: userId,
            user_name: userName,
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

    // Fetch users AND their profile details in a single join
    const { data, error } = await client
        .from('users')
        .select(`
            *,
            user_details (
                name,
                designation,
                contact,
                email
            )
        `)
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
        client.from('leads').select('id', { count: 'exact' }).eq('is_deleted', false),
        client.from('quotations').select('id', { count: 'exact' }),
        client.from('attendance').select('id', { count: 'exact' }).eq('date', today),
        client.from('calls').select('id', { count: 'exact' }).eq('is_deleted', false),
        client.from('meetings').select('id', { count: 'exact' }).eq('is_deleted', false)
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
        console.warn('[getCalls] Invalid or missing userId:', userId);
        return [];
    }

    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    let query = client
        .from('calls')
        .select('*, users(name, email)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    // TEAM ACCESS LOGIC
    if (session.permissions?.calls?.viewTeam && session.teamId) {
        const teamIds = await getTeamUserIds();
        query = query.in('user_id', teamIds);
    } else {
        query = query.eq('user_id', userId);
    }

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
            call_date: call.callDate || new Date().toISOString().split('T')[0],
            email: call.email || null,
            follow_up_date: call.followUpDate || null
        })
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('calls', data.id, userId, 'CREATED', {
        name: data.name,
        phone: data.phone
    });

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
            hospital_name: updates.hospitalName,
            email: updates.email || null,
            follow_up_date: updates.followUpDate || null
        })
        .eq('id', callId)
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('calls', data.id, data.user_id, 'UPDATED', {
        name: data.name,
        updates: Object.keys(updates)
    });

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
        .update({ is_deleted: true })
        .eq('id', callId);

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    try {
        const { data: call } = await client.from('calls').select('user_id').eq('id', callId).single();
        if (call) {
            await logActivity('calls', callId, call.user_id, 'DELETED');
        }
    } catch (e) { /* ignore */ }

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
        .eq('is_deleted', false)
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
        console.warn('[getMeetings] Invalid or missing userId:', userId);
        return [];
    }

    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    let query = client
        .from('meetings')
        .select('*, users(name, email)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    // TEAM ACCESS LOGIC
    if (session.permissions?.meetings?.viewTeam && session.teamId) {
        const teamIds = await getTeamUserIds();
        query = query.in('user_id', teamIds);
    } else {
        query = query.eq('user_id', userId);
    }

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
            meeting_date: meeting.meetingDate || new Date().toISOString().split('T')[0],
            email: meeting.email || null,
            follow_up_date: meeting.followUpDate || null
        })
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('meetings', data.id, userId, 'CREATED', {
        meeting_with: data.meeting_with,
        client: data.client_name
    });

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
            outcome: updates.outcome,
            email: updates.email || null,
            follow_up_date: updates.followUpDate || null
        })
        .eq('id', meetingId)
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('meetings', data.id, data.user_id, 'UPDATED', {
        meeting_with: data.meeting_with,
        updates: Object.keys(updates)
    });

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
        .update({ is_deleted: true })
        .eq('id', meetingId);

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    try {
        const { data: meeting } = await client.from('meetings').select('user_id').eq('id', meetingId).single();
        if (meeting) {
            await logActivity('meetings', meetingId, meeting.user_id, 'DELETED');
        }
    } catch (e) { /* ignore */ }

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
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// =============================================
// CASES FUNCTIONS
// =============================================

/**
 * Get all cases for admin
 */
async function getAllCasesAdmin() {
    const client = initSupabase();

    const { data, error } = await client
        .from('cases')
        .select('*, users (name, email)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Delete a case (Soft Delete)
 */
async function deleteCase(caseId) {
    const client = initSupabase();
    const { error } = await client
        .from('cases')
        .update({ is_deleted: true })
        .eq('id', caseId);

    if (error) throw error;
    return true;
}

/**
 * Get cases for a specific user
 * @param {string} userId 
 */
async function getCasesForUser(userId) {
    const client = initSupabase();

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
        console.warn('[getCasesForUser] Invalid or missing User ID:', userId);
        return [];
    }

    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    
    // TEAM ACCESS LOGIC
    let userIds = [userId];
    if (session.permissions?.cases?.viewTeam && session.teamId) {
        userIds = await getTeamUserIds();
    }

    // Primary query: try with lead join
    const { data, error } = await client
        .from('cases')
        .select('*, leads(name, contact), users(name, email)')
        .in('user_id', userIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (!error) {
        return data || [];
    }

    // Fallback: if join fails (e.g. RLS on leads table), query cases only
    console.warn('[getCasesForUser] Join query failed, falling back to cases-only query. Error:', error.message);
    const { data: fallbackData, error: fallbackError } = await client
        .from('cases')
        .select('*')
        .in('user_id', userIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (fallbackError) {
        console.error('[getCasesForUser] Fallback query also failed:', fallbackError.message);
        throw fallbackError;
    }
    return fallbackData || [];
}


/**
 * Get lead details by lead ID (used when opening a case detail panel)
 * @param {string} leadId
 */
async function getLeadByLeadId(leadId) {
    if (!leadId) return null;
    const client = initSupabase();

    // Fetch core lead fields (always present)
    const { data, error } = await client
        .from('leads')
        .select(`
            name, contact, email, patient_name, client_relation,
            source_location, destination_location, lead_source, field,
            follow_up_date, expected_close, next_action, account_name,
            is_converted, converted_at
        `)
        .eq('id', leadId)
        .maybeSingle();

    if (error) {
        console.warn('Could not fetch lead details:', error);
        return null;
    }

    if (data) {
        // Fetch serial numbers separately — these columns may not exist yet in the DB.
        // If the query fails, we silently skip and leave them null.
        try {
            const { data: sn } = await client
                .from('leads')
                .select('serial_no_1, serial_no_2')
                .eq('id', leadId)
                .maybeSingle();
            if (sn) {
                data.serial_no_1 = sn.serial_no_1;
                data.serial_no_2 = sn.serial_no_2;
            }
        } catch (_) { /* columns not yet added to DB — ignore */ }
    }

    return data;
}

/**
 * Create a new case
 * @param {object} caseData 
 */
async function createCase(caseData) {
    const client = initSupabase();

    // Generate a simple case number if not provided
    const caseNumber = caseData.caseNumber || `CASE-${Date.now().toString().slice(-6)}`;

    const { data, error } = await client
        .from('cases')
        .insert({
            case_number: caseNumber,
            title: caseData.title,
            description: caseData.description,
            lead_id: caseData.leadId || null,
            user_id: caseData.userId,
            status: caseData.status || 'Pending',
            priority: caseData.priority || 'Medium'
        })
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('cases', data.id, data.user_id, 'CREATED', {
        case_number: data.case_number,
        title: data.title
    });

    return data;
}

/**
 * Update a case
 * @param {string} caseId 
 * @param {object} updates 
 */
async function updateCase(caseId, updates) {
    const client = initSupabase();

    const { data, error } = await client
        .from('cases')
        .update({
            title: updates.title,
            description: updates.description,
            status: updates.status,
            priority: updates.priority,
            user_id: updates.userId,
            lead_id: updates.leadId
        })
        .eq('id', caseId)
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('cases', data.id, data.user_id, 'UPDATED', {
        title: data.title,
        status: data.status
    });

    return data;
}

/**
 * Delete a case
 * @param {string} caseId 
 */
async function deleteCase(caseId) {
    const client = initSupabase();

    const { error } = await client
        .from('cases')
        .delete()
        .eq('id', caseId);

    if (error) throw error;
    return true;
}


// =============================================
// EXPENSES FUNCTIONS
// =============================================

/**
 * Get expenses for the logged-in user
 */
async function getExpenses(userId) {
    const client = initSupabase();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
        console.warn('[getExpenses] Invalid or missing userId:', userId);
        return [];
    }
    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
    let userIds = [userId];
    if (session.permissions?.expenses?.viewTeam && session.teamId) {
        userIds = await getTeamUserIds();
    }

    const { data, error } = await client
        .from('expenses')
        .select('*, users(name, email)')
        .in('user_id', userIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

/**
 * Get ALL expenses (admin only), with user name merged separately
 * Uses two queries to avoid PostgREST join-RLS issues where an embedded
 * resource blocked by RLS can silently suppress the parent rows.
 */
async function getAllExpensesAdmin() {
    const client = initSupabase();

    const { data: expenses, error } = await client
        .from('expenses')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('[getAllExpensesAdmin] Query error:', error);
        throw error;
    }

    const rows = expenses || [];

    if (rows.length > 0) {
        const userIds = [...new Set(rows.map(e => e.user_id))];
        const { data: users } = await client
            .from('users')
            .select('id, name, email')
            .in('id', userIds);
        if (users && users.length > 0) {
            const userMap = Object.fromEntries(users.map(u => [u.id, u]));
            rows.forEach(exp => { exp.users = userMap[exp.user_id] || null; });
        }
    }

    return rows;
}

/**
 * Delete an expense (Soft Delete)
 */
async function deleteExpense(expenseId) {
    const client = initSupabase();
    // Try soft delete first; if is_deleted column doesn't exist, hard delete
    const { error: softErr } = await client
        .from('expenses')
        .update({ is_deleted: true })
        .eq('id', expenseId);

    if (softErr) {
        console.warn('[deleteExpense] Soft delete failed, trying hard delete:', softErr);
        const { error: hardErr } = await client
            .from('expenses')
            .delete()
            .eq('id', expenseId);
        if (hardErr) throw hardErr;
    }
    // UNIVERSAL ACTIVITY LOG
    try {
        const { data: exp } = await client.from('expenses').select('user_id').eq('id', expenseId).single();
        if (exp) {
            await logActivity('expenses', expenseId, exp.user_id, 'DELETED');
        }
    } catch (e) {}

    return true;
}

/**
 * Create a new expense
 */
async function createExpense(userId, expenseData) {
    const client = initSupabase();
    const { data, error } = await client
        .from('expenses')
        .insert([{
            user_id: userId,
            category: expenseData.category,
            amount: parseFloat(expenseData.amount),
            currency: expenseData.currency || 'AED',
            date: expenseData.date,
            description: expenseData.description,
            receipt_url: expenseData.receiptUrl || null,
            status: 'pending'
        }])
        .select()
        .single();
    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('expenses', data.id, userId, 'CREATED', {
        amount: data.amount,
        category: data.category
    });

    return data;
}

/**
 * Update expense status (admin: approve/reject) and notify the owner
 */
async function updateExpenseStatus(expenseId, status, adminNote, ownerUserId) {
    const client = initSupabase();

    const { error: updateError } = await client
        .from('expenses')
        .update({ status, admin_note: adminNote || null })
        .eq('id', expenseId);
    if (updateError) throw updateError;

    // Insert notification for the expense owner
    const notifTitle = status === 'approved' ? 'Expense Approved ✅' : 'Expense Rejected ❌';
    const notifMessage = status === 'approved'
        ? 'Your expense submission has been approved by the admin.'
        : `Your expense submission was rejected. ${adminNote ? 'Reason: ' + adminNote : ''}`;

    const { error: notifError } = await client
        .from('notifications')
        .insert([{
            user_id: ownerUserId,
            title: notifTitle,
            message: notifMessage,
            type: `expense_${status}`,
            is_read: false
        }]);
    if (notifError) console.error('Notification insert error:', notifError);

    // UNIVERSAL ACTIVITY LOG
    await logActivity('expenses', expenseId, ownerUserId, status === 'approved' ? 'APPROVED' : 'REJECTED', {
        admin_note: adminNote
    });

    return true;
}

// =============================================
// NOTIFICATIONS FUNCTIONS
// =============================================

/**
 * Get unread notifications for a user
 */
async function getNotifications(userId) {
    const client = initSupabase();
    const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) throw error;
    return data || [];
}

/**
 * Mark a single notification as read
 */
async function markNotificationRead(notificationId) {
    const client = initSupabase();
    const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    if (error) throw error;
    return true;
}

/**
 * Mark ALL notifications as read for a user
 */
async function markAllNotificationsRead(userId) {
    const client = initSupabase();
    const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    if (error) throw error;
    return true;
}


// =============================================
// AUDIT LOGS
// =============================================

/**
 * Record an admin action in the audit log
 */
async function createAuditLog(expenseId, adminId, adminName, action, adminNote) {
    const client = initSupabase();
    const { error } = await client
        .from('expense_audit_logs')
        .insert([{ expense_id: expenseId, admin_id: adminId, admin_name: adminName, action, admin_note: adminNote || null }]);
    if (error) console.error('Audit log error:', error);
}

/**
 * Get audit logs for a specific expense
 */
async function getExpenseAuditLogs(expenseId) {
    const client = initSupabase();
    const { data, error } = await client
        .from('expense_audit_logs')
        .select('*')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

/**
 * Update expense status AND create audit log entry
 */
async function updateExpenseStatusWithAudit(expenseId, status, adminNote, ownerUserId, adminId, adminName) {
    const client = initSupabase();

    const { error: updateError } = await client
        .from('expenses')
        .update({ status, admin_note: adminNote || null })
        .eq('id', expenseId);
    if (updateError) throw updateError;

    // Notify the expense owner
    const notifTitle = status === 'approved' ? 'Expense Approved ✅' : 'Expense Rejected ❌';
    const notifMessage = status === 'approved'
        ? 'Your expense submission has been approved by the admin.'
        : `Your expense was rejected. ${adminNote ? 'Reason: ' + adminNote : ''}`;

    await client.from('notifications').insert([{
        user_id: ownerUserId,
        title: notifTitle,
        message: notifMessage,
        type: `expense_${status}`,
        is_read: false
    }]);

    // Write audit log
    await createAuditLog(expenseId, adminId, adminName, status, adminNote);

    return true;
}

// =============================================
// ADMIN ANALYTICS & BADGE
// =============================================

/**
 * Count pending expenses (for sidebar badge)
 */
async function getPendingExpensesCount() {
    const client = initSupabase();
    const { count, error } = await client
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('is_deleted', false);
    if (error) return 0;
    return count || 0;
}

/**
 * Get analytics summary: by category totals and monthly totals
 */
async function getExpenseAnalytics() {
    const client = initSupabase();
    const { data, error } = await client
        .from('expenses')
        .select('category, amount, date, status')
        .eq('is_deleted', false);
    if (error) throw error;
    const rows = data || [];

    // Category breakdown
    const byCategory = {};
    rows.forEach(r => {
        if (!byCategory[r.category]) byCategory[r.category] = 0;
        byCategory[r.category] += parseFloat(r.amount);
    });

    // Monthly trend (last 6 months, include all statuses)
    const monthlyMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[key] = 0;
    }
    rows.forEach(r => {
        const d = new Date(r.date);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthlyMap[key] !== undefined) monthlyMap[key] += parseFloat(r.amount);
    });

    return { byCategory, monthly: monthlyMap };
}

// =============================================
// LEAD FILES FUNCTIONS
// =============================================

/**
 * Get all quotation/document files attached to a lead
 * @param {string} leadId
 */
async function getLeadFiles(leadId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('lead_files')
        .select('*')
        .eq('lead_id', leadId)
        .order('uploaded_at', { ascending: false });

    if (error) {
        console.error('Error fetching lead files:', error);
        return [];
    }
    return data || [];
}

/**
 * Manually attach a file to a lead (for future manual-upload feature)
 * @param {string} leadId
 * @param {string} fileName
 * @param {string} fileUrl
 */
async function attachLeadFile(leadId, fileName, fileUrl) {
    const client = initSupabase();

    const { data, error } = await client
        .from('lead_files')
        .insert({
            lead_id: leadId,
            file_name: fileName,
            file_url: fileUrl,
            source: 'manual'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// =============================================
// LEAD → CASE CONVERSION
// =============================================

/**
 * Get all leads for admin (active only, no converted)
 */
async function getAllLeadsAdmin() {
    const client = initSupabase();
    try {
        const { data, error } = await client
            .from('leads')
            .select('*, users(name, email)')
            .eq('is_deleted', false)
            .not('is_converted', 'is', true)
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Supabase Error (getAllLeadsAdmin):', error);
            throw error;
        }
        return data || [];
    } catch (e) {
        console.error('[getAllLeadsAdmin] Supabase error:', JSON.stringify(e));
        throw e;
    }
}

/**
 * Convert a lead to a case
 * @param {string} leadId
 * @param {string} userId - the user performing the conversion
 */
async function convertLeadToCase(leadId, userId) {
    const client = initSupabase();

    // 1. Fetch full lead data
    const { data: lead, error: leadError } = await client
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

    if (leadError) throw leadError;

    // 2. Build a rich description from all lead fields (kept for backward compatibility)
    const descParts = [];
    if (lead.patient_name) descParts.push(`Patient: ${lead.patient_name}`);
    if (lead.client_relation) descParts.push(`Client Relation: ${lead.client_relation}`);
    if (lead.source_location) descParts.push(`From: ${lead.source_location}`);
    if (lead.destination_location) descParts.push(`To: ${lead.destination_location}`);
    if (lead.field) descParts.push(`Category: ${lead.field}`);
    if (lead.lead_source) descParts.push(`Source: ${lead.lead_source}`);
    if (lead.next_action) descParts.push(`Next Action: ${lead.next_action}`);
    if (lead.follow_up_date) descParts.push(`Follow-up: ${lead.follow_up_date}`);
    if (lead.expected_close) descParts.push(`Expected Close: ${lead.expected_close}`);
    const description = descParts.join(' | ');

    // 3. Create the case — transfer ALL lead fields
    const caseNumber = 'CASE-' + Date.now().toString().slice(-6);
    const { data: newCase, error: caseError } = await client
        .from('cases')
        .insert({
            // Core fields
            case_number:          caseNumber,
            title:                lead.name,
            description:          description,
            lead_id:              leadId,
            user_id:              lead.user_id,
            status:               'In Progress',
            priority:             'High',
            // ── Lead fields transferred at conversion ──
            quotation_id:         lead.quotation_id         || null,
            contact:              lead.contact              || null,
            email:                lead.email                || null,
            patient_name:         lead.patient_name         || null,
            client_relation:      lead.client_relation      || null,
            source_location:      lead.source_location      || null,
            destination_location: lead.destination_location || null,
            zoho_lead_id:         lead.zoho_lead_id         || null,
            serial_no_1:          lead.serial_no_1          || null,
            serial_no_2:          lead.serial_no_2          || null,
            field:                lead.field                || null,
            lead_source:          lead.lead_source          || null,
            follow_up_date:       lead.follow_up_date       || null,
            expected_close:       lead.expected_close       || null,
            next_action:          lead.next_action          || null
        })
        .select()
        .single();

    if (caseError) throw caseError;

    // 4. Mark lead as converted (stays in DB, hidden from UI)
    const { error: updateError } = await client
        .from('leads')
        .update({
            is_converted: true,
            converted_at: new Date().toISOString(),
            converted_case_id: newCase.id,
            status: 'Qualified'
        })
        .eq('id', leadId);

    if (updateError) throw updateError;

    // 5. Log activity in lead history
    await logLeadActivity(leadId, userId, 'Lead Converted to Case', {
        case_number: caseNumber,
        case_id: newCase.id,
        summary: `Lead converted to ${caseNumber}`
    });

    return newCase;
}

// =============================================
// CASE FILES (QUOTATION UPLOADS)
// =============================================

/**
 * Get all uploaded quotation files for a case
 * @param {string} caseId
 */
async function getCaseFiles(caseId) {
    const client = initSupabase();
    const { data, error } = await client
        .from('case_files')
        .select('*, users(name, email)')
        .eq('case_id', caseId)
        .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

/**
 * Get file counts for multiple cases at once (for badge display)
 * @param {string[]} caseIds
 * @returns {object} { caseId: count }
 */
async function getCaseFileCounts(caseIds) {
    if (!caseIds || caseIds.length === 0) return {};
    const client = initSupabase();
    const { data, error } = await client
        .from('case_files')
        .select('case_id')
        .in('case_id', caseIds);
    if (error) return {};
    const counts = {};
    (data || []).forEach(row => {
        counts[row.case_id] = (counts[row.case_id] || 0) + 1;
    });
    return counts;
}

/**
 * Upload a quotation file to Supabase Storage and save record
 * @param {string} caseId
 * @param {string} userId
 * @param {File} file - browser File object
 * @param {Function} onProgress - optional progress callback(percent)
 */
async function uploadCaseFile(caseId, userId, file, onProgress) {
    const client = initSupabase();

    // Build storage path: caseId/timestamp-filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${caseId}/${timestamp}-${safeName}`;

    // Upload to Supabase Storage bucket 'case-quotations'
    const { data: storageData, error: storageError } = await client.storage
        .from('case-quotations')
        .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (storageError) throw storageError;

    // Get a signed URL (valid 10 years)
    const { data: urlData, error: urlError } = await client.storage
        .from('case-quotations')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (urlError) throw urlError;

    // Save record in case_files table
    const { data: fileRecord, error: dbError } = await client
        .from('case_files')
        .insert({
            case_id: caseId,
            file_name: file.name,
            file_url: urlData.signedUrl,
            file_size: file.size,
            uploaded_by: userId,
            storage_path: storagePath
        })
        .select()
        .single();

    if (dbError) throw dbError;
    return fileRecord;
}

/**
 * Delete a case file from Storage and database
 * @param {string} fileId - case_files.id
 * @param {string} storagePath - path in storage bucket
 */
async function deleteCaseFile(fileId, storagePath) {
    const client = initSupabase();

    // Remove from Supabase Storage
    if (storagePath) {
        await client.storage
            .from('case-quotations')
            .remove([storagePath]);
    }

    // Remove from database
    const { error } = await client
        .from('case_files')
        .delete()
        .eq('id', fileId);

    if (error) throw error;
    return true;
}

// =============================================
// CASE INVOICES FUNCTIONS
// =============================================

/**
 * Get all uploaded invoice files for a case
 * @param {string} caseId
 */
async function getCaseInvoices(caseId) {
    const client = initSupabase();
    const { data, error } = await client
        .from('case_invoices')
        .select('*, users(name, email)')
        .eq('case_id', caseId)
        .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

/**
 * Get invoice counts for multiple cases (for badge display)
 * @param {string[]} caseIds
 * @returns {object} { caseId: count }
 */
async function getCaseInvoiceCounts(caseIds) {
    if (!caseIds || caseIds.length === 0) return {};
    const client = initSupabase();
    // Exclude proforma files (stored with 'PROFORMA:' prefix) — only count final invoices.
    // This prevents Request Receipt from unlocking prematurely after a proforma-only upload.
    const { data, error } = await client
        .from('case_invoices')
        .select('case_id, file_name')
        .in('case_id', caseIds)
        .not('file_name', 'like', 'PROFORMA:%');
    if (error) return {};
    const counts = {};
    (data || []).forEach(row => {
        counts[row.case_id] = (counts[row.case_id] || 0) + 1;
    });
    return counts;
}

/**
 * Get receipt counts for multiple cases (for badge display)
 * @param {string[]} caseIds
 * @returns {object} { caseId: count }
 */
async function getCaseReceiptCounts(caseIds) {
    if (!caseIds || caseIds.length === 0) return {};
    const client = initSupabase();
    const { data, error } = await client
        .from('case_receipts')
        .select('case_id')
        .in('case_id', caseIds);
    if (error) return {};
    const counts = {};
    (data || []).forEach(row => {
        counts[row.case_id] = (counts[row.case_id] || 0) + 1;
    });
    return counts;
}

/**
 * Upload an invoice file to Supabase Storage and save record
 * Also marks cases.invoice_uploaded = true
 * @param {string} caseId
 * @param {string} userId
 * @param {File} file
 */
async function uploadCaseInvoice(caseId, userId, file) {
    const client = initSupabase();

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${caseId}/${timestamp}-${safeName}`;

    // Upload to Storage bucket 'case-invoices'
    const { data: storageData, error: storageError } = await client.storage
        .from('case-invoices')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (storageError) throw storageError;

    // Get signed URL (10 years)
    const { data: urlData, error: urlError } = await client.storage
        .from('case-invoices')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (urlError) throw urlError;

    // Save record in case_invoices table
    const { data: fileRecord, error: dbError } = await client
        .from('case_invoices')
        .insert({
            case_id: caseId,
            file_name: file.name,
            file_url: urlData.signedUrl,
            file_size: file.size,
            uploaded_by: userId,
            storage_path: storagePath
        })
        .select()
        .single();

    if (dbError) throw dbError;

    // Mark the case as having an invoice uploaded
    await client.from('cases')
        .update({ invoice_uploaded: true })
        .eq('id', caseId);

    return fileRecord;
}

/**
 * Upload a proforma invoice for a case
 */
async function uploadCaseProforma(caseId, userId, file) {
    const client = initSupabase();

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${caseId}/${timestamp}-${safeName}`;

    // Upload to Storage bucket 'case-invoices' (reusing same bucket)
    const { data: storageData, error: storageError } = await client.storage
        .from('case-invoices')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (storageError) throw storageError;

    // Get signed URL
    const { data: urlData, error: urlError } = await client.storage
        .from('case-invoices')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (urlError) throw urlError;

    // Save record in case_invoices table
    // Mark the file name as PROFORMA to distinguish it
    const { data: fileRecord, error: dbError } = await client
        .from('case_invoices')
        .insert({
            case_id: caseId,
            file_name: `PROFORMA: ${file.name}`,
            file_url: urlData.signedUrl,
            file_size: file.size,
            uploaded_by: userId,
            storage_path: storagePath
        })
        .select()
        .single();

    if (dbError) throw dbError;

    // Mark the case as having a proforma uploaded
    await client.from('cases')
        .update({ proforma_uploaded: true })
        .eq('id', caseId);

    return fileRecord;
}

/**
 * Delete a case invoice file from Storage and database
 * @param {string} fileId
 * @param {string} storagePath
 * @param {string} caseId - used to check if more invoices exist
 */
async function deleteCaseInvoice(fileId, storagePath, caseId) {
    const client = initSupabase();

    if (storagePath) {
        await client.storage.from('case-invoices').remove([storagePath]);
    }

    const { error } = await client
        .from('case_invoices')
        .delete()
        .eq('id', fileId);

    if (error) throw error;

    // If no more invoices, mark invoice_uploaded = false
    const { count } = await client
        .from('case_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('case_id', caseId);

    if (count === 0) {
        await client.from('cases')
            .update({ invoice_uploaded: false })
            .eq('id', caseId);
    }

    return true;
}

/**
 * Mark a case as having had an invoice requested (to prevent duplicate sends)
 * @param {string} caseId
 */
async function markInvoiceRequested(caseId) {
    const client = initSupabase();
    const { error } = await client
        .from('cases')
        .update({ invoice_requested: true })
        .eq('id', caseId);
    if (error) throw error;
    return true;
}

/**
 * Send a WhatsApp message to the Accounts team via the Whapi Netlify function
 * @param {'invoice'|'receipt'|'invoice_request'|'receipt_request'} type
 * @param {object} caseDetails
 * @param {object} requester - { name, email }
 */
async function sendWhatsAppRequest(type, caseDetails, requester) {
    // Standardize types if needed
    const normalizedType = type.includes('_request') ? type : `${type}_request`;

    try {
        const response = await fetch('/.netlify/functions/whapi-send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: normalizedType, caseDetails, requester })
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'WhatsApp send failed');
            }
            return result;
        } else {
            // Non-JSON response (likely 404/500 from proxy or local server)
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('WhatsApp service endpoint not found. Ensure Netlify functions are running.');
                }
                const text = await response.text();
                throw new Error(`Server error (${response.status}): ${text.slice(0, 100)}`);
            }
            return { success: true };
        }
    } catch (error) {
        console.error('sendWhatsAppRequest catch:', error);
        throw error;
    }
}

// =============================================
// CASE RECEIPTS FUNCTIONS
// =============================================

async function getCaseReceipts(caseId) {
    const client = initSupabase();
    const { data, error } = await client
        .from('case_receipts')
        .select('*, users(name, email)')
        .eq('case_id', caseId)
        .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function uploadCaseReceipt(caseId, userId, file) {
    const client = initSupabase();
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${caseId}/${timestamp}-${safeName}`;

    const { data: storageData, error: storageError } = await client.storage
        .from('case-receipts')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (storageError) throw storageError;

    const { data: urlData, error: urlError } = await client.storage
        .from('case-receipts')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (urlError) throw urlError;

    const { data: fileRecord, error: dbError } = await client
        .from('case_receipts')
        .insert({
            case_id: caseId,
            file_name: file.name,
            file_url: urlData.signedUrl,
            file_size: file.size,
            uploaded_by: userId,
            storage_path: storagePath
        })
        .select()
        .single();

    if (dbError) throw dbError;

    await client.from('cases')
        .update({ receipt_uploaded: true })
        .eq('id', caseId);

    return fileRecord;
}

async function deleteCaseReceipt(fileId, storagePath, caseId) {
    const client = initSupabase();
    if (storagePath) {
        await client.storage.from('case-receipts').remove([storagePath]);
    }
    const { error } = await client.from('case_receipts').delete().eq('id', fileId);
    if (error) throw error;

    const { count } = await client.from('case_receipts').select('id', { count: 'exact', head: true }).eq('case_id', caseId);
    if (count === 0) {
        await client.from('cases').update({ receipt_uploaded: false }).eq('id', caseId);
    }
    return true;
}

// =============================================
// PERMISSIONS MANAGEMENT FUNCTIONS
// =============================================

/**
 * Get all user_permissions for a specific user
 */
async function getUserPermissions(userId) {
    const client = initSupabase();
    const { data, error } = await client
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
    if (error) throw error;
    return data || [];
}

/**
 * Save/update permissions for a user
 */
async function saveUserPermissions(userId, permissionsArray) {
    const client = initSupabase();
    
    // Upsert all permissions in the array
    const { error } = await client
        .from('user_permissions')
        .upsert(permissionsArray.map(p => ({
            user_id: userId,
            module: p.module,
            enabled: p.enabled,
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
            can_view_team: p.can_view_team || false,
            updated_at: new Date().toISOString()
        })), { onConflict: 'user_id,module' });

    if (error) throw error;
    return true;
}

/**
 * Get all users with role='user' for permissions management
 */
async function getUsersForPermissionsManager() {
    const client = initSupabase();
    const { data, error } = await client
        .from('users')
        .select('id, name, email, role, created_at')
        .eq('role', 'user')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

/**
 * Get all users for super admin management
 */
async function getAllUsersAdmin() {
    const client = initSupabase();
    const { data, error } = await client
        .from('users')
        .select('*, user_details(name, designation)')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

// =============================================
// TEAM MANAGEMENT FUNCTIONS (ADMIN)
// =============================================

/**
 * Get all teams
 */
async function getTeams() {
    const client = initSupabase();
    const { data, error } = await client
        .from('teams')
        .select('*')
        .order('name');
    
    if (error) throw error;
    return data || [];
}

/**
 * Create a new team
 */
async function createTeam(name) {
    const client = initSupabase();
    const { data, error } = await client
        .from('teams')
        .insert({ name })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Assign a user to a team
 */
async function assignUserToTeam(userId, teamId) {
    const client = initSupabase();
    const { error } = await client
        .from('users')
        .update({ team_id: teamId })
        .eq('id', userId);
    
    if (error) throw error;
    return true;
}

/**
 * Get activity log for a specific record
 * @param {string} module 
 * @param {string} recordId 
 */
async function getActivityLogs(module, recordId) {
    const client = initSupabase();
    const { data, error } = await client
        .from('activity_log')
        .select('*, users(name, email)')
        .eq('module', module)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});
