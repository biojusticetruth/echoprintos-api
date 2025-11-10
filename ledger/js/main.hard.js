// --- Supabase config (yours) ---
const SUPABASE_URL = 'https://cyndhzyfaffprdebclnw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c';

const H = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

// --- DOM ---
const inpEcp   = document.getElementById('inpEcp');
const inpHash  = document.getElementById('inpHash');
const btnVerify= document.getElementById('btnVerify');
const btnPaste = document.getElementById('btnPaste');
const btnReset = document.getElementById('btnReset');
const recentStatus = document.getElementById('recentStatus');
const recentGrid   = document.getElementById('recentGrid');

// --- utils ---
const esc = (s='') => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const isHex64 = (s='') => /^[0-9a-f]{64}$/i.test(s.trim());
const pad = (n,len=2)=>String(n).padStart(len,'0');

function isoUTC(val){
  try { return new Date(val).toISOString().replace('Z','+00:00'); }
  catch { return ''; }
}
function ecpFromIso(iso){
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `ECP-${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}`
       + `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${pad(d.getUTCMilliseconds(),3)}`;
}
function isoFromEcp(ecp){
  const m = /^ECP-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/.exec(ecp||'');
  if (!m) return null;
  const [_,Y,Mo,D,H,Mi,S,Ms]=m;
  return `${Y}-${Mo}-${D}T${H}:${Mi}:${S}.${Ms}+00:00`;
}

// --- verify pop-out card ---
function openVerifyCard(r){
  const iso = r.timestamp_iso || r.created_iso || r.created_at || r.timestamp;
  const when = isoUTC(iso);
  const ecp  = when ? ecpFromIso(when) : '';
  const title= esc(r.title || '(untitled)');
  const view = r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="btn outline">View</a>` : '';

  const wrap = document.createElement('div');
  wrap.className = 'verify-pop';
  wrap.innerHTML = `
    <div class="echocard">
      <div class="topline">
        <strong>${title}</strong>
        <div>${view} <button class="close" type="button">Close</button></div>
      </div>
      ${ecp ? `<div class="muted"><strong>EchoprintOS Record ID</strong><br><code class="mono">${ecp}</code></div>` : ''}
      ${when ? `<div class="muted" style="margin-top:.35rem"><strong>TIMESTAMP (UTC)</strong><br><code class="mono">${when}</code></div>` : ''}
      ${r.hash ? `<div class="muted" style="margin-top:.5rem"><code class="mono" style="opacity:.8">${esc(r.hash)}</code></div>` : ''}
    </div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.querySelector('.close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once:true });
  document.body.appendChild(wrap);
}

function announce(msg){
  // brief inline note under Paste for errors/empty input
  const p = document.createElement('p');
  p.className = 'tip muted';
  p.style.marginTop = '8px';
  p.textContent = msg;
  btnPaste.insertAdjacentElement('afterend', p);
  setTimeout(()=>p.remove(), 2600);
}

// --- Verify handler ---
async function verify(){
  const ecp = (inpEcp.value||'').trim();
  const hex = (inpHash.value||'').trim();

  if (!ecp && !hex){ announce('Enter an ECP or full hash.'); return; }

  const parts = ['select=id,title,url,hash,timestamp,timestamp_iso,created_at,created_iso','limit=1'];
  const ors = [];
  if (hex && isHex64(hex)) ors.push(`hash.eq.${hex}`);
  if (ecp){
    const iso = isoFromEcp(ecp);
    if (!iso){ announce('ECP should be ECP-YYYYMMDDHHMMSSmmm'); return; }
    ors.push(`created_at.eq.${encodeURIComponent(iso)}`);
    ors.push(`timestamp_iso.eq.${encodeURIComponent(iso)}`);
    ors.push(`created_iso.eq.${encodeURIComponent(iso)}`);
  }
  const url = `${SUPABASE_URL}/rest/v1/echoprints?${parts.join('&')}&or=(${ors.join(',')})`;

  try{
    const res = await fetch(url, { headers:H, cache:'no-store' });
    if (!res.ok){ announce(`Verify error: ${res.status}`); return; }
    const rows = await res.json();
    if (!rows.length){ announce('No matching record found.'); return; }
    openVerifyCard(rows[0]);
  }catch(e){
    console.error(e);
    announce('Verify error.');
  }
}

// --- Recent feed ---
async function loadRecent(){
  recentStatus.textContent = 'Loading…';
  recentGrid.innerHTML = '';

  const qs = [
    'select=title,url,hash,timestamp,timestamp_iso,created_at,created_iso',
    'order=created_at.desc',
    'limit=12'
  ].join('&');

  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/echoprints?${qs}`, { headers:H, cache:'no-store' });
    if (!res.ok){ recentStatus.textContent = `Read error: ${res.status}`; return; }
    const rows = await res.json();
    if (!rows.length){ recentStatus.textContent = 'No records yet.'; return; }

    recentStatus.textContent = '';
    recentGrid.innerHTML = rows.map(r => {
      const iso = r.timestamp_iso || r.created_iso || r.created_at || r.timestamp;
      const when = isoUTC(iso);
      const ecp  = when ? ecpFromIso(when) : '';
      const title= esc(r.title || '(untitled)');
      const linkOpen  = r.url ? `<a class="title" href="${esc(r.url)}" target="_blank" rel="noopener">` : '<span class="title">';
      const linkClose = r.url ? '</a>' : '</span>';

      return `
        <div class="echocard">
          <div>
            <div style="margin-bottom:.35rem">${linkOpen}${title}${linkClose}</div>
            ${ecp  ? `<div class="muted"><strong>EchoprintOS Record ID</strong><br><code class="mono">${ecp}</code></div>` : ''}
            ${when ? `<div class="muted" style="margin-top:.25rem"><strong>TIMESTAMP (UTC)</strong><br><code class="mono">${when}</code></div>` : ''}
          </div>
          ${r.hash ? `<div class="muted" style="margin-top:.5rem"><code class="mono" style="opacity:.7">${esc(r.hash.slice(0,10))}…</code></div>` : ''}
        </div>`;
    }).join('');
  }catch(e){
    console.error(e);
    recentStatus.textContent = 'Read error.';
  }
}

// --- Wire events ---
btnVerify.addEventListener('click', verify);
document.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); });
btnPaste.addEventListener('click', async () => {
  try{
    const txt = (await navigator.clipboard.readText() || '').trim();
    if (!txt) return;
    if (!inpEcp.value) inpEcp.value = txt; else inpHash.value = txt;
  }catch{}
});
btnReset.addEventListener('click', () => { inpEcp.value=''; inpHash.value=''; });

// Kick it off
loadRecent();
