import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY in env.js');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// API host (same origin if you deployed /api/record and /api/verify on Vercel)
const API = location.origin;
// Modal refs (top-level in app.js)
const certModal = document.querySelector('#cert-modal');
const certBody  = document.querySelector('#cert-body');

function renderCertificate(row) {
  const ecpl = row.record_id || '(pending id)';
  const btc  = row.bitcoin?.anchored ? 'anchored' : (row.bitcoin ? 'pending' : '—');
  certBody.innerHTML = `
    <div class="card">
      <div class="ecp">${ecpl}</div>
      <h3 class="title">${row.title || 'Untitled'}</h3>
      <div class="hash"><strong>Hash:</strong> ${row.hash}</div>
      <div class="ts"><strong>Timestamp (UTC):</strong> ${
        new Date(row.timestamp || row.db_created_at || Date.now())
          .toISOString().replace('T',' ').replace('Z',' UTC')
      }</div>
      <div class="ts"><strong>Bitcoin:</strong> ${btc}</div>
      <div class="actions" style="margin-top:12px">
        <button class="btn" id="open-verify">Open in Verify</button>
        <button class="btn-ghost" id="dl-json">Download JSON</button>
      </div>
    </div>`;
  certModal.showModal();
}

// close buttons
document.querySelector('#cert-close')?.addEventListener('click', ()=>certModal.close());
document.querySelector('#cert-dismiss')?.addEventListener('click', ()=>certModal.close());
// Shorthand DOM helpers
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

// ------------ validators ------------
const isHex64 = s => !!s && /^[a-f0-9]{64}$/i.test(s);
const isECP   = s => !!s && /^ECP[-\s]?[A-Z0-9]{4,}$/i.test(s);

// ------------ ECP label (short, stable) ------------
/* Prefer a stored ecp_id if present; otherwise derive from record_id/uuid:
   take first 8 hex chars of the UUID (no dashes), uppercase → ECP-XXXXXXXX */
const ecpOf = (row) => {
  if (row.ecp_id && /^ECP[-A-Z0-9]{4,}$/.test(row.ecp_id)) return row.ecp_id.toUpperCase();
  const base = (row.record_id || row.id || '')
    .toString().replace(/[^a-f0-9]/gi,'').slice(0,8).toUpperCase();
  return base ? `ECP-${base}` : 'ECP——';
};

// ------------ timestamp pretty ------------
const prettyTS = (row) => {
  const t = row.sent_at || row.created_at || '';
  if (!t) return '—';
  try {
    return new Date(t).toISOString().replace('T',' ').replace('Z',' UTC');
  } catch { return t; }
};

// Card template
const cardTemplate = $('#card-template');

// ------------ certificate builder ------------
async function buildCertificate(row){
  // Try to fetch Bitcoin/OpenTimestamps proof from your API (optional).
  let ots = null;
  try {
    if (isHex64(row.hash)) {
      const res = await fetch(`${API}/api/verify?hash=${encodeURIComponent(row.hash)}`);
      if (res.ok) ots = await res.json();
    }
  } catch {}

  return {
    standard: 'EchoprintOS v1',
    ecp_id: ecpOf(row),
    title: row.title || null,
    hash: isHex64(row.hash) ? row.hash : null,
    timestamps: {
      db_created_at: row.created_at || null,
      sent_at: row.sent_at || null,
      bitcoin: ots && (ots.txid || ots.anchored)
        ? ots
        : { anchored: false, status: isHex64(row.hash) ? 'pending' : 'no-hash' }
    },
    links: {
      permalink: row.permalink || null,
      media: row.url || null,
      verify_ui: location.href
    }
  };
}
async function anchorToBitcoin(hash, meta = {}) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('64-hex hash required');
  const r = await fetch(window.__ENV.ANCHOR_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash, ...meta })
  });
  return r.json(); // { ok:true, bitcoin:{ anchored:false, status:'pending' } }
}
document.querySelector('#insert-bitcoin')?.addEventListener('click', async () => {
  const hash = document.querySelector('#existing-hash').value.trim();
  const row  = await createRecordFromHash(hash);     // your existing insert flow
  await afterCreateRecord(row);
});

