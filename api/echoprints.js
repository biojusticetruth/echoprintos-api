// app/api/echoprints/route.js
export const runtime = 'edge';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  const base = `${process.env.SUPABASE_URL}/rest/v1/v_echoprints_public`;
  const u = new URL(base);
  u.searchParams.set('select','ecp_id,hash,title,timestamp_human_utc,timestamp_iso');
  u.searchParams.set('order','timestamp_iso.desc');
  u.searchParams.set('limit','12');

  const r = await fetch(u.toString(), {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await r.text();
  return new Response(body, { status: r.status, headers: { 'Content-Type':'application/json', ...cors } });
}

export function OPTIONS() {
  return new Response(null, { headers: cors });
}
