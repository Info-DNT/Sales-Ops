const fetch = require('node-fetch');

// Folder ID for "Quotations - Approved"
const FOLDER_ID = '1BIDnlCPyiZy1_Djv1IeH9TkMjM_VF9po';

exports.handler = async (event) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) 
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { quotationId } = body;

        if (!quotationId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Missing Quotation ID' }) 
            };
        }

        const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
        if (!apiKey) {
            console.error('GOOGLE_DRIVE_API_KEY is not set in environment variables');
            return { 
                statusCode: 500, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Server configuration error' }) 
            };
        }

        console.log(`🔍 Searching Drive for Quotation ID: ${quotationId}`);

        // Construct search query: 
        // 1. Must be in the approved folder
        // 2. Name must contain the Quotation ID
        // 3. Not in trash
        const query = `'${FOLDER_ID}' in parents and name contains '${quotationId}' and trashed = false`;
        const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&key=${apiKey}`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Drive API Error:', errorText);
            return { 
                statusCode: 502, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Failed to communicate with Google Drive' }) 
            };
        }

        const data = await response.json();
        const files = data.files || [];

        if (files.length === 0) {
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Quotation PDF not found in Drive for this ID' }) 
            };
        }

        // Filter: prefer PDF, fallback to first match
        // Note: Google Docs mimeType is 'application/vnd.google-apps.document'
        let file = files.find(f => f.mimeType === 'application/pdf');
        
        // If no PDF, take the first one (might be a Google Doc, which uc link handles too usually)
        if (!file) {
            file = files[0];
            console.log(`⚠️ No PDF found, falling back to: ${file.name} (${file.mimeType})`);
        }

        // Direct Download Link (UC - User Content)
        // Works for anyone if the folder/file is set to "Anyone with link"
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                downloadUrl: downloadUrl, 
                fileName: file.name,
                fileId: file.id
            })
        };

    } catch (err) {
        console.error('drive-fetch internal error:', err);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ success: false, error: err.message }) 
        };
    }
};
