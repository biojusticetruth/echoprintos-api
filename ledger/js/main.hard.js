// --- CONFIG (uses your working project values) ---
const SUPABASE_URL = 'https://cyndhzyfaffprdebclnw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c';

// --- DOM ---
const inpEcp   = document.getElementById('inpEcp');
const inpHash  = document.getElementById('inpHash');
const btnVerify= document.getElementById('btnVerify');
const btnPaste = document.getElementById('btnPaste');
const btnReset = document.getElementById('btnReset');
const resBox   = document.getElementById('verifyResult');
const recentStatus = document.getElementById('recentStatus');
const recentGrid   = document.getElementById('recentGrid');

// --- utils ---
const esc = (s='') => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function isoUTC(d) {
  // returns ISO with +00:00 (not Z) to match your display
  const z = (d instanceof Date) ? d.toISOString() : new Date(d).toISOString();
  return z.replace('Z', '+00:00');
}

function ecpFromIso(iso) {
  // ECP-YYYYMMDDHHMMSSmmm from exact UTC ISO (…+00:00)
  const d = new Date(iso);
  const pad = (n,len=2) => String(n).padStart(len,'0');
  const y = d.getUTCFullYear();
  const mo= pad(d.getUTCMonth()+1);
  const da= pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const mi= pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  const ms= pad(d.getUTCMilliseconds(),3);
  return `ECP-${y}${mo}${da}${h}${mi}${s}${ms}`;
}

function isoFromEcp(ecp) {
  // parse ECP-YYYYMMDDHHMMSSmmm → ISO +00:00
  const m = /^ECP-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/.exec(ecp || '');
  if (!m) return null;
  const [_,Y,Mo,D,H,Mi,S,Ms] = m;
  return `${Y}-${Mo}-${D}T${H}:${Mi}:${S}.${Ms}+00:00`;
}

function cardHTML(r) {
  const iso = r.timestamp_iso || r.created_at;
  const when = iso ? isoUTC(iso) : '';
  const ecp = iso ? ecpFromIso(when) : '';
  const title = esc(r.title || '(untitled)');
  const link  = r.url ? `<a class="title" href="${esc(r.url)}" target="_blank" rel="noopener">${title}</a>` : `<span class="title">${title}</span>`;
  return `
    <div class="echocard">
      <div>
        <div style="margin-bottom:.35rem">${link}</div>
        ${ecp ? `<div class="muted"><strong>EchoprintOS Record ID</strong><br><code class="mono">${ecp}</code></div>` : ''}
        ${when ? `<div class="muted" style="margin-top:.25rem"><strong>TIMESTAMP (UTC)</strong><br><code class="mono">${when}</code></div>` : ''}
      </div>
      ${r.hash ? `<div class="muted" style="margin-top:.5rem"><code class="mono" style="opacity:.7">${esc(r.hash.slice(0,10))}…</code></div>` : ''}
    </div>`;
}

// --- Recent loader ---
async function loadRecent() {
  recentStatus.textContent = 'Loading…';
  recentGrid.innerHTML = '';
  const qs = [
    'select=id,title,url,hash,timestamp_iso,created_at',
    'order=created_at.desc',
    'limit=12'
  ].join('&');

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/echoprints?${qs}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store'
    });
    if (!res.ok) {
      recentStatus.textContent = `Read error: ${res.status}`;
      return;
    }
    const rows = await res.json();
    if (!rows.length) {
      recentStatus.textContent = 'No records yet.';
      return;
    }
    recentStatus.textContent = '';
    recentGrid.innerHTML = rows.map(cardHTML).join('');
  } catch (e) {
    recentStatus.textContent = 'Read error.';
    console.error(e);
  }
}

