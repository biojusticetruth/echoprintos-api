// ledger/app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';

const REST = `${SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

// --- helpers
const $ = (s) => document.querySelector(s);
const feedEl = $('#feed');
const inputEl = $('#q');
$('#btnVerify')?.addEventListener('click', onVerify);
$('#btnRecent')?.addEventListener('click', fetchRecent);

setStatus(''); // clear

// --- recent feed (ECP + UTC only)
async function fetchRecent() {
  setStatus('Loading…');
  // NOTE: remove ",permalink" below if your view doesn't have that column
  const url = `${REST}/v_echoprints_public?select=ecp_id,title,timestamp_human_utc,permalink&order=timestamp_iso.desc&limit=12`;
  const r = await fetch(url, { headers });
  const rows = await r.json();
  renderFeed(Array.isArray(rows) ? rows : []);
  setStatus('');
}

function renderFeed(rows) {
  if (!rows.length) {
    feedEl.innerHTML = `<div class="small">No records yet.</div>`;
    return;
  }
  feedEl.innerHTML = rows.map(r => `
    <article class="card">
      <div class="mono small muted">EchoprintOS Record ID</div>
      <div class="mono"><strong>${r.ecp_id}</strong></div>
      <div class="mono small muted" style="margin-top:8px">Timestamp (UTC)</div>
      <div class="mono">${r.timestamp_human_utc}</div>
      ${r.permalink ? `<div class="small" style="margin-top:8px"><a href="${r.permalink}">Permalink</a></div>` : ``}
    </article>
  `).join('');
}

// --- verify by ECP or 64-hex hash
async function onVerify() {
  const q = (inputEl.value || '').trim();
  if (!q) return;
  setStatus('Verifying…');
  const enc = encodeURIComponent(q);
  // NOTE: remove ",permalink" below if your view doesn't have that column
  const url = `${REST}/v_echoprints_public?select=ecp_id,title,timestamp_human_utc,hash,permalink&or=(ecp_id.eq.${enc},hash.eq.${enc})&limit=1`;
  const r = await fetch(url, { headers });
  const rows = await r.json();
  showVerify(rows?.[0] || null);
  setStatus('');
}

function showVerify(row) {
  const box = $('#verify-result');
  if (!box) return;
  if (!row) {
    box.innerHTML = `<div class="card"><div class="mono">No match.</div></div>`;
    return;
  }
  box.innerHTML = `
    <div class="card">
      <div class="mono small muted">ECP</div>
      <div class="mono"><strong>${row.ecp_id}</strong></div>
      <div class="mono small muted" style="margin-top:8px">Timestamp (UTC)</div>
      <div class="mono">${row.timestamp_human_utc}</div>
      <div class="mono small muted" style="margin-top:8px">SHA-256</div>
      <div class="mono card-hash">${row.hash}</div>
      ${row.permalink ? `<div class="small" style="margin-top:8px"><a href="${row.permalink}">Permalink</a></div>` : ``}
    </div>`;
}

function setStatus(msg) { const n = $('#status'); if (n) n.textContent = msg || ''; }

// init
fetchRecent();
