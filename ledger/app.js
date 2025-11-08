import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = window.env || {};
if(!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY){ alert('Missing Supabase ENV'); }
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

const $ = s => document.querySelector(s);
const els = {
  // generate
  title: $('#g-title'), link: $('#g-link'), media: $('#g-media'),
  text: $('#g-text'), file: $('#g-file'), gen: $('#btnGenerate'),
  anchor: $('#btnAnchor'), outHash: $('#g-hash'),
  // verify
  vInput: $('#verify-input'), vBtn: $('#verify-btn'),
  vOut: $('#verify-result'),
  // lists & modal
  list: $('#recent-list'),
  dlg: $('#cert-modal'), cert: $('#cert-body'),
  certClose: $('#cert-close'), certOpenV: $('#cert-open-verify'),
  certJson: $('#cert-json'), certPrint: $('#cert-print'),
};

const iso = (d)=> new Date(d).toISOString().replace('T',' ').replace('Z',' UTC');
const isHex64 = s => /^[a-f0-9]{64}$/i.test((s||'').trim());
const isECP   = s => /^ECP[-A-Z0-9]{8,}$/i.test((s||'').trim());

// Make a long, legible ECP like before (12 hex)
const makeEcp = () => {
  const rand = crypto.getRandomValues(new Uint8Array(8)); // 8 bytes -> 16 hex
  const hex  = [...rand].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,12).toUpperCase();
  return `ECP-${hex}`;
};

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

/* -------------------- GENERATE (single button) -------------------- */
let lastRow = null;

els.gen.onclick = async ()=>{
  try{
    // 1) compute hash
    let hash='';
    if(els.file.files?.[0])       hash = await sha256HexFromFile(els.file.files[0]);
    else if(els.text.value.trim()) hash = await sha256HexFromText(els.text.value);
    else { alert('Provide text or a file.'); return; }
    els.outHash.value = hash;

    // 2) insert (auto-save)
    const row = {
      record_id: makeEcp(),
      title: (els.title.value || 'Untitled').trim(),
      hash,
      permalink: els.link.value || null,
      media_url: els.media.value || null,
      timestamp: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('echoprints')
      .insert(row)
      .select('id,record_id,title,hash,permalink,media_url,timestamp,created_at,bitcoin_receipt_b64,bitcoin_anchored_at')
      .single();

    if(error) throw error;
    lastRow = data;

    // 3) show cert + prepend to Recent
    renderCertificate(data);
    prependCard(data);
    els.anchor.disabled = false;
  }catch(e){
    console.error(e); alert('Generate failed: ' + (e.message||e));
  }
};

/* --------- OPTIONAL: Anchor to Bitcoin via /api/anchor (if you deploy it) --------- */
els.anchor.onclick = async ()=>{
  if(!lastRow || !isHex64(lastRow.hash)){ return; }
  els.anchor.disabled = true; els.anchor.textContent = 'Anchoring…';
  try{
    const res = await fetch('/api/anchor', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ hash: lastRow.hash })
    });
    const payload = await res.json();
    if(!res.ok) throw new Error(payload.error||'OTS error');

    await supabase.from('echoprints')
      .update({ bitcoin_receipt_b64: payload.receipt_b64 })
      .eq('id', lastRow.id);

    els.anchor.textContent = 'Anchored (pending upgrade)';
  }catch(e){
    console.error(e);
    alert('Anchor failed: ' + (e.message||e));
    els.anchor.textContent = 'Anchor to Bitcoin';
    els.anchor.disabled = false;
  }
};

/* -------------------- VERIFY -------------------- */
els.vBtn.onclick = async ()=>{
  const q = (els.vInput.value||'').trim();
  els.vOut.innerHTML = '';
  if(!q) return;

  let sel = supabase.from('echoprints')
    .select('id,record_id,title,hash,permalink,media_url,timestamp,created_at,bitcoin_receipt_b64,bitcoin_anchored_at')
    .limit(1);

  if(isHex64(q)) sel = sel.eq('hash', q);
  else if(isECP(q)) sel = sel.eq('record_id', q.toUpperCase());
  else { els.vOut.textContent = 'Enter ECP-… or 64-hex hash.'; return; }

  const { data, error } = await sel;
  if(error){ els.vOut.textContent = error.message; return; }
  if(!data || !data.length){ els.vOut.textContent = 'No match.'; return; }
  els.vOut.prepend(cardEl(data[0]));
};

