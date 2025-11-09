// ---- constants (no ENV anymore) ----
const SUPABASE_URL = "https://YOURPROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";

const supa = {
  url: (p) => `${SUPABASE_URL}${p}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  })
};

// ---- helpers ----
const $ = (id) => document.getElementById(id);
const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s||"").trim());
const isECP   = (s) => /^ECP-\d{17,}$/.test(String(s||"").trim());
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error("Timeout")), ms))]);

// ---- verify ----
async function verify(q){
  const out = $("verifyResult");
  if (!out) return;
  q = (q||"").trim();
  if (!isECP(q) && !isHex64(q)) { out.textContent = "Enter an ECP (ECP-YYYY…) or a 64-hex hash."; return; }
  out.textContent = "Looking up…";
  try {
    const params = new URLSearchParams({
      select: "record_id,hash,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "1"
    });
    params.append("or", `(record_id.eq.${q},hash.eq.${q})`);
    const res = await withTimeout(fetch(supa.url(`/rest/v1/v_echoprints_public?${params}`), { headers: supa.headers() }));
    if (!res.ok) { out.textContent = `Error: ${await res.text()}`; return; }
    const rows = await res.json();
    if (!rows.length) { out.textContent = "No match."; return; }
    const r = rows[0];
    out.innerHTML = `
      <div class="ok">Verified</div>
      <div class="mono">${r.record_id}</div>
      <div class="tiny">UTC: <span class="mono">${r.timestamp_human_utc||"—"}</span></div>
      <div class="tiny">SHA-256: <span class="mono">${r.hash||"—"}</span></div>
      ${r.permalink ? `<div class="tiny">Source: <a href="${r.permalink}" target="_blank">open</a></div>` : ""}
      <div class="tiny"><a href="/ledger/?q=${encodeURIComponent(r.record_id)}">Permalink</a></div>`;
  } catch(e){ out.textContent = `Network error: ${e.message}`; }
}

// wire up
$("btnVerify")?.addEventListener("click", () => verify($("q").value));
$("q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") verify($("q").value); });

// run if ?q=
const qp = new URLSearchParams(location.search);
if (qp.get("q")) { $("q").value = qp.get("q"); verify(qp.get("q")); }

// ---- recent feed ----
async function loadRecent(){
  const status = $("recentStatus"); const feed = $("recent");
  if (!status || !feed) return;
  status.textContent = "Loading…";
  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "12"
    });
    const res = await withTimeout(fetch(supa.url(`/rest/v1/v_echoprints_public?${params}`), { headers: supa.headers() }));
    if (!res.ok) { status.textContent = `Error: ${await res.text()}`; return; }
    const rows = await res.json();
    feed.innerHTML = rows.map(r => `
      <article class="item">
        <h4 class="mono">${r.record_id}</h4>
        <div class="tiny muted">${r.timestamp_human_utc||""}</div>
        ${r.title ? `<div>${r.title}</div>` : ""}
        <div class="tiny" style="margin-top:.35rem">
          <a href="/ledger/?q=${encodeURIComponent(r.record_id)}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ""}
        </div>
      </article>
    `).join("");
    status.textContent = rows.length ? "" : "No records yet.";
  } catch(e){ status.textContent = `Network error: ${e.message}`; }
}
loadRecent();

// /ledger/js/main.js
const getENV = () => (window && window.ENV) ? window.ENV : null;
function assertENV(where="init"){
  const E = getENV();
  if (!E || !E.SUPABASE_URL || !E.SUPABASE_ANON_KEY){
    const t = document.getElementById("verifyResult") || document.getElementById("recentStatus");
    if (t) t.innerHTML = `<span style="color:#ff6b6b">Missing ENV in ${where}. Check /ledger/env.js.</span>`;
    console.error(`Missing ENV in ${where}`);
    return null;
  }
  return E;
}

/* ========= helpers ========= */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), ms))]);

const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s||'').trim());
const isECP   = (s) => /^ECP-\d{10,}$/.test(String(s||'').trim()); // your long format

/* ========= env ========= */
if (!window.ENV || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.error("Missing ENV. Check /ledger/env.js");
}

const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co",
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c";

const supa = {
  url: (path) => `${SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  })
};

/* ========= VERIFY (if present) ========= */
function bindVerify(){
  const form = $('#verify-form');
  const input = $('#verify-input');
  const out = $('#verify-result');
  if (!form || !input || !out) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { out.textContent = ""; return; }
    if (!isECP(q) && !isHex64(q)) {
      out.innerHTML = `<span class="warn">Enter an ECP (ECP-YYYY…) or a 64-hex hash.</span>`;
      return;
    }
    out.textContent = "Looking up…";

    try {
      const params = new URLSearchParams({
        select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso,hash",
        limit: "1",
        order: "timestamp_iso.desc"
      });
      // PostgREST OR filter
      params.append("or", `(record_id.eq.${q},hash.eq.${q})`);

      const res = await withTimeout(fetch(
        supa.url(`/rest/v1/v_echoprints_public?${params}`),
        { headers: supa.headers() }
      ));
      if (!res.ok) {
        out.innerHTML = `<span class="err">Error:</span> ${await res.text()}`;
        return;
      }
      const rows = await res.json();
      if (!rows.length) { out.innerHTML = `<span class="warn">No match.</span>`; return; }

      const r = rows[0];
      out.innerHTML = `
        <article class="card">
          <header class="card-head">
            <h3 class="title">${r.title || 'Untitled'}</h3>
            <div class="pill mono">${r.record_id}</div>
          </header>
          <dl class="meta">
            <dt>Timestamp</dt><dd class="mono">${r.timestamp_human_utc||'—'}</dd>
            <dt>SHA-256</dt><dd class="mono">${r.hash||'—'}</dd>
            ${r.permalink ? `<dt>Source</dt><dd><a href="${r.permalink}" target="_blank">${r.permalink}</a></dd>` : ''}
          </dl>
          <nav class="actions">
            <a class="btn ghost" href="/ledger/?q=${encodeURIComponent(r.record_id)}">Permalink</a>
          </nav>
        </article>
      `;
    } catch (e) {
      out.innerHTML = `<span class="err">Network error:</span> ${e.message}`;
    }
  });

  // Support /ledger/?q=ECP…
  const qp = new URLSearchParams(location.search);
  if (qp.get('q')) { input.value = qp.get('q'); form.dispatchEvent(new Event('submit')); }
}

/* ========= RECENT FEED (if present) ========= */
async function loadRecent(){
  const list = $('#recent-list');
  const status = $('#recent-status');
  if (!list || !status) return;

  status.textContent = 'Loading…';
  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "12"
    });
    const res = await withTimeout(fetch(
      supa.url(`/rest/v1/v_echoprints_public?${params}`),
      { headers: supa.headers() }
    ));
    if (!res.ok) { status.textContent = await res.text(); return; }
    const rows = await res.json();

    list.innerHTML = rows.map(r => `
      <article class="mini">
        <div class="top">
          <h4 class="mono">${r.record_id}</h4>
          <div class="tiny muted">${r.timestamp_human_utc || ''}</div>
        </div>
        <div class="title">${r.title ? r.title : ''}</div>
        <div class="row tiny">
          <a href="/ledger/?q=${encodeURIComponent(r.record_id)}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ''}
        </div>
      </article>
    `).join('');
    status.textContent = rows.length ? '' : 'No records yet.';
  } catch (e) {
    status.textContent = `Network error: ${e.message}`;
  }
}

/* ========= bootstrap ========= */
document.addEventListener('DOMContentLoaded', ()=>{
  bindVerify();
  loadRecent();
});
