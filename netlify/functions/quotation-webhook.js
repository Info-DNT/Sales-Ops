// =============================================
// QUOTATION WEBHOOK — Netlify Serverless Function
// Called by Make.com when a new PDF is uploaded to Google Drive.
// Supports matching by lead/case ID or Quotation ID in filename.
// =============================================

const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const secret = event.headers['x-webhook-secret'] || event.headers['X-Webhook-Secret'];
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { leadId, caseId, fileName, fileUrl, fileType } = body;
    const type = fileType || 'quotation'; // default to quotation

    if (!fileName || !fileUrl) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing fileName or fileUrl' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    let targetId = leadId || caseId;
    let targetTable = caseId ? 'cases' : 'leads';
    let targetFileTable = caseId ? 'case_files' : 'lead_files';

    // ── 1. If no ID provided, try matching by Quotation ID in Filename ──
    if (!targetId) {
        // Extract ID (e.g., "QUO-1002" from "QUO-1002_Report.pdf")
        const quoIdMatch = fileName.match(/(QUO-\d+)/i);
        if (quoIdMatch) {
            const extractedQuoId = quoIdMatch[0].toUpperCase();
            console.log(`🔍 Attempting match for Quotation ID: ${extractedQuoId}`);

            // Try Cases first (since converted leads become cases)
            const { data: caseRecord } = await supabase
                .from('cases')
                .select('id')
                .eq('quotation_id', extractedQuoId)
                .single();

            if (caseRecord) {
                targetId = caseRecord.id;
                targetTable = 'cases';
                targetFileTable = 'case_files';
            } else {
                // Try Leads
                const { data: leadRecord } = await supabase
                    .from('leads')
                    .select('id')
                    .eq('quotation_id', extractedQuoId)
                    .single();
                
                if (leadRecord) {
                    targetId = leadRecord.id;
                    targetTable = 'leads';
                    targetFileTable = 'lead_files';
                }
            }
        }
    }

    if (!targetId) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Could not match file to any lead or case. Ensure Quotation ID is in filename.' })
        };
    }

    // ── 2. Attach File ──
    const insertData = {
        file_name: fileName,
        file_url: fileUrl,
        file_type: type,
        source: 'drive'
    };
    
    if (targetTable === 'cases') {
        insertData.case_id = targetId;
    } else {
        insertData.lead_id = targetId;
    }

    const { data: fileRecord, error: insertError } = await supabase
        .from(targetFileTable)
        .insert(insertData)
        .select()
        .single();

    if (insertError) {
        console.error('Insert error:', insertError);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to attach file', detail: insertError.message }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: `File attached to ${targetTable} ${targetId}`,
            fileId: fileRecord.id
        })
    };
};
