const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Handshake token check (matches expected webhook secret)
    const secret = event.headers['x-webhook-secret'] || event.headers['X-Webhook-Secret'];
    const expectedSecret = process.env.WEBHOOK_SECRET || 'SALES_OPS_2026_SECURE';

    if (secret !== expectedSecret) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const {
        serial_no_2,
        quotation_id,
        phone,
        email,
        action,          // e.g. "Quotation Requested", "Quotation Approved", "Proforma Invoice Filled", "Receipt Filled"
        performed_by,    // e.g. "John Doe" or client name
        details,         // Summary notes or text
        file_url,        // Optional document link
        file_name        // Optional document file name
    } = body;

    if (!action) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action field' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        let matchedLead = null;
        let matchedCase = null;

        // ─── 1. RESOLVE LEAD AND CASE ───
        // Try Serial No. 2 lookup
        if (serial_no_2) {
            const { data } = await supabase.from('leads').select('id, user_id').eq('serial_no_2', String(serial_no_2)).maybeSingle();
            matchedLead = data;
        }

        // Try Quotation ID lookup if not found
        if (!matchedLead && quotation_id) {
            const { data } = await supabase.from('leads').select('id, user_id').eq('quotation_id', quotation_id).maybeSingle();
            matchedLead = data;
        }

        // Try Phone lookup fallback
        if (!matchedLead && phone) {
            const cleanPhone = phone.replace(/[^\d]/g, '');
            const { data } = await supabase.from('leads').select('id, user_id').eq('contact', cleanPhone).maybeSingle();
            matchedLead = data;
        }

        // Try Email lookup fallback
        if (!matchedLead && email) {
            const { data } = await supabase.from('leads').select('id, user_id').eq('email', email).maybeSingle();
            matchedLead = data;
        }

        // Find associated case (if lead matched)
        if (matchedLead) {
            const { data } = await supabase.from('cases').select('id, user_id').eq('lead_id', matchedLead.id).maybeSingle();
            matchedCase = data;
        } else {
            // Check direct Case lookup
            if (serial_no_2) {
                const { data } = await supabase.from('cases').select('id, user_id').eq('serial_no_2', String(serial_no_2)).maybeSingle();
                matchedCase = data;
            }
            if (!matchedCase && quotation_id) {
                const { data } = await supabase.from('cases').select('id, user_id').eq('quotation_id', quotation_id).maybeSingle();
                matchedCase = data;
            }
        }

        if (!matchedLead && !matchedCase) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'No matching Lead or Case found with the provided details' })
            };
        }

        // ─── 2. LOG TO LEAD HISTORY ───
        const historyInsert = {
            action: action,
            details: {
                summary: details || `${action} recorded via Google Sheets`,
                performed_by: performed_by || 'Google Sheets System',
                via: 'Google Sheets / WhatsApp',
                file_url: file_url || null
            },
            user_id: matchedCase?.user_id || matchedLead?.user_id
        };

        if (matchedLead) historyInsert.lead_id = matchedLead.id;
        if (matchedCase) historyInsert.case_id = matchedCase.id;

        let { data: historyData, error: historyErr } = await supabase
            .from('lead_history')
            .insert(historyInsert)
            .select()
            .maybeSingle();

        if (historyErr && historyErr.code === '42703') {
            console.warn('[TimelineReceiver] case_id column missing on database. Falling back to lead-only insert.');
            delete historyInsert.case_id;
            const fallbackResult = await supabase
                .from('lead_history')
                .insert(historyInsert)
                .select()
                .maybeSingle();
            historyData = fallbackResult.data;
            historyErr = fallbackResult.error;
        }

        if (historyErr) throw historyErr;

        // ─── 3. UPDATE CASE METADATA & FILES (IF DOCUMENT EVENT) ───
        let caseUpdated = false;
        let fileAttached = false;

        if (matchedCase) {
            let caseUpdates = {};
            let documentType = ''; // 'proforma', 'invoice', 'receipt', 'quotation'

            const normAction = action.toLowerCase();
            if (normAction.includes('proforma')) {
                caseUpdates.proforma_uploaded = true;
                caseUpdates.status = 'In Progress';
                documentType = 'proforma';
            } else if (normAction.includes('tax invoice') || normAction.includes('invoice')) {
                caseUpdates.invoice_uploaded = true;
                documentType = 'invoice';
            } else if (normAction.includes('receipt')) {
                caseUpdates.receipt_uploaded = true;
                documentType = 'receipt';
            } else if (normAction.includes('quotation')) {
                documentType = 'quotation';
            }

            if (Object.keys(caseUpdates).length > 0) {
                await supabase.from('cases').update(caseUpdates).eq('id', matchedCase.id);
                caseUpdated = true;
            }

            // Attach PDF Document URL directly if provided
            if (file_url && documentType) {
                const attachData = {
                    case_id: matchedCase.id,
                    file_name: file_name || `${documentType.toUpperCase()}_Document.pdf`,
                    file_url: file_url,
                    storage_path: 'drive_sync',
                    uploaded_by: matchedCase.user_id || null
                };

                let targetTable = 'case_files';
                if (documentType === 'invoice') targetTable = 'case_invoices';
                if (documentType === 'receipt') targetTable = 'case_receipts';

                await supabase.from(targetTable).insert(attachData);
                fileAttached = true;
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Timeline successfully updated',
                history_id: historyData.id,
                case_updated: caseUpdated,
                file_attached: fileAttached
            })
        };

    } catch (err) {
        console.error('Timeline receiver error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', detail: err.message })
        };
    }
};
