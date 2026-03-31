// =============================================
// QUOTATION WEBHOOK — Netlify Serverless Function
// Called by Make.com when a new quotation PDF
// is uploaded to Google Drive.
//
// Expected POST body:
// {
//   "leadId"   : "uuid-of-the-lead",
//   "fileName" : "Quotation_ClientName.pdf",
//   "fileUrl"  : "https://drive.google.com/file/d/..."
// }
//
// Required Netlify Environment Variables:
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service_role key (NOT anon key)
//   WEBHOOK_SECRET            — a long random string you set in Make.com too
// =============================================

const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
    // ── 1. Only allow POST ──────────────────────────────────────────
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // ── 2. Validate webhook secret ──────────────────────────────────
    const secret = event.headers['x-webhook-secret'] || event.headers['X-Webhook-Secret'];
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (!expectedSecret) {
        console.error('WEBHOOK_SECRET environment variable not set');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
    }

    if (!secret || secret !== expectedSecret) {
        console.warn('Unauthorized webhook call — invalid secret');
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // ── 3. Parse body ───────────────────────────────────────────────
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { leadId, fileName, fileUrl } = body;

    if (!leadId || !fileName || !fileUrl) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields: leadId, fileName, fileUrl' })
        };
    }

    // ── 4. Validate that leadId looks like a UUID ───────────────────
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadId)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'leadId must be a valid UUID' }) };
    }

    // ── 5. Connect to Supabase with service role key ────────────────
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Supabase environment variables missing');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 6. Verify lead exists ───────────────────────────────────────
    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, name')
        .eq('id', leadId)
        .single();

    if (leadError || !lead) {
        console.warn(`Lead not found: ${leadId}`);
        return { statusCode: 404, body: JSON.stringify({ error: 'Lead not found' }) };
    }

    // ── 7. Insert the file record ───────────────────────────────────
    const { data: fileRecord, error: insertError } = await supabase
        .from('lead_files')
        .insert({
            lead_id: leadId,
            file_name: fileName,
            file_url: fileUrl,
            source: 'drive'
        })
        .select()
        .single();

    if (insertError) {
        console.error('Insert error:', insertError);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save file record', detail: insertError.message }) };
    }

    console.log(`✅ Quotation attached to lead "${lead.name}" (${leadId}): ${fileName}`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: `Quotation "${fileName}" attached to lead "${lead.name}"`,
            fileId: fileRecord.id
        })
    };
};
