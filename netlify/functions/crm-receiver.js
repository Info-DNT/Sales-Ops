const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase from environment variables
const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for backend operations

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
        console.log('Received lead from Zoho:', payload);

        // Required fields mapping (matched to your Zoho Webhook screenshot)
        const leadData = {
            id: payload.ID || payload.id || undefined, // Supabase PK or Zoho ID
            name: payload.Name || payload.Last_Name || 'Unknown',
            email: payload.Email || payload.email || '',
            contact: payload.Phone || payload.phone || payload.Mobile || '',
            status: 'New',
            source: 'crm', // Matches the UI class 'crm-lead'
            lead_source: payload.Lead_Source || 'Zoho CRM', // Matches DB column
            created_at: new Date().toISOString()
        };

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Simple insert for the test (more robust against schema differences)
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();

        if (error) throw error;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Lead processed', data })
        };
    } catch (error) {
        console.error('Error processing Zoho lead:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
