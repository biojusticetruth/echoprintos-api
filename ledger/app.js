// /ledger/app.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ENV = window.__ECP__ || {};
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  alert('Missing Supabase ENV');
}
const db = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

// ---------- DOM ----------
const $title = document.querySelector('#title');
const $permalink = document.querySelector('#permalink');
const $media = document.querySelector('#media_url');
const $text = document.querySelector('#text');
const $file = document.querySelector('#file');
const $hash = document.querySelector('#hash');
const $genBtn = document.querySelector('#generate');

const $verifyInput = document.querySelector('#verify-input');
const $verifyBtn = document.querySelector('#verify-btn');
const $recentBtn = document.querySelector('#recent-btn');
const $verifyResult = document.querySelector('#verify-result');
const $recentList = document.querySelector('#recent-list');

const $certModal = document.querySelector('#cert-modal');
const $certBody = document.querySelector('#cert-body');
const $certClose = document.querySelector('#cert-close');
const $certDismiss = document.querySelector('#cert-dismiss');
const $certOpenVerify = document.querySelector('#open-verify');
const $certDl = document.querySelector('#dl-json');

// ---------- helpers ----------
const fmtUTC = (d) =>
  new Date(d).toISOString().replace('T',' ').replace('Z',' UTC');

const makeEcp = (date = new Date()) => {
  // ECP-YYYYMMDDHHMMSSms (short)
  const s = date.toISOString().replace(/[-:TZ.]/g,'');
  return `ECP-${s.slice(0,14)}${s.slice(14,16)}`;
};

async function sha256HexFromText(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256HexFromFile(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function cardHTML(row) {
  const ecp = row.record_id || '—';
  const ts  = row.timestamp || row.created_at || row.inserted_at || new Date().toISOString();
  return `
  <article class="card">
    <span class="ecp chip">${ecp}</span>
    <h3 class="title">${row.title || 'Untitled'}</h3>
    <div class="meta mono"><strong>Hash:</strong> ${row.hash}</div>
    <div class="meta mono"><strong>Timestamp (UTC):</strong> ${fmtUTC(ts)}</div>
    <div class="meta mono"><strong>Bitcoin:</strong> ${row.bitcoin_anchored_at ? 'anchored' : '—'}</div>
    <div class="actions">
      <button class="btn view-cert" data-id="${row.id}">View certificate</button>
      <button class="btn btn-ghost dl-json" data-id="${row.id}">Download JSON</button>
    </div>
  </article>`;
}

function renderRows(target, rows) {
  target.innerHTML = rows.map(cardHTML).join('') || `<div class="muted">No results.</div>`;
  // wire buttons
  target.querySelectorAll('.view-cert').forEach(b=>{
    b.addEventListener('click', async () => showCertificateById(b.dataset.id));
  });
  target.querySelectorAll('.dl-json').forEach(b=>{
    b.addEventListener('click', async () => downloadJsonById(b.dataset.id));
  });
}

async function showCertificateById(id) {
  const { data } = await db.from('echoprints').select('*').eq('id', id).single();
  showCertificate(data);
}
function showCertificate(row) {
  const ts  = row.timestamp || row.created_at || new Date().toISOString();
  $certBody.innerHTML = `
    <div class="card">
      <span class="ecp chip">${row.record_id || '—'}</span>
      <h3 class="title">${row.title || 'Untitled'}</h3>
      <div class="meta mono"><strong>Hash:</strong> ${row.hash}</div>
      <div class="meta mono"><strong>Timestamp (UTC):</strong> ${fmtUTC(ts)}</div>
      <div class="meta mono"><strong>Bitcoin:</strong> ${row.bitcoin_anchored_at ? 'anchored' : '—'}</div>
    </div>`;
  $certOpenVerify.onclick = () => {
    $verifyInput.value = row.record_id || row.hash;
    $certModal.close();
    verify();
  };
  $certDl.onclick = () => downloadJson(row);
  $certModal.showModal();
}
function downloadJson(row) {
  const blob = new Blob([JSON.stringify(row, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href:url, download:`${row.record_id||'certificate'}.json` });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
async function downloadJsonById(id) {
  const { data } = await db.from('echoprints').select('*').eq('id', id).single();
  downloadJson(data);
}

// ---------- actions ----------
$genBtn.addEventListener('click', async () => {
  try {
    // 1) get hash (file wins; else text)
    let hex = '';
    if ($file.files[0]) {
      hex = await sha256HexFromFile($file.files[0]);
    } else if ($text.value.trim()) {
      hex = await sha256HexFromText($text.value.trim());
    } else {
      alert('Add text or choose a file to hash.');
      return;
    }
    $hash.value = hex;

    // 2) save to ledger
    const row = {
      record_id: makeEcp(),
      title: ($title.value || 'Untitled').trim(),
      permalink: ($permalink.value || null) || null,
      media_url: ($media.value || null) || null,
      hash: hex,
      timestamp: new Date().toISOString()
    };
    const { data, error } = await db.from('echoprints').insert(row).select('*').single();
    if (error) throw error;

    // 3) show certificate + prepend to recent
    showCertificate(data);
    recent(true);
  } catch (e) {
    alert('Error: ' + (e.message || e));
  }
});

async function verify() {
  const q = ($verifyInput.value || '').trim();
  if (!q) return;
  let query = db.from('echoprints').select('*').limit(20);
  if (/^ECP-/i.test(q)) query = query.eq('record_id', q);
  else if (/^[a-f0-9]{64}$/i.test(q)) query = query.eq('hash', q.toLowerCase());
  else { alert('Enter an ECP like ECP-XXXX or a 64-hex hash'); return; }
  const { data, error } = await query;
  if (error) { alert(error.message); return; }
  renderRows($verifyResult, data || []);
}
$verifyBtn.addEventListener('click', verify);

async function recent(prepend=false) {
  const { data, error } = await db
    .from('echoprints')
    .select('id,record_id,title,hash,timestamp,created_at,bitcoin_anchored_at')
    .order('created_at', { ascending:false, nullsFirst:false })
    .limit(20);
  if (error) { $recentList.innerHTML = `<div class="muted">${error.message}</div>`; return; }
  renderRows($recentList, data || []);
}
$recentBtn.addEventListener('click', ()=>recent(false));

// init
recent(false);
setInterval(()=>recent(false), 15000);
$certClose?.addEventListener('click', ()=> $certModal.close());
$certDismiss?.addEventListener('click', ()=> $certModal.close());
