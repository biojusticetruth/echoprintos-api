import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) console.error('Missing env in /ledger/env.js');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// helpers
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const isHex64 = s => !!s && /^[a-f0-9]{64}$/i.test(s);
const isECP   = s => !!s && /^ECP[-\s]?[A-Z0-9]{4,}$/i.test(s);

// derive short ECP label when record_id missing
const ecpOf = (row) => {
  const given = row.record_id;
  if (given && /^ECP[-A-Z0-9]{4,}$/.test(given)) return given;
  const base = (row.record_id || row.id || '').toString().replace(/[^a-f0-9]/gi,'').slice(0,8).toUpperCase();
  return base ? `ECP-${base}` : 'ECP—';
};

// card renderer
function renderCard(row){
  const ecpl = ecpOf(row);
  const ts   = row.timestamp || row.created_at || row.db_created_at || null;
  const tsTxt = ts ? new Date(ts).toISOString().replace('T',' ').replace('Z',' UTC') : '—';
  const btc  = row.bitcoin?.anchored ? 'anchored' : (row.bitcoin ? 'pending' : '—');

  const wrap = document.createElement('article');
  wrap.className = 'card';
  wrap.innerHTML = `
    <div class="ecp">${ecpl}</div>
    <h3 class="title">${row.title || 'Untitled'}</h3>
    <div class="hash"><strong>Hash:</strong> ${row.hash || '—'}</div>
    <div class="ts"><strong>Timestamp (UTC):</strong> ${tsTxt}</div>
    <div class="ts"><strong>Bitcoin:</strong> ${btc}</div>
    <div class="actions">
      <button class="btn open-cert">View certificate</button>
      <button class="btn-ghost dl-json">Download JSON</button>
    </div>
  `;

  // wire actions
  wrap.querySelector('.open-cert').addEventListener('click', () => openCertificate(row));
  wrap.querySelector('.dl-json').addEventListener('click', () => downloadJSON(row));

  return wrap;
}

function downloadJSON(row){
  const blob = new Blob([JSON.stringify(toCertificateJSON(row), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${ecpOf(row)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toCertificateJSON(row){
  return {
    standard: "EchoprintOS v1",
    ecp_id: row.record_id || ecpOf(row),
    title: row.title || "Untitled",
    hash: row.hash || null,
    timestamps: {
      db_created_at: row.created_at || row.db_created_at || null,
      sent_at: row.sent_at || null,
      bitcoin: row.bitcoin || { anchored:false, status: row.bitcoin?.status || 'pending' }
    },
    links: {
      permalink: row.permalink || null,
      media: row.media_url || null,
      verify_ui: location.origin + '/'
    }
  };
}

/* -------- Certificate modal ---------- */
const certModal = $('#cert-modal');
const certBody  = $('#cert-body');
$('#cert-close')?.addEventListener('click', ()=> certModal.close());
$('#cert-open-verify')?.addEventListener('click', () => {
  const id = certBody.dataset.ecp || '';
  $('#verify-input').value = id;
  certModal.close();
  doVerify();
});
$('#cert-download-json')?.addEventListener('click', () => {
  const row = JSON.parse(certBody.dataset.row || '{}');
  downloadJSON(row);
});

function openCertificate(row){
  certBody.dataset.row = JSON.stringify(row);
  certBody.dataset.ecp = row.record_id || ecpOf(row);

  const ecpl = ecpOf(row);
  const ts   = row.timestamp || row.created_at || row.db_created_at || null;
  const tsTxt = ts ? new Date(ts).toISOString().replace('T',' ').replace('Z',' UTC') : '—';
  const btc  = row.bitcoin?.anchored ? 'anchored' : (row.bitcoin ? 'pending' : '—');

  certBody.innerHTML = `
    <div class="card">
      <div class="ecp">${ecpl}</div>
      <h3 class="title">${row.title || 'Untitled'}</h3>
      <div class="hash"><strong>Hash:</strong> ${row.hash || '—'}</div>
      <div class="ts"><strong>Timestamp (UTC):</strong> ${tsTxt}</div>
      <div class="ts"><strong>Bitcoin:</strong> ${btc}</div>
    </div>`;
  certModal.showModal();
}

/* -------- Data loaders ---------- */
async function loadRecent(limit=20){
  const list = $('#recent-list');
  list.innerHTML = '';

  // try created_at, then timestamp, then no order
  let res = await supabase.from('echoprints').select('*').order('created_at', {ascending:false}).limit(limit);
  if (res.error && /created_at/.test(res.error.message)) {
    res = await supabase.from('echoprints').select('*').order('timestamp', {ascending:false}).limit(limit);
  }
  if (res.error) {
    list.innerHTML = `<article class="card"><div class="title">Error</div><div class="hash">${res.error.message}</div></article>`;
    return;
  }
  if (!res.data?.length) {
    list.innerHTML = `<article class="card"><div class="title">No records yet</div></article>`;
    return;
  }
  res.data.forEach(row => list.appendChild(renderCard(row)));
}

async function doVerify(){
  const s = $('#verify-input').value.trim();
  const out = $('#verify-result');
  out.innerHTML = '';

  if (!s) return;

  let q;
  if (isHex64(s)) {
    q = supabase.from('echoprints').select('*').eq('hash', s).limit(1).maybeSingle();
  } else if (isECP(s)) {
    const norm = s.toUpperCase().replace(/\s+/g,'');
    q = supabase.from('echoprints').select('*').eq('record_id', norm).limit(1).maybeSingle();
  } else {
    out.innerHTML = `<article class="card"><div class="title">Invalid input</div><div class="hash">Enter an ECP id or 64-hex hash.</div></article>`;
    return;
  }

  const { data, error } = await q;
  if (error || !data) {
    out.innerHTML = `<article class="card"><div class="title">Not found</div><div class="hash">${error?.message || 'No match'}</div></article>`;
    return;
  }
  out.appendChild(renderCard(data));
  // also pop modal for “clean” cert look
  openCertificate(data);
}

/* -------- wire UI ---------- */
$('#verify-btn')?.addEventListener('click', doVerify);
$('#recent-btn')?.addEventListener('click', () => loadRecent());
document.addEventListener('DOMContentLoaded', () => loadRecent());
