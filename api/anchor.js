export const config = { runtime: 'edge' };

const OTS = (process.env.OTS_URL || 'https://a.pool.opentimestamps.org') + '/stamp';

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Use POST', { status:405 });

  const { hash } = await req.json().catch(()=>({}));
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash))
    return new Response(JSON.stringify({ error:'hash must be 64-hex sha256' }), { status:400 });

  const bytes = new Uint8Array(hash.match(/.{2}/g).map(b=>parseInt(b,16)));
  const res = await fetch(OTS, { method:'POST', body:bytes });
  if (!res.ok) return new Response(JSON.stringify({ error:`OTS ${res.status}`, body: await res.text() }), { status:502 });

  const receipt = await res.arrayBuffer();
  const b64 = Buffer.from(receipt).toString('base64');
  return new Response(JSON.stringify({ receipt_b64:b64, status:'pending' }), { headers:{'content-type':'application/json'} });
}
