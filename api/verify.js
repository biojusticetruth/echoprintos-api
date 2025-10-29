// api/verify.js
export default async function handler(req, res) {
  // Allow CORS (lets your website talk to this API)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*"); // you can later limit this to your domain
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  try {
    const { ecp_id, hash } = req.query;

    // check if either field is filled in
    if (!ecp_id && !hash) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(400).json({ ok: false, error: "Missing ecp_id or hash" });
    }

    // send request to the upstream EchoprintOS API
    const upstream = new URL("https://echoprintos-api.vercel.app/");
    if (ecp_id) upstream.searchParams.set("ecp_id", ecp_id);
    if (hash)   upstream.searchParams.set("hash", hash);

    const r = await fetch(upstream.toString(), { cache: "no-store" });
    const raw = await r.json();

    // create a stable response format
    const data = {
      ok: true,
      title: raw.title ?? raw.name ?? "(untitled)",
      timestamp: raw.timestamp ?? raw.created_at ?? null,
      ecp_id: raw.ecp_id ?? raw.record_id ?? ecp_id ?? null,
      sha256: raw.hash ?? raw.sha256 ?? hash ?? null,
      image_url: raw.image_url ?? null,
      image_base64: raw.image_base64 ?? null
    };

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Vary", "Origin");
    res.status(200).json(data);

  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ ok: false, error: err.message });
  }
}
