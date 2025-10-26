// api/verify.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const q = req.method === 'GET' ? req.query : (req.body || {});
    const needleHash = (q.hash || '').trim();
    const needleId   = (q.recordId || q.id || '').trim();

    if (!needleHash && !needleId) {
      return res.status(400).json({ ok: false, error: 'Provide ?hash= or ?recordId=' });
    }

    const GIST_ID = process.env.GIST_ID;
    const GH_TOKEN = process.env.GITHUB_TOKEN;
    if (!GIST_ID || !GH_TOKEN) {
      return res.status(500).json({ ok: false, error: 'Server missing GIST_ID or GITHUB_TOKEN' });
    }

    const gistResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `token ${GH_TOKEN}`, 'User-Agent': 'EchoprintOS-Verify' }
    });
    if (!gistResp.ok) {
      const t = await gistResp.text();
      return res.status(502).json({ ok: false, error: 'Could not read ledger gist', detail: t });
    }
    const gist = await gistResp.json();
    const files = gist.files || {};
    const jsonlFile =
      files['echoprint-records.jsonl'] ||
      Object.values(files).find(f => f && f.filename && f.filename.endsWith('.jsonl'));

    if (!jsonlFile || !jsonlFile.raw_url) {
      return res.status(404).json({ ok: false, error: 'Ledger file not found in gist' });
    }

    const raw = await fetch(jsonlFile.raw_url);
    if (!raw.ok) {
      const t = await raw.text();
      return res.status(502).json({ ok: false, error: 'Could not fetch ledger raw', detail: t });
    }
    const text = await raw.text();
    const entries = text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(safeParse)
      .filter(Boolean);

    const match = entries.find(e => {
      const recId = e?.certificate?.recordId || e?.recordId;
      const hv = e?.certificate?.hash?.value || e?.hash?.value || e?.hash;
      return (needleId && recId === needleId) || (needleHash && hv === needleHash);
    });

    if (!match) {
      return res.status(404).json({
        ok: false,
        error: 'No matching entry found',
        lookedFor: { hash: needleHash || undefined, recordId: needleId || undefined }
      });
    }

    return res.status(200).json({
      ok: true,
      result: {
        certificate: match.certificate || match,
        foundBy: needleId ? 'recordId' : 'hash',
        source: { gistId: GIST_ID, file: jsonlFile.filename, updated_at: gist.updated_at }
      }
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: String(err) });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
