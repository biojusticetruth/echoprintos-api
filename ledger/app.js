import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) console.error('Missing env.js');

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- helpers ---
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const isHex64 = s => !!s && /^[a-f0-9]{64}$/i.test(s);
const isECP   = s => !!s && /^ECP[-\s]?[A-Z0-9]{4,}$/i.test(s);

const tsOf = row => row.created_at || row.timestamp || row.db_created_at || null;
const fmtUTC = ts => ts ? new Date(ts).toISOString().replace('T',' ').replace('Z',' UTC') : '—';
const ecpOf = row => row.ecp_id || row.record_id || row.id ? String(row.ecp_id||row.record_id||row.id).toUpperCase() : '—';

// --- render card ---
function card(row){
  const ecp = ecpOf(row);
  const html = `
  <article class="card">
    <div class="pill">${ecp}</div>
    <div class="title">${row.title || 'Untitled'}</div>
    <div class="meta"><strong>Hash:</strong> ${row.hash || '—'}</div>
    <div class="meta"><strong>Timestamp (UTC):</strong> ${fmtUTC(tsOf(row))}</div>
    <div class="meta"><strong>Bitcoin:</strong> ${row.bitcoin_anchored_at ? 'anchored' : (row.bitcoin_receipt_b64 ? 'pending' : '—')}</div>
    <div class="actions">
      <button class="btn btn-primary view" data-id="${row.id}">View certificate</button>
      <button class="btn json" data-id="${row.id}">Download JSON</button>
    </div>
  </article>`;
  const el = document.createElement('div'); el.innerHTML = html; return el.firstElementChild;
}

// --- certificate modal ---
const certModal = $('#cert-modal');
const certBody  = $('#cert-body');
$('#cert-close').addEventListener('click', ()=>certModal.close());
$('#cert-open').addEventListener('click', ()=>{ certModal.close(); $('#verify-btn').click(); });

async function openCert(row){
  const ecp = ecpOf(row);
  certBody.innerHTML = `
    <div class="card">
      <div class="pill">${ecp}</div>
      <div class="title" style="margin-bottom:6px">${row.title || 'Untitled'}</div>
      <div class="meta"><strong>Hash:</strong> ${row.hash || '—'}</div>
      <div class="meta"><strong>Timestamp (UTC):</strong> ${fmtUTC(tsOf(row))}</div>
      <div class="meta"><strong>Bitcoin:</strong> ${row.bitcoin_anchored_at ? 'anchored' : (row.bitcoin_receipt_b64 ? 'pending' : '—')}</div>
    </div>`;
  $('#cert-open').onclick = ()=>{ $('#verify-input').value = ecp; certModal.close(); $('#verify-btn').click(); };
  $('#cert-json').onclick = ()=>downloadJSON(row);
  certModal.showModal();
}

function downloadJSON(row){
  const data = {
    standard: 'EchoprintOS v1',
    ecp_id: ecpOf(row),
    title: row.title || 'Untitled',
    hash: row.hash || null,
    timestamps: {
      db_created_at: tsOf(row),
      bitcoin: {
        anchored: !!row.bitcoin_anchored_at,
        status: row.bitcoin_anchored_at ? 'anchored' : (row.bitcoin_receipt_b64 ? 'pending' : '—')
      }
    },
    links: { verify_ui: location.origin + '/' }
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'echoprint.json' });
  a.click(); URL.revokeObjectURL(a.href);
}

async function loadRecent(){
  const { data, error } = await sb
    .from('echoprints')
    .select('id, ecp_id, record_id, title, hash, created_at, timestamp') // <— no bitcoin_* fields
    .order('created_at', { ascending:false })
    .limit(20);

  const host = document.querySelector('#recent-list'); host.innerHTML = '';
  if (error) { host.textContent = error.message; return; }
  data.forEach(row=>{
    const el = card(row);
    el.querySelector('.view').onclick = ()=>openCert(row);
    el.querySelector('.json').onclick = ()=>downloadJSON(row);
    host.appendChild(el);
  });
}

// --- verify by ECP or hash ---
async function doVerify(){
  const q = ($('#verify-input').value || '').trim();
  if (!q) return;

  let data, error;
  if (isHex64(q)) {
    ({data, error} = await sb.from('echoprints').select('*').eq('hash', q).limit(1).maybeSingle());
  } else if (isECP(q)) {
    const clean = q.replace(/^ECP[-\s]?/i, '');
    ({data, error} = await sb.from('echoprints').select('*')
      .or(`ecp_id.eq.ECP-${clean},record_id.eq.ECP-${clean},ecp_id.eq.${q},record_id.eq.${q}`)
      .limit(1).maybeSingle());
  } else {
    $('#verify-result').textContent = 'Enter ECP-… or 64-hex SHA-256.';
    return;
  }

  const host = $('#verify-result'); host.innerHTML = '';
  if (error || !data) { host.textContent = 'No record found.'; return; }
  const el = card(data);
  el.querySelector('.view').onclick = ()=>openCert(data);
  el.querySelector('.json').onclick = ()=>downloadJSON(data);
  host.appendChild(el);
}

$('#verify-btn').addEventListener('click', doVerify);
$('#recent-btn').addEventListener('click', loadRecent);

// initial
loadRecent();
