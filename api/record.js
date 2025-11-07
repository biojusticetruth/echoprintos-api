// /api/record.js — Vercel Serverless Function (root-level /api/*)
// Auth: X-API-Key (preferred), Authorization: Bearer …, or ?key= fallback
// Body: expects JSON with at least { text, url }. Optional fields below.
// perma_link is the database column. Send `perma_link` in body if available.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// helpers
const norm = s => (s || '').replace(/^Bearer\s+/i, '').trim();
const tsc  = (a, b) => {
  const A = Buffer.from(a || '');
  const B = Buffer.from(b || '');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const iso = (v) => (v ? new Date(v).toISOString() : null);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ---------- AUTH (X-API-Key, Bearer, or ?key=) ----------
    const expected = (process.env.ECHOPRINTS_API_KEY || '').trim();
    const headerApiKey = (req.headers['x-api-key'] || '').trim();
    const headerBearer = norm(req.headers.authorization || '');
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

    // ---------- BODY ----------
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

    // ---------- SUPABASE CLIENT ----------
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: 'Server misconfig: Supabase env missing' });
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ---------- MAP + UPSERT (perma_link only) ----------
    const payload = {
      text,
      link: body.link ?? null,
      perma_link: body.perma_link ?? null,   // only perma_link is supported
      url,
      platform: body.platform ?? null,
      handle: body.handle ?? null,
      sent_at: iso(body.sent_at),
      scheduled_at: iso(body.scheduled_at),
      source: body.source ?? 'make',
      raw: body
    };

    // use perma_link for conflict if present, otherwise fall back to url
    const conflictCol = payload.perma_link ? 'perma_link' : 'url';

    const { data, error } = await supabase
      .from('echoprints')
      .upsert(payload, { onConflict: conflictCol })
      .select();

    if (error) {
      console.error('record.insert.error', error);
      return res.status(500).json({ error: 'Supabase insert failed', detail: error.message });
    }

    return res.status(200).json({ ok: true, conflictCol, rows: data?.length || 0 });
  } catch (err) {
    console.error('record.handler.crash', err);
    return res.status(500).json({ error: 'Handler crashed', detail: err?.message });
  }
}
