// api/record.js
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${process.env.ECHOPRINT_API_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { platform, url, title, content, publishedAt } = req.body || {};
  if (!platform || !url || !publishedAt) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const canonical = [
    platform,
    title || "",
    (content || "").replace(/\s+/g, " ").trim(),
    url.toLowerCase(),
    new Date(publishedAt).toISOString()
  ].join("|");

  const hash = crypto.createHash("sha256").update(canonical).digest("hex");
  const runId = crypto.randomUUID();
  const ts = new Date().toISOString();

  // If Supabase vars exist, try to insert; otherwise just return the receipt
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Prefer": "return=representation",
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify([{
          platform, url, title, content,
          published_at: new Date(publishedAt).toISOString(),
          hash, run_id: runId, created_at: ts
        }])
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(500).json({ error: "Supabase insert failed", detail: err });
      }
      const [row] = await resp.json();
      return res.status(200).json({ id: row.id, hash, runId, ts });
    }
  } catch (e) {
    return res.status(500).json({ error: "Supabase error", detail: String(e) });
  }

  // Fallback if DB is disabled/not ready
  return res.status(200).json({ id: null, hash, runId, ts });
}
