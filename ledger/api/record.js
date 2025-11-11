// record.js — verify webhook, dedupe, insert into Supabase
// Placement: ledger/api/record.js
// Accepts POST with JSON body. Verification methods:
//   1) HMAC hex in header `X-Zapier-Signature` using WEBHOOK_SECRET over the *raw* body
//   2) OR a shared-secret header `X-Webhook-Secret` that equals WEBHOOK_SECRET

// --- helpers ---
function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function timingSafeHexEqual(aHex, bHex) {
  try {
    const a = Buffer.from(String(aHex), 'hex');
    const b = Buffer.from(String(bHex), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Allowlist of columns we’ll send to Supabase
const ALLOWED_FIELDS = new Set([
  'title', 'text', 'author_handle', 'platform', 'media_url',
  'perma_link', 'wayback_link',
  'content_sha256', 'page_html_sha256',
  'original_published_at', 'sent_at',
  'captured_at', 'echoprinted_at',
  'url', 'notes', 'source', 'text_html',
  'ecp_id', 'ecp_record_id',
  'bitcoin_receipt_b64', 'bitcoin_anchored_at',
  'created_iso', 'source_published_iso', 'timestamp_iso',
  'is_test'
]);

async function findOneBy(url, key, column, value) {
  const qs = new URLSearchParams();
  qs.set('select', 'id,record_id,perma_link,content_sha256');
  qs.set(column, `eq.${encodeURIComponent(value)}`);
  const resp = await fetch(`${url}/rest/v1/echoprints?${qs.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  if (!resp.ok) return null;
  const arr = await resp.json();
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server_env_missing' });
  }

  // --- read raw body (needed for HMAC) ---
  const raw = await readRaw(req);
  const rawText = raw.toString('utf8');

  // --- verify signature ---
  const sigHeader =
    (req.headers['x-zapier-signature'] || req.headers['X-Zapier-Signature'] || '').toString();
  const sharedHeader =
    (req.headers['x-webhook-secret'] || req.headers['X-Webhook-Secret'] || '').toString();

  if (!sigHeader && !sharedHeader) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // Option A: shared secret equality
  if (sharedHeader) {
    if (sharedHeader !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  } else {
    // Option B: HMAC hex
    const expectedHex = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
    if (!timingSafeHexEqual(expectedHex, sigHeader)) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }
  }

  // --- parse JSON ---
  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // ignore explicit test payloads
  if (body.is_test === true || body.is_test === 'true') {
    return res.status(200).json({ ignored: true, reason: 'is_test' });
  }

  // compute content_sha256 if missing (simple heuristic: text + media_url)
  if (!body.content_sha256) {
    const source = String(body.text || '') + String(body.media_url || '');
    body.content_sha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  } else {
    body.content_sha256 = String(body.content_sha256).toLowerCase();
  }

  // default timestamps
  const nowIso = new Date().toISOString();
  body.captured_at = body.captured_at || nowIso;
  body.echoprinted_at = body.echoprinted_at || nowIso;

  // --- dedupe checks ---
  try {
    if (body.perma_link) {
      const byPermalink = await findOneBy(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, 'perma_link', body.perma_link);
      if (byPermalink) {
        return res.status(200).json({ status: 'exists', by: 'perma_link', row: byPermalink });
      }
    }

    if (body.content_sha256) {
      const bySha = await findOneBy(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, 'content_sha256', body.content_sha256);
      if (bySha) {
        return res.status(200).json({ status: 'exists', by: 'content_sha256', row: bySha });
      }
    }
  } catch (e) {
    // soft-fail dedupe (still allow insert); report why
    console.warn('dedupe_lookup_failed', e);
  }

  // --- build insert payload (allowlist only) ---
  const insertPayload = {};
  for (const k of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(k) && body[k] !== undefined) insertPayload[k] = body[k];
  }
  // Always store these three, even if omitted from allowlist above
  insertPayload.perma_link = body.perma_link ?? null;
  insertPayload.content_sha256 = body.content_sha256 ?? null;
  insertPayload.platform = body.platform ?? null;

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/echoprints`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(insertPayload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(502).json({ error: 'insert_failed', status: resp.status, detail: text });
    }

    const row = (() => { try { return JSON.parse(text)[0]; } catch { return null; } })();
    return res.status(201).json({ status: 'inserted', row });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', detail: String(err) });
  }
};
