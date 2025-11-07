// pages/api/record.js (Next.js Pages Router on Vercel)
// Force Node runtime (NOT Edge)
export const config = { runtime: 'nodejs18.x' };

import crypto from 'crypto';

const norm = (s) => (s || '').replace(/^Bearer\s+/i, '').trim();
const sha = (s) => crypto.createHash('sha256').update(s || '').digest('hex');

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ----- AUTH (tolerant + debug) -----
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
      return res.status(500).json({ error: 'Server key missing (ECHOPRINTS_API_KEY empty)' });
    }
    // timing-safe equal
    const A = Buffer.from(token);
    const B = Buffer.from(expected);
    if (!token || A.length !== B.length || !crypto.timingSafeEqual(A, B)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ----- BODY PARSING (robust) -----
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const text = (body.text ?? '').toString().trim();
    const url  = (body.url  ?? '').toString().trim();
    if (!text || !url) {
      return res.status(400).json({ error: 'Missing required fields: text and url' });
    }

    // ✅ Auth + body OK (stub success)
    return res.status(200).json({ ok: true, msg: 'auth passed; stub success' });
  } catch (e) {
    console.error('record.handler.crash', e);
    return res.status(500).json({ error: 'Handler crashed', detail: e?.message });
  }
}
