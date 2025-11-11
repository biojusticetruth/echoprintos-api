export default async function handler(_req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'env_missing' });
  }

  const r = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  res.status(200).json({ ok: r.ok, status: r.status });
}
