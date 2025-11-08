export const config = { runtime: 'edge' };

const OTS_UPGRADE = (process.env.OTS_URL || 'https://a.pool.opentimestamps.org') + '/upgrade';

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Use POST', { status:405 });
  const { receipt_b64 } = await req.json().catch(()=>({}));
  if (!receipt_b64) return new Response(JSON.stringify({ error:'receipt_b64 required' }), { status:400 });

  const receipt = Buffer.from(receipt_b64, 'base64');
  const res = await fetch(OTS_UPGRADE, { method:'POST', body: receipt });
  if (!res.ok) {
    const t = await res.text();
    return new Response(JSON.stringify({ error:`OTS ${res.status}`, body:t }), { status:502 });
  }
  const upgraded = await res.arrayBuffer();
  const b64 = Buffer.from(upgraded).toString('base64');

  // We can’t *prove* anchored from the pool alone; store the upgraded receipt.
  return new Response(JSON.stringify({ status:'upgraded', receipt_b64: b64 }), {
    headers: { 'content-type':'application/json' }
  });
}
