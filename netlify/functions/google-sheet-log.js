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

        const appsScriptUrl = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwpAo0dYg2e1ZvKluMItkUmy327ZaSATfyWGlgljDupPhm-zjo_vVMlEP9IBLEpcM1NPA/exec';
        const token = 'SALES_OPS_2026_SECURE';

        console.log(`[PROXY] Forwarding quotation log for Serial No: ${serialNo2}`);
        
        const url = `${appsScriptUrl}?action=saveQuotation&serialNo2=${serialNo2}&name=${encodeURIComponent(name || 'Unknown')}&token=${token}`;
        
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
