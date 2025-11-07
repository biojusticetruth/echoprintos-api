// /api/record.js — Vercel Serverless Function (root-level /api/*)
//
// Auth: prefers X-API-Key, also accepts Authorization: Bearer … or ?key=
// Body: expects JSON with at least { text, url }

import crypto from 'crypto';

// helpers
const norm = s => (s || '').replace(/^Bearer\s+/i, '').trim();
const tsc  = (a, b) => {
  const A = Buffer.from(a || '');
  const B = Buffer.from(b || '');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ---------- AUTH (X-API-Key, Bearer, or ?key=) ----------
    const expected = (process.env.ECHOPRINTS_API_KEY || '').trim();
    const headerApiKey = (req.headers['x-api-key'] || '').trim();
    const headerBearer = norm(req.headers.authorization || '');

    // query ?key= fallback (Vercel provides req.url without origin)
    let queryKey = '';
    try {
      const u = new URL(req.url, 'http://localhost');
      queryKey = (u.searchParams.get('key') || '').trim();
    } catch {}

    const token = headerApiKey || headerBearer || queryKey;

    console.log('auth.debug', {
      gotXApiKey: Boolean(headerApiKey),
      gotBearer:  Boolean(headerBearer),
      gotQuery:   Boolean(queryKey),
      tokenLen:   (token || '').length,
      expectedLen: expected.length,
      vercelEnv:  process.env.VERCEL_ENV || null
    });

    if (!expected || !token || !tsc(token, expected)) {
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
    const url  = (body.url  ?? '').toString().trim();
    if (!text || !url) {
      return res.status(400).json({ error: 'Missing required fields: text and url' });
    }

    // ✅ Auth + body OK — stub success (uncomment Supabase section below when ready)
    return res.status(200).json({ ok: true, msg: 'auth passed; stub success' });

    /* ---------- SUPABASE INSERT/UPSERT (optional) ----------
    // 1) Ensure env vars exist in Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    // 2) npm i @supabase/supabase-js
    // 3) Uncomment this section and the return below

    import { createClient } from '@supabase/supabase-js';
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const payload = {
      text,
      link: body.link ?? null,
      permalink: body.permalink ?? null,
      url,
      platform: body.platform ?? null,
      handle: body.handle ?? null,
      sent_at: body.sent_at ? new Date(body.sent_at).toISOString() : null,
      scheduled_at: body.scheduled_at ? new Date(body.scheduled_at).toISOString() : null,
      source: body.source ?? 'buffer',
      raw: body
    };

    // Optional: make permalink unique in DB, then use upsert to prevent dupes
    // SQL (run once in Supabase):
    //   create unique index if not exists echoprints_permalink_uidx on public.echoprints (permalink);

    const { data, error } = await supabase
      //.insert(payload)               // for inserts only
      .from('echoprints').upsert(payload, { onConflict: 'permalink' }).select();

    if (error) {
      console.error('record.insert.error', error);
      return res.status(500).json({ error: 'Supabase insert failed', detail: error.message });
    }

    return res.status(200).json({ ok: true, data });
    // ---------- END SUPABASE ----------
    */

  } catch (err) {
    console.error('record.handler.crash', err);
    return res.status(500).json({ error: 'Handler crashed', detail: err?.message });
  }
}
