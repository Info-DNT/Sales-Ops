// =====================================================
// CRM UPDATER: Web App → Zoho CRM Sync
// =====================================================
// This function syncs lead updates from the web app back to Zoho CRM

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

// In-memory cache for access token (survives for function lifetime)
let cachedAccessToken = null;
let tokenExpiryTime = null;

/**
 * Get a fresh access token using the refresh token
 */
async function getAccessToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime - 300000) {
        return cachedAccessToken;
    }

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

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.access_token) {
            cachedAccessToken = data.access_token;
            // Tokens typically expire in 1 hour (3600 seconds)
            tokenExpiryTime = Date.now() + (data.expires_in || 3600) * 1000;
            return cachedAccessToken;
        } else {
            throw new Error('No access token in response');
        }
    } catch (error) {
        console.error('Failed to get access token:', error);
        throw error;
    }
}

/**
 * Map web app status to Zoho Lead_Status
 */
function mapStatus(appStatus) {
    const statusMap = {
        'New': 'Contacted',
        'In Progress': 'Contacted',
        'Qualified': 'Qualified',
        'Closed': 'Converted',
        'Not Converted': 'Junk Lead'
    };
    return statusMap[appStatus] || 'Contacted';
}

/**
 * Update a lead in Zoho CRM
 */
async function updateLeadInZoho(zohoLeadId, updates) {
    const accessToken = await getAccessToken();
    const region = process.env.ZOHO_REGION || 'in';
    const apiUrl = ZOHO_API_BASE[region];

    // Map web app fields to Zoho fields
    const zohoData = {
        data: [{
            id: zohoLeadId
        }]
    };

    // Only include fields that were actually updated
    if (updates.name) zohoData.data[0].Last_Name = updates.name;
    if (updates.email) zohoData.data[0].Email = updates.email;
    if (updates.contact) zohoData.data[0].Phone = updates.contact;
    if (updates.status) zohoData.data[0].Lead_Status = mapStatus(updates.status);
    if (updates.account_name) zohoData.data[0].Company = updates.account_name;

    // Add next_action to description if provided
    if (updates.next_action) {
        zohoData.data[0].Description = updates.next_action;
    }

    try {
        const response = await fetch(`${apiUrl}/crm/v2/Leads`, {
            method: 'PUT',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(zohoData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Failed to update lead in Zoho:', error);
        throw error;
    }
}

/**
 * Main handler
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Validate environment variables
        if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
            console.warn('Zoho credentials not configured - skipping CRM sync');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'CRM sync skipped (credentials not configured)'
                })
            };
        }

        // Parse request
        const payload = JSON.parse(event.body || '{}');
        const { zohoLeadId, updates } = payload;

        if (!zohoLeadId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing zohoLeadId'
                })
            };
        }

        // Update lead in Zoho
        const result = await updateLeadInZoho(zohoLeadId, updates);

        console.log('Lead synced to Zoho:', zohoLeadId, result);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Lead updated in Zoho CRM',
                zohoResponse: result
            })
        };

    } catch (error) {
        console.error('CRM updater error:', error);

        // Don't fail the request if CRM sync fails (graceful degradation)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                message: 'Local update succeeded, but CRM sync failed'
            })
        };
    }
};
