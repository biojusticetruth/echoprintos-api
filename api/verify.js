export default async function handler(req, res) {
  try {
    const { ecp_id, hash } = req.query;

    if (!ecp_id && !hash) {
      return res.status(400).json({ ok: false, error: "Missing ecp_id or hash" });
    }

    // Try direct JSON endpoint first
    const upstream = new URL("https://echoprintos.org/api/verify.json");
    if (ecp_id) upstream.searchParams.append("ecp_id", ecp_id);
    if (hash) upstream.searchParams.append("hash", hash);

    const response = await fetch(upstream.toString());
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Fallback for HTML / non-JSON response
      return res.status(502).json({
        ok: false,
        error: "Upstream returned HTML instead of JSON — check echoprintos.org/api/verify.json",
        raw: text.slice(0, 300) + "..."
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
