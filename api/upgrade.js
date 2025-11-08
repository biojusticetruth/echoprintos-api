export const config = { runtime: 'edge' };

const OTS_UPGRADE = (process.env.OTS_URL || 'https://a.pool.opentimestamps.org') + '/upgrade';

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Use POST', { status:405 });

  const { receipt_b64 } = await req.json().catch(()=>({}));
  if (!receipt_b64) return new Response(JSON.stringify({ error:'receipt_b64 required' }), { status:400 });

  const res = await fetch(OTS_UPGRADE, { method:'POST', body: Buffer.from(receipt_b64,'base64') });
  if (!res.ok) return new Response(JSON.stringify({ error:`OTS ${res.status}`, body: await res.text() }), { status:502 });

  const upgraded = await res.arrayBuffer();
  return new Response(JSON.stringify({ receipt_b64: Buffer.from(upgraded).toString('base64'), status:'anchored-or-still-pending' }), { headers:{'content-type':'application/json'} });
}
