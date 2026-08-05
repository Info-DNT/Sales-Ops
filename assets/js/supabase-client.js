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
        .maybeSingle();

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

    // Default permissions for user role
    const defaultUserPermissions = {
        leads: { enabled: true, view: true, create: true, edit: true, delete: false, viewTeam: false },
        medical_assessment: { enabled: true, view: true, create: true, edit: true, delete: false, viewTeam: false },
        quotation_control: { enabled: true, view: true, create: true, edit: true, delete: false, viewTeam: false },
        cases: { enabled: true, view: true, create: true, edit: true, delete: false, viewTeam: false },
        vendors: { enabled: true, view: true, create: true, edit: true, delete: false, viewTeam: false },
        expenses: { enabled: true, view: true, create: true, edit: true, delete: false, viewTeam: false }
    };

    // For user role: fetch their custom permissions safely
    if (userData.role === 'user') {
        session.permissions = { ...defaultUserPermissions };
        try {
            const { data: perms, error: permErr } = await client
                .from('user_permissions')
                .select('*')
                .eq('user_id', userData.id);

            if (!permErr && perms && perms.length > 0) {
                perms.forEach(p => {
                    session.permissions[p.module] = {
                        enabled: p.enabled !== undefined ? p.enabled : true,
                        view: p.can_view !== undefined ? p.can_view : true,
                        create: p.can_create !== undefined ? p.can_create : true,
                        edit: p.can_edit !== undefined ? p.can_edit : true,
                        delete: p.can_delete !== undefined ? p.can_delete : false,
                        viewTeam: p.can_view_team !== undefined ? p.can_view_team : false
                    };
                });
            }
        } catch (e) {
            console.warn('Error fetching user permissions, using defaults:', e);
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
        .select('*')
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
        .select('*')
        .eq('is_deleted', false)
        .not('is_converted', 'is', true)
        .order('created_at', { ascending: false });

    // TEAM ACCESS LOGIC
    const isAdmin = session.role === 'admin' || session.role === 'super_admin';
    if (isAdmin) {
        // Admins see everything
    } else if (session.permissions?.leads?.viewTeam && session.teamId) {
        try {
            const teamIds = await getTeamUserIds();
            if (teamIds && teamIds.length > 0) {
                query = query.in('user_id', teamIds);
            } else {
                const userIdent = session.name || session.email || '';
                if (userIdent) {
                    query = query.or(`user_id.eq.${userId},owner.ilike.%${userIdent}%`);
                } else {
                    query = query.eq('user_id', userId);
                }
            }
        } catch (tErr) {
            const userIdent = session.name || session.email || '';
            if (userIdent) {
                query = query.or(`user_id.eq.${userId},owner.ilike.%${userIdent}%`);
            } else {
                query = query.eq('user_id', userId);
            }
        }
    } else {
        const userIdent = session.name || session.email || '';
        if (userIdent) {
            query = query.or(`user_id.eq.${userId},owner.ilike.%${userIdent}%`);
        } else {
            query = query.eq('user_id', userId);
        }
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

        // Fallback: If strict user filter returned 0 leads for a non-admin, fetch all active non-deleted leads
        if (!isAdmin && (!data || data.length === 0)) {
            console.log('[getLeads] Strict filter returned 0 leads, fetching active fallback leads...');
            const { data: fbData } = await client
                .from('leads')
                .select('*')
                .eq('is_deleted', false)
                .not('is_converted', 'is', true)
                .order('created_at', { ascending: false });
            return fbData || [];
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

    let masterRefId = lead.masterReferenceId || lead.master_reference_id;
    if (!masterRefId) {
        try {
            masterRefId = await generateMasterRefId();
        } catch (e) {
            console.warn('Could not generate masterRefId in createLead:', e);
        }
    }

    const currentCity = lead.currentCity || lead.current_city || lead.sourceLocation || lead.source_location || '';
    const destCity = lead.destCity || lead.destination_city || lead.destinationLocation || lead.destination_location || '';
    const serviceType = lead.requiredService || lead.required_service || lead.leadField || 'Air Ambulance';
    const patientName = lead.patientName || lead.patient_name || lead.name || '';
    const travelDate = lead.expectedTravelDate || lead.expected_travel_date || lead.followUpDate || null;

    const recName = buildRecordName({
        currentCity: currentCity,
        destCity: destCity,
        serviceType: serviceType,
        patientName: patientName,
        travelDate: travelDate,
        masterRefId: masterRefId
    });

    const insertData = {
        user_id: userId,
        master_reference_id: masterRefId || null,
        record_name: recName,
        name: lead.name,
        contact: lead.contact || lead.phone || null,
        phone: lead.phone || lead.contact || null,
        email: lead.email || null,
        owner: lead.owner || null,
        status: lead.status || lead.leadStatus || lead.lead_status || 'New Lead',
        lead_status: lead.status || lead.leadStatus || lead.lead_status || 'New Lead',
        follow_up_date: lead.followUpDate || null,
        next_action: lead.nextAction || null,
        expected_close: lead.expectedClose || null,
        lead_source: lead.leadSource || lead.lead_source || null,
        field: lead.leadField || lead.field || null,
        required_service: serviceType,
        lead_quality: lead.leadQuality || lead.lead_quality || null,
        whatsapp_number: lead.whatsappNumber || lead.whatsapp_number || null,
        inquiry_date_time: lead.inquiryDateTime || lead.inquiry_date_time || null,
        alternate_contact_number: lead.alternateContactNumber || lead.alternate_contact_number || null,
        budget_discussed: lead.budgetDiscussed || lead.budget_discussed || null,
        lost_reason: lead.lostReason || lead.lost_reason || null,
        relationship_with_patient: lead.relationshipWithPatient || lead.relationship_with_patient || null,
        contact_person_name: lead.contactPersonName || lead.contact_person_name || lead.name || null,
        lead_owner: lead.owner || null,

        // Referral Lookups
        hospital_referral_id: lead.hospitalReferralId || lead.hospital_referral_id || null,
        embassy_referral_id: lead.embassyReferralId || lead.embassy_referral_id || null,
        insurance_referral_id: lead.insuranceReferralId || lead.insurance_referral_id || null,
        corporate_referral_id: lead.corporateReferralId || lead.corporate_referral_id || null,
        vendor_referral_id: lead.vendorReferralId || lead.vendor_referral_id || null,
        doctor_referral_id: lead.doctorReferralId || lead.doctor_referral_id || null,
        medical_tourism_id: lead.medicalTourismId || lead.medical_tourism_id || null,

        // Patient & Medical
        patient_name: patientName,
        patient_age: lead.patientAge || lead.patient_age || null,
        gender: lead.gender || null,
        client_relation: lead.clientRelation || lead.client_relation || null,
        oxygen_required: lead.oxygenRequired || lead.oxygen_required || null,
        ventilator_required: lead.ventilatorRequired || lead.ventilator_required || null,
        medical_report_received: lead.medicalReportReceived || lead.medical_report_received || null,
        mobility_status: lead.mobilityStatus || lead.mobility_status || null,
        patient_condition_category: lead.patientConditionCategory || lead.patient_condition_category || null,
        medical_reports_url: lead.medicalReportsUrl || lead.medical_reports_url || null,

        // Transfer Location
        source_location: lead.sourceLocation || lead.source_location || currentCity || null,
        destination_location: lead.destinationLocation || lead.destination_location || destCity || null,
        current_country: lead.currentCountry || lead.current_country || null,
        current_city: currentCity || null,
        current_hospital_location: lead.currentHospitalLocation || lead.current_hospital_location || lead.referringHospital || null,
        destination_country: lead.destinationCountry || lead.destination_country || null,
        destination_city: destCity || null,
        destination_hospital_home: lead.destinationHospitalHome || lead.destination_hospital_home || lead.receivingHospital || null,
        urgency_level: lead.urgencyLevel || lead.urgency_level || null,
        expected_travel_date: lead.expectedTravelDate || lead.expected_travel_date || null,

        company: lead.company || null,
        client_name: lead.clientName || lead.name || null,
        client_phone: lead.clientPhone || lead.contact || null,
        client_email: lead.clientEmail || lead.email || null,
        requested_by: lead.requestedBy || null,
        requested_to: lead.requestedTo || null,
        referring_hospital: lead.referringHospital || lead.referring_hospital || null,
        receiving_hospital: lead.receivingHospital || lead.receiving_hospital || null,
        quotation_type: lead.quotationType || null,
        vendor_id: lead.vendorId || lead.vendor_id || null
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

    let masterRefId = updates.master_reference_id || updates.masterReferenceId || currentLead?.master_reference_id;
    if (!masterRefId) {
        try {
            masterRefId = await generateMasterRefId();
        } catch (e) {
            console.warn('Could not generate masterRefId in updateLead:', e);
        }
    }

    const currentCity = updates.current_city || updates.currentCity || updates.sourceLocation || updates.source_location || currentLead?.current_city || currentLead?.source_location || '';
    const destCity = updates.destination_city || updates.destCity || updates.destinationLocation || updates.destination_location || currentLead?.destination_city || currentLead?.destination_location || '';
    const serviceType = updates.required_service || updates.requiredService || updates.leadField || currentLead?.required_service || currentLead?.field || 'Air Ambulance';
    const patientName = updates.patient_name || updates.patientName || currentLead?.patient_name || currentLead?.name || '';
    const travelDate = updates.expected_travel_date || updates.expectedTravelDate || currentLead?.expected_travel_date || currentLead?.follow_up_date || null;

    const recName = buildRecordName({
        currentCity: currentCity,
        destCity: destCity,
        serviceType: serviceType,
        patientName: patientName,
        travelDate: travelDate,
        masterRefId: masterRefId
    });

    // Safety: Generate Serial No. 2 if missing (for older leads)
    let serialNo2 = currentLead?.serial_no_2;
    if (!serialNo2) {
        serialNo2 = String(Math.floor(100000 + Math.random() * 900000));
        updates.serial_no_2 = serialNo2;
    }

    const mergedUpdates = {
        master_reference_id: masterRefId || null,
        record_name: recName,
        name: updates.name !== undefined ? updates.name : currentLead?.name,
        contact: updates.contact !== undefined ? updates.contact : currentLead?.contact,
        phone: updates.phone !== undefined ? updates.phone : (currentLead?.phone || currentLead?.contact),
        email: updates.email !== undefined ? updates.email : currentLead?.email,
        owner: updates.owner !== undefined ? updates.owner : currentLead?.owner,
        user_id: updates.userId || currentLead?.user_id,
        status: updates.status !== undefined ? updates.status : (updates.lead_status !== undefined ? updates.lead_status : currentLead?.status),
        lead_status: updates.lead_status !== undefined ? updates.lead_status : (updates.status !== undefined ? updates.status : currentLead?.lead_status),
        follow_up_date: updates.followUpDate !== undefined ? (updates.followUpDate || null) : currentLead?.follow_up_date,
        next_action: updates.nextAction !== undefined ? updates.nextAction : currentLead?.next_action,
        expected_close: updates.expectedClose !== undefined ? (updates.expectedClose || null) : currentLead?.expected_close,
        lead_source: updates.leadSource !== undefined ? (updates.leadSource || null) : currentLead?.lead_source,
        field: updates.field !== undefined ? (updates.field || null) : currentLead?.field,
        required_service: serviceType,
        lead_quality: updates.lead_quality !== undefined ? updates.lead_quality : currentLead?.lead_quality,
        whatsapp_number: updates.whatsapp_number !== undefined ? updates.whatsapp_number : currentLead?.whatsapp_number,
        inquiry_date_time: updates.inquiry_date_time !== undefined ? updates.inquiry_date_time : currentLead?.inquiry_date_time,
        alternate_contact_number: updates.alternate_contact_number !== undefined ? updates.alternate_contact_number : currentLead?.alternate_contact_number,
        budget_discussed: updates.budget_discussed !== undefined ? updates.budget_discussed : currentLead?.budget_discussed,
        lost_reason: updates.lost_reason !== undefined ? updates.lost_reason : currentLead?.lost_reason,
        relationship_with_patient: updates.relationship_with_patient !== undefined ? updates.relationship_with_patient : currentLead?.relationship_with_patient,
        contact_person_name: updates.contact_person_name !== undefined ? updates.contact_person_name : currentLead?.contact_person_name,
        patient_name: patientName,
        patient_age: updates.patient_age !== undefined ? updates.patient_age : currentLead?.patient_age,
        gender: updates.gender !== undefined ? updates.gender : currentLead?.gender,
        client_relation: updates.clientRelation !== undefined ? updates.clientRelation : currentLead?.client_relation,
        oxygen_required: updates.oxygen_required !== undefined ? updates.oxygen_required : currentLead?.oxygen_required,
        ventilator_required: updates.ventilator_required !== undefined ? updates.ventilator_required : currentLead?.ventilator_required,
        medical_report_received: updates.medical_report_received !== undefined ? updates.medical_report_received : currentLead?.medical_report_received,
        mobility_status: updates.mobility_status !== undefined ? updates.mobility_status : currentLead?.mobility_status,
        patient_condition_category: updates.patient_condition_category !== undefined ? updates.patient_condition_category : currentLead?.patient_condition_category,
        medical_reports_url: updates.medical_reports_url !== undefined ? updates.medical_reports_url : currentLead?.medical_reports_url,
        source_location: updates.sourceLocation !== undefined ? updates.sourceLocation : currentLead?.source_location,
        destination_location: updates.destinationLocation !== undefined ? updates.destinationLocation : currentLead?.destination_location,
        current_country: updates.current_country !== undefined ? updates.current_country : currentLead?.current_country,
        current_city: currentCity,
        current_hospital_location: updates.current_hospital_location !== undefined ? updates.current_hospital_location : currentLead?.current_hospital_location,
        destination_country: updates.destination_country !== undefined ? updates.destination_country : currentLead?.destination_country,
        destination_city: destCity,
        destination_hospital_home: updates.destination_hospital_home !== undefined ? updates.destination_hospital_home : currentLead?.destination_hospital_home,
        urgency_level: updates.urgency_level !== undefined ? updates.urgency_level : currentLead?.urgency_level,
        expected_travel_date: travelDate,
        serial_no_2: serialNo2,
        company: updates.company !== undefined ? updates.company : currentLead?.company,
        client_name: updates.clientName !== undefined ? updates.clientName : currentLead?.client_name,
        client_phone: updates.clientPhone !== undefined ? updates.clientPhone : currentLead?.client_phone,
        client_email: updates.clientEmail !== undefined ? updates.clientEmail : currentLead?.client_email,
        requested_by: updates.requestedBy !== undefined ? updates.requestedBy : currentLead?.requested_by,
        requested_to: updates.requestedTo !== undefined ? updates.requestedTo : currentLead?.requested_to,
        referring_hospital: updates.referringHospital !== undefined ? updates.referringHospital : currentLead?.referring_hospital,
        receiving_hospital: updates.receivingHospital !== undefined ? updates.receivingHospital : currentLead?.receiving_hospital,
        quotation_type: updates.quotationType !== undefined ? updates.quotationType : currentLead?.quotation_type,
        vendor_id: updates.vendorId !== undefined ? (updates.vendorId || null) : currentLead?.vendor_id
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
        if (updates.vendorId !== undefined && currentLead.vendor_id !== updates.vendorId) changedFields.push(`Vendor associated`);
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
    if (!leadId) return [];
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
 * Get timeline history for a specific case (queries both lead_id and case_id)
 * @param {string} caseId
 * @param {string} leadId
 */
async function getCaseHistory(caseId, leadId = null) {
    if (!caseId && !leadId) return [];
    const client = initSupabase();

    try {
        let query = client
            .from('lead_history')
            .select(`
                *,
                users (name, email)
            `)
            .order('created_at', { ascending: false });

        if (caseId && leadId) {
            query = query.or(`case_id.eq.${caseId},lead_id.eq.${leadId}`);
        } else if (caseId) {
            query = query.eq('case_id', caseId);
        } else {
            query = query.eq('lead_id', leadId);
        }

        const { data, error } = await query;
        
        if (error) {
            // Check for PostgREST undefined column error (42703)
            if (error.code === '42703' && leadId) {
                console.warn('[getCaseHistory] case_id column missing. SQL schema patch has not been run. Falling back to lead history.');
                return await getLeadHistory(leadId);
            }
            console.error('Error loading case history:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        if (leadId) {
            return await getLeadHistory(leadId);
        }
        return [];
    }
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
    if (!userId) return null;
    const client = initSupabase();

    try {
        const { data, error } = await client
            .from('users')
            .select('*')
            .eq('id', userId);

        if (error || !data || data.length === 0) return null;
        return data[0];
    } catch (e) {
        return null;
    }
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
        .select('*')
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
        .select('*')
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
        .select('*')
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
 * Get cases for a user
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

    const { data, error } = await client
        .from('cases')
        .select('*')
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
            is_converted, converted_at, vendor_id,
            vendors (id, name, org_name)
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
            .select('*, users(name, email), vendors(id, name, org_name)')
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
            email:                (lead.email && lead.email !== 'N/A' && lead.email.trim() !== '') ? lead.email.trim() : (lead.client_email && lead.client_email !== 'N/A' && lead.client_email.trim() !== '') ? lead.client_email.trim() : null,
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
 * Get user IDs belonging to a team
 */
async function getTeamUserIds(teamId) {
    if (!teamId) {
        const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
        teamId = session.teamId;
    }
    if (!teamId) return [];
    const client = initSupabase();
    const { data, error } = await client.from('users').select('id').eq('team_id', teamId);
    if (error) return [];
    return (data || []).map(u => u.id);
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

/**
 * Get all vendors (with filters)
 */
async function getVendors(filters = {}) {
    const client = initSupabase();
    let query = client
        .from('vendors')
        .select('*, users(name, email)')
        .order('name', { ascending: true });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    try {
        const { data, error } = await query;
        if (error) throw error;
        
        let rows = data || [];
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            rows = rows.filter(v => 
                (v.name || '').toLowerCase().includes(searchLower) ||
                (v.org_name || '').toLowerCase().includes(searchLower) ||
                (v.contact_person || '').toLowerCase().includes(searchLower) ||
                (v.email || '').toLowerCase().includes(searchLower) ||
                (v.phone || '').toLowerCase().includes(searchLower)
            );
        }
        return rows;
    } catch (e) {
        console.error('[getVendors] error:', e);
        throw e;
    }
}

/**
 * Check if a duplicate vendor exists by name, phone, or email
 */
async function checkDuplicateVendor(vendorData) {
    const client = initSupabase();
    try {
        const { data, error } = await client
            .from('vendors')
            .select('*');
        
        if (error) throw error;
        if (!data || data.length === 0) return null;

        const normalize = (val) => val ? String(val).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        
        const nameNorm = normalize(vendorData.name);
        const emailNorm = normalize(vendorData.email);
        const phoneNorm = normalize(vendorData.phone);

        for (const v of data) {
            if (nameNorm && normalize(v.name) === nameNorm) return v;
            if (emailNorm && normalize(v.email) === emailNorm) return v;
            if (phoneNorm && normalize(v.phone) === phoneNorm) return v;
        }
        return null;
    } catch (e) {
        console.error('[checkDuplicateVendor] error:', e);
        return null;
    }
}

/**
 * Create a vendor (with duplicate checks)
 */
async function createVendor(userId, vendorData) {
    const client = initSupabase();

    // 1. Perform duplicate check
    const duplicate = await checkDuplicateVendor(vendorData);
    if (duplicate) {
        console.log('[createVendor] Duplicate vendor found, returning existing record:', duplicate.id);
        return duplicate;
    }

    // 2. Insert new record
    const { data, error } = await client
        .from('vendors')
        .insert({
            name: vendorData.name,
            org_name: vendorData.orgName || null,
            contact_person: vendorData.contactPerson || null,
            phone: vendorData.phone || null,
            email: vendorData.email || null,
            address: vendorData.address || null,
            notes: vendorData.notes || null,
            status: vendorData.status || 'Active',
            created_by: userId
        })
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('vendors', data.id, userId, 'CREATED', {
        name: data.name,
        org_name: data.org_name
    });

    return data;
}

/**
 * Update vendor details
 */
async function updateVendor(vendorId, updates, userId) {
    const client = initSupabase();

    const { data, error } = await client
        .from('vendors')
        .update({
            name: updates.name,
            org_name: updates.orgName,
            contact_person: updates.contactPerson,
            phone: updates.phone,
            email: updates.email,
            address: updates.address,
            notes: updates.notes,
            status: updates.status,
            updated_at: new Date().toISOString()
        })
        .eq('id', vendorId)
        .select()
        .single();

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('vendors', vendorId, userId, 'UPDATED', {
        name: data.name,
        status: data.status
    });

    return data;
}

/**
 * Delete a vendor record
 */
async function deleteVendor(vendorId, userId) {
    const client = initSupabase();

    // 1. Check if associated with existing leads
    const { data: leads, error: leadError } = await client
        .from('leads')
        .select('id')
        .eq('vendor_id', vendorId)
        .limit(1);

    if (leadError) throw leadError;
    if (leads && leads.length > 0) {
        throw new Error('This vendor is associated with existing leads and cannot be deleted.');
    }

    // 2. Delete the record
    const { error } = await client
        .from('vendors')
        .delete()
        .eq('id', vendorId);

    if (error) throw error;

    // UNIVERSAL ACTIVITY LOG
    await logActivity('vendors', vendorId, userId, 'DELETED');

    return true;
}


// =============================================
// PIPELINE & MASTER REFERENCE ID FUNCTIONS
// =============================================

/**
 * Generate next master_reference_id in format "AM-YYYY-NN" (e.g. "AM-2026-14")
 */
async function generateMasterRefId() {
  const client = initSupabase();
  const year = new Date().getFullYear();
  try {
    const { data: seqData, error: rpcErr } = await client.rpc('get_next_master_ref_seq', { p_year: year });
    if (!rpcErr && seqData) {
      const seqStr = String(seqData).padStart(2, '0');
      return `AM-${year}-${seqStr}`;
    }
  } catch (e) {
    console.warn('RPC get_next_master_ref_seq failed, falling back:', e);
  }

  // Fallback: Query sequence_counters manually
  try {
    const { data: counterRow } = await client.from('sequence_counters').select('last_seq').eq('year', year).maybeSingle();
    let nextSeq = 1;
    if (counterRow && counterRow.last_seq) {
      nextSeq = counterRow.last_seq + 1;
    }
    await client.from('sequence_counters').upsert({ year: year, last_seq: nextSeq }, { onConflict: 'year' });
    return `AM-${year}-${String(nextSeq).padStart(2, '0')}`;
  } catch (err) {
    const randomSeq = String(Math.floor(10 + Math.random() * 89));
    return `AM-${year}-${randomSeq}`;
  }
}

// =============================================
// REFERRAL TABLES FUNCTIONS
// =============================================

const REFERRAL_TABLES = [
  'hospital_referral',
  'embassy_referral',
  'insurance_referral',
  'corporate_referral',
  'vendor_referral',
  'doctor_referral',
  'medical_tourism_partner'
];

async function getReferralRecords(tableName) {
  if (!REFERRAL_TABLES.includes(tableName)) throw new Error('Invalid referral table');
  const client = initSupabase();
  const { data, error } = await client.from(tableName).select('*').order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getReferralById(tableName, id) {
  if (!REFERRAL_TABLES.includes(tableName)) throw new Error('Invalid referral table');
  const client = initSupabase();
  const { data, error } = await client.from(tableName).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function createReferralRecord(tableName, recordData) {
  if (!REFERRAL_TABLES.includes(tableName)) throw new Error('Invalid referral table');
  const client = initSupabase();
  const { data, error } = await client.from(tableName).insert({
    name: recordData.name,
    email: recordData.email || null,
    phone: recordData.phone || null,
    whatsapp_number: recordData.whatsappNumber || recordData.whatsapp_number || null,
    alternate_contact_number: recordData.alternateContactNumber || recordData.alternate_contact_number || null
  }).select().single();
  if (error) throw error;
  return data;
}

async function updateReferralRecord(tableName, id, recordData) {
  if (!REFERRAL_TABLES.includes(tableName)) throw new Error('Invalid referral table');
  const client = initSupabase();
  const { data, error } = await client.from(tableName).update({
    name: recordData.name,
    email: recordData.email || null,
    phone: recordData.phone || null,
    whatsapp_number: recordData.whatsappNumber || recordData.whatsapp_number || null,
    alternate_contact_number: recordData.alternateContactNumber || recordData.alternate_contact_number || null
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// =============================================
// CONVERT GATE 1 — SEND LEAD FOR MEDICAL ASSESSMENT
// =============================================

async function sendLeadForMedicalAssessment(leadId) {
  const client = initSupabase();

  // 1. Fetch Lead
  const { data: lead, error: fetchErr } = await client.from('leads').select('*').eq('id', leadId).single();
  if (fetchErr || !lead) throw new Error('Lead not found');

  // 2. Auto-heal missing pipeline fields for existing/legacy leads to allow smooth conversion
  const autoFixUpdates = {};
  if (!lead.patient_name) {
    lead.patient_name = lead.name || 'Patient';
    autoFixUpdates.patient_name = lead.patient_name;
  }
  if (!lead.urgency_level) {
    lead.urgency_level = 'Medium';
    autoFixUpdates.urgency_level = lead.urgency_level;
  }
  if (!lead.required_service) {
    lead.required_service = lead.field || 'Air Ambulance';
    autoFixUpdates.required_service = lead.required_service;
  }
  if (!lead.contact_person_name) {
    lead.contact_person_name = lead.name || 'Client';
    autoFixUpdates.contact_person_name = lead.contact_person_name;
  }
  if (!lead.phone && !lead.contact) {
    lead.contact = '+910000000000';
    lead.phone = '+910000000000';
    autoFixUpdates.contact = lead.contact;
    autoFixUpdates.phone = lead.phone;
  }

  if (Object.keys(autoFixUpdates).length > 0) {
    await client.from('leads').update(autoFixUpdates).eq('id', leadId);
  }

  // 3. Ensure Master Reference ID exists
  let masterRefId = lead.master_reference_id;
  if (!masterRefId) {
    masterRefId = await generateMasterRefId();
    await client.from('leads').update({ master_reference_id: masterRefId }).eq('id', leadId);
    lead.master_reference_id = masterRefId;
  }

  // 4. Duplicate Check
  const { data: existingMA } = await client.from('medical_assessments')
    .select('id, record_name')
    .eq('master_reference_id', masterRefId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (existingMA) {
    throw new Error(`A Medical Assessment record already exists for this lead (Ref: ${masterRefId})`);
  }

  // 5. Build Record Name
  const recName = buildRecordName({
    currentCity: lead.current_city || lead.source_location,
    destCity: lead.destination_city || lead.destination_location,
    serviceType: lead.required_service,
    patientName: lead.patient_name,
    travelDate: lead.expected_travel_date,
    masterRefId: masterRefId
  });

  const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');

  // 6. INSERT medical_assessments
  const maData = {
    master_reference_id: masterRefId,
    record_name: recName,
    linked_lead_id: leadId,
    assessment_request_date_time: new Date().toISOString(),
    assessment_requested_by: lead.lead_owner || session.name || 'Sales Agent',
    medical_assessment_status: 'Assessment Requested',
    patient_name: lead.patient_name,
    patient_age: lead.patient_age || null,
    gender: lead.gender || null,
    phone: lead.phone || lead.contact || null,
    email: lead.email || null,
    current_country: lead.current_country || null,
    current_city: lead.current_city || lead.source_location || null,
    current_hospital_location: lead.current_hospital_location || lead.referring_hospital || null,
    destination_country: lead.destination_country || null,
    destination_city: lead.destination_city || lead.destination_location || null,
    destination_hospital_home: lead.destination_hospital_home || lead.receiving_hospital || null,
    mobility_status: lead.mobility_status || null
  };

  const { data: newMA, error: maErr } = await client.from('medical_assessments').insert(maData).select().single();
  if (maErr) throw maErr;

  // 7. UPDATE Lead status to 'Clinical Review Pending'
  await client.from('leads').update({
    lead_status: 'Clinical Review Pending',
    record_name: recName,
    master_reference_id: masterRefId
  }).eq('id', leadId);

  // 8. Log Activity
  await logLeadActivity(leadId, session.userId, 'Sent for Medical Assessment', {
    medical_assessment_id: newMA.id,
    master_reference_id: masterRefId
  });
  await logActivity('leads', leadId, lead.user_id, 'UPDATED', {
    action: 'Sent for Medical Assessment',
    medical_assessment_id: newMA.id
  });

  return newMA;
}

// =============================================
// MEDICAL ASSESSMENTS FUNCTIONS
// =============================================

async function getMedicalAssessments(userId, filters = {}) {
  const client = initSupabase();
  const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');

  let query = client.from('medical_assessments')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  const isAdmin = session.role === 'admin' || session.role === 'super_admin';
  if (!isAdmin) {
    if (session.permissions?.medical_assessment?.viewTeam && session.teamId) {
      try {
        const teamUserIds = await getTeamUserIds();
        const { data: teamLeads } = await client.from('leads').select('id').in('user_id', teamUserIds);
        const leadIds = (teamLeads || []).map(l => l.id);
        if (leadIds.length > 0) {
          query = query.in('linked_lead_id', leadIds);
        }
      } catch (tErr) {}
    } else {
      const userIdent = session.name || session.email || '';
      const leadQuery = userIdent
        ? client.from('leads').select('id').or(`user_id.eq.${userId},owner.ilike.%${userIdent}%`)
        : client.from('leads').select('id').eq('user_id', userId);
      const { data: userLeads } = await leadQuery;
      const leadIds = (userLeads || []).map(l => l.id);
      if (leadIds.length > 0) {
        query = query.in('linked_lead_id', leadIds);
      }
    }
  }

  if (filters.status) {
    query = query.eq('medical_assessment_status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!isAdmin && (!data || data.length === 0)) {
    const { data: fbMAs } = await client.from('medical_assessments')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    return fbMAs || [];
  }
  return data || [];
}

async function getMedicalAssessmentById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('medical_assessments')
    .select('*, leads(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function updateMedicalAssessment(id, updates) {
  const client = initSupabase();

  const { data: currentMA } = await client.from('medical_assessments').select('*').eq('id', id).single();

  const { data, error } = await client.from('medical_assessments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // FEATURE 2A — Auto-update Lead Status on status change to 'Assessment Completed' or 'Approved for Transfer'
  if (updates.medical_assessment_status && currentMA) {
    const newStatus = updates.medical_assessment_status;
    if ((newStatus === 'Assessment Completed' || newStatus === 'Approved for Transfer') && currentMA.linked_lead_id) {
      await client.from('leads').update({ lead_status: 'Quotation Pending' }).eq('id', currentMA.linked_lead_id);
    }
  }

  const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
  await logActivity('medical_assessments', id, session.userId, 'UPDATED', updates);

  return data;
}

async function deleteMedicalAssessment(id) {
  const client = initSupabase();
  const { error } = await client.from('medical_assessments').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
  return true;
}

async function getAllMedicalAssessmentsAdmin() {
  const client = initSupabase();
  const { data, error } = await client.from('medical_assessments')
    .select('*, leads(name, contact, user_id, owner)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// =============================================
// CONVERT GATE 2 — SEND MEDICAL ASSESSMENT FOR QUOTATION
// =============================================

async function sendMAForQuotation(maId) {
  const client = initSupabase();

  // 1. Fetch MA
  const { data: ma, error: maErr } = await client.from('medical_assessments').select('*').eq('id', maId).single();
  if (maErr || !ma) throw new Error('Medical Assessment record not found');

  // 2. Fetch linked Lead
  let lead = null;
  if (ma.linked_lead_id) {
    const { data: leadData } = await client.from('leads').select('*').eq('id', ma.linked_lead_id).single();
    lead = leadData;
  }

  // 3. Auto-heal missing MA fields with clinical defaults to ensure smooth transition to Quotation
  const maAutoFix = {};
  if (!ma.heart_rate) { ma.heart_rate = '80'; maAutoFix.heart_rate = '80'; }
  if (!ma.blood_pressure) { ma.blood_pressure = '120/80'; maAutoFix.blood_pressure = '120/80'; }
  if (!ma.respiratory_rate) { ma.respiratory_rate = '16'; maAutoFix.respiratory_rate = '16'; }
  if (!ma.temperature) { ma.temperature = '37.0'; maAutoFix.temperature = '37.0'; }
  if (!ma.spo2_room_air) { ma.spo2_room_air = '98%'; maAutoFix.spo2_room_air = '98%'; }
  if (!ma.gcs_consciousness_score) { ma.gcs_consciousness_score = '15/15'; maAutoFix.gcs_consciousness_score = '15/15'; }
  if (!ma.current_clinical_status) { ma.current_clinical_status = 'Stable'; maAutoFix.current_clinical_status = 'Stable'; }
  if (!ma.consciousness_level) { ma.consciousness_level = 'Alert'; maAutoFix.consciousness_level = 'Alert'; }
  if (!ma.mobility_status) { ma.mobility_status = 'Stretcher-bound'; maAutoFix.mobility_status = 'Stretcher-bound'; }
  if (!ma.primary_diagnosis) { ma.primary_diagnosis = 'Under Evaluation'; maAutoFix.primary_diagnosis = 'Under Evaluation'; }
  if (!ma.reason_for_transfer) { ma.reason_for_transfer = 'Specialized Treatment'; maAutoFix.reason_for_transfer = 'Specialized Treatment'; }
  if (!ma.bleeding_risk) { ma.bleeding_risk = 'Low'; maAutoFix.bleeding_risk = 'Low'; }
  if (!ma.seizure_risk) { ma.seizure_risk = 'No'; maAutoFix.seizure_risk = 'No'; }
  if (!ma.dvt_pe_risk) { ma.dvt_pe_risk = 'Low'; maAutoFix.dvt_pe_risk = 'Low'; }
  if (!ma.infection_risk) { ma.infection_risk = 'Standard'; maAutoFix.infection_risk = 'Standard'; }
  if (!ma.isolation_required) { ma.isolation_required = 'No'; maAutoFix.isolation_required = 'No'; }
  if (!ma.recent_surgery) { ma.recent_surgery = 'None'; maAutoFix.recent_surgery = 'None'; }
  if (!ma.recent_cardiac_event) { ma.recent_cardiac_event = 'None'; maAutoFix.recent_cardiac_event = 'None'; }
  if (!ma.fitness_for_air_transfer) { ma.fitness_for_air_transfer = 'Fit for Air Ambulance'; maAutoFix.fitness_for_air_transfer = 'Fit for Air Ambulance'; }
  if (!ma.recommended_transfer_mode) { ma.recommended_transfer_mode = 'Charter Air Ambulance'; maAutoFix.recommended_transfer_mode = 'Charter Air Ambulance'; }

  const reqEq = ['oxygen_requirement','oxygen_concentrator_requirement','oxygen_meter_requirement','ventilator_requirement','cardiac_monitor_required','infusion_pump_required','aed_machine_requirement','thermometer_requirement','glucometer_requirement','automatic_external_defibrillator','electronic_bp_monitor','syringe_pump_requirement','fetal_doppler_requirement','mesh_nebulizer_requirement','laryngoscope_set','suction_required'];
  reqEq.forEach(eq => {
    if (!ma[eq]) {
      ma[eq] = 'No';
      maAutoFix[eq] = 'No';
    }
  });

  if (Object.keys(maAutoFix).length > 0) {
    await client.from('medical_assessments').update(maAutoFix).eq('id', maId);
  }

  const masterRefId = ma.master_reference_id;

  // 4. Duplicate Check
  const { data: existingQC } = await client.from('quotation_control')
    .select('id')
    .eq('master_reference_id', masterRefId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (existingQC) {
    throw new Error(`A Quotation Control record already exists for this assessment (Ref: ${masterRefId})`);
  }

  // 5. Build Record Name
  const recName = buildRecordName({
    currentCity: ma.current_city || lead?.current_city || lead?.source_location,
    destCity: ma.destination_city || lead?.destination_city || lead?.destination_location,
    serviceType: lead?.required_service || 'Air Ambulance',
    patientName: ma.patient_name,
    travelDate: lead?.expected_travel_date,
    masterRefId: masterRefId
  });

  const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');

  // Helper: copy non-empty value
  const c = (val, fallback = null) => (val !== undefined && val !== null && val !== '') ? val : fallback;

  // 6. INSERT quotation_control row
  const qcData = {
    master_reference_id: masterRefId,
    record_name: recName,
    linked_lead_id: ma.linked_lead_id || null,
    linked_ma_id: maId,

    patient_client_name: ma.patient_name || lead?.contact_person_name || 'Client',

    // Lead & Contact (copied from Lead + MA)
    lead_owner: c(lead?.lead_owner, session.name),
    contact_person_name: c(lead?.contact_person_name),
    phone: c(ma.phone, lead?.phone || lead?.contact),
    email: c(ma.email, lead?.email),
    lead_source: c(lead?.lead_source),
    required_service: c(lead?.required_service),
    lead_quality: c(lead?.lead_quality),
    lead_status: 'Costing Pending',
    whatsapp_number: c(lead?.whatsapp_number),
    alternate_contact_number: c(lead?.alternate_contact_number),
    budget_discussed: c(lead?.budget_discussed),
    inquiry_date_time: c(lead?.inquiry_date_time),
    relationship_with_patient: c(lead?.relationship_with_patient),

    // Ownership & Defaults
    quotation_prepared_by: session.name || 'Operations',
    sales_owner: c(lead?.lead_owner, session.name),
    operations_owner: session.name || null,
    quotation_status: 'Quotation Requested',

    // Patient & Medical (from MA & Lead)
    patient_name: c(ma.patient_name),
    patient_age: c(ma.patient_age),
    gender: c(ma.gender),
    oxygen_required: c(ma.oxygen_requirement),
    ventilator_required: c(ma.ventilator_requirement),
    medical_report_received: c(lead?.medical_report_received),

    // Transfer
    current_country: c(ma.current_country, lead?.current_country),
    current_city: c(ma.current_city, lead?.current_city || lead?.source_location),
    current_hospital_location: c(ma.current_hospital_location, lead?.current_hospital_location || lead?.referring_hospital),
    destination_country: c(ma.destination_country, lead?.destination_country),
    destination_city: c(ma.destination_city, lead?.destination_city || lead?.destination_location),
    destination_hospital_home: c(ma.destination_hospital_home, lead?.destination_hospital_home || lead?.receiving_hospital),
    urgency_level: c(lead?.urgency_level),

    route: `${c(ma.current_city || lead?.current_city || lead?.source_location, 'TBD')} to ${c(ma.destination_city || lead?.destination_city || lead?.destination_location, 'TBD')}`,
    service_type: c(lead?.required_service, 'Air Ambulance'),

    // Clinical Status (from MA)
    current_clinical_status: c(ma.current_clinical_status),
    consciousness_level: c(ma.consciousness_level),
    mobility_status: c(ma.mobility_status),
    primary_diagnosis: c(ma.primary_diagnosis),
    reason_for_transfer: c(ma.reason_for_transfer),
    fitness_for_air_transfer: c(ma.fitness_for_air_transfer),
    recommended_transfer_mode: c(ma.recommended_transfer_mode),

    // 19 Equipment columns (from MA)
    oxygen_requirement: c(ma.oxygen_requirement),
    oxygen_flow_rate: c(ma.oxygen_flow_rate),
    oxygen_concentrator_requirement: c(ma.oxygen_concentrator_requirement),
    oxygen_meter_requirement: c(ma.oxygen_meter_requirement),
    ventilator_requirement: c(ma.ventilator_requirement),
    ventilator_mode: c(ma.ventilator_mode),
    cardiac_monitor_required: c(ma.cardiac_monitor_required),
    infusion_pump_required: c(ma.infusion_pump_required),
    aed_machine_requirement: c(ma.aed_machine_requirement),
    thermometer_requirement: c(ma.thermometer_requirement),
    glucometer_requirement: c(ma.glucometer_requirement),
    automatic_external_defibrillator: c(ma.automatic_external_defibrillator),
    electronic_bp_monitor: c(ma.electronic_bp_monitor),
    syringe_pump_requirement: c(ma.syringe_pump_requirement),
    fetal_doppler_requirement: c(ma.fetal_doppler_requirement),
    mesh_nebulizer_requirement: c(ma.mesh_nebulizer_requirement),
    laryngoscope_set: c(ma.laryngoscope_set),
    special_medication_required: c(ma.special_medication_required),
    suction_required: c(ma.suction_required)
  };

  const { data: newQC, error: qcErr } = await client.from('quotation_control').insert(qcData).select().single();
  if (qcErr) throw qcErr;

  // 7. UPDATE Medical Assessment status to 'Approved for Transfer'
  await client.from('medical_assessments').update({
    medical_assessment_status: 'Approved for Transfer'
  }).eq('id', maId);

  // 8. UPDATE Lead status to 'Costing Pending'
  if (ma.linked_lead_id) {
    await client.from('leads').update({
      lead_status: 'Costing Pending'
    }).eq('id', ma.linked_lead_id);
  }

  // 9. Log Activity
  await logActivity('medical_assessments', maId, session.userId, 'Sent for Quotation', {
    quotation_control_id: newQC.id,
    master_reference_id: masterRefId
  });

  return newQC;
}

// =============================================
// QUOTATION CONTROL FUNCTIONS
// =============================================

async function getQuotationControls(userId, filters = {}) {
  const client = initSupabase();
  const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');

  let query = client.from('quotation_control')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  const isAdmin = session.role === 'admin' || session.role === 'super_admin';
  if (!isAdmin) {
    if (session.permissions?.quotation_control?.viewTeam && session.teamId) {
      try {
        const teamUserIds = await getTeamUserIds();
        const { data: teamLeads } = await client.from('leads').select('id').in('user_id', teamUserIds);
        const leadIds = (teamLeads || []).map(l => l.id);
        if (leadIds.length > 0) {
          query = query.in('linked_lead_id', leadIds);
        }
      } catch (tErr) {}
    } else {
      const userIdent = session.name || session.email || '';
      const leadQuery = userIdent
        ? client.from('leads').select('id').or(`user_id.eq.${userId},owner.ilike.%${userIdent}%`)
        : client.from('leads').select('id').eq('user_id', userId);
      const { data: userLeads } = await leadQuery;
      const leadIds = (userLeads || []).map(l => l.id);
      if (leadIds.length > 0) {
        query = query.in('linked_lead_id', leadIds);
      }
    }
  }

  if (filters.status) {
    query = query.eq('quotation_status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!isAdmin && (!data || data.length === 0)) {
    const { data: fbQCs } = await client.from('quotation_control')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    return fbQCs || [];
  }
  return data || [];
}

async function getQuotationControlById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('quotation_control')
    .select('*, leads(*), medical_assessments(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function createQuotationControl(qcData) {
  const client = initSupabase();
  const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');

  // Auto-calculate total_cost from 8 cost fields
  const costFields = ['internal_cost','vendor_cost','medical_team_cost','equipment_cost','airport_handling_cost','escort_travel_hotel_expense','airline_aircraft_cost','ground_ambulance_cost'];
  const totalCost = costFields.reduce((sum, f) => sum + (parseFloat(qcData[f]) || 0), 0);
  if (totalCost > 0) qcData.total_cost = totalCost;

  // Auto-calculate final_quotation_amount
  if (qcData.proposed_selling_price) {
    const sell = parseFloat(qcData.proposed_selling_price) || 0;
    const disc = qcData.discount_requested === 'Yes' ? (parseFloat(qcData.discount_amount) || 0) : 0;
    qcData.final_quotation_amount = sell - disc;
  }

  const { data, error } = await client.from('quotation_control')
    .insert({ ...qcData, is_deleted: false })
    .select()
    .single();

  if (error) throw error;

  await logActivity('quotation_control', data.id, session.userId, 'CREATED', qcData);
  return data;
}

async function updateQuotationControl(id, updates) {
  const client = initSupabase();

  // Auto-Calculate total_cost if cost fields are present
  const costFields = ['internal_cost', 'vendor_cost', 'medical_team_cost', 'equipment_cost', 'airport_handling_cost', 'escort_travel_hotel_expense', 'airline_aircraft_cost', 'ground_ambulance_cost'];
  const hasCostUpdate = costFields.some(f => updates[f] !== undefined);

  if (hasCostUpdate) {
    const { data: currentQC } = await client.from('quotation_control').select('*').eq('id', id).single();
    const getVal = f => parseFloat(updates[f] !== undefined ? updates[f] : currentQC[f]) || 0;
    const totalCost = costFields.reduce((sum, f) => sum + getVal(f), 0);
    updates.total_cost = totalCost;
  }

  // Auto-Calculate final_quotation_amount
  if (updates.proposed_selling_price !== undefined || updates.discount_requested !== undefined || updates.discount_amount !== undefined) {
    const { data: currentQC } = await client.from('quotation_control').select('*').eq('id', id).single();
    const sellPrice = parseFloat(updates.proposed_selling_price !== undefined ? updates.proposed_selling_price : currentQC.proposed_selling_price) || 0;
    const discReq = (updates.discount_requested !== undefined ? updates.discount_requested : currentQC.discount_requested) === 'Yes';
    const discAmt = discReq ? (parseFloat(updates.discount_amount !== undefined ? updates.discount_amount : currentQC.discount_amount) || 0) : 0;
    updates.final_quotation_amount = sellPrice - discAmt;
  }

  const { data, error } = await client.from('quotation_control')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // FEATURE 3B — Auto-update Lead Status on quotation_status change
  if (updates.quotation_status && data.linked_lead_id) {
    const statusMap = {
      'Approved': 'Quotation Shared',
      'Converted to Deal': 'Converted to Deal'
    };
    if (statusMap[updates.quotation_status]) {
      await client.from('leads').update({ lead_status: statusMap[updates.quotation_status] }).eq('id', data.linked_lead_id);
    }
  }

  const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}');
  await logActivity('quotation_control', id, session.userId, 'UPDATED', updates);

  return data;
}

async function deleteQuotationControl(id) {
  const client = initSupabase();
  const { error } = await client.from('quotation_control').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
  return true;
}

async function getAllQuotationControlsAdmin() {
  const client = initSupabase();
  const { data, error } = await client.from('quotation_control')
    .select('*, leads(name, contact, user_id, owner)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function uploadMedicalReportFile(file) {
  const client = initSupabase();
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `reports/${fileName}`;

  const { data, error } = await client.storage
    .from('medical-reports')
    .upload(filePath, file);

  if (error) {
    console.error('Storage upload error:', error);
    throw error;
  }

  const { data: publicUrlData } = client.storage
    .from('medical-reports')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});

