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
                body: JSON.stringify({ success: false, error: 'Service configuration error' })
            };
        }

        // Parse data from BOTH query parameters and body
        const contentType = event.headers['content-type'] || '';
        let queryParams = event.queryStringParameters || {};
        let bodyParams = {};

        if (event.body) {
            if (contentType.includes('application/x-www-form-urlencoded')) {
                bodyParams = querystring.parse(event.body);
            } else if (contentType.includes('application/json')) {
                try {
                    bodyParams = JSON.parse(event.body);
                } catch (e) {
                    // Ignore parse errors, try form-urlencoded
                    bodyParams = querystring.parse(event.body);
                }
            }
        }

        // Merge sources (query params take precedence)
        const payload = { ...bodyParams, ...queryParams };

        // Initialize Supabase with Service Role Key (bypasses RLS)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Find default admin user for assignment
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

        // DEBUG: Log the incoming payload to see what Zoho is sending
        console.log('Received payload from Zoho:', JSON.stringify(payload, null, 2));

        // Map Zoho fields to database schema
        // Match exact schema from zoho-crm-integration.sql + create-calls-meetings-tables.sql
        const leadData = {
            user_id: defaultUserId,
            name: payload.Name || payload.Last_Name || 'CRM Lead',
            contact: payload.Phone || payload.Mobile || '',
            email: payload.Email || '',
            owner: 'Super Admin',
            status: 'New',
            account_name: payload.Company || payload.Account_Name || '',
            next_action: 'Follow up',
            follow_up_date: null,
            expected_close: null,
            field: null,
            lead_source: payload.Lead_Source || 'Zoho CRM',
            lead_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
            created_at: new Date().toISOString()
        };

        // Insert into database (Service Role Key bypasses RLS)
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();

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
                message: 'Lead created successfully',
                lead_id: data[0]?.id
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
