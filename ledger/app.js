import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// ------- Supabase (read-only in browser)
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  alert('Missing Supabase env. Check /ledger/env.js'); throw new Error('Missing env');
}
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------- helpers
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const isHex64 = (s='') => /^[a-f0-9]{64}$/i.test(s.trim());
const isECP   = (s='') => /^ECP[-A-Z0-9]/i.test(s.trim());   // do not shorten or mutate your ECP

const titleOf = (r) => r.title || r.post_title || r.caption || 'Untitled';
const ecpOf   = (r) => r.ecp_id || r.record_id || '';        // keep whatever you already store
const permaOf = (r) => r.permalink || r.perma_link || '';
const mediaOf = (r) => r.url || r.image_url || r.photo_url || r.document_url || r.file_url || r.thumb_url || '';

const tsRaw   = (r) => r.sent_at || r.created_at || r.timestamp || r.timestamp_iso || null;
const fmtUTC  = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d)) return String(t);
  return d.toISOString().replace('T',' ').replace('Z',' UTC');
};

function route(tab){
  const t = tab || (location.hash.replace('#','') || 'feed');
  ['verify','feed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = (id !== t);
  });
  $$('.tab').forEach(a => a.classList.toggle('active', a.dataset.tab === t));
}

// ------- certificate modal
const certModal = $('#cert-modal');
const certBody  = $('#cert-body');
const certDlJSON= $('#cert-dl-json');
const certDlCert= $('#cert-dl-cert');
$('#cert-close')?.addEventListener('click', ()=>certModal.close());
certModal?.addEventListener('click', (e)=>{ if(e.target === certModal) certModal.close(); });
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && certModal?.open) certModal.close(); });

function makeCertificate(row){
  const cert = {
    standard: 'EchoprintOS v1',
    ecp_id: ecpOf(row) || null,
    title: titleOf(row),
    hash: row.hash || null,
    timestamps: {
      db_created_at: row.created_at || null,
      sent_at: row.sent_at || null,
      bitcoin: { anchored:false, status: row.hash ? 'pending' : 'no-hash' }
    },
    links: { permalink: permaOf(row) || null, media: mediaOf(row) || null, verify_ui: location.href }
  };
  return cert;
}
function openCert(row){
  const cert = makeCertificate(row);
  certBody.innerHTML = `
    <div class="cert">
      <h3>${cert.title || 'Untitled'}</h3>
      <div class="row">
        <div class="item"><span class="k">ECP</span><span class="v">${cert.ecp_id || '—'}</span></div>
        <div class="item"><span class="k">SHA-256</span><span class="v">${cert.hash || '—'}</span></div>
        <div class="item"><span class="k">Timestamp (UTC)</span><span class="v">${fmtUTC(cert.timestamps.db_created_at || cert.timestamps.sent_at) || '—'}</span></div>
        <div class="item"><span class="k">Bitcoin</span><span class="v">${cert.timestamps.bitcoin.status}</span></div>
        <div class="item"><span class="k">Permalink</span><span class="v">${cert.links.permalink ? `<a href="${cert.links.permalink}" target="_blank" rel="noopener">${cert.links.permalink}</a>` : '—'}</span></div>
        <div class="item"><span class="k">Media</span><span class="v">${cert.links.media ? `<a href="${cert.links.media}" target="_blank" rel="noopener">${cert.links.media}</a>` : '—'}</span></div>
      </div>
    </div>`;
  // wire downloads
  certDlJSON.onclick = () => downloadJSON('echoprint.json', row);
  certDlCert.onclick = () => downloadJSON('echoprint-certificate.json', cert);
  certModal.showModal();
}
function downloadJSON(name, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}

