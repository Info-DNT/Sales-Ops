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

    // Normalize updates to handle both camelCase (frontend) and snake_case (DB)
    const normalized = { ...updates };
    const getVal = (key1, key2) => normalized[key1] !== undefined ? normalized[key1] : normalized[key2];

    if (updates.name) leadData.Last_Name = updates.name;
    if (updates.email) leadData.Email = updates.email;
    if (updates.contact) leadData.Phone = updates.contact;
    if (updates.status) leadData.Lead_Status = mapStatus(updates.status);
    
    // Account Name / Company
    const companyName = getVal('account_name', 'company') || getVal('accountName', 'company');
    if (companyName) leadData.Company = companyName;

    // Follow up and Next Action
    const followUp = getVal('follow_up_date', 'followUpDate');
    if (followUp) {
        leadData.Follow_Up_Date = followUp;
        leadData.Follow_up_Date = followUp;
    }

    const nextAction = getVal('next_action', 'nextAction');
    if (nextAction) {
        leadData.Description = nextAction;
        leadData.Next_Action = nextAction;
    }

    // Extended fields - Mapping to exact Zoho API names from UI
    const patientName = getVal('patient_name', 'patientName');
    if (patientName) {
        leadData.Patient_Name = patientName;
        leadData.Name_of_patient = patientName;
        leadData['Name of patient'] = patientName;
    }

    const clientRelation = getVal('client_relation', 'clientRelation');
    if (clientRelation) {
        leadData.Client_Relation = clientRelation;
        leadData.Relation_with_Patient = clientRelation;
        leadData['Relation with Patient'] = clientRelation;
    }

    const sourceLoc = getVal('source_location', 'sourceLocation');
    if (sourceLoc) {
        leadData.Source_Location = sourceLoc;
        leadData.From_location = sourceLoc;
        leadData['From (location)'] = sourceLoc;
    }

    const destLoc = getVal('destination_location', 'destinationLocation');
    if (destLoc) {
        leadData.Destination_Location = destLoc;
        leadData.To_Location = destLoc;
        leadData['To(Location)'] = destLoc;
    }

    const leadSource = getVal('lead_source', 'leadSource');
    if (leadSource) leadData.Lead_Source = leadSource;

    const field = getVal('field', 'leadField');
    if (field) leadData.Field = field;

    const serial2 = getVal('serial_no_2', 'serialNo2');
    if (serial2) {
        leadData.Serial_No_2 = serial2;
        leadData['Serial No. 2'] = serial2;
    }

    const clientName = getVal('client_name', 'clientName');
    if (clientName) {
        leadData.Client_Name = clientName;
        leadData['Client Name'] = clientName;
    }

    const clientPhone = getVal('client_phone', 'clientPhone');
    if (clientPhone) {
        leadData.Client_phone_num = clientPhone;
        leadData.Client_phone_number = clientPhone;
        leadData['Client phone number'] = clientPhone;
    }

    const clientEmail = getVal('client_email', 'clientEmail');
    if (clientEmail) {
        leadData.Client_Email = clientEmail;
        leadData['Client Email'] = clientEmail;
    }

    const reqBy = getVal('requested_by', 'requestedBy');
    if (reqBy) {
        leadData.Request_By = reqBy;
        leadData['Request By'] = reqBy;
    }

    const reqTo = getVal('requested_to', 'requestedTo');
    if (reqTo) {
        leadData.Request_to = reqTo;
        leadData['Request to'] = reqTo;
    }

    const refHosp = getVal('referring_hospital', 'referringHospital');
    if (refHosp) {
        leadData.Referring_Hospital = refHosp;
        leadData['Referring Hospital'] = refHosp;
    }

    const recHosp = getVal('receiving_hospital', 'receivingHospital');
    if (recHosp) {
        leadData.Receiving_Hospital = recHosp;
        leadData['Receiving Hospital'] = recHosp;
    }

    const quoType = getVal('quotation_type', 'quotationType');
    if (quoType) {
        leadData.Quotation_Type = quoType;
        leadData['Quotation Type'] = quoType;
    }

    // Set source for new leads
    if (!zohoLeadId) {
        if (!leadData.Lead_Source) leadData.Lead_Source = 'Web App';
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
        'Access-Control-Allow-Origin': process.env.APP_DOMAIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // =============================================
    // DUAL-AUTH SECURITY CHECK
    // Accepts either a valid Supabase JWT (from the Web App)
    // OR a pre-shared API Key (from Postman / admin tools)
    // =============================================
    const isAuthenticated = (() => {
        // Path 1: API Key (for Postman & server-to-server calls)
        const apiKey = event.headers['x-api-key'];
        if (apiKey && process.env.CRM_API_KEY && apiKey === process.env.CRM_API_KEY) {
            return true;
        }

        // Path 2: Supabase JWT Bearer token (for Web App users)
        const authHeader = event.headers['authorization'] || event.headers['Authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '').trim();
            // Validate: JWT must be a non-empty string with 3 base64 segments
            if (token && token.split('.').length === 3) {
                return true;
            }
        }

        return false;
    })();

    if (!isAuthenticated) {
        console.warn('Unauthorized request to crm-updater');
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Unauthorized. Provide a valid Authorization token or x-api-key header.'
            })
        };
    }
    // =============================================

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
