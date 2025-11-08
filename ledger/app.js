// Uses your existing env.js. Any of these shapes will work:
import * as env from './env.js';
// Supported names: SUPABASE_URL/SUPABASE_ANON_KEY or url/key
const SUPABASE_URL = env.SUPABASE_URL || env.url || env.SUPABASE_PROJECT_URL;
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.key || env.SUPABASE_KEY;

const h = (sel) => document.querySelector(sel);
const elQ    = h('#q');
const elVerify = h('#btnVerify');
const elRecent = h('#btnRecent');
const elFeed   = h('#feed');
const elResult = h('#verify-result');
const elStatus = h('#status');

function headers() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

function viewURL(params) {
  const base = `${SUPABASE_URL}/rest/v1/v_echoprints_public`;
  return `${base}?${params}`;
}

function showStatus(msg='') { elStatus.textContent = msg; }
function cardHTML(record) {
  const { ecp_id, title, timestamp_human_utc, permalink } = record;
  return `
    <article class="card">
      <h3>${title ? escapeHtml(title) : 'Echoprint'}</h3>
      <div class="kv">
        <div class="k">ECP</div>
        <div class="v mono">${ecp_id}</div>
        <div class="k">Timestamp</div>
        <div class="v">${timestamp_human_utc}</div>
        ${permalink ? `<div class="k">Link</div><div class="v"><a href="${permalink}" target="_blank" rel="noopener">Permalink</a></div>` : ``}
      </div>
    </article>
  `;
}
function verifyHTML(record) {
  // On the verify detail we DO show the hash for audit transparency
  const { ecp_id, hash, title, timestamp_human_utc, permalink } = record;
  return `
    <article class="card">
      <h3>${title ? escapeHtml(title) : 'Echoprint'}</h3>
      <div class="kv">
        <div class="k">ECP</div>
        <div class="v mono">${ecp_id}</div>
        <div class="k">SHA-256</div>
        <div class="v mono">${hash}</div>
        <div class="k">Timestamp</div>
        <div class="v">${timestamp_human_utc}</div>
        ${permalink ? `<div class="k">Link</div><div class="v"><a href="${permalink}" target="_blank" rel="noopener">Permalink</a></div>` : ``}
      </div>
    </article>
  `;
}

async function loadRecent() {
  showStatus('Loading recent…');
  try {
    const url = viewURL([
      'select=ecp_id,title,timestamp_human_utc,timestamp_iso,permalink',
      'order=timestamp_iso.desc',
      'limit=12'
    ].join('&'));
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      elFeed.innerHTML = `<p class="muted">No records yet.</p>`;
    } else {
      elFeed.innerHTML = rows.map(cardHTML).join('');
    }
    showStatus('');
  } catch (err) {
    showStatus('Failed to load recent.');
    elFeed.innerHTML = `<p class="muted mono">${escapeHtml(err.message)}</p>`;
  }
}

async function verifyQuery(q) {
  if (!q) return;
  showStatus('Verifying…');
  elResult.innerHTML = '';
  try {
    const enc = encodeURIComponent(q.trim());
    // OR filter: try ECP match OR hash match
    const url = viewURL([
      'select=ecp_id,hash,title,timestamp_human_utc,timestamp_iso,permalink',
      `or=(ecp_id.eq.${enc},hash.eq.${enc})`,
      'limit=1'
    ].join('&'));
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const rows = await res.json();
    if (!rows.length) {
      elResult.innerHTML = `<p class="muted">No match for <span class="mono">${escapeHtml(q)}</span>.</p>`;
    } else {
      elResult.innerHTML = verifyHTML(rows[0]);
    }
    showStatus('');
  } catch (err) {
    showStatus('Verification failed.');
    elResult.innerHTML = `<p class="muted mono">${escapeHtml(err.message)}</p>`;
  }
}

function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Wire up UI
elVerify.addEventListener('click', () => verifyQuery(elQ.value));
elRecent.addEventListener('click', loadRecent);
elQ.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') verifyQuery(elQ.value);
});

// Deep-link: /ledger/?ecp=ECP-....
const params = new URLSearchParams(location.search);
const deep = params.get('ecp') || params.get('hash') || params.get('q');
if (deep) { elQ.value = deep; verifyQuery(deep); }

// Initial feed
loadRecent();