// ------- render a card (compact; “View” toggles details)
const tpl = $('#card-template');
function renderCard(row, expanded=false){
  const n = tpl.content.cloneNode(true);
  $('.title', n).textContent = titleOf(row);
  $('.ecp-pill', n).textContent = ecpOf(row) || 'ECP';

  $('.ts', n).textContent = fmtUTC(tsRaw(row)) || '—';

  const permalink = permaOf(row);
  const media = mediaOf(row);

  const aPost = $('.open-post', n);
  const aImg  = $('.view-image', n);
  const aVer  = $('.open-verify', n);
  const aMore = $('.view-more', n);
  const aCert = $('.cert-open', n);
  const aJ    = $('.dl-json', n);
  const aC    = $('.dl-cert', n);
  const box   = $('.details', n);

  if (permalink) { aPost.hidden = false; aPost.href = permalink; }
  if (media) {
    const isImg = /\.(png|jpe?g|gif|webp|mp4|mov|m4v)$/i.test(media);
    aImg.hidden = !isImg;
    if (isImg){ aImg.href = media; }
  }

  aVer.onclick  = (e)=>{ e.preventDefault(); goVerify(ecpOf(row) || row.hash || ''); };
  aMore.onclick = (e)=>{ e.preventDefault(); box.hidden = !box.hidden; aMore.textContent = box.hidden ? 'View' : 'Hide'; };

  $('.ecp', n).value  = ecpOf(row) || '';
  $('.hash', n).value = row.hash || '';

  // copy buttons
  $$('.copy', n).forEach(btn=>{
    btn.onclick = ()=>{
      const input = btn.previousElementSibling;
      input?.select(); document.execCommand('copy');
      btn.textContent='Copied'; setTimeout(()=>btn.textContent='Copy', 900);
    };
  });

  aCert.onclick = (e)=>{ e.preventDefault(); openCert(row); };
  aJ.onclick    = (e)=>{ e.preventDefault(); downloadJSON('echoprint.json', slim(row)); };
  aC.onclick    = (e)=>{ e.preventDefault(); downloadJSON('echoprint-certificate.json', makeCertificate(row)); };

  if (!expanded) box.hidden = true;
  return n;
}
function slim(r){
  return {
    ecp_id: ecpOf(r) || null,
    record_id: r.record_id || null,
    title: titleOf(r),
    hash: r.hash || null,
    permalink: permaOf(r) || null,
    media: mediaOf(r) || null,
    created_at: r.created_at || null,
    sent_at: r.sent_at || null
  };
}

// ------- FEED
async function loadRecent(){
  const list = $('#recent-list');
  list.innerHTML = '';
  const { data, error } = await sb
    .from('echoprints')
    .select('id, record_id, ecp_id, title, hash, created_at, sent_at, timestamp, timestamp_iso, permalink, url, image_url, photo_url, document_url, file_url, thumb_url')
    .order('created_at', { ascending:false })
    .limit(24);
  if (error) { list.innerHTML = `<div class="muted">${error.message}</div>`; return; }
  (data||[]).forEach(row => list.appendChild(renderCard(row, false)));
}
$('#refresh-btn')?.addEventListener('click', loadRecent);

// ------- VERIFY
async function doVerify(q){
  const out = $('#verify-result'); out.innerHTML = '';
  if (!q) { out.textContent = 'Enter ECP or 64-hex hash'; return; }

  let sel = null;
  if (isHex64(q)) sel = sb.from('echoprints').select('*').eq('hash', q).limit(1);
  else if (isECP(q)) sel = sb.from('echoprints').select('*').eq('ecp_id', q).limit(1).neq('ecp_id', null)
                      || sb.from('echoprints').select('*').eq('record_id', q).limit(1);
  else { out.textContent = 'Not a valid ECP or 64-hex hash'; return; }

  const { data, error } = await sel;
  if (error) { out.textContent = error.message; return; }
  if (!data || !data.length) { out.textContent = 'No match'; return; }
  out.appendChild(renderCard(data[0], true));
}
function goVerify(value){
  const input = $('#verify-input');
  input.value = value;
  $('#verify-btn').click();
  location.hash = '#verify';
  window.scrollTo({top:0, behavior:'smooth'});
}

$('#verify-form').addEventListener('submit', e=>{
  e.preventDefault();
  doVerify($('#verify-input').value.trim());
});
$('#clear-btn').addEventListener('click', ()=>{
  $('#verify-input').value=''; $('#verify-result').innerHTML='';
});

// ------- URL auto-verify (?ecp= or ?hash=)
(function autoFromURL(){
  const p = new URLSearchParams(location.search);
  const v = p.get('ecp') || p.get('hash') || p.get('q');
  if (v) { $('#verify-input').value = v; doVerify(v); }
})();

// ------- boot
addEventListener('hashchange', ()=>route());
route();
loadRecent();
