export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !key) {
      return res.status(500).json({ ok:false, error:'Missing Supabase env vars' });
    }

    const limit = Math.min(parseInt(req.query.limit || '12', 10) || 12, 50);
    const params = new URLSearchParams({
      select: 'record_id,title,permalink,timestamp_iso,timestamp_human_utc',
      order: 'timestamp_iso.desc',
      limit: String(limit),
    });

    const r = await fetch(`${supabaseUrl}/rest/v1/v_echoprints_public?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (!r.ok) return res.status(r.status).json({ ok:false, error: await r.text() });

    const rows = await r.json();
    return res.status(200).json({ ok:true, rows });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
