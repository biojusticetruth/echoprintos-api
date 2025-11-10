// EchoprintOS Ledger · feed loader (DB timestamp is authoritative)
// ---------------------------------------------------------------
// 1) Leave dates OUT of your Zapier POST; Supabase sets created_at (UTC).
// 2) If you later add original_published_at, this already displays it.

const SUPABASE_URL  = 'https://cyndhzyfaffprdebclnw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c';

// NEW: include ECP (record_id) + UUID (id)
const FEED_QS = [
  'select=title,url,platform,created_at,original_published_at,record_id,id',
  'or=(is_test.is.false,is_test.is.null)',
  'order=created_at.desc.nullslast',
  'limit=30'
].join('&');

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

// Render in UTC so ledger time is unambiguous
function fmtUTC(iso){
  try{
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso || '');
    return d.toLocaleString(undefined, { timeZone: 'UTC' }) + ' UTC';
  }catch{ return esc(iso || ''); }
}

async function loadFeed(){
  const listEl = document.querySelector('#feed-list') || document.querySelector('#recent');
  const statEl = document.querySelector('#feed-stat') || document.querySelector('#recentStatus');
  if (!listEl) return;
  if (statEl) statEl.textContent = 'Loading…';

  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/echoprints?${FEED_QS}`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`
      },
      cache: 'no-store'
    });
    if (!r.ok){
      const t = await r.text().catch(()=> '');
      throw new Error(`HTTP ${r.status} • ${t || '—'}`);
    }
    const rows = await r.json();
    if (statEl) statEl.textContent = String(rows.length || 0);
    render(rows, listEl);
  }catch(err){
    if (statEl) statEl.textContent = 'Error';
    listEl.innerHTML = `<li class="item">Feed error. ${esc(err.message)}</li>`;
    console.error(err);
  }
}

// NEW: print ECP (record_id) + UUID (id) in small gray mono lines
function render(rows, listEl){
  if (!rows?.length){
    listEl.innerHTML = `<li class="item">No posts yet.</li>`;
    return;
  }
  listEl.innerHTML = rows.map(row => {
    const title  = esc(row.title || '(untitled)');
    const href   = row.url ? esc(row.url) : '#';
    const ledger = row.created_at ? fmtUTC(row.created_at) : '';
    const pub    = row.original_published_at ? ` · Published: ${fmtUTC(row.original_published_at)}` : '';
    const plat   = row.platform ? ` · ${esc(row.platform)}` : '';
    const ecp    = row.record_id ? esc(row.record_id) : '';
    const uuid   = row.id ? esc(row.id) : '';

    const titleHtml = row.url
      ? `<a class="fc-title" href="${href}" target="_blank" rel="noopener">${title}</a>`
      : `<span class="fc-title">${title}</span>`;

    return `
      <li class="item feed-card">
        <div class="fc-top">
          ${titleHtml}
          ${row.platform ? `<span class="pill">${esc(row.platform)}</span>` : ''}
        </div>
        <div class="fc-meta">Ledger: ${ledger}${pub}${plat}</div>
        <div class="fc-ids">
          ${ecp  ? `<div class="idline mono">ECP: ${ecp}</div>`   : ''}
          ${uuid ? `<div class="idline mono">UUID: ${uuid}</div>` : ''}
        </div>
      </li>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', loadFeed);