/* -------------------- RECENT + REALTIME -------------------- */
async function loadRecent(){
  const { data, error } = await supabase.from('echoprints')
    .select('id,record_id,title,hash,permalink,media_url,timestamp,created_at,bitcoin_receipt_b64,bitcoin_anchored_at')
    .order('timestamp',{ascending:false}).limit(30);
  if(error){ console.error(error); return; }
  els.list.innerHTML = '';
  (data||[]).forEach(r => els.list.append(cardEl(r)));
}
loadRecent();

supabase.channel('public:echoprints')
  .on('postgres_changes', { event:'INSERT', schema:'public', table:'echoprints' },
    payload => prependCard(payload.new))
  .subscribe();

function prependCard(r){ els.list.prepend(cardEl(r)); }

/* -------------------- RENDERING -------------------- */
function cardEl(row){
  const ecp = row.record_id || '—';
  const dt  = row.timestamp || row.created_at || null;
  const btc = row.bitcoin_anchored_at ? 'anchored'
           : row.bitcoin_receipt_b64 ? 'pending'
           : '—';

  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="head">
      <h3 class="title">${row.title || 'Untitled'}</h3>
      <span class="ecp">${ecp}</span>
    </div>
    <div class="meta"><strong>Hash:</strong> ${row.hash || '—'}</div>
    <div class="meta"><strong>Timestamp (UTC):</strong> ${dt ? iso(dt) : '—'}</div>
    <div class="meta"><strong>Bitcoin:</strong> ${btc}</div>
    <div class="actions">
      ${row.permalink?'<button class="btn ghost open-post">Open post</button>':''}
      ${row.media_url?'<button class="btn ghost view-image">View image</button>':''}
      <button class="btn open-verify">Open in Verify</button>
      <button class="btn ghost view-cert">View certificate</button>
      <button class="btn ghost dl-json">Download JSON</button>
    </div>`;

  if(row.permalink) el.querySelector('.open-post').onclick = () => window.open(row.permalink,'_blank');
  if(row.media_url) el.querySelector('.view-image').onclick = () => window.open(row.media_url,'_blank');

  el.querySelector('.open-verify').onclick = ()=>{
    els.vInput.value = row.record_id || row.hash || '';
    els.vBtn.click();
    window.scrollTo({top:0,behavior:'smooth'});
  };

  el.querySelector('.view-cert').onclick = ()=> renderCertificate(row);
  el.querySelector('.dl-json').onclick   = ()=> downloadJSON(row, (row.record_id||'echoprint')+'.json');
  return el;
}

function renderCertificate(row){
  const ecp = row.record_id || '—';
  const dt  = row.timestamp || row.created_at || null;
  const btc = row.bitcoin_anchored_at ? 'anchored'
           : row.bitcoin_receipt_b64 ? 'pending'
           : '—';

  els.cert.innerHTML = `
    <article class="card">
      <div class="head">
        <h3 class="title">${row.title || 'Untitled'}</h3>
        <span class="ecp">${ecp}</span>
      </div>
      <div class="meta"><strong>Hash:</strong> ${row.hash || '—'}</div>
      <div class="meta"><strong>Timestamp (UTC):</strong> ${dt ? iso(dt) : '—'}</div>
      <div class="meta"><strong>Permalink:</strong> ${row.permalink || '—'}</div>
      <div class="meta"><strong>Media URL:</strong> ${row.media_url || '—'}</div>
      <div class="meta"><strong>Bitcoin:</strong> ${btc}</div>
    </article>`;
  els.dlg.showModal();

  els.certOpenV.onclick = ()=>{
    els.vInput.value = row.record_id || row.hash || '';
    els.dlg.close(); els.vBtn.click();
  };
  els.certJson.onclick  = ()=> downloadJSON(certificatePayload(row), (ecp||'echoprint')+'-certificate.json');
  els.certPrint.onclick = ()=> window.print();
}
$('#cert-close')?.addEventListener('click', ()=>els.dlg.close());

function certificatePayload(r){
  return {
    standard: 'EchoprintOS v1',
    ecp_id: r.record_id || null,
    title: r.title || null,
    hash: r.hash || null,
    timestamps: {
      db_created_at: r.created_at || null,
      sent_at: r.timestamp || null,
      bitcoin: r.bitcoin_anchored_at ? { anchored:true, anchored_at:r.bitcoin_anchored_at }
              : r.bitcoin_receipt_b64 ? { anchored:false, status:'pending' }
              : { anchored:false, status:'no-receipt' }
    },
    links: {
      permalink: r.permalink || null,
      media: r.media_url || null,
      verify_ui: location.href
    }
  };
}

function downloadJSON(obj, name){
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
