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
        let payload = {};
        const contentType = event.headers['content-type'] || '';

        // Handle different content types from Zoho
        if (contentType.includes('application/x-www-form-urlencoded')) {
            payload = querystring.parse(event.body);
        } else {
            try {
                payload = JSON.parse(event.body || '{}');
            } catch (e) {
                payload = { raw_body: event.body, parse_error: e.message };
            }
        }

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 200, // Return 200 so Zoho shows the body
                headers,
                body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Map data with fallback values to avoid NULL constraint violations
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

        // Attempt to find a default admin
        try {
            const { data: users } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
            if (users && users.length > 0) {
                leadData.user_id = users[0].id;
                // many systems use 'owner' too
                leadData.owner = 'Super Admin';
            }
        } catch (e) {
            console.log('User lookup failed');
        }

        // Insert into database
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();

        if (error) {
            // WE RETURN 200 TO SEE THE ERROR IN ZOHO LOGS
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    type: 'Database Error',
                    message: error.message,
                    code: error.code,
                    hint: error.hint,
                    details: error.details,
                    attempted_data: leadData,
                    received_content_type: contentType
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Lead added', lead_id: data[0]?.id })
        };

    } catch (err) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                type: 'Function Crash',
                error: err.message,
                stack: err.stack
            })
        };
    }
};
