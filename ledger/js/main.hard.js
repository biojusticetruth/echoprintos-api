// ------- CONFIG -------
const SUPABASE_URL  = window.SUPABASE_URL;
const SUPABASE_ANON = window.SUPABASE_ANON;
const TABLE = 'echoprints'; // Make writes here

const HDRS = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

// ------- DOM -------
const listEl    = document.getElementById('recentList');
const feedEmpty = document.getElementById('feedEmpty');
const feedStat  = document.getElementById('feedStatus');

// ------- Helpers -------
const esc = s => (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmtUTC = iso => {
  try { return new Date(iso).toUTCString().replace('GMT','UTC'); }
  catch { return iso || '—'; }
};
const label = src => {
  const s = (src||'').toLowerCase();
  if (s.includes('substack')) return 'Substack';
  if (s === 'x' || s.includes('twitter')) return 'X';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('youtube')) return 'YouTube';
  if (s.includes('linkedin')) return 'LinkedIn';
  return src || '';
};

// ------- Load feed from table -------
async function loadFeed() {
  feedStat.textContent = 'loading…';
  const base = `${SUPABASE_URL}/rest/v1/${TABLE}`;
  const qs   = [
    'select=title,record_id,timestamp_iso,url,source',
    'order=timestamp_iso.desc',
    'limit=20'
  ].join('&');

  try {
    const r = await fetch(`${base}?${qs}`, { headers: HDRS, cache: 'no-store' });
    if (!r.ok) {
      const t = await r.text().catch(()=> '');
      throw new Error(`HTTP ${r.status}: ${t || '—'}`);
    }
    const rows = await r.json();

    if (!rows.length) {
      feedEmpty.style.display = '';
      listEl.innerHTML = '';
      feedStat.textContent = '';
      return;
    }

    feedEmpty.style.display = 'none';
    listEl.innerHTML = rows.map(row => {
      const t  = esc(row.title || 'Untitled');
      const ts = fmtUTC(row.timestamp_iso);
      const b  = row.source ? `<span class="badge">${esc(label(row.source))}</span>` : '';
      const title = row.url
        ? `<a href="${esc(row.url)}" target="_blank" rel="noopener">${t}</a>`
        : `<span>${t}</span>`;
      return `
        <li>
          <div>${title}${b}</div>
          <div class="meta">ECP: ${esc(row.record_id || '—')}<br>TIMESTAMP (UTC): ${esc(ts)}</div>
        </li>`;
    }).join('');
    feedStat.textContent = '';
  } catch (err) {
    feedStat.textContent = 'error';
    listEl.innerHTML = `<li>Feed error. ${esc(err.message)}</li>`;
  }
}

document.addEventListener('DOMContentLoaded', loadFeed);