function openVerifyCard(r){
  const iso = r.timestamp_iso || r.created_at;
  const when = iso ? isoUTC(iso) : '';
  const ecpShow = iso ? ecpFromIso(when) : '';
  const t = esc(r.title || '(untitled)');
  const view = r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="btn outline">View</a>` : '';

  const wrap = document.createElement('div');
  wrap.className = 'verify-pop';
  wrap.innerHTML = `
    <div class="echocard">
      <div class="topline">
        <strong>${t}</strong>
        <div>${view} <button class="close" type="button">Close</button></div>
      </div>
      ${ecpShow ? `<div class="muted" style="margin-top:.25rem"><strong>EchoprintOS Record ID</strong><br><code class="mono">${ecpShow}</code></div>` : ''}
      ${when ? `<div class="muted" style="margin-top:.5rem"><strong>TIMESTAMP (UTC)</strong><br><code class="mono">${when}</code></div>` : ''}
      ${r.hash ? `<div class="muted" style="margin-top:.5rem"><code class="mono" style="opacity:.8">${esc(r.hash)}</code></div>` : ''}
    </div>
  `;
  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.querySelector('.close').addEventListener('click', close);
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') close(); }, {once:true});
  document.body.appendChild(wrap);
}

function announceInline(msg){
  // brief inline message under the buttons if nothing found / error
  const p = document.createElement('p');
  p.className = 'tip muted';
  p.style.marginTop = '8px';
  p.textContent = msg;
  // put it right after the Paste button
  btnPaste.insertAdjacentElement('afterend', p);
  setTimeout(()=>p.remove(), 3000);
}

async function verify() {
  const ecp = (inpEcp.value || '').trim();
  const hex = (inpHash.value || '').trim();
  if (!ecp && !hex) { announceInline('Enter an ECP or full hash.'); return; }

  const select = 'select=id,title,url,hash,timestamp_iso,created_at';
  let url = `${SUPABASE_URL}/rest/v1/echoprints?${select}&limit=1`;

  const ors = [];
  if (hex) ors.push(`hash.eq.${hex}`);
  if (ecp) {
    const iso = isoFromEcp(ecp);
    if (iso) {
      ors.push(`created_at.eq.${encodeURIComponent(iso)}`);
      ors.push(`timestamp_iso.eq.${encodeURIComponent(iso)}`);
    } else {
      announceInline('ECP format should be ECP-YYYYMMDDHHMMSSmmm'); return;
    }
  }
  url += `&or=(${ors.join(',')})`;

  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store'
    });
    if (!res.ok) { announceInline(`Verify error: ${res.status}`); return; }
    const rows = await res.json();
    if (!rows.length) { announceInline('No matching record found.'); return; }
    openVerifyCard(rows[0]);
  } catch (e) {
    console.error(e);
    announceInline('Verify error.');
  }

  // Build PostgREST query
  const select = 'select=id,title,url,hash,timestamp_iso,created_at';
  let url = `${SUPABASE_URL}/rest/v1/echoprints?${select}&limit=1`;

  const ors = [];
  if (hex) {
    ors.push(`hash.eq.${hex}`);
  }
  if (ecp) {
    const iso = isoFromEcp(ecp);
    if (iso) {
      // Try match on created_at OR timestamp_iso text
      ors.push(`created_at.eq.${encodeURIComponent(iso)}`);
      ors.push(`timestamp_iso.eq.${encodeURIComponent(iso)}`);
    }
  }
  if (ors.length) {
    url += `&or=(${ors.join(',')})`;
  }

  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store'
    });
    if (!res.ok) {
      resBox.innerHTML = `<div class="muted">Verify error: ${res.status}</div>`;
      return;
    }
    const rows = await res.json();
    if (!rows.length) {
      resBox.innerHTML = `<div class="muted">No matching record found.</div>`;
      return;
    }
    const r = rows[0];
    const iso = r.timestamp_iso || r.created_at;
    const when = iso ? isoUTC(iso) : '';
    const ecpShow = iso ? ecpFromIso(when) : '';
    const t = esc(r.title || '(untitled)');
    const view = r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="btn outline" style="margin-left:.5rem">View</a>` : '';

    resBox.innerHTML = `
      <div class="echocard" style="margin-top:6px">
        <div><strong>${t}</strong>${view}</div>
        ${ecpShow ? `<div class="muted" style="margin-top:.25rem"><strong>EchoprintOS Record ID</strong><br><code class="mono">${ecpShow}</code></div>` : ''}
        ${when ? `<div class="muted" style="margin-top:.25rem"><strong>TIMESTAMP (UTC)</strong><br><code class="mono">${when}</code></div>` : ''}
        ${r.hash ? `<div class="muted" style="margin-top:.5rem"><code class="mono" style="opacity:.7">${esc(r.hash)}</code></div>` : ''}
      </div>`;
  } catch (e) {
    resBox.innerHTML = `<div class="muted">Verify error.</div>`;
    console.error(e);
  }
}

// --- Clipboard + Reset ---
btnPaste?.addEventListener('click', async () => {
  try {
    const txt = await navigator.clipboard.readText();
    if (!inpEcp.value) inpEcp.value = txt.trim();
    else inpHash.value = txt.trim();
  } catch { /* ignore */ }
});
btnReset?.addEventListener('click', () => {
  inpEcp.value = ''; inpHash.value = ''; resBox.innerHTML = '';
});
btnVerify?.addEventListener('click', verify);
['keydown'].forEach(evt =>
  document.addEventListener(evt, e => { if (e.key === 'Enter') verify(); })
);

// Load recent on arrive
loadRecent();
