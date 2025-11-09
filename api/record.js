// /api/record.js
// Inserts a new Echoprint row into Supabase (server-side, secure).

export default async function handler(req, res) {
  // --- CORS (optional; useful if you call from other origins) ---
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  // --- Only POST is allowed here ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  // --- Simple shared-secret gate ---
  const secret = req.headers['x-auth-token'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // --- Required envs (configured in Vercel → Settings → Environment Variables) ---
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  // --- Parse payload (accepts Make/Buffer-style fields) ---
  const {
    record_id,          // required (your ECP-... id)
    title = null,
    hash = null,
    url = null,         // optional source url
    permalink = null,   // optional canonical link
    platform = null,    // optional: "twitter", "instagram", etc.
    sent_at = null      // optional ISO datetime string
  } = (req.body || {});

  if (!record_id) {
    return res.status(400).json({ error: 'record_id required' });
  }

  // Choose the canonical link to store
  const link = permalink || url || null;

  try {
    // REST insert with service-role (bypasses RLS safely on server)
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/echoprints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        record_id,
        title,
        hash,
        permalink: link,
        platform,
        sent_at
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: data });
    }

    // Return the inserted row (first element)
    return res.status(200).json({ ok: true, row: Array.isArray(data) ? data[0] : data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
