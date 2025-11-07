import crypto from 'crypto';

// normalize + safe compare helpers
const norm = (s) => (s || '').replace(/^Bearer\s+/i, '').trim();
const sha = (s) => crypto.createHash('sha256').update(s || '').digest('hex');
const tsc = (a, b) => {
  // timing-safe compare on equal-length buffers
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 🔐 AUTH (tolerant + debug)
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
      tokenHash,         // safe short hashes, not the secret
      expectedHash,
      vercelEnv: process.env.VERCEL_ENV || null, // "production" / "preview" / "development"
    });

    if (!expected) {
      return res.status(500).json({ error: 'Server key missing (ECHOPRINTS_API_KEY empty)' });
    }

    // timing-safe compare on normalized values
    if (!token || !tsc(token, expected)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ✅ if you get here, auth passed
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !body.url || !body.text) {
      return res.status(400).json({ error: 'Missing required fields: text and url' });
    }

    return res.status(200).json({ ok: true, msg: 'auth passed; stub success' });
  } catch (e) {
    console.error('record.handler.crash', e);
    return res.status(500).json({ error: 'Handler crashed', detail: e?.message });
  }
}
