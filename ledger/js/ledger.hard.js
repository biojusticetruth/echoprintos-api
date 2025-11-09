// === Hardcoded config (no env) ===========================================
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";
const ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c"; // safe for public reads
const VIEW          = "v_echoprints_public";    // the read-only view
// ========================================================================

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept: "application/json"
};

const $ = (s) => document.querySelector(s);
const qInput = $("#q");
const resultEl = $("#verifyResult");
const recentWrap = $("#recent");
const recentStatus = $("#recentStatus");

// Prefill from ?q=... and auto-verify
const params = new URLSearchParams(location.search);
const initialQ = params.get("q");
if (initialQ) { qInput.value = initialQ; verify(); }

$("#btnVerify").addEventListener("click", verify);
$("#btnClear").addEventListener("click", () => {
  qInput.value = ""; resultEl.textContent = "";
});
$("#btnPaste").addEventListener("click", async () => {
  try { qInput.value = await navigator.clipboard.readText(); verify(); }
  catch { /* ignore */ }
});

// Smart verify: ECP, record_id, or 64-hex hash
async function verify() {
  const q = qInput.value.trim();
  resultEl.textContent = "";
  if (!q) return;

  const hex64 = /^[0-9a-f]{64}$/i.test(q);
  const url = new URL(`${SUPABASE_URL}/rest/v1/${VIEW}`);
  url.searchParams.set("select","ecp_id,record_id,title,permalink,hash,timestamp_iso");
  // PostgREST OR: try ecp_id, record_id, hash
  url.searchParams.set("or",`(ecp_id.eq.${q},record_id.eq.${q}${hex64?`,hash.eq.${q}`:""})`);
  url.searchParams.set("limit","10");

  const r = await fetch(url, { headers });
  const rows = await r.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    resultEl.textContent = "No match.";
    return;
  }
  if (rows.length > 1) {
    resultEl.textContent = `Multiple matches (${rows.length}). Showing below.`;
  } else {
    resultEl.textContent = "Match found.";
  }
  // also render them as mini-cards under “Recent”
  renderList(rows, recentWrap, /*override*/ true);
}

// Load recent
(async function loadRecent(){
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${VIEW}`);
    url.searchParams.set("select","ecp_id,record_id,title,permalink,hash,timestamp_iso");
    url.searchParams.set("order","timestamp_iso.desc");
    url.searchParams.set("limit","10");
    const r = await fetch(url, { headers });
    const rows = await r.json();
    recentStatus.textContent = "";
    renderList(rows, recentWrap);
  } catch (e) {
    recentStatus.textContent = "Could not load recent.";
  }
})();

function renderList(rows, container, override = false){
  if (override) container.innerHTML = "";
  for (const row of rows) {
    const title = row.title?.trim() || "(Untitled)";
    const ts    = row.timestamp_iso ? human(row.timestamp_iso) : "";
    const hash  = row.hash ? row.hash.slice(0,8) + "…" : "—";
    const json  = row.permalink || null;

    const card = document.createElement("article");
    card.className = "mini";
    card.innerHTML = `
      <div class="mini-title">${escapeHtml(title)}</div>
      <div class="mini-meta">
        <span class="mono">${escapeHtml(row.ecp_id || row.record_id || "")}</span>
        • ${escapeHtml(ts)} • <span class="mono">${hash}</span>
      </div>
      <div class="mini-links">
        ${json ? `<a href="${json}" target="_blank" rel="noopener">JSON</a>` : ``}
        <a href="/ledger/?q=${encodeURIComponent(row.ecp_id || row.record_id || "")}">Verify</a>
      </div>
    `;
    container.appendChild(card);
  }
}

function human(iso){
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime())/1000);
    const mins = Math.floor(diff/60);
    if (diff < 60) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins/60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs/24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleString();
  } catch { return iso; }
}

function escapeHtml(s){ return String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
