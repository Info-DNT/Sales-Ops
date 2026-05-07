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

  // --- Netlify Functions Emulator ---
  if (u.pathname.startsWith('/.netlify/functions/')) {
    const functionName = u.pathname.split('/').pop();
    const functionPath = path.join(ROOT, 'netlify', 'functions', `${functionName}.js`);

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') return send(res, 200, headers, '');

    if (!fs.existsSync(functionPath)) {
      console.warn(`[DevServer] Function not found: ${functionName} at ${functionPath}`);
      return send(res, 404, headers, JSON.stringify({ error: `Function ${functionName} not found` }));
    }

    try {
      console.log(`[DevServer] Invoking function: ${functionName}`);
      
      // Clear cache to allow local function development without restarting server
      delete require.cache[require.resolve(functionPath)];
      const { handler } = require(functionPath);
      
      const body = await readBody(req);
      
      // Mock the Netlify 'event' object
      const event = {
        path: u.pathname,
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: Object.fromEntries(u.searchParams),
        body: body,
        isBase64Encoded: false
      };

      const result = await handler(event, {});
      
      const responseHeaders = { ...headers, ...(result.headers || {}) };
      return send(res, result.statusCode || 200, responseHeaders, result.body || '');
      
    } catch (e) {
      console.error(`[DevServer] Error in function ${functionName}:`, e);
      return send(res, 500, headers, JSON.stringify({ success: false, error: e.message }));
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

