/* ========= SUPABASE (HARDCODE — replace these 2 strings) ========= */
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c".

/* ===============================
   Small helpers
   =============================== */
const $ = (s) => document.querySelector(s);
const withTimeout = (p, ms = 12000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Request timeout")), ms))]);

const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s || "").trim());
const isECP   = (s) => /^ECP-\d{17,}$/.test(String(s || "").trim());
const shortHash = (h) => h && h.length > 20 ? `${h.slice(0,10)}…${h.slice(-10)}` : (h || "");

// small client
const sb = {
  url: (path) => `${SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type":"application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  })
};

/* ===============================
   VERIFY
   =============================== */
async function verify(q){
  const out = $("#verifyResult");
  if (!out) return;
  out.textContent = "";

  if (!q || (!isECP(q) && !isHex64(q))) {
    // no error stripe, just ignore quietly
    return;
  }

  out.textContent = "Looking up…";
  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,hash,timestamp_human_utc,timestamp_iso",
      limit: "1",
      order: "timestamp_iso.desc"
    });
    params.append("or", `(record_id.eq.${q},hash.eq.${q})`);

    const res = await withTimeout(fetch(
      sb.url(`/rest/v1/v_echoprints_public?${params}`),
      { headers: sb.headers() }
    ));
    if (!res.ok) {
      out.innerHTML = `Error: ${await res.text()}`;
      return;
    }
    const rows = await res.json();
    if (!rows.length) { out.textContent = "No match."; return; }

    const r = rows[0];
    const detail = `/record/${encodeURIComponent(r.record_id)}`;
    out.innerHTML = `
      <div class="ok">Verified</div>
      ${r.title ? `<div style="font-weight:600;margin-bottom:2px">${r.title}</div>` : ""}
      <div class="tiny">Record ID: <span class="mono">${r.record_id}</span></div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${r.timestamp_human_utc || ""}</span></div>
      ${r.hash ? `<div class="tiny">SHA-256: <span class="mono">${shortHash(r.hash)}</span></div>` : ""}
      <div class="tiny" style="margin-top:.35rem">
        <a href="${detail}">Permalink</a>
        ${r.permalink ? ` · <a href="${r.permalink}" target="_blank" rel="noopener">Source</a>` : ""}
      </div>
    `;
  } catch (e) {
    out.innerHTML = `Network error: ${e.message}`;
  }
}

$("#btnVerify")?.addEventListener("click", () => verify($("#q").value.trim()));
$("#btnClear")?.addEventListener("click", () => { $("#q").value = ""; $("#verifyResult").textContent = ""; });

// pre-fill from ?q=
const qp = new URLSearchParams(location.search);
if (qp.get("q")) { const v = qp.get("q"); $("#q").value = v; verify(v); }

/* ===============================
   RECENT
   =============================== */
async function loadRecent(){
  const status = $("#recentStatus");
  const feed   = $("#recent");
  if (!status || !feed) return;

  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "12"
    });

    const res = await withTimeout(fetch(
      sb.url(`/rest/v1/v_echoprints_public?${params}`),
      { headers: sb.headers() }
    ));
    if (!res.ok) { status.innerHTML = `Error: ${await res.text()}`; return; }

    const rows = await res.json();
    if (!rows.length){ status.textContent = "No records yet."; feed.innerHTML = ""; return; }
    status.textContent = "";

    // link back to this ledger page with ?q=
    const ledgerHref = location.pathname.includes("/ledger/") ? location.pathname : "/ledger/";

    feed.innerHTML = rows.map(r => `
      <article class="item">
        ${r.title ? `<h4>${r.title}</h4>` : `<h4 class="muted">Untitled</h4>`}
        <div class="meta tiny">
          <span class="chip mono">${r.record_id}</span>
          <span class="chip">${r.timestamp_human_utc || ""} UTC</span>
          ${r.permalink ? `<a class="chip" href="${r.permalink}" target="_blank" rel="noopener">Post</a>` : ``}
          <a class="chip" href="${ledgerHref}?q=${encodeURIComponent(r.record_id)}">Verify</a>
        </div>
      </article>
    `).join("");
  } catch (e) {
    status.innerHTML = `Network error: ${e.message}`;
  }
}
loadRecent();
