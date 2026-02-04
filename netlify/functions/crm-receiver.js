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

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const contentType = event.headers['content-type'] || '';
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

        const payload = { ...bodyParams, ...queryParams };

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const leadData = {
            name: payload.Name || payload.Last_Name || 'Unknown Zoho Lead',
            email: payload.Email || '',
            contact: payload.Phone || payload.Mobile || '',
            status: 'New',
            source: 'crm',
            lead_source: payload.Lead_Source || 'Zoho CRM',
            account_name: payload.Company || 'N/A',
            created_at: new Date().toISOString()
        };

        // Get default admin
        try {
            const { data: users } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
            if (users && users.length > 0) {
                leadData.user_id = users[0].id;
            }
        } catch (e) { }

        const { data, error } = await supabase.from('leads').insert(leadData).select();

        if (error) {
            // RETURNING 200 SO ZOHO WILL SHOW THIS BODY
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    debug: true,
                    message: error.message,
                    code: error.code,
                    hint: error.hint,
                    details: error.details,
                    received_payload: payload,
                    mapped_data: leadData
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Success', id: data[0]?.id })
        };

    } catch (err) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: false, error: err.message, stack: err.stack })
        };
    }
};
