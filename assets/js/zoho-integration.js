/**
 * CRM Integration
 * Handles bi-directional sync between app and Zoho CRM via Make.com
 */

// Make.com Webhook URLs
// Replace these with your scenario URLs from Make.com
const MAKE_WEBHOOKS = {
    fetchLeads: 'https://hook.eu1.make.com/7ljqht2ikevvjymtsxvbcuef8gb5bly3', // ✅ Scenario 1: Fetch Leads
    updateLead: '', // ⚠️ TODO: Add Scenario 2 URL
    assignLead: ''  // ⚠️ TODO: Add Scenario 3 URL
}

/**
 * Sync CRM Leads from Zoho
 * Called when admin clicks "Sync CRM" button
 */
async function syncCRMLeads() {
    try {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'D', location: 'assets/js/zoho-integration.js:syncCRMLeads:entry', message: 'syncCRMLeads entry', data: { hasFetchWebhook: !!MAKE_WEBHOOKS.fetchLeads, proxyPath: '/.netlify/functions/zoho-proxy' }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log
        if (!MAKE_WEBHOOKS.fetchLeads) {
            showToast('Make.com webhook not configured', 'error')
            return
        }

        showToast('Fetching leads from CRM...', 'info')

        // 1. Fetch ALL leads from Zoho via Netlify proxy function
        const response = await fetch('/.netlify/functions/zoho-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhookUrl: MAKE_WEBHOOKS.fetchLeads
            })
        })

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'A', location: 'assets/js/zoho-integration.js:syncCRMLeads:proxyResponse', message: 'zoho-proxy response received', data: { ok: response.ok, status: response.status, statusText: response.statusText }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log

        if (!response.ok) {
            let errDetail = ''
            let rawBody = ''
            try {
                const ct = response.headers.get('content-type') || ''
                if (ct.includes('application/json')) {
                    const j = await response.json()
                    errDetail = j?.error ? ` - ${j.error}` : ''
                    rawBody = j?.raw || ''
                } else {
                    rawBody = await response.text()
                    errDetail = rawBody ? ` - ${rawBody.slice(0, 140)}` : ''
                }
            } catch (e) {
                errDetail = ''
            }
            const error = new Error(`Failed to fetch: ${response.statusText}${errDetail}`)
            error.raw = rawBody
            throw error
        }

        const data = await response.json()
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'C', location: 'assets/js/zoho-integration.js:syncCRMLeads:proxyJson', message: 'zoho-proxy JSON parsed', data: { success: data?.success, leadsIsArray: Array.isArray(data?.leads), leadsLen: Array.isArray(data?.leads) ? data.leads.length : null, keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 15) : null }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log
        console.log('Zoho Proxy Response:', data)

        // 2. Extract leads (handle different response formats)
        let rawLeads = []
        if (Array.isArray(data)) {
            rawLeads = data
        } else if (data.leads && Array.isArray(data.leads)) {
            rawLeads = data.leads
        } else if (data.data && Array.isArray(data.data)) {
            rawLeads = data.data
        } else if (data.records && Array.isArray(data.records)) {
            rawLeads = data.records
        } else {
            console.error('Unexpected Zoho response format:', data)
            throw new Error('Could not find leads array in Zoho response')
        }

        console.log(`Processing ${rawLeads.length} leads from CRM`)

        // 3. Get existing lead IDs from registry (duplicate prevention)
        const existingIDs = await getExistingCRMLeadIDs()

        // 4. Process and transform leads
        const crmLeads = []
        const newLeadIDs = []

        for (const zohoLead of rawLeads) {
            // Zoho IDs can be strings or numbers
            const leadId = zohoLead.id || zohoLead.ID || zohoLead.zoho_id
            if (!leadId) continue

            const isNew = !existingIDs.includes(String(leadId))

            // Transform Zoho lead format to app format (handle various Zoho field names)
            const lead = {
                zoho_lead_id: String(leadId),
                name: zohoLead.Last_Name || zohoLead.Full_Name || zohoLead.Name || 'Unknown',
                contact: zohoLead.Phone || zohoLead.Mobile || '',
                email: zohoLead.Email || '',
                owner: zohoLead.Lead_Owner?.email || zohoLead.Owner || '',
                status: zohoLead.Lead_Status || zohoLead.Status || 'New',
                account_name: zohoLead.Company || zohoLead.Account_Name || 'N/A',
                field: zohoLead.Field || '',
                lead_source: zohoLead.Lead_Source || zohoLead.Source || '',
                follow_up_date: zohoLead.Follow_Up_Date || '',
                next_action: zohoLead.Next_Action || '',
                expected_close: zohoLead.Expected_Close || '',
                app_assigned_to: zohoLead.App_Assigned_To || '',
                source: 'crm',
                isNew: isNew
            }

            crmLeads.push(lead)

            if (isNew) {
                newLeadIDs.push(String(leadId))
            }
        }

        // 5. Register new leads in Supabase (for duplicate tracking)
        if (newLeadIDs.length > 0) {
            await registerNewCRMLeads(newLeadIDs)
            console.log(`Registered ${newLeadIDs.length} new CRM leads`)
        }

        // 5. Return result object
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'D', location: 'assets/js/zoho-integration.js:syncCRMLeads:beforeReturn', message: 'about to return sync result', data: { crmLeadsLen: crmLeads.length, newLeadIDsLen: newLeadIDs.length, totalCountType: typeof totalCount, newCountType: typeof newCount }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log
        const totalCount = crmLeads.length
        const newCount = newLeadIDs.length

        return {
            success: true,
            totalLeads: totalCount,
            newLeads: newCount,
            leads: crmLeads
        }

    } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'D', location: 'assets/js/zoho-integration.js:syncCRMLeads:catch', message: 'syncCRMLeads caught error', data: { name: error?.name, message: error?.message, stackTop: (error?.stack || '').split('\n').slice(0, 3).join(' | ') }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log
        console.error('Sync error:', error)
        return {
            success: false,
            error: error.message,
            raw: error.raw, // Pass through raw response if available
            totalLeads: 0,
            newLeads: 0,
            leads: []
        }
    }
}

