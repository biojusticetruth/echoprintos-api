// /api/record.js — Vercel Serverless Function (Node.js runtime)

import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ---------- AUTH (tolerant + debug) ----------
    const norm = (s) => (s || '').replace(/^Bearer\s+/i, '').trim();
    const sha = (s) => crypto.createHash('sha256').update(s || '').digest('hex');

    const rawAuth = req.headers.authorization || '';
    const token = norm(rawAuth);
    const expected = norm(process.env.ECHOPRINTS_API_KEY || '');

    const tokenHash = sha(token).slice(0, 12);
    const expectedHash = sha(expected).slice(0, 12);

    console.log('auth.debug', {
      gotHeader: Boolean(rawAuth),
      gotBearerPrefix: /^Bearer\s+/i.test(rawAuth),
      tokenLen: token.length,
      expectedLen: expected.length,
      tokenHash,
      expectedHash,
      vercelEnv: process.env.VERCEL_ENV || null
    });

    if (!expected) {
      return res.status(500).json({ error: 'Server key missing: ECHOPRINTS_API_KEY is empty or missing in this environment' });
    }

    const A = Buffer.from(token);
    const B = Buffer.from(expected);

    if (!token || A.length !== B.length || !crypto.timingSafeEqual(A, B)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ---------- BODY PARSING ----------
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const text = (body.text ?? '').toString().trim();
    const url = (body.url ?? '').toString().trim();
    if (!text || !url) {
      return res.status(400).json({ error: 'Missing required fields: text and url' });
    }

    // ✅ If we reach here, auth + body are valid
    return res.status(200).json({ ok: true, msg: 'auth passed; stub success' });

  } catch (err) {
    console.error('record.handler.crash', err);
    return res.status(500).json({ error: 'Handler crashed', detail: err?.message });
  }
}
