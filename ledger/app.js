import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY in env.js');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API = location.origin;                  // your Vercel API host (same origin)
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

const isHex64 = s => /^[a-f0-9]{64}$/i.test(s);
const isECP   = s => /^ECP[-\s]?[A-Z0-9]{8,}$/i.test(s);
const ecpOf = r => r.ecp_id || ('ECP-' + (r.record_id||'').toString().replace(/-/g,'').slice(0,12).toUpperCase());
const tsOf  = r => (r.sent_at || r.created_at || '').replace('T',' ').replace('Z',' UTC');

const cardTemplate = $('#card-template');

function renderCard(row){
  const tpl = cardTemplate.content.cloneNode(true);
  $('.title', tpl).textContent = row.title || '(untitled)';
  $('.ecp',   tpl).textContent = ecpOf(row);
  $('.hash',  tpl).textContent = row.hash || '—';
  $('.ts',    tpl).textContent = tsOf(row) || '—';

  // Buttons
  const bOpen  = $('.open-post', tpl);
  const bImg   = $('.view-image', tpl);
  const bVer   = $('.open-in-verify', tpl);
  const bCert  = $('.view-cert', tpl);
  const bJ     = $('.download-json', tpl);
  const bC     = $('.download-cert', tpl);

  if (row.permalink) { bOpen.hidden = false; bOpen.onclick = () => window.open(row.permalink,'_blank'); }
  else if (row.url)  { bOpen.hidden = false; bOpen.textContent='Open link'; bOpen.onclick = () => window.open(row.url,'_blank'); }

  if (row.url && /\.(png|jpe?g|gif|webp|mp4|mov|m4v)$/i.test(row.url)) {
    bImg.hidden = false; bImg.onclick = () => window.open(row.url,'_blank');
  }

  bVer.onclick  = () => { $('#verify-input').value = isHex64(row.hash||'') ? row.hash : ecpOf(row); $('#verify').scrollIntoView({behavior:'smooth'}); };
  bJ.onclick    = () => download('echoprint.json', JSON.stringify(slim(row),null,2));
  bCert.onclick = async () => {
    const cert = await buildCertificate(row);
    $('#cert-pre').textContent = JSON.stringify(cert, null, 2);
    $('#cert-modal').showModal();
  };
  bC.onclick    = async () => {
    const cert = await buildCertificate(row);
    download('echoprint-certificate.json', JSON.stringify(cert, null, 2));
  };

  return tpl;
}

function slim(r){
  return {
    ecp_id: ecpOf(r),
    record_id: r.record_id,
    title: r.title, hash: r.hash,
    url: r.url, permalink: r.permalink, platform: r.platform,
    created_at: r.created_at, sent_at: r.sent_at
  };
}

async function buildCertificate(row){
  // Ask your API to verify/anchor the hash (Bitcoin OpenTimestamps).
  // If your /api/verify returns { anchored:true, txid, merkle, proof_url }, include it.
  let ots = null;
  try {
    const res = await fetch(`${API}/api/verify?hash=${encodeURIComponent(row.hash)}`);
    if (res.ok) ots = await res.json();
  } catch {}
  return {
    standard: 'EchoprintOS v1',
    ecp_id: ecpOf(row),
    title: row.title || null,
    hash: row.hash,
    timestamps: {
      db_created_at: row.created_at || null,
      sent_at: row.sent_at || null,
      bitcoin: ots && (ots.txid || ots.anchored) ? ots : { anchored: false, status: 'pending' }
    },
    links: {
      permalink: row.permalink || null,
      media: row.url || null,
      verify_ui: location.href
    }
  };
}

function download(name, text){
  const blob = new Blob([text], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/* ========== RECENT ========== */
async function loadRecent(){
  const { data, error } = await supabase
    .from('echoprints')
    .select('id,record_id,ecp_id,title,hash,created_at,sent_at,url,permalink,platform')
    .order('created_at', { ascending:false })
    .limit(50);
  const list = $('#recent-list'); list.innerHTML = '';
  if (error) { list.textContent = error.message; return; }
  (data||[]).forEach(r => list.append(renderCard(r)));
}

/* ========== VERIFY ========== */
async function doVerify(q){
  const out = $('#verify-result'); out.innerHTML = '';
  if (!q) { out.textContent='Enter ECP-… or 64-hex hash'; return; }

  let sel = null;
  if (isHex64(q)) sel = supabase.from('echoprints').select('*').eq('hash', q).limit(1);
  else if (isECP(q)) sel = supabase.from('echoprints').select('*').eq('ecp_id', q.toUpperCase()).limit(1);
  else out.textContent = 'Not a valid ECP or 64-hex hash';

  if (!sel) return;
  const { data, error } = await sel;
  if (error) { out.textContent = error.message; return; }
  if (!data || !data.length) { out.textContent = 'No match'; return; }
  out.append(renderCard(data[0]));
}

/* ========== GENERATE ========== */
async function sha256HexFromText(s){
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256HexFromFile(file){
  const buf = await file.arrayBuffer();
  const dig = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

$('#btnHashText').onclick = async ()=>{
  const t = $('#g-text').value||'';
  $('#g-hash').value = t ? await sha256HexFromText(t) : '';
};
$('#btnHashFile').onclick = async ()=>{
  const f = $('#g-file').files[0]; if(!f) return;
  $('#g-hash').value = await sha256HexFromFile(f);
};
$('#btnClear').onclick = ()=>{ ['g-title','g-permalink','g-media','g-text','g-hash'].forEach(id=>$('#'+id).value=''); $('#g-status').textContent=''; };

$('#btnInsert').onclick = async ()=>{
  const title = $('#g-title').value.trim();
  const permalink = $('#g-permalink').value.trim() || null;
  const url = $('#g-media').value.trim() || null;
  const hash = $('#g-hash').value.trim();

  if (!title || !isHex64(hash)) {
    $('#g-status').textContent = 'Need a title and a valid 64-hex hash.';
    return;
  }
  $('#g-status').textContent = 'Stamping on Bitcoin + inserting…';

  // Your serverless API handles: DB insert + OpenTimestamps stamp.
  const res = await fetch(`${API}/api/record`, {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ title, hash, permalink, url, stamp:true })
  });
  if (!res.ok) { $('#g-status').textContent = 'Insert failed.'; return; }
  const r = await res.json();
  $('#g-status').textContent = 'Inserted. (Bitcoin stamp requested.)';
  await loadRecent();
};

/* ========== WIRE UI ========== */
$('#verify-form').addEventListener('submit', e=>{ e.preventDefault(); doVerify($('#verify-input').value.trim()); });
$('#recent-btn').onclick = ()=>loadRecent();
$('#clear-btn').onclick = ()=>{ $('#verify-input').value=''; $('#verify-result').innerHTML=''; };

loadRecent();
