// Vercel serverless function: POST {hash:"<64-hex>"} -> { ok, ots_b64, status_url }
const allow = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
};

// Minimal OpenTimestamps submit (hex SHA-256 -> pending calendar receipt)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });
  try {
    const { hash } = req.body || {};
    if (!/^[a-f0-9]{64}$/i.test(hash || '')) return res.status(400).json({ ok:false, error:'hash must be 64-hex' });

    // submit to a public OTS calendar
    const buf = Buffer.from(hash, 'hex');
    const r = await fetch('https://a.pool.opentimestamps.org/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buf
    });

    if (!r.ok) throw new Error(`OTS ${r.status}`);
    const receipt = await r.arrayBuffer(); // raw receipt bytes

    // you would normally store 'receipt' and later upgrade it to 'anchored'
    return res.status(200).json({ ok:true, status:'pending', bytes: Buffer.byteLength(Buffer.from(receipt)) });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
export const config = { api: { bodyParser: true } };
  }
  try {
    const { hash } = req.body || {};
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return res.status(400).json({ ok:false, error:'hash must be 64-hex' });
    }
    const digest = Buffer.from(hash, 'hex');
    const r = await fetch('https://a.pool.opentimestamps.org/digest', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: digest
    });
    if (!r.ok) {
      const text = await r.text().catch(()=> '');
      return res.status(502).json({ ok:false, error:`OTS calendar ${r.status}`, detail:text });
    }
    const otsBuf = Buffer.from(await r.arrayBuffer());
    const status_url = `https://a.pool.opentimestamps.org/info/${hash}`;
    return res.status(200).json({ ok:true, ots_b64: otsBuf.toString('base64'), status_url });
  } catch (err) {
    return res.status(500).json({ ok:false, error: err.message || String(err) });
  }
};
