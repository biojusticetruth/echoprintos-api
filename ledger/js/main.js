// /js/main.hard.js

// --- HARD CODED Supabase client (safe for anon) ---
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";        // <- replace
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c";                      // <- replace

const supa = {
  url: (path) => `${SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  })
};

// --- helpers ---
const $ = (sel) => document.querySelector(sel);
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("Request timeout")), ms))]);
const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s||"").trim());
const isECP   = (s) => /^ECP-\d{17,}$/.test(String(s||"").trim()); // ECP-YYYYMMDDHHMMSSmmm

// --- VERIFY ---
async function verify(q){
  const out = $("#verifyResult");
  if (!out) return;
  if (!q) { out.textContent = ""; return; }

  if (!isECP(q) && !isHex64(q)) {
    out.innerHTML = `<span class="tiny">Enter an ECP (ECP-YYYY…) or a 64-hex hash.</span>`;
    return;
  }
  out.textContent = "Looking up…";

  try {
    const params = new URLSearchParams({
      select: "record_id,hash,title,permalink,timestamp_human_utc,timestamp_iso",
      limit: "1",
      order: "timestamp_iso.desc"
    });
    params.append("or", `(record_id.eq.${q},hash.eq.${q})`);

    const res = await withTimeout(fetch(
      supa.url(`/rest/v1/v_echoprints_public?${params}`),
      { headers: supa.headers() }
    ));
    if (!res.ok) { out.textContent = `Error: ${await res.text()}`; return; }

    const rows = await res.json();
    if (!rows.length) { out.textContent = "No match."; return; }

    const r = rows[0];
    const link = `/record/${encodeURIComponent(r.record_id)}`;
    out.innerHTML = `
      <div style="color:#7ef3c4">Verified</div>
      <div class="mono" style="margin:.25rem 0">${r.record_id}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${r.timestamp_human_utc||"—"}</span></div>
      <div class="tiny">SHA-256: <span class="mono">${r.hash||"—"}</span></div>
      ${r.permalink ? `<div class="tiny">Source: <a href="${r.permalink}" target="_blank">${r.permalink}</a></div>` : ""}
      <div class="tiny" style="margin-top:.35rem"><a href="${link}">Permalink</a></div>
    `;
  } catch (e) {
    out.textContent = `Network error: ${e.message}`;
  }
}

$("#btnVerify")?.addEventListener("click", () => verify($("#q").value.trim()));
$("#btnClear")?.addEventListener("click", () => { $("#q").value=""; $("#verifyResult").textContent=""; });

const qp = new URLSearchParams(location.search);
if (qp.get("q")) { $("#q").value = qp.get("q"); verify(qp.get("q")); }

// --- RECENT FEED ---
async function loadRecent(){
  const status = $("#recentStatus"); const feed = $("#recent");
  if (!status || !feed) return;
  status.textContent = "Loading…";

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
    if (!res.ok) { status.textContent = `Error: ${await res.text()}`; return; }

    const rows = await res.json();
    feed.innerHTML = rows.map(r => `
      <article class="item">
        <h4 class="mono">${r.record_id}</h4>
        <div class="tiny muted">${r.timestamp_human_utc || ""}</div>
        ${r.title ? `<div>${r.title}</div>` : ""}
        <div class="tiny" style="margin-top:.35rem">
          <a href="/record/${encodeURIComponent(r.record_id)}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ""}
        </div>
      </article>
    `).join("");
    status.textContent = rows.length ? "" : "No records yet.";
  } catch (e) {
    status.textContent = `Network error: ${e.message}`;
  }
}
loadRecent();
