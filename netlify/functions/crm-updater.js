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
        'New': 'New',
        'In Progress': 'Contacted',
        'Qualified': 'Qualified',
        'Closed': 'Converted',
        'Not Converted': 'Junk Lead'
    };
    return statusMap[appStatus] || 'New';
}

/**
 * Create or Update a lead in Zoho CRM
 */
async function syncLeadToZoho(updates, zohoLeadId = null) {
    const accessToken = await getAccessToken();
    const region = process.env.ZOHO_REGION || 'in';
    const apiUrl = ZOHO_API_BASE[region];

    // Map web app fields to Zoho fields
    const leadData = {};

    if (updates.name) leadData.Last_Name = updates.name;
    if (updates.email) leadData.Email = updates.email;
    if (updates.contact) leadData.Phone = updates.contact;
    if (updates.status) leadData.Lead_Status = mapStatus(updates.status);
    if (updates.account_name) leadData.Company = updates.account_name;

    // Additional fields with fallbacks
    if (updates.assignedTo) {
        leadData.App_Assigned_To = updates.assignedTo;
        leadData['App Assigned To'] = updates.assignedTo;
    }

    if (updates.expectedClose) {
        leadData.Expected_Close = updates.expectedClose;
        leadData['Expected Close'] = updates.expectedClose;
    }

    if (updates.followUpDate) {
        leadData.Follow_Up_Date = updates.followUpDate;
        leadData.Follow_up_Date = updates.followUpDate;
        leadData['Follow-up Date'] = updates.followUpDate;
    }

    if (updates.next_action) {
        leadData.Description = updates.next_action;
        leadData.Next_Action = updates.next_action;
        leadData['Next Action'] = updates.next_action;
    }

    // Set source for new leads
    if (!zohoLeadId) {
        leadData.Lead_Source = 'Web App';
        leadData['Lead Source'] = 'Web App';
        // New leads must have a Company in Zoho, fallback to name or "Web App"
        if (!leadData.Company) leadData.Company = updates.name || 'Web App';
    } else {
        leadData.id = zohoLeadId;
    }

    const zohoPayload = { data: [leadData] };

    try {
        const method = zohoLeadId ? 'PUT' : 'POST';
        console.log(`Syncing to Zoho (${method}):`, JSON.stringify(zohoPayload));

        const response = await fetch(`${apiUrl}/crm/v2/Leads`, {
            method: method,
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(zohoPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Failed to sync lead to Zoho:', error);
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

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
            console.warn('Zoho credentials not configured');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'CRM sync skipped' })
            };
        }

        const payload = JSON.parse(event.body || '{}');
        const { zohoLeadId, updates } = payload;

        if (!updates) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing updates object' })
            };
        }

        const result = await syncLeadToZoho(updates, zohoLeadId);

        // Extract the Zoho ID from response
        let returnedZohoId = zohoLeadId;
        if (!zohoLeadId && result.data && result.data[0] && result.data[0].details) {
            returnedZohoId = result.data[0].details.id;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: zohoLeadId ? 'Lead updated in Zoho' : 'Lead created in Zoho',
                zohoLeadId: returnedZohoId,
                zohoResponse: result
            })
        };

    } catch (error) {
        console.error('CRM sync error:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                message: 'Local operation succeeded, but CRM sync failed'
            })
        };
    }
};
