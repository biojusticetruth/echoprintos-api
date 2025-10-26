export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { hash, title = 'Untitled', recordId } = req.body || {};
    if (!hash || typeof hash !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid or missing "hash" (string expected)' });
    }

    // Build the certificate payload
    const now = new Date().toISOString();
    const cert = {
      "@context": "https://schema.org/",
      "@type": "CreativeWork",
      echoprintVersion: "v0.1",
      recordId: recordId || `ECP-${now.replace(/[-:.TZ]/g, '').slice(0,14)}`,
      title,
      hash: { algorithm: "SHA-256", value: hash },
      timestamp: now
    };

    // Append to Gist as JSONL
    const GIST_ID = process.env.GIST_ID;
    const GIST_FILENAME = process.env.GIST_FILENAME || 'echoprint-records.jsonl';
    const GH = process.env.GITHUB_TOKEN;

    if (!GIST_ID || !GH) {
      // Return certificate anyway, but tell caller we couldn’t archive
      return res.status(200).json({
        ok: true,
        certificate: cert,
        archive: { ok: false, error: 'Missing GIST_ID or GITHUB_TOKEN' }
      });
    }

    // 1) Get current file content
    const getResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `Bearer ${GH}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!getResp.ok) {
      throw new Error(`GitHub GET failed: ${getResp.status} ${await getResp.text()}`);
    }
    const gist = await getResp.json();

    const existing = gist.files?.[GIST_FILENAME]?.content ?? '';
    const line = JSON.stringify({
      recordId: cert.recordId,
      title: cert.title,
      hash: cert.hash,
      timestamp: cert.timestamp
    });

    const newContent = existing
      ? (existing.endsWith('\n') ? existing + line + '\n' : existing + '\n' + line + '\n')
      : line + '\n';

    // 2) PATCH updated content
    const patchResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GH}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: { content: newContent }
        }
      })
    });

    if (!patchResp.ok) {
      throw new Error(`GitHub PATCH failed: ${patchResp.status} ${await patchResp.text()}`);
    }

    return res.status(200).json({
      ok: true,
      certificate: cert,
      archive: { ok: true, gistId: GIST_ID, file: GIST_FILENAME }
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
