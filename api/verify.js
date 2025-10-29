export default async function handler(req, res) {
  try {
    const { ecp_id } = req.query;

    if (!ecp_id) {
      return res.status(400).json({ ok: false, error: "Missing ecp_id" });
    }

    // Replace with your actual Supabase URL + key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(`${supabaseUrl}/rest/v1/echoprints?select=*&id=eq.${ecp_id}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const data = await response.json();

    if (data.length === 0) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
