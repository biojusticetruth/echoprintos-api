// /api/record.js — strict, no-bearer
const { createClient } = require('@supabase/supabase-js');

const norm = s => (s || '').trim();
const parseBody = req => {
  try { return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return {}; }
};

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Auth: X-API-Key header OR ?key=
    const headerKey = norm(req.headers['x-api-key']);
    let queryKey = '';
    try { queryKey = norm(new URL(req.url, 'http://localhost').searchParams.get('key') || ''); } catch {}
    const token = headerKey || queryKey;
    const expected = norm(process.env.ECHOPRINTS_API_KEY);
    if (!expected || !token || token !== expected) return res.status(401).json({ error: 'Unauthorized' });

    // Body
    const b = parseBody(req);
    const payload = {
      text: b.text ?? null,
      link: b.link ?? null,
      perma_link: b.perma_link ?? null,
      url: b.url ?? null,
      platform: b.platform ?? null,
      handle: b.handle ?? null,
      sent_at: b.sent_at ? new Date(b.sent_at) : null,
      scheduled_at: b.scheduled_at ? new Date(b.scheduled_at) : null,
      source: b.source ?? 'make',
      raw: b
    };
    if (!payload.text || !(payload.perma_link || payload.url)) {
      return res.status(400).json({ error: 'Missing: text and perma_link (or url)' });
    }

    // Supabase
    const SUPABASE_URL = norm(process.env.SUPABASE_URL);
    const SERVICE_KEY  = norm(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Supabase env missing' });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Upsert
    const { data, error } = await supabase
      .from('echoprints')
      .upsert(payload, { onConflict: 'perma_link' })
      .select()
      .limit(1);

    if (error) return res.status(500).json({ error: 'Supabase upsert failed', detail: error.message });

    return res.status(200).json({ ok: true, record: data?.[0] ?? null });
  } catch (e) {
    return res.status(500).json({ error: 'Handler crashed', detail: e?.message || String(e) });
  }
};
