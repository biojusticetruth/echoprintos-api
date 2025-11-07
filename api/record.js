// /api/record.js  (Next.js Pages API on Vercel)
// Node runtime
export const config = { runtime: 'nodejs18.x' };

function norm(s) { return (s || '').trim(); }
function jsonBody(req) {
  try {
    if (!req.body) return {};
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch { return {}; }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // --- Auth: query ?key=..., X-API-Key, or Authorization: Bearer ...
    const qKey   = norm(req.query?.key);
    const hKey   = norm(req.headers['x-api-key']);
    const auth   = norm(req.headers.authorization);
    const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : auth;
    const token  = qKey || hKey || bearer || '';
    const expected = norm(process.env.ECHOPRINTS_API_KEY);
    if (!token || !expected || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // --- Body
    const b = jsonBody(req);
    const payload = {
      text: b.text ?? null,
      link: b.link ?? null,
      perma_link: b.perma_link ?? b.permalink ?? null, // accepts old input, writes perma_link
      url: b.url ?? null,
      platform: b.platform ?? null,
      handle: b.handle ?? null,
      sent_at: b.sent_at ? new Date(b.sent_at) : null,
      scheduled_at: b.scheduled_at ? new Date(b.scheduled_at) : null,
      source: b.source ?? 'make',
      raw: b
    };

    if (!payload.text || !(payload.perma_link || payload.url)) {
      return res.status(400).json({ error: 'Missing required fields: text and perma_link (or url)' });
    }

    // --- Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const SUPABASE_URL = norm(process.env.SUPABASE_URL);
    const SERVICE_KEY  = norm(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Supabase env missing' });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // --- Upsert on perma_link
    const { data, error } = await supabase
      .from('echoprints')
      .upsert(payload, { onConflict: 'perma_link' })
      .select()
      .limit(1);

    if (error) return res.status(500).json({ error: 'Supabase upsert failed', detail: error.message });

    return res.status(200).json({ ok: true, conflictCol: 'perma_link', rows: data?.length || 0, record: data?.[0] ?? null });
  } catch (e) {
    return res.status(500).json({ error: 'Handler crashed', detail: e?.message || String(e) });
  }
}