/**
 * Get existing CRM lead IDs from registry
 */
async function getExistingCRMLeadIDs() {
    try {
        const { data, error } = await supabase
            .from('crm_lead_registry')
            .select('zoho_lead_id')

        if (error) throw error

        return data?.map(row => row.zoho_lead_id) || []
    } catch (error) {
        console.error('Error fetching registry:', error)
        return []
    }
}

/**
 * Register new CRM leads in Supabase
 * This prevents showing duplicates on next sync
 */
async function registerNewCRMLeads(zohoLeadIDs) {
    try {
        const records = zohoLeadIDs.map(id => ({
            zoho_lead_id: id,
            user_id: null,
            assigned_at: null
        }))

        const { error } = await supabase
            .from('crm_lead_registry')
            .insert(records)

        if (error) {
            // Ignore duplicate key errors (lead already registered)
            if (!error.message.includes('duplicate')) {
                throw error
            }
        }

    } catch (error) {
        console.error('Error registering leads:', error)
    }
}

/**
 * Get CRM leads assigned to specific user
 */
async function getAssignedCRMLeads(userId) {
    try {
        if (!MAKE_WEBHOOKS.fetchLeads) {
            return []
        }

        // 1. Get assigned lead IDs from registry
        const { data: assignments, error } = await supabase
            .from('crm_lead_registry')
            .select('zoho_lead_id')
            .eq('user_id', userId)

        if (error) throw error

        const assignedIDs = assignments?.map(a => a.zoho_lead_id) || []

        if (assignedIDs.length === 0) {
            return []
        }

        // 2. Fetch fresh data via proxy (avoid CORS)
        const response = await fetch('/.netlify/functions/zoho-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhookUrl: MAKE_WEBHOOKS.fetchLeads
            })
        })
        const data = await response.json()

        if (!data.success || !data.leads) {
            return []
        }

        // 3. Filter and transform assigned leads
        const myLeads = data.leads
            .filter(lead => assignedIDs.includes(lead.id))
            .map(zohoLead => ({
                zoho_lead_id: zohoLead.id,
                name: zohoLead.Last_Name || '',
                contact: zohoLead.Phone || '',
                email: zohoLead.Email || '',
                owner: zohoLead.Lead_Owner?.email || '',
                status: zohoLead.Lead_Status || 'New',
                account_name: zohoLead.Company || '',
                field: zohoLead.Field || '',
                lead_source: zohoLead.Lead_Source || '',
                follow_up_date: zohoLead.Follow_Up_Date || '',
                next_action: zohoLead.Next_Action || '',
                expected_close: zohoLead.Expected_Close || '',
                source: 'crm'
            }))

        return myLeads

    } catch (error) {
        console.error('Error getting assigned leads:', error)
        return []
    }
}

