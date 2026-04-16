const fetch = require('node-fetch');

// Folder IDs for different document types
const FOLDERS = {
    'quotation': '1BIDnlCPyiZy1_Djv1IeH9TkMjM_VF9po',
    'proforma': '1F5HG9gdya9oO2mJG_KDKlloUEp7s2fGi',
    'invoice': '1Of96E8HY2ayPSZRxTB0_HjUTysHGmPv2',
    'receipt': '1FoLF2e3auTjhMiUUbG84CvmFk2eXep7d'
};

// Map docType to human-readable names for error messages
const DOC_NAMES = {
    'quotation': 'Quotation PDF',
    'proforma': 'Proforma Invoice',
    'invoice': 'Final Invoice',
    'receipt': 'Payment Receipt'
};

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
        const { quotationId, docType = 'quotation' } = body;

        if (!quotationId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Missing Quotation ID' }) 
            };
        }

        const folderId = FOLDERS[docType];
        if (!folderId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, error: `Unsupported document type: ${docType}` }) 
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

        const docName = DOC_NAMES[docType] || 'File';
        console.log(`🔍 Searching Drive for ${docName} using Quotation ID: ${quotationId}`);

        // Construct search query: 
        // 1. Must be in the specific folder
        // 2. Name must contain the Quotation ID
        // 3. Not in trash
        const query = `'${folderId}' in parents and name contains '${quotationId}' and trashed = false`;
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
                body: JSON.stringify({ 
                    success: false, 
                    error: `Pending request from accounts team. (${docName} not found in Drive for this ID)`,
                    isPending: true
                }) 
            };
        }

        // Filter: prefer PDF, fallback to first match
        let file = files.find(f => f.mimeType === 'application/pdf');
        
        if (!file) {
            file = files[0];
            console.log(`⚠️ No PDF found, falling back to: ${file.name} (${file.mimeType})`);
        }

        // Direct Download Link (UC - User Content)
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                downloadUrl: downloadUrl, 
                fileName: file.name,
                fileId: file.id,
                docType: docType
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
