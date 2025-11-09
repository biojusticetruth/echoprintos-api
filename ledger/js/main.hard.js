/* ========= SUPABASE (HARDCODE — replace these 2 strings) ========= */
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c";

/* ========= tiny helpers ========= */
const $ = (sel) => document.querySelector(sel);
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("Request timeout")), ms))]);

/* Accepts ECP-… (hyphen) or ECP–… (en dash) with long numeric tail */
function isECP(s){ return /^ECP[-\u2013\u2014]?\d{10,}$/.test(String(s||"").trim()); }
function isHex64(s){ return /^[0-9a-f]{64}$/i.test(String(s||"").trim()); }

/* ========= VERIFY ========= */
const verifyBox = $("#q");
const verifyOut = $("#verifyResult");
const btnVerify = $("#btnVerify");
const btnClear  = $("#btnClear");

async function verify(q){
  if (!verifyOut) return;
  // Keep it silent unless valid input
  if (!q || (!isECP(q) && !isHex64(q))) { verifyOut.innerHTML = ""; return; }

  try {
    const params = new URLSearchParams({
      select: "record_id,hash,title,permalink,timestamp_human_utc,timestamp_iso",
      limit: "1",
      order: "timestamp_iso.desc"
    });
    // Proper OR filter for record_id or hash
    params.append("or", `(record_id.eq.${q},hash.eq.${q})`);

    const res = await withTimeout(fetch(
      `${SUPABASE_URL}/rest/v1/v_echoprints_public?${params.toString()}`,
      { headers: {
          "Content-Type":"application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }}
    ));
    if (!res.ok) { verifyOut.innerHTML = ""; return; }

    const rows = await res.json();
    if (!rows.length) { verifyOut.innerHTML = ""; return; }

    const r = rows[0];
    const link = `/record/${encodeURIComponent(r.record_id)}`;
    // Minimal, only when we actually have a match
    verifyOut.innerHTML = `
      <div class="mono" style="margin:.25rem 0">${r.record_id}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${r.timestamp_human_utc||"—"}</span></div>
      ${r.hash ? `<div class="tiny">SHA-256: <span class="mono">${r.hash}</span></div>` : ""}
      ${r.permalink ? `<div class="tiny">Source: <a href="${r.permalink}" target="_blank" rel="noopener">Open</a></div>` : ""}
      <div class="tiny" style="margin-top:.35rem"><a href="${link}">Permalink</a></div>
    `;
  } catch {
    verifyOut.innerHTML = "";
  }
}

btnVerify?.addEventListener("click", () => verify(verifyBox.value.trim()));
btnClear?.addEventListener("click", () => { verifyBox.value=""; verifyOut.innerHTML=""; });

// **Do NOT** prefill the input from URL — keep it empty and calm.

/* ========= RECENT FEED ========= */
const recentStatus = $("#recentStatus");
const recentList   = $("#recent");

async function loadRecent(){
  if (!recentList) return;

  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "12"
    });
    const res = await withTimeout(fetch(
      `${SUPABASE_URL}/rest/v1/v_echoprints_public?${params.toString()}`,
      { headers: {
          "Content-Type":"application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }}
    ));
    if (!res.ok) { recentStatus.textContent = await res.text(); return; }

    const rows = await res.json();
    if (!rows.length) { recentStatus.textContent = "No records yet."; return; }

    recentList.innerHTML = rows.map(r => `
      <article class="item">
        <h4 class="mono" style="margin:0 0 2px 0">${r.record_id}</h4>
        <div class="tiny muted">${r.timestamp_human_utc || ""}</div>
        ${r.title ? `<div style="margin-top:6px">${r.title}</div>` : ""}
        <div class="tiny" style="margin-top:.35rem">
          <a href="/record/${encodeURIComponent(r.record_id)}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank" rel="noopener">Post</a>` : ""}
        </div>
      </article>
    `).join("");
    recentStatus.textContent = "";
  } catch (e) {
    recentStatus.textContent = e.message || "Network error";
  }
}
loadRecent();
