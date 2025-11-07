import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY in env.js');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helpers
const $ = (sel, root=document) => root.querySelector(sel);
const isHex64 = (s) => /^[a-f0-9]{64}$/i.test(s);
const isUUID  = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const ecpFrom = (row) => 'ECP-' + (row.record_id||row.id||'').toString().replace(/-/g,'').slice(0,8).toUpperCase();
const tsFrom  = (row) => row.sent_at || row.created_at || ''; // Make rows can set sent_at; DB always sets created_at
const fmtTS   = (s) => s ? new Date(s).toISOString().replace('T',' ').replace('Z',' UTC') : '—';

function renderCard(row) {
  const tpl = $('#card-template').content.cloneNode(true);
  $('.title', tpl).textContent = row.title || '(untitled)';
  $('.ecp',   tpl).textContent = ecpFrom(row);
  $('.hash',  tpl).textContent = row.hash || '—';
  $('.ts',    tpl).textContent = fmtTS(tsFrom(row));

  // Buttons
  const btnPost = $('.open-post', tpl);
  const btnImg  = $('.view-image', tpl);
  if (row.permalink) { btnPost.hidden = false; btnPost.onclick = () => window.open(row.permalink, '_blank'); }
  if (row.url)       { btnImg.hidden  = false; btnImg.onclick  = () => window.open(row.url, '_blank'); }

  $('.open-in-verify', tpl).onclick = () => {
    $('#verify-input').value = row.hash || ecpFrom(row);
    $('#verify-form').dispatchEvent(new Event('submit', {cancelable:true}));
    window.scrollTo({top:0,behavior:'smooth'});
  };

  $('.view-cert', tpl).onclick = () => {
    const cert = {
      echoprint_id: ecpFrom(row),
      record_id: row.record_id || row.id,
      hash: row.hash,
      timestamp: tsFrom(row),
      platform: row.platform || null,
      permalink: row.permalink || null,
      url: row.url || null
    };
    alert(JSON.stringify(cert, null, 2));
  };

  $('.download-json', tpl).onclick = () => {
    const blob = new Blob([JSON.stringify(row, null, 2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'), {download: `${ecpFrom(row)}.json`, href: URL.createObjectURL(blob)});
    a.click(); URL.revokeObjectURL(a.href);
  };

  $('.download-cert', tpl).onclick = () => {
    const cert = {
      echoprint_id: ecpFrom(row),
      record_id: row.record_id || row.id,
      hash: row.hash,
      timestamp: tsFrom(row)
    };
    const blob = new Blob([JSON.stringify(cert, null, 2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'), {download: `${ecpFrom(row)}-certificate.json`, href: URL.createObjectURL(blob)});
    a.click(); URL.revokeObjectURL(a.href);
  };

  return tpl;
}

// Fetch recent
async function loadRecent() {
  const list = $('#recent-list');
  list.innerHTML = '<div class="muted">Loading…</div>';
  const { data, error } = await supabase
    .from('echoprints')
    .select('id,record_id,title,hash,permalink,url,platform,created_at,sent_at')
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) { list.innerHTML = `<div class="muted">Error: ${error.message}</div>`; return; }
  list.innerHTML = '';
  (data||[]).forEach(row => list.appendChild(renderCard(row)));
}

// Verify handler (accepts 64-hex hash, UUID, or ECP-prefix)
$('#verify-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const out = $('#verify-result');
  const v   = ($('#verify-input').value||'').trim();
  if (!v) { out.textContent = 'Enter a hash or EchoprintOS Record ID.'; return; }

  let q = supabase.from('echoprints').select('*').limit(1);
  if (isHex64(v)) {
    q = q.eq('hash', v);
  } else if (/^ECP/i.test(v)) {
    const suffix = v.replace(/^ECP[-\s]?/i,'').replace(/[^a-f0-9]/ig,'').slice(0,8);
    q = q.ilike('record_id', `${suffix}%`);
  } else if (isUUID(v)) {
    q = q.eq('record_id', v);
  } else {
    out.textContent = 'Not a 64-hex hash, UUID, or ECP code.'; return;
  }

  const { data, error } = await q;
  if (error) { out.textContent = `Error: ${error.message}`; return; }
  if (!data || data.length === 0) { out.textContent = 'No match.'; return; }

  const row = data[0];
  out.innerHTML = `
    <b>${row.title || '(untitled)'}</b><br/>
    <small>${ecpFrom(row)}</small><br/>
    Hash: <code>${row.hash || '—'}</code><br/>
    Timestamp: ${fmtTS(tsFrom(row))}<br/>
    ${row.permalink ? `<a href="${row.permalink}" target="_blank">Open post</a><br/>` : ''}
    ${row.url ? `<a href="${row.url}" target="_blank">View image</a><br/>` : ''}
  `;
});

// Boot
loadRecent();
console.log('EchoprintOS page booted.');
