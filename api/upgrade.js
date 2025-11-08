export const config = { runtime: 'edge' };
const UPG = (process.env.OTS_UPGRADE_URL || 'https://a.pool.opentimestamps.org') + '/upgrade';

export default async function handler(req){
  if (req.method !== 'POST') return new Response('Use POST', { status:405 });
  const { receipt_b64 } = await req.json().catch(()=>({}));
  if (!receipt_b64) return new Response(JSON.stringify({ error:'missing receipt_b64' }), { status:400 });

  const bin = Buffer.from(receipt_b64, 'base64');
  const res = await fetch(UPG, { method:'POST', body:bin });
  if (!res.ok) return new Response(JSON.stringify({ error:`Upgrade ${res.status}` }), { status:502 });

  // Many pools return 200 even if still pending; we simply report that
  // Some give a timestamp—pass it through if present
  const upgraded = await res.arrayBuffer();
  const b64 = Buffer.from(upgraded).toString('base64');
  // When pools expose a confirmed time, you could parse it. For now:
  return new Response(JSON.stringify({ receipt_b64: b64, anchored_at: null }), {
    headers: { 'content-type':'application/json' }
  });
}
