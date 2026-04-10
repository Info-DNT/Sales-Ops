const fetch = require('node-fetch');

// =============================================
// GOOGLE SHEET SYNC — Netlify Function
// Fetches the Quotation ID (quo_id) from Google Sheets
// using the provided Google Apps Script URL as a proxy.
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

    const { phone, id } = body;
    if (!phone && !id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing phone number or CRM ID' }) };
    }

    // The URL provided by the user
    const appsScriptUrl = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwMRdkENPvgHH-P5RDHhhAr_ieXkMoCU17kqaWBWgnD2OS5wKTEW03fPQ5K18b177x5ww/exec';

    try {
        const cleanPhone = phone ? phone.replace(/[^\d]/g, '') : '';
        
        console.log(`🔍 Syncing quotation for ID: ${id}, Phone: ${cleanPhone}`);

        // Call the Google Apps Script with both ID and Phone
        let queryUrl = `${appsScriptUrl}?`;
        if (id) queryUrl += `id=${id}&`;
        if (cleanPhone) queryUrl += `phone=${cleanPhone}`;

        const response = await fetch(queryUrl);
        const data = await response.json();

        if (data.error) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Quotation not found in Google Sheet' })
            };
        }

        console.log(`✅ Found Quotation ID: ${data.quo_id}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                quo_id: data.quo_id
            })
        };

    } catch (err) {
        console.error('Apps Script Sync Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to sync with Google Sheets', detail: err.message })
        };
    }
};
