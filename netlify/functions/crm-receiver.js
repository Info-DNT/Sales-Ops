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

        // 1. Capture Data from ALL possible sources
        let queryParams = event.queryStringParameters || {};
        let bodyParams = {};

        if (event.body) {
            if (contentType.includes('application/x-www-form-urlencoded')) {
                bodyParams = querystring.parse(event.body);
            } else {
                try {
                    bodyParams = JSON.parse(event.body);
                } catch (e) {
                    console.log('Body parse failed, trying form-urlencoded anyway');
                    bodyParams = querystring.parse(event.body);
                }
            }
        }

        // Merge sources (Zoho "Body: None" sends data in QueryParams)
        const payload = { ...bodyParams, ...queryParams };

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 2. Identify a valid User ID (Mandatory for foreign key constraints)
        let defaultUserId = null;
        try {
            const { data: users } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
            if (users && users.length > 0) {
                defaultUserId = users[0].id;
            }
        } catch (e) {
            console.error('Admin lookup error');
        }

        // 3. Map with Mandatory Defaults (Matches createLead schema exactly)
        const leadData = {
            user_id: defaultUserId,
            name: payload.Name || payload.Last_Name || payload.name || 'CRM Lead',
            email: payload.Email || payload.email || '',
            contact: payload.Phone || payload.phone || payload.Mobile || '',
            owner: 'Super Admin',
            status: 'New',
            source: 'crm',
            lead_source: payload.Lead_Source || 'Zoho CRM',
            account_name: payload.Company || payload.Account_Name || 'N/A',
            next_action: 'Initial Outreach', // Mandatory column
            created_at: new Date().toISOString()
        };

        // 4. Final Insert (Strict Mode)
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();

        if (error) {
            console.error('Database rejection:', error);
            return {
                statusCode: 400, // Show failure in Zoho logs
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                    code: error.code,
                    details: error.details,
                    received_keys: Object.keys(payload)
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Success: Lead Recorded', id: data[0]?.id })
        };

    } catch (err) {
        console.error('Crash:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};
