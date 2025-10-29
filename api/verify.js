export default async function handler(req, res) {
  try {
    const { ecp_id, hash } = req.query;

    if (!ecp_id && !hash) {
      return res.status(400).json({ ok: false, error: "Missing ecp_id or hash" });
    }

    // ✅ Real upstream endpoint
    const upstream = new URL("https://echoprintos.org/api/verify");
    if (ecp_id) upstream.searchParams.append("ecp_id", ecp_id);
    if (hash) upstream.searchParams.append("hash", hash);

    const response = await fetch(upstream.toString());
    const text = await response.text();

    // Try to parse JSON safely
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // fallback for HTML or unexpected response
      return res.status(502).json({
        ok: false,
        error: "Upstream did not return valid JSON",
        raw: text.slice(0, 200) + "..." // just first few chars
      });
    }

    return res.status(200).json({ ok: true, ...data });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
