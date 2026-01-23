/**
 * Zoho CRM Integration
 * Handles bi-directional sync between app and Zoho CRM
 */

// Zoho Flow Webhook URLs
// These will be configured after creating flows in Zoho Flow
const ZOHO_WEBHOOKS = {
    fetchLeads: 'https://flow.zoho.in/60058359930/flow/webhook/incoming?zapikey=1001.f48987ca0423bfb479496cfdba9451d1.7ff7e7f752debd8ebba83209c11544d9&isdebug=false', // ✅ Flow 1: Fetch Leads
    updateLead: 'https://flow.zoho.in/60058359930/flow/webhook/incoming?zapikey=1001.488751e647a5a09c7f1bf8f62ab55a3e.2ace7dac95fab5246e87808e8940ecef&isdebug=false', // ✅ Flow 2: Update Lead
    assignLead: 'https://flow.zoho.in/60058359930/flow/webhook/incoming?zapikey=1001.dc18940a48cc645f6cb40ec749f495cc.348be6a2e7e6615425e50f05c0cb660e&isdebug=false'  // ✅ Flow 3: Assign Lead
}

/**
 * Sync CRM Leads from Zoho
 * Called when admin clicks "Sync CRM" button
 */
async function syncCRMLeads() {
    try {
        if (!ZOHO_WEBHOOKS.fetchLeads) {
            showToast('Zoho Flow webhook not configured', 'error')
            return
        }

        showToast('Fetching leads from Zoho CRM...', 'info')

        // 1. Fetch ALL leads from Zoho via Netlify proxy function
        const response = await fetch('/.netlify/functions/zoho-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhookUrl: ZOHO_WEBHOOKS.fetchLeads
            })
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.success || !data.leads) {
            throw new Error('Invalid response from Zoho Flow')
        }

        console.log(`Fetched ${data.leads.length} leads from Zoho CRM`)

        // 2. Get existing lead IDs from registry (duplicate prevention)
        const existingIDs = await getExistingCRMLeadIDs()

        // 3. Process and transform leads
        const crmLeads = []
        const newLeadIDs = []

        for (const zohoLead of data.leads) {
            const isNew = !existingIDs.includes(zohoLead.id)

            // Transform Zoho lead format to app format
            const lead = {
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
                app_assigned_to: zohoLead.App_Assigned_To || '',
                source: 'crm',
                isNew: isNew
            }

            crmLeads.push(lead)

            if (isNew) {
                newLeadIDs.push(zohoLead.id)
            }
        }

        // 4. Register new leads in Supabase (for duplicate tracking)
        if (newLeadIDs.length > 0) {
            await registerNewCRMLeads(newLeadIDs)
            console.log(`Registered ${newLeadIDs.length} new CRM leads`)
        }

        // 5. Return result object
        return {
            success: true,
            totalLeads: totalCount,
            newLeads: newCount,
            leads: crmLeads
        }

    } catch (error) {
        console.error('Sync error:', error)
        showToast(`Failed to sync: ${error.message}`, 'error')
        return {
            success: false,
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
        if (!ZOHO_WEBHOOKS.fetchLeads) {
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

        // 2. Fetch fresh data from Zoho
        const response = await fetch(ZOHO_WEBHOOKS.fetchLeads)
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
        if (!ZOHO_WEBHOOKS.updateLead) {
            showToast('Zoho Flow webhook not configured', 'error')
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

        const response = await fetch(ZOHO_WEBHOOKS.updateLead, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            throw new Error(`Update failed: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('Zoho update successful:', result)
        return true

    } catch (error) {
        console.error('Error updating Zoho lead:', error)
        throw error
    }
}

/**
 * Assign CRM lead to user
 * Updates App_Assigned_To field in Zoho (NOT Lead Owner)
 */
async function assignCRMLeadToUser(zohoLeadId, userId, userEmail) {
    try {
        if (!ZOHO_WEBHOOKS.assignLead) {
            showToast('Zoho Flow webhook not configured', 'error')
            return false
        }

        showToast('Assigning lead...', 'info')

        // 1. Update App_Assigned_To field in Zoho via webhook
        const payload = {
            zoho_lead_id: zohoLeadId,
            app_assigned_to: userEmail,
            assigned_by: getCurrentUser().email,
            timestamp: new Date().toISOString()
        }

        const response = await fetch(ZOHO_WEBHOOKS.assignLead, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
 * Configure Zoho webhooks
 * Call this after creating flows in Zoho Flow
 */
function configureZohoWebhooks(fetchUrl, updateUrl, assignUrl) {
    ZOHO_WEBHOOKS.fetchLeads = fetchUrl
    ZOHO_WEBHOOKS.updateLead = updateUrl
    ZOHO_WEBHOOKS.assignLead = assignUrl

    // Save to localStorage for persistence
    localStorage.setItem('zohoWebhooks', JSON.stringify(ZOHO_WEBHOOKS))

    console.log('Zoho webhooks configured:', ZOHO_WEBHOOKS)
}

// Load saved webhooks on page load
(function loadZohoWebhooks() {
    const saved = localStorage.getItem('zohoWebhooks')
    if (saved) {
        const webhooks = JSON.parse(saved)
        Object.assign(ZOHO_WEBHOOKS, webhooks)
        console.log('Loaded Zoho webhooks from storage')
    }
})()
