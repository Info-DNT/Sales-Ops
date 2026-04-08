// =============================================
// WHAPI WHATSAPP MESSAGE SENDER — Netlify Function
// Sends Invoice/Receipt request messages to the
// Accounts team via WhatsApp using Whapi API.
//
// POST body expected:
// {
//   "type": "invoice_request" | "receipt_request",
//   "caseDetails": {
//     "caseNumber": "CASE-123456",
//     "title": "John Doe",
//     "description": "Patient: ...",
//     "status": "In Progress",
//     "priority": "High",
//     "clientName": "John Doe",
//     "clientPhone": "+91...",
//     "clientEmail": "...",
//     "patientName": "...",
//     "sourceLocation": "...",
//     "destinationLocation": "...",
//     "field": "Medical Tourism"
//   },
//   "requester": {
//     "name": "Sales Agent Name",
//     "email": "agent@example.com"
//   }
// }
//
// Required Netlify Environment Variables:
//   WHAPI_API_TOKEN      — Your Whapi channel token
//   WHAPI_ACCOUNTS_PHONE — Accounts team WhatsApp number (e.g. 919876543210)
// =============================================

exports.handler = async function (event) {
    // ── 1. Only allow POST ──────────────────────────────────────────
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // ── 2. Parse body ───────────────────────────────────────────────
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { type, caseDetails, requester } = body;

    if (!type || !caseDetails || !requester) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields: type, caseDetails, requester' })
        };
    }

    // ── 3. Validate env vars ─────────────────────────────────────────
    const whapiToken = process.env.WHAPI_API_TOKEN;
    const accountsPhone = process.env.WHAPI_ACCOUNTS_PHONE;

    if (!whapiToken || !accountsPhone) {
        console.error('Missing WHAPI_API_TOKEN or WHAPI_ACCOUNTS_PHONE env variable');
        return { statusCode: 500, body: JSON.stringify({ error: 'WhatsApp service not configured. Please contact admin.' }) };
    }

    // ── 4. Build message text ────────────────────────────────────────
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    let messageText = '';

    if (type === 'invoice_request') {
        messageText = `🧾 *INVOICE REQUEST*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 *Case:* #${caseDetails.caseNumber}\n` +
            `👤 *Client:* ${caseDetails.clientName || caseDetails.title || '—'}\n` +
            `📞 *Phone:* ${caseDetails.clientPhone || '—'}\n` +
            `📧 *Email:* ${caseDetails.clientEmail || '—'}\n` +
            `🏥 *Patient:* ${caseDetails.patientName || '—'}\n` +
            `✈️ *From:* ${caseDetails.sourceLocation || '—'}\n` +
            `🏁 *To:* ${caseDetails.destinationLocation || '—'}\n` +
            `🗂️ *Category:* ${caseDetails.field || '—'}\n` +
            `📊 *Status:* ${caseDetails.status || '—'}\n` +
            `⚡ *Priority:* ${caseDetails.priority || '—'}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👨‍💼 *Requested by:* ${requester.name || requester.email}\n` +
            `🕒 *Time:* ${timestamp}`;
    } else if (type === 'receipt_request') {
        messageText = `🧾 *RECEIPT REQUEST*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 *Case:* #${caseDetails.caseNumber}\n` +
            `👤 *Client:* ${caseDetails.clientName || caseDetails.title || '—'}\n` +
            `📞 *Phone:* ${caseDetails.clientPhone || '—'}\n` +
            `📧 *Email:* ${caseDetails.clientEmail || '—'}\n` +
            `🏥 *Patient:* ${caseDetails.patientName || '—'}\n` +
            `✈️ *From:* ${caseDetails.sourceLocation || '—'}\n` +
            `🏁 *To:* ${caseDetails.destinationLocation || '—'}\n` +
            `🗂️ *Category:* ${caseDetails.field || '—'}\n` +
            `📊 *Status:* ${caseDetails.status || '—'}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👨‍💼 *Requested by:* ${requester.name || requester.email}\n` +
            `🕒 *Time:* ${timestamp}\n` +
            `ℹ️ _Invoice has been submitted. Please process the receipt._`;
    } else {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid type. Use invoice_request or receipt_request' }) };
    }

    // ── 5. Send via Whapi ────────────────────────────────────────────
    try {
        const whapiResponse = await fetch('https://gate.whapi.cloud/messages/text', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${whapiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: accountsPhone,
                body: messageText
            })
        });

        const whapiData = await whapiResponse.json();

        if (!whapiResponse.ok) {
            console.error('Whapi API error:', whapiData);
            return {
                statusCode: 502,
                body: JSON.stringify({ error: 'WhatsApp send failed', detail: whapiData })
            };
        }

        console.log(`✅ WhatsApp ${type} sent for case #${caseDetails.caseNumber} by ${requester.name}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                messageId: whapiData.id || whapiData.message?.id,
                message: `${type === 'invoice_request' ? 'Invoice' : 'Receipt'} request sent to Accounts team.`
            })
        };

    } catch (err) {
        console.error('Network error calling Whapi:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send WhatsApp message', detail: err.message })
        };
    }
};
