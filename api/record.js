const crypto = require('crypto');

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const raw = await readRaw(req);

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'WEBHOOK_SECRET missing' });

  const headerSig = (req.headers['x-zapier-signature'] || req.headers['x-webhook-secret'] || '').toString();
  if (!headerSig) return res.status(401).json({ error: 'Missing signature' });

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(headerSig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('bad sig');
  } catch {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body;
  try { body = JSON.parse(raw.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const row = {
    perma_link: body.perma_link ?? null,
    title: body.title ?? null,
    text: body.text ?? null,
    author_handle: body.author_handle ?? null,
    platform: body.platform ?? null,
    content_sha256: body.content_sha256 ?? null,
    original_published_at: body.original_published_at ?? null,
    sent_at: body.sent_at ?? null,
    captured_at: new Date().toISOString(),
    is_test: false,
  };

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) return res.status(500).json({ error: 'Supabase env missing' });

  const resp = await fetch(`${sbUrl}/rest/v1/echoprints`, {
    method: 'POST',
    headers: {
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  });

  const out = await resp.text();
  if (!resp.ok) return res.status(500).json({ ok: false, status: resp.status, out });
  return res.status(200).json({ ok: true });
};
