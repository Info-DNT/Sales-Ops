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
  }).catch(() => {});
}
// #endregion agent log

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  // Local implementation of Netlify function
  if (u.pathname === '/.netlify/functions/zoho-proxy') {
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

      debugLog('B', 'dev-server.js:zoho-proxy:entry', 'local zoho-proxy invoked', {
        hasWebhookUrl: !!webhookUrl,
        hasPayload: !!payload,
        webhookHost: (() => {
          try {
            return new URL(webhookUrl).host;
          } catch {
            return null;
          }
        })()
      });

      if (!webhookUrl) return send(res, 400, headers, JSON.stringify({ error: 'webhookUrl is required' }));

      let zohoResp;
      try {
        zohoResp = await fetch(webhookUrl, {
          // Zoho Flow "incoming webhook" expects POST; GET often returns 200 with an empty body.
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload ?? {})
        });
      } catch (e) {
        debugLog('A', 'dev-server.js:zoho-proxy:webhookFetchFail', 'Fetch to Zoho Flow webhook failed', {
          name: e?.name,
          message: e?.message,
          causeName: e?.cause?.name,
          causeCode: e?.cause?.code,
          causeMessage: e?.cause?.message,
          causeErrno: e?.cause?.errno,
          causeSyscall: e?.cause?.syscall
        });
        throw e;
      }

      debugLog('B', 'dev-server.js:zoho-proxy:webhookResponse', 'Zoho Flow webhook responded', {
        ok: zohoResp.ok,
        status: zohoResp.status,
        statusText: zohoResp.statusText,
        contentType: zohoResp.headers.get('content-type')
      });

      let rawText = '';
      try {
        rawText = await zohoResp.text();
      } catch (e) {
        rawText = '';
      }

      if (!rawText) {
        debugLog('B', 'dev-server.js:zoho-proxy:emptyBody', 'Webhook returned empty body', {
          ok: zohoResp.ok,
          status: zohoResp.status,
          statusText: zohoResp.statusText,
          contentType: zohoResp.headers.get('content-type')
        });
        return send(res, 502, headers, JSON.stringify({ success: false, error: 'Zoho Flow webhook returned empty response' }));
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        debugLog('B', 'dev-server.js:zoho-proxy:jsonParseFail', 'Failed parsing webhook response as JSON', {
          name: e?.name,
          message: e?.message,
          contentType: zohoResp.headers.get('content-type'),
          rawLen: rawText.length,
          rawHead: rawText.slice(0, 140)
        });
        return send(res, 502, headers, JSON.stringify({ success: false, error: 'Zoho Flow returned non-JSON response', raw: rawText.slice(0, 200) }));
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

