// /api/upgrade.js  (Vercel serverless - Edge)
export const config = { runtime: 'edge' };

const OTS = (process.env.OTS_URL || 'https://a.pool.opentimestamps.org') + '/upgrade';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Use POST', { status: 405 });
  }

  // expects the original OTS receipt you saved from /api/anchor
  const { receipt_b64 } = await req.json().catch(() => ({}));
  if (!receipt_b64) {
    return new Response(JSON.stringify({ error: 'receipt_b64 is required' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    });
  }

  // decode base64 -> bytes
  const bytes = Uint8Array.from(atob(receipt_b64), c => c.charCodeAt(0));

  // ask the calendar to upgrade the receipt (adds attestations once anchored)
  const res = await fetch(OTS, { method: 'POST', body: bytes });
  if (!res.ok) {
    const body = await res.text();
    return new Response(JSON.stringify({ error: `OTS ${res.status}`, body }), {
      status: 502, headers: { 'content-type': 'application/json' }
    });
  }

  const upgraded = new Uint8Array(await res.arrayBuffer());

  // encode back to base64 for storage
  const upgraded_b64 = btoa(String.fromCharCode(...upgraded));

  // very lightweight “anchored?” heuristic (receipt stays binary; we just hint)
  let anchored = false;
  try {
    const ascii = new TextDecoder().decode(upgraded);
    anchored = /Bitcoin|block/i.test(ascii);
  } catch { /* ignore */ }

  return new Response(JSON.stringify({ receipt_b64: upgraded_b64, anchored }), {
    headers: { 'content-type': 'application/json' }
  });
}
