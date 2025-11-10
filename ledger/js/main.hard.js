const SUPA_URL = 'https://cyndhzyfaffprdebclnw.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c'; // keep as env if you have it

const FEED_QS =
  "select=title,url,perma_link,permalink,platform,original_published_at,created_at,timestamp&or=(is_test.is.false,is_test.is.null)&order=created_at.desc.nullslast&limit=30";

async function loadFeed(){
  const listEl = document.querySelector('#feed-list');
  const feedStat = document.querySelector('#feed-stat');
  feedStat && (feedStat.textContent = 'loading…');

  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/echoprints?${FEED_QS}`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` }
    });
    if (!r.ok) {
      const t = await r.text().catch(()=> '');
      throw new Error(`HTTP ${r.status} • ${t || '—'}`);
    }
    const rows = await r.json();
    render(rows, listEl);
    feedStat && (feedStat.textContent = rows.length.toString());
  } catch (err) {
    feedStat && (feedStat.textContent = 'error');
    listEl.innerHTML = `<li class="item">Feed error. ${escapeHtml(err.message)}</li>`;
  }
}

function render(rows, listEl){
  const html = rows.map(row => {
    const title = (row.title || 'Untitled');
    const href  = row.permalink || row.perma_link || row.url || '#';
    const ts    = row.original_published_at || row.created_at || row.timestamp;
    const when  = ts ? new Date(ts).toLocaleString() : '';
    const plat  = row.platform || '';
    return `
      <li class="item">
        <a class="item__title" href="${href}" target="_blank" rel="noopener">${escapeHtml(title)}</a>
        <div class="item__meta">${when}${plat ? ' · '+escapeHtml(plat):''}</div>
      </li>`;
  }).join('');
  listEl.innerHTML = html || `<li class="item">No posts yet.</li>`;
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

document.addEventListener('DOMContentLoaded', loadFeed);
