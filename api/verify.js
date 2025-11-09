export default async function handler(req, res) {
  try {
    const { record_id } = req.query;
    if (!record_id) {
      return res.status(400).json({ ok: false, error: "Missing record_id" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const url =
      `${supabaseUrl}/rest/v1/v_echoprints_public` +
      `?select=*` +
      `&record_id=eq.${encodeURIComponent(record_id)}`;

    const r = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });

    const rows = await r.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
