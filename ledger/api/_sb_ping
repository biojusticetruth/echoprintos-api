// _sb_ping.js — minimal Supabase REST reachability check
module.exports = async function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'env_missing' });
  }

  try {
    // Hit PostgREST root; any 200/204/3xx proves headers are accepted
    const r = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });

    return res.status(200).json({ ok: true, status: r.status });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'fetch_failed', detail: String(err) });
  }
};
