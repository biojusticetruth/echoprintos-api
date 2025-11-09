// /ledger/js/main.hard.js  (no ENV; hard-coded config)
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";   // <-- paste your project REST base URL
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c";                             // <-- paste your Supabase anon key

// ----- guards -----
if (!/^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) || !ANON) {
  throw new Error("SUPABASE_URL or ANON missing/invalid in main.hard.js");
}
const HDRS = {
  "apikey": ANON,
  "Authorization": `Bearer ${ANON}`,
  "Content-Type": "application/json"
};
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("Request timeout")), ms))]);
const isHex64 = s => /^[0-9a-f]{64}$/i.test(String(s||"").trim());
const isECP   = s => /^ECP-\d{17,}$/.test(String(s||"").trim());

// ----- data calls (hard-coded to v_echoprints_public) -----
async function fetchRecent(limit=12){
  const params = new URLSearchParams({
    select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso,hash",
    order: "timestamp_iso.desc",
    limit: String(limit)
  });
  const r = await withTimeout(fetch(`${SUPABASE_URL}/rest/v1/v_echoprints_public?${params}`, { headers: HDRS }));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function fetchOne(q){
  const params = new URLSearchParams({
    select: "*",
    limit: "1",
    order: "timestamp_iso.desc"
  });
  // look up by ECP (record_id) OR hash
  params.append("or", `(record_id.eq.${q},hash.eq.${q})`);
  const r = await withTimeout(fetch(`${SUPABASE_URL}/rest/v1/v_echoprints_public?${params}`, { headers: HDRS }));
  if (!r.ok) throw new Error(await r.text());
  const rows = await r.json();
  return rows[0] || null;
}

// ----- DOM helpers -----
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ----- VERIFY wiring (no placeholder text in the field, no orange helper) -----
const verifyOut = $("#verifyResult");
const inputQ    = $("#q");
$("#btnVerify")?.addEventListener("click", async ()=>{
  const q = (inputQ?.value || "").trim();
  if (!q) { verifyOut.textContent = ""; return; }
  if (!isECP(q) && !isHex64(q)) {
    verifyOut.innerHTML = `<span style="color:#ffbf66">Enter an ECP (e.g., ECP-20251108034124863) or a 64-hex hash.</span>`;
    return;
  }
  verifyOut.textContent = "Looking up…";
  try{
    const row = await fetchOne(q);
    if (!row) { verifyOut.innerHTML = `<span style="color:#ff8c8c">No match.</span>`; return; }
    verifyOut.innerHTML = `
      <div style="color:#7ef3c4">Verified</div>
      <div class="mono" style="margin:.25rem 0">${row.record_id}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${row.timestamp_human_utc || "—"}</span></div>
      <div class="tiny">SHA-256: <span class="mono">${row.hash || "—"}</span></div>
      ${row.permalink ? `<div class="tiny">Source: <a href="${row.permalink}" target="_blank" rel="noopener">permalink</a></div>` : ""}
    `;
  }catch(e){
    verifyOut.innerHTML = `<span style="color:#ff8c8c">Error:</span> ${e.message}`;
  }
});
$("#btnClear")?.addEventListener("click", ()=>{
  if (inputQ) inputQ.value = "";
  if (verifyOut) verifyOut.textContent = "";
});

// ----- RECENT feed (title on top, ECP under it, compact/clean) -----
async function loadRecent(){
  const status = $("#recentStatus");
  const feed   = $("#recent");
  if (!feed) return;
  if (status) status.textContent = "Loading…";
  try{
    const rows = await fetchRecent(12);
    feed.innerHTML = rows.map(r => `
      <article class="item">
        ${r.title ? `<div class="title">${escapeHtml(r.title)}</div>` : ""}
        <div class="mono">${r.record_id}</div>
        <div class="tiny muted">${r.timestamp_human_utc || ""}</div>
        <div class="tiny" style="margin-top:.35rem">
          <a href="/ledger/?q=${encodeURIComponent(r.record_id)}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank" rel="noopener">Post</a>` : ""}
        </div>
      </article>
    `).join("");
    if (status) status.textContent = rows.length ? "" : "No records yet.";
  }catch(e){
    if (status) status.textContent = e.message;
  }
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
loadRecent();

// ----- support query param (?q=ECP-…) -----
const qp = new URLSearchParams(location.search);
if (qp.get("q")) { if (inputQ) inputQ.value = qp.get("q"); $("#btnVerify")?.click(); }
