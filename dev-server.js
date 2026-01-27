/**
 * Local dev server (no Netlify CLI required)
 * - Serves static files from project root
 * - Implements `/.netlify/functions/zoho-proxy` endpoint locally
 *
 * NOTE: This is for debugging only.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8888;
const ROOT = process.cwd();

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml; charset=utf-8';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

async function readBody(req, limitBytes = 1_000_000) {
  return await new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (c) => {
      total += c.length;
      if (total > limitBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// #region agent log
function debugLog(hypothesisId, location, message, data) {
  fetch('http://127.0.0.1:7244/ingest/949f1888-e64e-492e-bd26-b2cbf4deffcb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => { });
}
// #endregion agent log

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  // Handle CRM Sync Proxy
  if (u.pathname === '/.netlify/functions/zoho-proxy') {
    const proxyHandler = require('./netlify/functions/zoho-proxy').handler;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') return send(res, 200, headers, '');
    if (req.method !== 'POST') return send(res, 405, headers, JSON.stringify({ error: 'Method not allowed' }));

    try {
      const raw = await readBody(req);
      const { webhookUrl, payload } = JSON.parse(raw || '{}');

      debugLog('B', 'dev-server.js:zoho-proxy:entry', 'local CRM proxy invoked', {
        hasWebhookUrl: !!webhookUrl,
        hasPayload: !!payload
      });

      if (!webhookUrl) return send(res, 400, headers, JSON.stringify({ error: 'webhookUrl is required' }));

      let crmResp;
      try {
        // Match live proxy logic: use POST if payload exists, otherwise GET
        const method = payload ? 'POST' : 'GET';
        crmResp = await fetch(webhookUrl, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: method === 'POST' ? JSON.stringify(payload) : undefined
        });
      } catch (e) {
        debugLog('A', 'dev-server.js:zoho-proxy:webhookFetchFail', 'CRM Webhook fetch failed', {
          message: e?.message
        });
        throw e;
      }

      debugLog('B', 'dev-server.js:zoho-proxy:webhookResponse', 'CRM Webhook responded', {
        ok: crmResp.ok,
        status: crmResp.status,
        statusText: crmResp.statusText,
        contentType: crmResp.headers.get('content-type')
      });

      let rawText = '';
      try {
        rawText = await crmResp.text();
      } catch (e) {
        rawText = '';
      }

      if (!rawText) {
        return send(res, 502, headers, JSON.stringify({ success: false, error: 'CRM webhook returned empty response' }));
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        return send(res, 502, headers, JSON.stringify({ success: false, error: 'CRM webhook returned non-JSON response', raw: rawText.slice(0, 200) }));
      }

      debugLog('C', 'dev-server.js:zoho-proxy:jsonOk', 'Webhook JSON parsed', {
        keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 15) : null,
        success: data?.success,
        leadsIsArray: Array.isArray(data?.leads),
        leadsLen: Array.isArray(data?.leads) ? data.leads.length : null
      });

      return send(res, 200, headers, JSON.stringify(data));
    } catch (e) {
      debugLog('A', 'dev-server.js:zoho-proxy:catch', 'local zoho-proxy caught error', {
        name: e?.name,
        message: e?.message,
        stackTop: (e?.stack || '').split('\n').slice(0, 3).join(' | ')
      });
      return send(res, 500, headers, JSON.stringify({ success: false, error: e?.message || 'Unknown error' }));
    }
  }

  // Static file serving
  let filePath = path.join(ROOT, decodeURIComponent(u.pathname));
  if (u.pathname === '/' || u.pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!path.extname(filePath)) {
    // If someone visits /admin/leads.html (has ext) it's fine; otherwise default to .html if exists
    const htmlCandidate = `${filePath}.html`;
    if (fs.existsSync(htmlCandidate)) filePath = htmlCandidate;
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
    }
    return send(res, 200, { 'Content-Type': contentTypeFor(filePath) }, buf);
  });
});

server.listen(PORT, () => {
  console.log(`Local dev server running at http://localhost:${PORT}`);
});

