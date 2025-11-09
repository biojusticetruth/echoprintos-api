export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Accept either ?record_id=ECP-... or ?permalink=https://...
    const q = req.query || {};
    const recordId  = q.record_id || q.id || null;       // id kept as alias for convenience
    const permalink = q.permalink || q.url || null;

    if (!recordId && !permalink) {
      return res.status(400).json({
        ok: false,
        error: 'Provide ?record_id=ECP-... or ?permalink=https://...'
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' });
    }

    // Query the PUBLIC VIEW that already exposes timestamps in multiple formats
    // (created earlier as v_echoprints_public)
    const base = `${supabaseUrl}/rest/v1/v_echoprints_public`;

    const params = new URLSearchParams();
    params.set(
      'select',
      'record_id,title,hash,platform,permalink,timestamp_iso,timestamp_human_utc'
    );
    if (recordId)  params.set('record_id', `eq.${encodeURIComponent(recordId)}`);
    if (permalink) params.set('permalink', `eq.${encodeURIComponent(permalink)}`);

    const r = await fetch(`${base}?${params.toString()}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ ok: false, error: `Supabase error: ${text}` });
    }

    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }

    const x = rows[0];
    return res.status(200).json({
      ok: true,
      record: {
        record_id: x.record_id,
        title: x.title,
        platform: x.platform,
        permalink: x.permalink,
        hash: x.hash,
        timestamp_iso: x.timestamp_iso,
        timestamp_human_utc: x.timestamp_human_utc
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
