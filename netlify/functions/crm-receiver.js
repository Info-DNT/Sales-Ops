const { createClient } = require('@supabase/supabase-js');

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
        const payload = JSON.parse(event.body || '{}');

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 200, // We return 200 so Zoho shows this body
                headers,
                body: JSON.stringify({ debug_error: 'SUPABASE_SERVICE_ROLE_KEY is missing in Netlify settings' })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Map data - Minimal set for testing
        const leadData = {
            name: payload.Name || payload.Last_Name || 'Test Lead',
            email: payload.Email || '',
            contact: payload.Phone || '',
            status: 'New',
            source: 'crm',
            lead_source: 'Zoho CRM',
            account_name: payload.Company || 'N/A',
            created_at: new Date().toISOString()
        };

        // Attempt insert
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();

        if (error) {
            return {
                statusCode: 200, // Return 200 even on error for debugging
                headers,
                body: JSON.stringify({
                    debug_mode: true,
                    status: 'Database Error',
                    message: error.message,
                    code: error.code,
                    hint: error.hint,
                    details: error.details,
                    received_payload: payload
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Debug: Lead added', data })
        };

    } catch (error) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                debug_mode: true,
                status: 'Function Crash',
                error: error.message,
                stack: error.stack
            })
        };
    }
};
