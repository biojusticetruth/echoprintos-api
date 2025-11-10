// Read-only feed pulling what Make writes to public.echoprints

const SUPABASE_URL  = window.SUPABASE_URL;
const SUPABASE_ANON = window.SUPABASE_ANON;
const TABLE = 'echoprints';

const HEADERS = {
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`
};

const listEl    = document.getElementById('recentList');
const feedEmpty = document.getElementById('feedEmpty');
const feedStat  = document.getElementById('feedStatus');

const esc = s => (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const label = src => {
  const s = (src||'').toLowerCase();
  if (s.includes('substack')) return 'Substack';
  if (s === 'x' || s.includes('twitter')) return 'X';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('youtube')) return 'YouTube';
  if (s.includes('linkedin')) return 'LinkedIn';
  return src || '';
};
const fmtUTC = iso => {
  try { return new Date(iso).toUTCString().replace('GMT','UTC'); }
  catch { return iso || '—'; }
};

function render(rows){
  if (!rows.length){
    feedEmpty.style.display = '';
    listEl.innerHTML = '';
    feedStat.textContent = '';
    return;
  }
  feedEmpty.style.display = 'none';
  listEl.innerHTML = rows.map(r=>{
    const t   = esc(r.title || 'Untitled');
    const ts  = esc(fmtUTC(r.timestamp_iso));
    const ecp = esc(r.record_id || '—');
    const badge = r.source ? `<span class="badge">${esc(label(r.source))}</span>` : '';
    const title = r.url
      ? `<a class="title" href="${esc(r.url)}" target="_blank" rel="noopener">${t}</a>`
      : `<span class="title">${t}</span>`;
    return `
      <li class="item">
        <div>${title}${badge}</div>
        <div class="meta">ECP: ${ecp}\nTIMESTAMP (UTC): ${ts}</div>
      </li>`;
  }).join('');
  feedStat.textContent = '';
}

async function loadFeed(){
  feedStat.textContent = 'loading…';
  const base = `${SUPABASE_URL}/rest/v1/${TABLE}`;
  const qs   = [
    'select=title,record_id,timestamp_iso,url,source',
    'order=timestamp_iso.desc',
    'limit=36'
  ].join('&');

  try{
    const r = await fetch(`${base}?${qs}`, { headers: HEADERS, cache: 'no-store' });
    if(!r.ok){
      const t = await r.text().catch(()=> '');
      throw new Error(`HTTP ${r.status} • ${t || '—'}`);
    }
    const rows = await r.json();
    render(rows);
  }catch(err){
    feedStat.textContent = 'error';
    listEl.innerHTML = `<li class="item">Feed error. ${esc(err.message)}</li>`;
  }
}

document.addEventListener('DOMContentLoaded', loadFeed);