// Example: call right after you create a record
async function afterCreateRecord(row) {
  try {
    const anchor = await anchorToBitcoin(row.hash, { record_id: row.record_id, title: row.title });
    row.bitcoin = anchor.bitcoin;                     // keep in memory
    renderCertificate(row);                           // your existing render – now shows “pending”
  } catch (e) {
    console.warn('Anchor submit failed:', e);
  }
}
// Small helper to download a JSON blob
function download(name, text){
  const blob = new Blob([text], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

// For the small JSON export
function slim(r){
  return {
    ecp_id: ecpOf(r),
    record_id: r.record_id ?? null,
    title: r.title ?? null,
    hash: isHex64(r.hash) ? r.hash : null,
    url: r.url ?? null,
    permalink: r.permalink ?? null,
    platform: r.platform ?? null,
    created_at: r.created_at ?? null,
    sent_at: r.sent_at ?? null
  };
}

// ------------ render a card (with safe buttons) ------------
function renderCard(row){
  const tpl = cardTemplate.content.cloneNode(true);

  // Title + ECP label
  const title = row.title || (row.permalink ? new URL(row.permalink).hostname : '(untitled)');
  $('.title', tpl).textContent = title;
  $('.ecp',   tpl).textContent = ecpOf(row);
function newEcpId() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g,''); // YYYYMMDDHHMMSSmmm
  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(16).slice(0,6).toUpperCase();
  return `ECP-${ts}-${rand}`;
}

// when creating a row:
const row = {
  record_id: newEcpId(),
  title, hash, permalink, media_url
};
  // Hash + Timestamp
  $('.hash', tpl).textContent = isHex64(row.hash) ? row.hash : '—';
  $('.ts',   tpl).textContent = prettyTS(row);

  // Buttons
  const bOpen  = $('.open-post', tpl);
  const bImg   = $('.view-image', tpl);
  const bVer   = $('.open-in-verify', tpl);
  const bCert  = $('.view-cert', tpl);
  const bJ     = $('.download-json', tpl);
  const bC     = $('.download-cert', tpl);

  // Open post / link
  if (row.permalink) {
    bOpen.hidden = false;
    bOpen.onclick = () => window.open(row.permalink,'_blank');
  } else if (row.url) {
    bOpen.hidden = false;
    bOpen.textContent='Open link';
    bOpen.onclick = () => window.open(row.url,'_blank');
  }

  // View image (only for obvious media)
  if (row.url && /\.(png|jpe?g|gif|webp|mp4|mov|m4v)$/i.test(row.url)) {
    bImg.hidden = false; bImg.onclick = () => window.open(row.url,'_blank');
  }

  // Open in Verify (prefer hash, else ECP)
  bVer.onclick = () => {
    const q = isHex64(row.hash) ? row.hash : ecpOf(row);
    const input = $('#verify-input');
    if (input) {
      input.value = q;
      $('#verify-btn')?.click();
      document.getElementById('verify')?.scrollIntoView({behavior:'smooth'});
    }
  };

  // Certificate buttons: disable when no valid hash
  const enableCert = isHex64(row.hash);
  bCert.disabled = !enableCert;
  bC.disabled    = !enableCert;

  // View certificate (modal text JSON)
  bCert.onclick = async () => {
    const cert = await buildCertificate(row);
    const pre  = $('#cert-pre');
    const dlg  = $('#cert-modal');
    if (pre && dlg) { pre.textContent = JSON.stringify(cert, null, 2); dlg.showModal(); }
  };

  // Downloads
  bJ.onclick = () => download(`${ecpOf(row)}.json`, JSON.stringify(slim(row),null,2));
  bC.onclick = async () => {
    const cert = await buildCertificate(row);
    download(`${ecpOf(row)}-certificate.json`, JSON.stringify(cert, null, 2));
  };

  return tpl;
}

