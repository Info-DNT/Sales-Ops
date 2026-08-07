const fetch = require('node-fetch');

// =============================================
// ZOHO CRM CONFIGURATION
// =============================================
const ZOHO_API_BASE = {
    'com': 'https://www.zohoapis.com',
    'eu': 'https://www.zohoapis.eu',
    'in': 'https://www.zohoapis.in',
    'au': 'https://www.zohoapis.com.au'
};

const ZOHO_ACCOUNTS_BASE = {
    'com': 'https://accounts.zoho.com',
    'eu': 'https://accounts.zoho.eu',
    'in': 'https://accounts.zoho.in',
    'au': 'https://accounts.zoho.com.au'
};

// =============================================
// ZOHO AUTH HELPERS
// =============================================
async function getZohoAccessToken() {
    const region = process.env.ZOHO_REGION || 'in';
    const accountsUrl = ZOHO_ACCOUNTS_BASE[region];

    const params = new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
    });

    try {
        const response = await fetch(`${accountsUrl}/oauth/v2/token?${params}`, {
            method: 'POST'
        });
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Zoho Token Error:', error);
        throw error;
    }
}

async function updateZohoLead(zohoLeadId, quotationId) {
    const accessToken = await getZohoAccessToken();
    const region = process.env.ZOHO_REGION || 'in';
    const apiUrl = ZOHO_API_BASE[region];

    try {
        const response = await fetch(`${apiUrl}/crm/v3/Leads/${zohoLeadId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: [{
                    Quotation_ID: quotationId // Field confirmed by user
                }]
            })
        });

        const result = await response.json();
        console.log('Zoho Update Result:', JSON.stringify(result));
        return result;
    } catch (error) {
        console.error('Zoho Update Error:', error);
        throw error;
    }
}

// =============================================
// HANDLER
// =============================================
exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    // serialNo2: 6-digit unique ID
    // zohoLeadId: used to push back to CRM
    // phone: fallback lookup method
    const { serialNo2, zohoLeadId, phone } = body;

    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
        console.error('APPS_SCRIPT_URL is not set');
        return { statusCode: 500, body: JSON.stringify({ error: 'Sync service not configured' }) };
    }

    // Normalise lookup keys to digits only. These values are interpolated into a
    // PostgREST .or() filter below; without this, a crafted value could inject
    // extra filter clauses and match rows it should not.
    const cleanSerial = serialNo2 ? String(serialNo2).replace(/[^\d]/g, '') : '';
    const cleanPhone = phone ? String(phone).replace(/[^\d]/g, '') : '';

    try {
        let quo_id = null;
        let queryUrl = `${appsScriptUrl}?`;

        if (cleanSerial) {
            console.log(`🔍 Syncing by Serial No. 2: ${cleanSerial}`);
            queryUrl += `action=getQuotationBySerial&serialNo2=${encodeURIComponent(cleanSerial)}`;
        } else if (cleanPhone) {
            console.log(`🔍 Syncing by Phone: ${cleanPhone}`);
            queryUrl += `phone=${encodeURIComponent(cleanPhone)}`;
        } else {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing lookup criteria (Serial No. 2 or Phone)' }) };
        }

        const response = await fetch(queryUrl);
        const data = await response.json();

        if (data.error || !data.quo_id) {
            console.warn('❌ Quotation not found in Sheets');
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Quotation not yet generated in Google Sheet' 
                })
            };
        }

        quo_id = data.quo_id;
        console.log(`✅ Found Quotation ID in Sheets: ${quo_id}`);

        // --- UPDATE SUPABASE ---
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // Match with separate .eq() calls rather than one .or() string.
        //
        // .eq() values are sent as parameters, so no sanitising is needed and
        // the RAW phone can be used — important, because `contact` is NOT stored
        // digits-only (leads carry values like "+91 98765 43210"), so matching
        // on the stripped form would silently stop finding rows.
        const updateBoth = async (table, column, value) => {
            if (!value) return [];
            const { data, error } = await supabase
                .from(table)
                .update({ quotation_id: quo_id })
                .eq(column, value)
                .select();
            if (error) {
                console.error(`${table}.${column} update error:`, error.message);
                return [];
            }
            return data || [];
        };

        const leadUpdate = [
            ...await updateBoth('leads', 'serial_no_2', cleanSerial),
            ...await updateBoth('leads', 'contact', phone)
        ];
        if (leadUpdate.length > 0) {
            console.log(`✅ Updated Supabase Lead(s) with Quo ID: ${quo_id}`);
        }

        const caseUpdate = [
            ...await updateBoth('cases', 'serial_no_2', cleanSerial),
            ...await updateBoth('cases', 'contact', phone)
        ];
        if (caseUpdate.length > 0) {
            console.log(`✅ Updated Supabase Case(s) with Quo ID: ${quo_id}`);
        }

        // --- PUSH TO ZOHO CRM IF REQUESTED ---
        let crmUpdated = false;
        if (zohoLeadId && quo_id) {
            console.log(`🚀 Pushing Quotation ID to Zoho Lead: ${zohoLeadId}`);
            await updateZohoLead(zohoLeadId, quo_id);
            crmUpdated = true;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                quo_id: quo_id,
                crmUpdated: crmUpdated,
                supabaseUpdated: (leadUpdate?.length > 0 || caseUpdate?.length > 0)
            })
        };

    } catch (err) {
        console.error('Final Sync Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal sync error', detail: err.message })
        };
    }
};
