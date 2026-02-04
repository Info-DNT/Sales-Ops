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
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Empty body' }) };
        }

        const payload = JSON.parse(event.body);

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service Role Key Missing' }) };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Map Zoho Fields
        const leadData = {
            name: payload.Name || payload.Last_Name || 'Unknown Lead',
            email: payload.Email || '',
            contact: payload.Phone || '',
            status: 'New',
            source: 'crm',
            lead_source: payload.Lead_Source || 'Zoho CRM',
            account_name: payload.Company || 'N/A',
            created_at: new Date().toISOString()
        };

        // Try to assign to an admin if possible
        try {
            const { data: users } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
            if (users && users.length > 0) {
                leadData.user_id = users[0].id;
            }
        } catch (e) {
            console.log('User assignment skipped');
        }

        // Insert
        const { data, error } = await supabase.from('leads').insert(leadData).select();

        if (error) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: error.message, code: error.code })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Lead Received', lead_id: data[0]?.id })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