// ========== RECENT ==========
async function loadRecent(){
  const list = $('#recent-list'); if (list) list.innerHTML = '';
  const { data, error } = await supabase
    .from('echoprints')
    .select('id,record_id,ecp_id,title,hash,created_at,sent_at,url,permalink,platform')
    .order('created_at', { ascending:false })
    .limit(50);

  if (!list) return;
  if (error) { list.textContent = error.message; return; }
  (data||[]).forEach(r => list.append(renderCard(r)));
}

// ========== VERIFY ==========
async function doVerify(q){
  const out = $('#verify-result'); if (out) out.innerHTML = '';
  if (!q) { out && (out.textContent='Enter ECP-… or 64-hex hash'); return; }

  // 1) Hash lookup
  if (isHex64(q)) {
    const { data, error } = await supabase.from('echoprints').select('*').eq('hash', q).limit(1);
    if (error) { out && (out.textContent = error.message); return; }
    if (!data?.length) { out && (out.textContent = 'No match'); return; }
    out && out.append(renderCard(data[0])); return;
  }

  // 2) ECP lookup
  if (isECP(q)) {
    // Try DB column first
    let row = null;
    try {
      const { data } = await supabase.from('echoprints').select('*').eq('ecp_id', q.toUpperCase()).limit(1);
      if (data?.length) row = data[0];
    } catch {}
    if (!row) {
      // Fallback: scan recent and match computed ECPs
      const { data } = await supabase
        .from('echoprints')
        .select('id,record_id,ecp_id,title,hash,created_at,sent_at,url,permalink,platform')
        .order('created_at',{ascending:false}).limit(500);
      row = (data||[]).find(r => ecpOf(r).toUpperCase() === q.toUpperCase()) || null;
    }
    if (!row) { out && (out.textContent='No match'); return; }
    out && out.append(renderCard(row)); return;
  }

  out && (out.textContent = 'Not a valid ECP or 64-hex hash');
}

// ========== GENERATE (safe wiring) ==========
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

// Only attach if those elements exist (prevents crashes when Generate UI isn’t on the page)
$('#btnHashText')?.addEventListener('click', async ()=>{
  const t = $('#g-text')?.value || '';
  const out = $('#g-hash'); if (!out) return;
  out.value = t ? await sha256HexFromText(t) : '';
});
$('#btnHashFile')?.addEventListener('click', async ()=>{
  const f = $('#g-file')?.files?.[0]; const out = $('#g-hash'); if (!out || !f) return;
  out.value = await sha256HexFromFile(f);
});
$('#btnClear')?.addEventListener('click', ()=>{
  ['g-title','g-permalink','g-media','g-text','g-hash'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
  const s = $('#g-status'); if (s) s.textContent='';
});
$('#btnInsert')?.addEventListener('click', async ()=>{
  const title = $('#g-title')?.value?.trim() || '';
  const permalink = $('#g-permalink')?.value?.trim() || null;
  const url = $('#g-media')?.value?.trim() || null;
  const hash = $('#g-hash')?.value?.trim() || '';

  const status = $('#g-status');
  if (!title || !isHex64(hash)) { status && (status.textContent='Need a title and a valid 64-hex hash.'); return; }
  status && (status.textContent='Stamping on Bitcoin + inserting…');

  // Your serverless API does DB insert + OpenTimestamps stamp.
  try {
    const res = await fetch(`${API}/api/record`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ title, hash, permalink, url, stamp:true })
    });
    if (!res.ok) throw new Error('Insert failed');
    status && (status.textContent='Inserted. (Bitcoin stamp requested.)');
  } catch {
    status && (status.textContent='Insert failed.');
  }
  await loadRecent();
});

// ========== WIRE UI ==========
$('#verify-form')?.addEventListener('submit', e=>{
  e.preventDefault();
  doVerify($('#verify-input')?.value?.trim() || '');
});
$('#recent-btn')?.addEventListener('click', ()=>loadRecent());
$('#clear-btn')?.addEventListener('click', ()=>{
  const v = $('#verify-input'); if (v) v.value='';
  const out = $('#verify-result'); if (out) out.innerHTML='';
});

// Boot
loadRecent();
