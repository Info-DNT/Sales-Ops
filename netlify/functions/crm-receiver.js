const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
    const headers = { 'Content-Type': 'application/json' };

    try {
        // Log environment check
        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'SERVICE_ROLE_KEY_MISSING' }) };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Minimum possible data to avoid constraints
        const testName = 'Zoho Test ' + new Date().getTime();

        const { data, error } = await supabase
            .from('leads')
            .insert({ name: testName })
            .select();

        if (error) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    stage: 'Database Insert',
                    error: error.message,
                    code: error.code
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Lead Saved',
                lead_id: data[0]?.id,
                received_event_keys: Object.keys(event)
            })
        };

    } catch (err) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                stage: 'Crash',
                error: err.message
            })
        };
    }
};
