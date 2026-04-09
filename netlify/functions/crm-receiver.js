const { createClient } = require('@supabase/supabase-js');
const querystring = require('querystring');

const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        // Validate Service Role Key
        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Service configuration error: SUPABASE_SERVICE_ROLE_KEY missing' })
            };
        }

        // Parse data from BOTH query parameters and body
        const contentType = event.headers['content-type'] || '';
        let queryParams = event.queryStringParameters || {};
        let bodyParams = {};

        if (event.body) {
            if (contentType.includes('application/x-www-form-urlencoded')) {
                bodyParams = querystring.parse(event.body);
            } else {
                // Try JSON first, fallback to form-urlencoded
                try {
                    bodyParams = JSON.parse(event.body);
                } catch (e) {
                    bodyParams = querystring.parse(event.body);
                }
            }
        }

        // Merge sources (body params first, query params override)
        const payload = { ...bodyParams, ...queryParams };

        // DEBUG: Log the incoming payload to see what Zoho Flow is sending
        console.log('Received payload from Zoho Flow:', JSON.stringify(payload, null, 2));

        // Initialize Supabase with Service Role Key (bypasses RLS)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Extract Zoho Lead ID — required to determine INSERT vs UPDATE
        const zohoLeadId = payload['Lead ID'] || payload.id || payload.Lead_Id || payload.zoho_id || null;

        if (!zohoLeadId) {
            console.warn('No zoho_lead_id found. Payload keys:', Object.keys(payload));
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing Lead ID in Zoho payload. Ensure Zoho Flow sends the Lead ID field.'
                })
            };
        }

        // Find default admin user for new lead assignment
        let defaultUserId = null;
        try {
            const { data: users } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin')
                .limit(1);

            if (users && users.length > 0) {
                defaultUserId = users[0].id;
            }
        } catch (e) {
            console.error('Admin lookup failed:', e);
        }

        // Step 1: Try to find existing lead by zoho_lead_id
        let existingLead = null;
        const { data: byZohoId } = await supabase
            .from('leads')
            .select('id, user_id')
            .eq('zoho_lead_id', String(zohoLeadId))
            .maybeSingle();

        existingLead = byZohoId;

        // Step 2: If not found by zoho_lead_id, fallback to matching by email or phone
        if (!existingLead) {
            const email = payload.Email || '';
            const phone = payload.Phone || payload.Mobile || '';

            if (email) {
                const { data: byEmail } = await supabase
                    .from('leads')
                    .select('id, user_id')
                    .eq('email', email)
                    .maybeSingle();
                existingLead = byEmail;
            }

            if (!existingLead && phone) {
                const { data: byPhone } = await supabase
                    .from('leads')
                    .select('id, user_id')
                    .eq('contact', phone)
                    .maybeSingle();
                existingLead = byPhone;
            }
        }

        const isUpdate = !!existingLead;
        console.log(isUpdate
            ? `UPDATE: Found existing lead for zoho_id ${zohoLeadId}`
            : `INSERT: New lead for zoho_id ${zohoLeadId}`
        );

        // Map Zoho fields to database schema
        const leadData = {
            zoho_lead_id: String(zohoLeadId),
            name: payload.Name || payload.Last_Name || payload.Full_Name || 'CRM Lead',
            contact: payload.Phone || payload.Mobile || '',
            email: payload.Email || '',
            status: payload.Lead_Status || payload.Status || 'New',
            account_name: payload.Company || payload.Account_Name || '',
            next_action: payload.Next_Action || payload['Next Action'] || '',
            follow_up_date: payload.Follow_Up_Date || payload['Follow-up Date'] || null,
            expected_close: payload.Expected_Close || payload['Expected Close'] || null,
            field: payload.Field || payload.field || null,
            lead_source: payload.Lead_Source || payload.Source || 'Zoho CRM',
            service_opt: payload.Service_Opt || payload['Service Opt'] || null,
            transport: payload.Transport || null,
        };

        let data, error;

        if (isUpdate) {
            // UPDATE existing lead — preserve user_id and other local-only fields
            // Also ensures zoho_lead_id is saved back if this was matched by email/phone fallback
            ({ data, error } = await supabase
                .from('leads')
                .update(leadData)
                .eq('id', existingLead.id)
                .select());
        } else {
            // INSERT new lead — assign to admin by default
            leadData.user_id = defaultUserId;
            leadData.owner = 'Super Admin';
            leadData.lead_date = new Date().toISOString().split('T')[0];
            leadData.created_at = new Date().toISOString();

            ({ data, error } = await supabase
                .from('leads')
                .insert(leadData)
                .select());
        }

        if (error) {
            console.error('Database error:', error);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                    code: error.code,
                    hint: error.hint
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: isUpdate ? 'Lead updated from Zoho Flow' : 'Lead created from Zoho Flow',
                lead_id: data[0]?.id,
                zoho_lead_id: zohoLeadId,
                action: isUpdate ? 'update' : 'insert'
            })
        };

    } catch (err) {
        console.error('Function error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: err.message
            })
        };
    }
};
