// /api/record.js (Next.js / Vercel)
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 🔐 AUTH DEBUG BLOCK (the snippet you pasted)
    const auth = req.headers.authorization || '';
    const token = (auth.startsWith('Bearer ') ? auth.slice(7) : auth).trim();
    const expected = (process.env.ECHOPRINTS_API_KEY || '').trim();

    console.log('auth.debug', {
      gotBearer: auth.startsWith('Bearer '),
      tokenLen: token.length,
      expectedLen: expected.length
    });

    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ✅ If you get here, auth passed
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !body.url || !body.text) {
      return res.status(400).json({ error: 'Missing required fields: text and url' });
    }

    // TODO: your Supabase insert goes here
    // const { data, error } = await supabase.from('echoprints').insert({...}).select();
    // if (error) return res.status(500).json({ error: 'Supabase insert failed', detail: error.message });

    return res.status(200).json({ ok: true, msg: 'auth passed; stub success' });
  } catch (e) {
    console.error('record.handler.crash', e);
    return res.status(500).json({ error: 'Handler crashed', detail: e?.message });
  }
}
