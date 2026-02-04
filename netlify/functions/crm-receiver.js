const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase from environment variables
const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const payload = JSON.parse(event.body);
        console.log('Incoming Zoho Payload:', JSON.stringify(payload, null, 2));

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Try to find a default Admin user
        let defaultUserId = null;
        try {
            const { data: adminUsers } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin')
                .limit(1);
            if (adminUsers && adminUsers.length > 0) {
                defaultUserId = adminUsers[0].id;
            }
        } catch (e) {
            console.log('Admin lookup skipped');
        }

        // 2. Map Zoho fields (ID, Name, Phone, Email, Company)
        const leadData = {
            name: payload.Name || payload.Last_Name || 'Unknown CRM Lead',
            email: payload.Email || payload.email || '',
            contact: payload.Phone || payload.phone || payload.Mobile || '',
            status: 'New',
            source: 'crm',
            lead_source: payload.Lead_Source || 'Zoho CRM',
            account_name: payload.Company || 'N/A',
            user_id: defaultUserId,
            created_at: new Date().toISOString()
        };

        console.log('Final Lead Object:', JSON.stringify(leadData, null, 2));

        // 3. Insert into database
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();

        if (error) {
            console.error('Supabase DB Error:', error);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: error.message })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Lead added', data })
        };
    } catch (error) {
        console.error('Execution Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
