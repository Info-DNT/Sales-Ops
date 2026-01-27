/**
 * Netlify Serverless Function - Zoho CRM Proxy
 * Solves CORS issue by proxying requests to Zoho Flow webhooks
 */

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { webhookUrl, payload } = JSON.parse(event.body);

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'B', location: 'netlify/functions/zoho-proxy.js:handler:entry', message: 'zoho-proxy invoked', data: { method: event.httpMethod, hasWebhookUrl: !!webhookUrl, hasPayload: !!payload, webhookHost: (() => { try { return new URL(webhookUrl).host } catch (e) { return null } })() }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log

        if (!webhookUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'webhookUrl is required' })
            };
        }

        console.log('Proxying request to:', webhookUrl);

        // Make request to Zoho Flow webhook
        // Use GET if no payload is provided, otherwise POST
        const method = payload ? 'POST' : 'GET';

        const response = await fetch(webhookUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: method === 'POST' ? JSON.stringify(payload) : undefined
        });

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'B', location: 'netlify/functions/zoho-proxy.js:handler:webhookResponse', message: 'Zoho Flow webhook responded', data: { ok: response.ok, status: response.status, statusText: response.statusText, contentType: response.headers.get('content-type') }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log

        let rawText = '';
        try {
            rawText = await response.text();
        } catch (e) {
            rawText = '';
        }

        if (!rawText) {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'B', location: 'netlify/functions/zoho-proxy.js:handler:emptyBody', message: 'Webhook returned empty body', data: { ok: response.ok, status: response.status, statusText: response.statusText, contentType: response.headers.get('content-type') }, timestamp: Date.now() }) }).catch(() => { });
            // #endregion agent log
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ success: false, error: 'Zoho Flow webhook returned empty response' })
            };
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'B', location: 'netlify/functions/zoho-proxy.js:handler:jsonParseFail', message: 'Failed parsing webhook response as JSON', data: { name: e?.name, message: e?.message, contentType: response.headers.get('content-type'), rawLen: rawText.length, rawHead: rawText.slice(0, 140) }, timestamp: Date.now() }) }).catch(() => { });
            // #endregion agent log
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ success: false, error: 'Zoho Flow returned non-JSON response', raw: rawText.slice(0, 200) })
            };
        }

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'C', location: 'netlify/functions/zoho-proxy.js:handler:jsonOk', message: 'Webhook JSON parsed', data: { keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 15) : null, success: data?.success, leadsIsArray: Array.isArray(data?.leads), leadsLen: Array.isArray(data?.leads) ? data.leads.length : null }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Proxy error:', error);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'A', location: 'netlify/functions/zoho-proxy.js:handler:catch', message: 'zoho-proxy caught error', data: { name: error?.name, message: error?.message, stackTop: (error?.stack || '').split('\n').slice(0, 3).join(' | ') }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion agent log
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                success: false
            })
        };
    }
};
