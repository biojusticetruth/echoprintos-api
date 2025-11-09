import { createHash } from 'crypto';

function toRecordId(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  const pad = (n, len=2) => String(n).padStart(len, '0');
  const ms = pad(d.getUTCMilliseconds(), 3);
  return `ECP-${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${ms}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok:false, error:'Method not allowed' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !key) {
      return res.status(500).json({ ok:false, error:'Missing Supabase env vars' });
    }

    const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;

    const {
      platform,
      permalink,          // canonical URL of the post
      url,                // alt url if you use one
      title,
      author_handle,
      text,
      text_html,
      published_at        // ISO datetime if you have it; optional
    } = body || {};

    if (!permalink && !title && !text) {
      return res.status(400).json({ ok:false, error:'Provide at least permalink or title/text' });
    }

    // 1) record_id
    const record_id = toRecordId(published_at);

    // 2) timestamp to store (sent_at)
    const sent_at = published_at ? new Date(published_at).toISOString() : null;

    // 3) hash over a canonical string (permalink|title|text|timestampISO)
    const canon = [
      permalink || '',
      title || '',
      text || '',
      sent_at || ''
    ].join('|');
    const hash = createHash('sha256').update(canon, 'utf8').digest('hex');

    // 4) insert into canonical table
    const payload = {
      record_id,
      title: title || null,
      platform: platform || null,
      author_handle: author_handle || null,
      permalink: permalink || null,
      url: url || null,
      text: text || null,
      text_html: text_html || null,
      sent_at,            // falls back to created_at if null, via DB defaults
      hash
    };

    const r = await fetch(`${supabaseUrl}/rest/v1/echoprints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ ok:false, error: err });
    }

    const [row] = await r.json();
    return res.status(200).json({ ok:true, record: row });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
