// /api/timestamp.js
// EchoprintOS • Timestamp microservice (Vercel/Node)

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { hash, recordId, title } = req.body || {};

    // Basic validation
    const HEX64 = /^[a-f0-9]{64}$/i;
    if (!hash || !HEX64.test(hash)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid or missing hash. Expect 64-char hex SHA-256.",
      });
    }

    // Generate timestamp “certificate”
    const now = new Date().toISOString();
    const nonce = Math.random().toString(36).slice(2, 10).toUpperCase();

    const id =
      recordId ||
      `ECP-${now.slice(0, 10).replace(/-/g, "")}-${nonce}`; // e.g., ECP-20251025-AB12CD34

    const certificate = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      echoprintVersion: "v0.1",
      recordId: id,
      title: title || null,
      hash: {
        algorithm: "SHA-256",
        value: hash.toLowerCase(),
      },
      timestamp: {
        issuedAt: now, // UTC ISO-8601
        authority: "EchoprintOS Timestamp Node",
        // placeholder for external proofs you may add later (OpenTimestamps, etc.)
        proofs: [],
      },
      issuer: {
        name: "EchoprintOS API",
        url: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "https://echoprintos-api.vercel.app",
      },
      nonce,
    };

    // --- Append to Gist ledger if configured ---
    // Set these in Vercel → Project → Settings → Environment Variables
    //   GITHUB_TOKEN = <your GitHub PAT with "gist" scope>
    //   GIST_ID      = <the id of your target Gist>
    const token = process.env.GITHUB_TOKEN;
    const gistId = process.env.GIST_ID;

    let gistUrl = null;

    if (token && gistId) {
      // 1) Fetch current file content (or create if missing)
      const filename = "echoprint-records.jsonl";
      const gistApi = `https://api.github.com/gists/${gistId}`;

      const gistResp = await fetch(gistApi, {
        headers: { Authorization: `token ${token}`, "User-Agent": "echoprintos" },
      });

      if (!gistResp.ok) {
        throw new Error(`Gist fetch failed: ${gistResp.status} ${await gistResp.text()}`);
      }

      const gist = await gistResp.json();
      const existing =
        gist.files?.[filename]?.content ? gist.files[filename].content : "";

      // Append one JSONL line
      const line = JSON.stringify(certificate);
      const updated = existing ? `${existing}\n${line}\n` : `${line}\n`;

      // 2) Update the Gist
      const patch = await fetch(gistApi, {
        method: "PATCH",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "echoprintos",
        },
        body: JSON.stringify({
          files: {
            [filename]: { content: updated },
          },
        }),
      });

      if (!patch.ok) {
        throw new Error(`Gist update failed: ${patch.status} ${await patch.text()}`);
      }

      const patched = await patch.json();
      gistUrl = patched.html_url || null;
    }

    return res.status(200).json({
      ok: true,
      certificate,
      ledger: gistUrl ? { type: "gist", url: gistUrl } : null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
}
