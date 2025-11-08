import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON, ANCHOR_ENDPOINT, UPGRADE_ENDPOINT } from './env.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ---------- helpers ----------
const $ = (q) => document.querySelector(q);
const byId = (x) => document.getElementById(x);
const fmtTs = (row) => {
  const raw = row.timestamp || row.created_at || row.inserted_at || row.db_created_at;
  try { return new Date(raw || Date.now()).toISOString().replace('T',' ').replace('Z',' UTC'); }
  catch { return '—'; }
};
const btcStatus = (row) => {
  if (row.bitcoin_anchored_at) return 'anchored';
  if (row.bitcoin_receipt_b64 || row.bitcoin_receipt) return 'pending';
  return '—';
};
const ecpOf = (row) => row.record_id || row.ecp_id || 'ECP-—';

// compose downloadable cert JSON
const buildCert = (row) => ({
  standard: 'EchoprintOS v1',
  ecp_id: ecpOf(row),
  title: row.title || 'Untitled',
  hash: row.hash || null,
  timestamps: {
    created_at: row.timestamp || row.created_at || null,
    bitcoin: { anchored: !!row.bitcoin_anchored_at, anchored_at: row.bitcoin_anchored_at || null }
  },
  links: {
    permalink: row.permalink || row.link || null,
    media: row.media_url || null,
    verify_ui: location.origin
  }
});

// ---------- renderers ----------
function card(row){
  const ts = fmtTs(row);
  const btc = btcStatus(row);
  return `
  <article class="card" data-ecp="${ecpOf(row)}" data-hash="${row.hash || ''}">
    <div class="card-head">
      <div class="title">${row.title || 'Untitled'} <span class="pill">${ecpOf(row)}</span></div>
    </div>
    <div class="meta"><strong>Hash:</strong> ${row.hash || '—'}</div>
    <div class="meta"><strong>Timestamp (UTC):</strong> ${ts}</div>
    <div class="meta"><strong>Bitcoin:</strong> ${btc}</div>
    <div class="actionbar">
      <button class="btn view-cert">View certificate</button>
      <button class="btn btn-ghost dl-json">Download JSON</button>
    </div>
  </article>`;
}

function renderList(list, into){
  into.innerHTML = list.map(card).join('');
  // wire buttons
  into.querySelectorAll('.view-cert').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const art = e.target.closest('article');
      const ecp = art.dataset.ecp;
      const hash = art.dataset.hash;
      const row = list.find(r => ecpOf(r)===ecp) || { title:'', hash, record_id: ecp };
      openCert(row);
    });
  });
  into.querySelectorAll('.dl-json').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const art = e.target.closest('article');
      const ecp = art.dataset.ecp;
      const row = list.find(r => ecpOf(r)===ecp);
      downloadJSON(buildCert(row), `${ecp}.json`);
    });
  });
}

function openCert(row){
  const body = $('#cert-body');
  body.innerHTML = `
    <div class="card">
      <div class="title" style="font-size:18px;margin-bottom:8px">${row.title || 'Untitled'} <span class="pill">${ecpOf(row)}</span></div>
      <div class="meta"><strong>Hash:</strong> ${row.hash || '—'}</div>
      <div class="meta"><strong>Timestamp (UTC):</strong> ${fmtTs(row)}</div>
      <div class="meta"><strong>Bitcoin:</strong> ${btcStatus(row)}</div>
    </div>`;
  $('#cert-open').onclick = ()=>{ $('#cert-modal').close(); verifyBy(ecpOf(row)); };
  $('#cert-json').onclick = ()=> downloadJSON(buildCert(row), `${ecpOf(row)}.json`);
  $('#cert-modal').showModal();
}
$('#cert-close').addEventListener('click', ()=>$('#cert-modal').close());

function downloadJSON(obj, name){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 500);
}

// ---------- Supabase ops ----------
async function recent(){
  // tolerant select: grab everything the policy allows, sort client-side
  const { data, error } = await sb.from('echoprints').select('*').limit(50);
  if (error){ $('#recent-list').innerHTML = `<div class="muted">${error.message}</div>`; return; }
  const list = (data||[]).sort((a,b) => new Date(b.timestamp||b.created_at||0) - new Date(a.timestamp||a.created_at||0));
  renderList(list, $('#recent-list'));
}

async function verifyBy(input){
  const value = (input || $('#verify-input').value || '').trim();
  if (!value) return;
  let q;
  if (/^ECP[-_]/i.test(value)){
    q = sb.from('echoprints').select('*').or(`record_id.eq.${value},ecp_id.eq.${value}`).limit(1);
  } else if (/^[a-f0-9]{64}$/i.test(value)){
    q = sb.from('echoprints').select('*').eq('hash', value).limit(1);
  } else {
    $('#verify-result').innerHTML = `<div class="muted">Enter ECP-… or 64-hex hash.</div>`;
    return;
  }
  const { data, error } = await q;
  if (error){ $('#verify-result').innerHTML = `<div class="muted">${error.message}</div>`; return; }
  if (!data || !data[0]){ $('#verify-result').innerHTML = `<div class="muted">No match.</div>`; return; }
  renderList(data, $('#verify-result'));
}

$('#verify-btn').addEventListener('click', ()=>verifyBy());
$('#recent-btn').addEventListener('click', recent);

// ---------- Generate flow ----------
async function sha256OfText(text){
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function sha256OfFile(file){
  const buf = await file.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function nextEcp(){
  const d = new Date();
  const pad = (n,w=2)=>String(n).padStart(w,'0');
  return `ECP-${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${pad(d.getUTCMilliseconds(),3)}`;
}

byId('btn-hash-text').onclick = async ()=>{
  const t = byId('gen-text').value.trim();
  if (!t) return;
  const h = await sha256OfText(t);
  byId('gen-hash').value = h;
  byId('btn-save').disabled = false;
  byId('btn-anchor').disabled = false;
};
byId('btn-hash-file').onclick = async ()=>{
  const f = byId('gen-file').files[0];
  if (!f) return;
  const h = await sha256OfFile(f);
  byId('gen-hash').value = h;
  byId('btn-save').disabled = false;
  byId('btn-anchor').disabled = false;
};

byId('btn-save').onclick = async ()=>{
  const title = byId('gen-title').value.trim() || 'Untitled';
  const hash  = byId('gen-hash').value.trim();
  if (!/^[a-f0-9]{64}$/i.test(hash)) return alert('Compute a SHA-256 first.');
  const record_id = nextEcp();
  const payload = {
    title, hash, record_id,
    permalink: byId('gen-link').value.trim() || null,
    media_url: byId('gen-media').value.trim() || null
  };
  const { data, error } = await sb.from('echoprints').insert(payload).select('*').single();
  if (error){ return alert(error.message); }
  // echo into Verify
  $('#verify-input').value = record_id;
  verifyBy(record_id);
  recent();
};

byId('btn-anchor').onclick = async ()=>{
  const hash = byId('gen-hash').value.trim();
  if (!/^[a-f0-9]{64}$/i.test(hash)) return alert('Compute a SHA-256 first.');
  const res = await fetch(ANCHOR_ENDPOINT, {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ hash })
  });
  const j = await res.json().catch(()=>({}));
  if (!res.ok) return alert('Anchor error: ' + (j.error || res.status));
  // Try to attach receipt to the newest row with this hash (best effort)
  await sb.from('echoprints').update({ bitcoin_receipt_b64: j.receipt_b64 }).eq('hash', hash);
  alert('Anchoring started (pending). You can run upgrade later.');
  recent();
};

// initial load
recent();
