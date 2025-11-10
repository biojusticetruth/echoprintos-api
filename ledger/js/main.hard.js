// EchoprintOS Ledger · feed loader (DB timestamp is authoritative)
// 1) Zapier sends NO dates; Supabase sets created_at (UTC).
// 2) If you later add original_published_at, this already displays it.

const SUPABASE_URL  = 'https://cyndhzyfaffprdebclnw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c';

// Include ECP (record_id) + UUID (id) in the feed query
const FEED_QS = [
  'select=title,url,platform,created_at,original_published_at,record_id,id',
  'or=(is_test.is.false,is_test.is.null)',
  'order=created_at.desc',
  'limit=30'
].join('&');

// Card renderer: show ECP + UUID, keep hash off the feed
function render(rows, listEl){
  if (!rows?.length){
    listEl.innerHTML = `<li class="item">No posts yet.</li>`;
    return;
  }
  listEl.innerHTML = rows.map(row => {
    const title   = esc(row.title || '(untitled)');
    const href    = row.url ? esc(row.url) : '#';
    const ledger  = row.created_at ? fmtUTC(row.created_at) : '';
    const pub     = row.original_published_at ? ` · Published: ${fmtUTC(row.original_published_at)}` : '';
    const plat    = row.platform ? `<span class="pill">${esc(row.platform)}</span>` : '';
    const ecp     = (row.record_id || '').toString().trim();
    const uuid    = (row.id || '').toString().trim();

    return `
      <li class="card glass sheen glow-corners feed-card">
        <div class="fc-top">
          <a class="fc-title" href="${href}" target="_blank" rel="noopener">${title}</a>
          ${plat}
        </div>

        ${ecp  ? `<div class="fc-ecp  mono">ECP Record ID: ${esc(ecp)}</div>`   : ''}
        ${uuid ? `<div class="fc-uuid mono">UUID: ${esc(uuid)}</div>`           : ''}

        <div class="fc-meta"><span class="mono">Ledger:</span> ${ledger}${pub}</div>
      </li>
    `;
  }).join('');
}

async function loadFeed(){
  const listEl = document.querySelector('#feed-list') || document.querySelector('#recent');
  // put near the top of your JS
const setStat = (text) => {
  ['#feed-stat', '#recentStatus'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  });
};
  
  if (!listEl) return;

  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/echoprints?${FEED_QS}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      cache: 'no-store'
    });
    if (!r.ok){
      const t = await r.text().catch(()=> '');
      throw new Error(`HTTP ${r.status} • ${t || '—'}`);
    }

    const rows = await r.json();

    if (!rows.length){
      render([], listEl);
      return;
    }
    
    render(rows, listEl);
  }catch(err){
    listEl.innerHTML = `<li class="item">Feed error. ${esc(err.message)}</li>`;
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadFeed);