/**
 * Update CRM lead in Zoho
 * Called when user/admin edits a CRM lead
 */
async function updateCRMLead(leadData) {
    try {
        if (!MAKE_WEBHOOKS.updateLead) {
            showToast('Make.com update webhook not configured', 'error')
            return false
        }

        const payload = {
            zoho_lead_id: leadData.zoho_lead_id,
            last_name: leadData.name,
            phone: leadData.contact,
            email: leadData.email,
            company: leadData.account_name || '',
            lead_status: leadData.status,
            lead_source: leadData.lead_source || '',
            field: leadData.field || '',
            follow_up_date: leadData.follow_up_date || '',
            next_action: leadData.next_action || '',
            expected_close: leadData.expected_close || '',
            updated_by: getCurrentUser().email,
            timestamp: new Date().toISOString()
        }

        const response = await fetch('/.netlify/functions/zoho-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhookUrl: MAKE_WEBHOOKS.updateLead,
                payload: payload
            })
        })

        if (!response.ok) {
            throw new Error(`Update failed: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('CRM update successful:', result)
        return true

    } catch (error) {
        console.error('Error updating CRM lead:', error)
        throw error
    }
}

/**
 * Assign CRM lead to user
 * Updates App_Assigned_To field in Zoho (NOT Lead Owner)
 */
async function assignCRMLeadToUser(zohoLeadId, userId, userEmail) {
    try {
        if (!MAKE_WEBHOOKS.assignLead) {
            showToast('Make.com assignment webhook not configured', 'error')
            return false
        }

        showToast('Assigning lead...', 'info')

        // 1. Update assignment via Make.com webhook
        const payload = {
            zoho_lead_id: zohoLeadId,
            app_assigned_to: userEmail,
            assigned_by: getCurrentUser().email,
            timestamp: new Date().toISOString()
        }

        const response = await fetch('/.netlify/functions/zoho-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhookUrl: MAKE_WEBHOOKS.assignLead,
                payload: payload
            })
        })

        if (!response.ok) {
            throw new Error(`Assignment failed: ${response.statusText}`)
        }

        // 2. Update registry in Supabase
        const { error } = await supabase
            .from('crm_lead_registry')
            .update({
                user_id: userId,
                assigned_at: new Date().toISOString()
            })
            .eq('zoho_lead_id', zohoLeadId)

        if (error) throw error

        showToast('Lead assigned successfully', 'success')
        return true

    } catch (error) {
        console.error('Assignment error:', error)
        showToast(`Failed to assign: ${error.message}`, 'error')
        return false
    }
}

/**
 * Get current user from session
 */
function getCurrentUser() {
    const session = JSON.parse(localStorage.getItem('salesAppSession') || '{}')
    return session
}

/**
 * Configure Make.com webhooks
 */
function configureMakeWebhooks(fetchUrl, updateUrl, assignUrl) {
    MAKE_WEBHOOKS.fetchLeads = fetchUrl
    MAKE_WEBHOOKS.updateLead = updateUrl
    MAKE_WEBHOOKS.assignLead = assignUrl

    // Save to localStorage for persistence
    localStorage.setItem('makeWebhooks', JSON.stringify(MAKE_WEBHOOKS))

    console.log('Make.com webhooks configured:', MAKE_WEBHOOKS)
}

// Load saved webhooks on page load
(function loadMakeWebhooks() {
    const saved = localStorage.getItem('makeWebhooks')
    if (saved) {
        const webhooks = JSON.parse(saved)
        Object.assign(MAKE_WEBHOOKS, webhooks)
        console.log('Loaded Make.com webhooks from storage')
    }
})()
