const { createClient } = require('@supabase/supabase-js');
const querystring = require('querystring');

const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ===================================================================
// Confirmed columns in the leads table (from supabase-client.js):
// user_id, name, contact, email, owner, status, follow_up_date,
// next_action, expected_close, lead_source, field,
// patient_name, client_relation, source_location, destination_location,
// zoho_lead_id, created_at, is_converted
//
// NOT in the leads table (excluded from this function):
// account_name, lead_date, service_opt, transport
// ===================================================================

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Service configuration error' })
            };
        }

        // ─── Parse payload (query params + body) ───────────────────
        const contentType = event.headers['content-type'] || '';
        const queryParams = event.queryStringParameters || {};
        let bodyParams = {};

        if (event.body) {
            try {
                bodyParams = JSON.parse(event.body);
            } catch {
                try { bodyParams = querystring.parse(event.body); } catch { /* ignore */ }
            }
        }

        const payload = { ...bodyParams, ...queryParams };
        console.log('crm-receiver payload:', JSON.stringify(payload));

        // ─── Extract Zoho Lead ID ────────────────────────────────────
        // Zoho Flow sends it as "Lead ID" key (with a space, URL-encoded)
        const zohoLeadId = payload['Lead ID'] || payload['Lead_ID'] || payload.id || payload.Lead_Id || null;

        if (!zohoLeadId) {
            console.error('No zoho_lead_id. Keys received:', Object.keys(payload));
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing Lead ID in payload' })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // ─── Match existing lead ──────────────────────────────────────
        // Priority 1: zoho_lead_id exact match
        let existingLead = null;
        const { data: byZohoId, error: zohoLookupErr } = await supabase
            .from('leads')
            .select('id, user_id')
            .eq('zoho_lead_id', String(zohoLeadId))
            .maybeSingle();

        if (zohoLookupErr) console.error('zoho_lead_id lookup error:', zohoLookupErr);
        existingLead = byZohoId;

        // Priority 2: email fallback
        const email = payload.Email || '';
        const phone  = payload.Phone || payload.Mobile || '';

        if (!existingLead && email) {
            const { data: byEmail, error: emailErr } = await supabase
                .from('leads')
                .select('id, user_id')
                .eq('email', email)
                .maybeSingle();
            if (emailErr) console.error('email lookup error:', emailErr);
            existingLead = byEmail;
        }

        // Priority 3: phone fallback
        if (!existingLead && phone) {
            const { data: byPhone, error: phoneErr } = await supabase
                .from('leads')
                .select('id, user_id')
                .eq('contact', phone)
                .maybeSingle();
            if (phoneErr) console.error('phone lookup error:', phoneErr);
            existingLead = byPhone;
        }

        const isUpdate = !!existingLead;
        console.log(isUpdate
            ? `ACTION: UPDATE lead id=${existingLead.id} (zoho_id=${zohoLeadId})`
            : `ACTION: INSERT new lead (zoho_id=${zohoLeadId})`
        );

        // ─── Build lead data (ONLY confirmed columns) ────────────────
        const leadData = {
            zoho_lead_id:   String(zohoLeadId),
            name:           payload.Name || payload.Last_Name || payload.Full_Name || 'CRM Lead',
            contact:        phone,
            email:          email,
            status:         payload.Lead_Status || payload.Status || 'New',
            next_action:    payload.Next_Action || payload['Next Action'] || '',
            follow_up_date: payload.Follow_Up_Date || payload['Follow-up Date'] || null,
            expected_close: payload.Expected_Close || payload['Expected Close'] || null,
            field:          payload.Field || payload.field || null,
            lead_source:    payload.Lead_Source || payload.Source || 'Zoho CRM',
        };

        // ─── Execute DB operation ────────────────────────────────────
        let data, error;

        if (isUpdate) {
            ({ data, error } = await supabase
                .from('leads')
                .update(leadData)
                .eq('id', existingLead.id)
                .select());
        } else {
            // Get admin user for assignment
            let defaultUserId = null;
            const { data: admins } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin')
                .limit(1);
            if (admins?.length > 0) defaultUserId = admins[0].id;

            leadData.user_id = defaultUserId;
            leadData.owner   = 'Super Admin';

            ({ data, error } = await supabase
                .from('leads')
                .insert(leadData)
                .select());
        }

        if (error) {
            // Log full error details so they appear in Netlify function logs
            console.error('DB ERROR code:', error.code);
            console.error('DB ERROR message:', error.message);
            console.error('DB ERROR details:', error.details);
            console.error('DB ERROR hint:', error.hint);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                    code:   error.code,
                    hint:   error.hint
                })
            };
        }

        console.log('DB SUCCESS:', isUpdate ? 'updated' : 'inserted', 'lead id:', data[0]?.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success:      true,
                message:      isUpdate ? 'Lead updated from Zoho' : 'Lead created from Zoho',
                lead_id:      data[0]?.id,
                zoho_lead_id: zohoLeadId,
                action:       isUpdate ? 'update' : 'insert'
            })
        };

    } catch (err) {
        console.error('UNCAUGHT ERROR:', err.message, err.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};
