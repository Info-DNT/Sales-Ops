// =============================================
// SIGNUP NOTIFICATION — Netlify Function
// Sends New Signup Request details to the Admin
// via WhatsApp using Whapi API.
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

    const { name, phone, email, designation } = body;

    if (!name || !phone || !email) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields: name, phone, email' })
        };
    }

    const whapiToken = process.env.WHAPI_API_TOKEN;
    const adminPhone = "918130035039"; // Updated admin number
    const appsScriptUrl = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzp45h1TXpF-yX3QYarHnHgxCx25-nHOUxrrxkRqyM4hlS2xUaFjVVQ7e97hZQVdIko/exec';
    const apiToken = 'SALES_OPS_2026_SECURE';

    if (!whapiToken) {
        console.error('Missing WHAPI_API_TOKEN env variable');
        return { statusCode: 500, body: JSON.stringify({ error: 'WhatsApp service not configured.' }) };
    }

    // ── 1. Log to Google Sheet (Primary Backup) ──────────────────────
    try {
        const sheetParams = new URLSearchParams({
            action: 'saveSignup',
            token: apiToken,
            name: name,
            phone: phone,
            email: email,
            designation: designation || '—'
        });
        
        await fetch(`${appsScriptUrl}?${sheetParams.toString()}`);
        console.log('✅ Signup logged to Google Sheet');
    } catch (sheetErr) {
        console.error('⚠️ Sheet logging failed (continuing to WhatsApp):', sheetErr);
    }

    // ── 2. Build WhatsApp message text ───────────────────────────────
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const messageText = `🆕 *NEW SIGNUP REQUEST*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Name:* ${name}\n` +
        `📞 *Phone:* ${phone}\n` +
        `📧 *Email:* ${email}\n` +
        `💼 *Designation:* ${designation || '—'}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🕒 *Time:* ${timestamp}\n` +
        `ℹ️ _User is requesting access to the Sales Portal._`;

    try {
        const whapiResponse = await fetch('https://gate.whapi.cloud/messages/text', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${whapiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: adminPhone,
                body: messageText
            })
        });

        const whapiData = await whapiResponse.json();

        if (!whapiResponse.ok) {
            console.error('Whapi API error:', whapiData);
            // We return success anyway because the sheet logging (hopefully) worked
            return {
                statusCode: 200, 
                body: JSON.stringify({ 
                    success: true, 
                    warning: 'WhatsApp failed but request was logged',
                    detail: whapiData 
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Notification sent to admin.'
            })
        };

    } catch (err) {
        console.error('Network error calling Whapi:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send WhatsApp notification', detail: err.message })
        };
    }
};
