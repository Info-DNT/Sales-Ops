const fetch = require('node-fetch');

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (e) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
        }

        const { serialNo2, name } = body;
        
        if (!serialNo2) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing Serial No 2' }) };
        }

        const appsScriptUrl = process.env.APPS_SCRIPT_URL;
        const token = process.env.APPS_SCRIPT_TOKEN;

        if (!appsScriptUrl || !token) {
            console.error('APPS_SCRIPT_URL / APPS_SCRIPT_TOKEN is not set');
            return { statusCode: 500, body: JSON.stringify({ error: 'Sync service not configured' }) };
        }

        console.log(`[PROXY] Forwarding quotation log for Serial No: ${serialNo2}`);

        // Every interpolated value is encoded — an unencoded serialNo2 could
        // inject extra parameters into this authenticated Apps Script call.
        const params = new URLSearchParams({
            action: 'saveQuotation',
            serialNo2: String(serialNo2),
            name: name || 'Unknown',
            token: token
        });
        const url = `${appsScriptUrl}?${params.toString()}`;
        
        // This server-to-server request will NEVER be blocked by the browser!
        const response = await fetch(url);
        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('[PROXY] Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}
