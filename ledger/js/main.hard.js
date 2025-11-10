/* EchoprintOS ledger JS (v22) */

/* 1) Config from window (set in index.html) */
const SUPABASE_URL      = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
const SUBSTACK_HOME     = window.SUBSTACK_HOME || 'https://biojusticetruth.substack.com/';

/* 2) DOM refs */
const qEcp   = document.getElementById('q-ecp');
const qHash  = document.getElementById('q-hash');
const btnV   = document.getElementById('btnVerify');
const btnP   = document.getElementById('btnPaste');
const vRes   = document.getElementById('verifyResult');

const recentStatus = document.getElementById('recentStatus');
const recentWrap   = document.getElementById('recent');

const verifyPop = document.getElementById('verifyPop');
const popT  = document.getElementById('popT');
const popE  = document.getElementById('popECP');
const popI  = document.getElementById('popISO');
const popV  = document.getElementById('popView');
const popX  = document.getElementById('popClose');

/* 3) Helpers */
const esc = s => (s||'').toString().replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const pad = (n,w=2)=>String(n).padStart(w,'0');
const looksHex64 = s => /^[a-f0-9]{64}$/i.test((s||'').trim());

function isoUTC(ts){
  try{ const d = new Date(ts); return isNaN(d) ? (ts||'') : d.toISOString().replace('Z','+00:00'); }
  catch{ return ts||''; }
}

function ecpFromISO(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(iso||'');
  if(!m) return '';
  const [,Y,Mo,D,H,Mi,S,Ms] = m;
  return `ECP-${Y}${Mo}${D}${H}${Mi}${S}${Ms}`;
}

function isoFromECP(ecp){
  const m = /^ECP-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/.exec((ecp||'').trim());
  if(!m) return null;
  const [,Y,Mo,D,H,Mi,S,Ms] = m;
  return `${Y}-${Mo}-${D}T${H}:${Mi}:${S}.${Ms}+00:00`;
}

/* 4) Recent feed (buttonless cards; title link + Substack chip) */
async function loadRecent(){
  recentStatus.textContent = 'Loading…';
  recentWrap.innerHTML = '';

  const qs = [
    'select=title,url,"timestamp",timestamp_iso,source',
    'order=timestamp.desc',
    'limit=12'
  ].join('&');

  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/echoprints?${qs}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store'
    });
    if(!r.ok){ throw new Error(`Read error: ${r.status}`); }
    let rows = await r.json();

    // remove obvious test placeholders like "test"
    rows = rows.filter(row => !/^\s*test\b/i.test(row.title||''));

    if(!rows.length){ recentStatus.textContent = 'No records yet.'; return; }
    recentStatus.textContent = '';

    recentWrap.innerHTML = rows.map(row => {
      const title = esc(row.title || 'Untitled');
      const href  = row.url || SUBSTACK_HOME;
      const iso   = isoUTC(row.timestamp_iso || row.timestamp || '');
      const ecp   = ecpFromISO(iso);
      const src   = (row.source || 'Substack') + '';

      const srcPill = `<a class="pill-src" href="${esc(SUBSTACK_HOME)}" target="_blank" rel="noopener">${esc(src)}</a>`;

      return `
        <div class="feed-card">
          <div class="t"><a href="${esc(href)}" target="_blank" rel="noopener">${title}</a>${srcPill}</div>
          <div class="meta"><span class="k">ECP: </span><span class="v nowrap">${esc(ecp)}</span></div>
          <div class="meta"><span class="k">TIMESTAMP (UTC): </span><span class="v">${esc(iso)}</span></div>
        </div>
      `;
    }).join('');
  }catch(err){
    console.error(err);
    recentStatus.textContent = 'Read error.';
  }
}

/* 5) Verify behavior (ECP or full hash) */
async function onVerify(){
  vRes.hidden = true; vRes.textContent = '';

  const ecp  = (qEcp.value||'').trim();
  const hash = (qHash.value||'').trim();

  let qs = null;
  if (ecp){
    const iso = isoFromECP(ecp);
    if(!iso){ return showInline('Invalid ECP format. Use ECP-YYYYMMDDHHMMSSmmm.'); }
    qs = `select=title,url,"timestamp",timestamp_iso&timestamp=eq.${encodeURIComponent(iso)}&limit=1`;
  } else if (hash){
    if(!looksHex64(hash)){ return showInline('Hash must be a full 64-hex SHA-256 value.'); }
    qs = `select=title,url,"timestamp",timestamp_iso&hash=eq.${encodeURIComponent(hash)}&limit=1`;
  } else {
    return showInline('Enter an ECP or a 64-hex hash.');
  }

  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/echoprints?${qs}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache:'no-store'
    });
    if(!r.ok){ throw new Error(`Verify error: ${r.status}`); }
    const rows = await r.json();
    if(!rows.length){ return showInline('No matching record.'); }

    const row = rows[0];
    const iso = isoUTC(row.timestamp_iso || row.timestamp || '');
    const ecpOut = ecpFromISO(iso);

    popT.textContent  = row.title || 'Untitled';
    popE.textContent  = ecpOut || '(unavailable)';
    popI.textContent  = iso || '(unknown)';
    popV.href         = row.url || SUBSTACK_HOME;

    openModal();
  }catch(err){
    console.error(err);
    showInline('Could not verify right now.');
  }
}

function showInline(msg){ vRes.textContent = msg; vRes.hidden = false; }
async function onPaste(){
  try{
    const txt = (await navigator.clipboard.readText()).trim();
    if (!txt) return;
    if (/^ECP-\d{17}$/.test(txt)) qEcp.value = txt;
    else if (looksHex64(txt)) qHash.value = txt;
    else qEcp.value = txt; // let them verify anyway
  }catch{}
}

/* 6) Modal open/close */
function openModal(){ verifyPop.hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal(){ verifyPop.hidden = true; document.body.style.overflow = ''; }

verifyPop.addEventListener('click', (e)=>{ if(e.target === verifyPop) closeModal(); });
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && !verifyPop.hidden) closeModal(); });
document.getElementById('popClose').addEventListener('click', closeModal);

/* 7) Wire up + init */
document.getElementById('btnVerify').addEventListener('click', onVerify);
document.getElementById('btnPaste').addEventListener('click', onPaste);
loadRecent();
