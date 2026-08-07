/**
 * Netlify Serverless Function - Zoho CRM Proxy
 * Solves CORS issue by proxying requests to Zoho Flow webhooks
 */

// Only these hosts may be proxied. Without an allow-list this function is an
// open server-side proxy: any caller could have it fetch an arbitrary URL,
// including internal/metadata addresses unreachable from the public internet.
//
// Despite this file's name, the callers in assets/js/zoho-integration.js point
// at Make.com automation webhooks, which then talk to Zoho — so both the
// Make.com hook hosts and the direct Zoho endpoints are permitted.
const ALLOWED_HOSTS = [
    'flow.zoho.com',
    'flow.zoho.in',
    'flow.zoho.eu',
    'www.zohoapis.com',
    'www.zohoapis.in',
    'www.zohoapis.eu',
    'www.zohoapis.com.au'
];

// Make.com issues per-region hook subdomains (hook.eu1.make.com, hook.us1.make.com, …).
const ALLOWED_HOST_SUFFIXES = ['.make.com', '.integromat.com'];

function isAllowedWebhookUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_HOSTS.includes(host)) return true;
    return ALLOWED_HOST_SUFFIXES.some(suffix => host.endsWith(suffix));
}

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': process.env.APP_DOMAIN || '*',
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

        if (!webhookUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'webhookUrl is required' })
            };
        }

        if (!isAllowedWebhookUrl(webhookUrl)) {
            console.warn('Blocked proxy request to disallowed URL:', webhookUrl);
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'webhookUrl host is not allowed' })
            };
        }

        console.log('Proxying request to:', webhookUrl);

        // Make request to CRM webhook.
        //
        // redirect:'manual' is load-bearing, not a detail. The allow-list above
        // is evaluated once, against the URL we were given. With the default
        // redirect:'follow', an allowed host could answer 302 → an internal
        // address (cloud metadata, localhost) and fetch would follow it,
        // returning the body to the caller — a full read-SSRF through a
        // permitted host. Anyone can register a .make.com webhook, so that is
        // not a theoretical path. Refuse redirects instead of re-validating,
        // since no legitimate webhook here redirects.
        const method = payload ? 'POST' : 'GET';
        const response = await fetch(webhookUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: method === 'POST' ? JSON.stringify(payload) : undefined,
            redirect: 'manual'
        });

        if (response.status >= 300 && response.status < 400) {
            console.warn('Blocked redirect from webhook:', webhookUrl, '→', response.headers.get('location'));
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ success: false, error: 'Webhook redirected; refusing to follow' })
            };
        }

        let rawText = '';
        try {
            rawText = await response.text();
        } catch (e) {
            rawText = '';
        }

        if (!rawText) {
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ success: false, error: 'CRM webhook returned empty response' })
            };
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ success: false, error: 'CRM webhook returned non-JSON response', raw: rawText.slice(0, 200) })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Proxy error:', error);
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
