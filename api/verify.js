export default async function handler(req, res) {
  try {
    // --- 1. Base upstream verification endpoint ---
    const upstream = new URL("https://echoprintos.org/api/verify");

    // --- 2. Accept either ?ecp_id= or ?hash= parameters ---
    const { ecp_id, hash } = req.query;

    if (!ecp_id && !hash) {
      return res.status(400).json({
        ok: false,
        error: "Missing required parameter: ecp_id or hash",
      });
    }

    // --- 3. Forward parameters to EchoprintOS.org ---
    const params = new URLSearchParams();
    if (ecp_id) params.append("ecp_id", ecp_id);
    if (hash) params.append("hash", hash);

    const verifyUrl = `${upstream}?${params.toString()}`;
    const response = await fetch(verifyUrl);

    // --- 4. Handle and validate JSON response ---
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Upstream returned ${response.status}`,
      });
    }

    const data = await response.json();

    // --- 5. Return unified JSON back to your frontend ---
    res.status(200).json({
      ok: true,
      title: data.title || "(untitled)",
      timestamp: data.timestamp || null,
      ecp_id: data.ecp_id || ecp_id || null,
      sha256: data.sha256 || null,
      image_url: data.image_url || null,
      image_base64: data.image_base64 || null,
    });
  } catch (err) {
    // --- 6. Graceful error handling ---
    res.status(500).json({
      ok: false,
      error: err.message || "Unexpected server error",
    });
  }
}
