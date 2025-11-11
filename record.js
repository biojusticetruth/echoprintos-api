import crypto from 'node:crypto';
export const config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks=[]; req.on('data',c=>chunks.push(c));
    req.on('end',()=>resolve(Buffer.concat(chunks)));
    req.on('error',reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const raw = await readRaw(req);
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'WEBHOOK_SECRET missing' });

  const header = (req.headers['x-zapier-signature'] || req.headers['x-webhook-secret'] || '').toString();
  if (!header) return res.status(401).json({ error: 'Missing signature' });

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex'), b = Buffer.from(header, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error();
  } catch { return res.status(401).json({ error: 'Invalid signature' }); }

  let body; try { body = JSON.parse(raw.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Supabase env missing' });

  const row = {
    perma_link: body.perma_link ?? null,
    title: body.title ?? null,
    text: body.text ?? null,
    author_handle: body.author_handle ?? null,
    platform: body.platform ?? null,
    media_url: body.media_url ?? null,
    content_sha256: body.content_sha256 ?? null,
    original_published_at: body.original_published_at ?? null,
    sent_at: body.sent_at ?? new Date().toISOString(),
    captured_at: new Date().toISOString(),
    echoprinted_at: new Date().toISOString(),
    is_test: false
  };

  const resp = await fetch(`${url}/rest/v1/echoprints?on_conflict=content_sha256&select=*`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(row)
  });

  const txt = await resp.text();
  if (!resp.ok) return res.status(502).json({ error: 'insert_failed', details: txt });
  const inserted = JSON.parse(txt);
  res.status(201).json({ status: 'inserted', row: inserted[0] });
}
