const { createClient } = require('@supabase/supabase-js');
const querystring = require('querystring');

const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const contentType = event.headers['content-type'] || '';

        // 1. Parse Data from BOTH Body and Query Parameters
        let queryParams = event.queryStringParameters || {};
        let bodyParams = {};

        if (event.body) {
            if (contentType.includes('application/x-www-form-urlencoded')) {
                bodyParams = querystring.parse(event.body);
            } else {
                try {
                    bodyParams = JSON.parse(event.body);
                } catch (e) {
                    console.error('Body parse error:', e.message);
                }
            }
        }

        // Merge sources (Query params override body if same name exists, usually Zoho sends one or the other)
        const payload = { ...bodyParams, ...queryParams };
        console.log('Final Merged Payload:', JSON.stringify(payload, null, 2));

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 2. Map mapped fields from Zoho (based on user's Webhook screenshot)
        // Note: Map parameters correctly (Name, Email, Phone, ID)
        const leadData = {
            name: payload.Name || payload.Last_Name || 'Unknown CRM Lead',
            email: payload.Email || payload.email || '',
            contact: payload.Phone || payload.phone || payload.Mobile || '',
            status: 'New',
            source: 'crm',
            lead_source: payload.Lead_Source || 'Zoho CRM',
            account_name: payload.Company || payload.Account_Name || 'N/A',
            created_at: new Date().toISOString()
        };

        // 3. Find default admin for assignment
        try {
            const { data: users } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
            if (users && users.length > 0) {
                leadData.user_id = users[0].id;
                leadData.owner = 'Super Admin';
            }
        } catch (e) {
            console.warn('Admin lookup failed');
        }

        // 4. Insert into DB
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();

        if (error) {
            // Return 400 so Zoho shows failure and the Body below
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: error.message,
                    code: error.code,
                    hint: error.hint,
                    details: error.details,
                    received_keys: Object.keys(payload)
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Lead added', id: data[0]?.id })
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};
