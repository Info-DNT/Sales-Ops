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

        if (!webhookUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'webhookUrl is required' })
            };
        }

        console.log('Proxying request to:', webhookUrl);

        // Make request to CRM webhook
        const method = payload ? 'POST' : 'GET';
        const response = await fetch(webhookUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: method === 'POST' ? JSON.stringify(payload) : undefined
        });

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
