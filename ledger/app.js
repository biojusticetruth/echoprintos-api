/* ====== config ====== */
const ENABLE_VERIFY = true;   // set to false to hide the Verify card entirely

/* ====== supabase helpers ====== */
const supa = {
  url: (path) => `${ENV.SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": ENV.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_ANON_KEY}`
  })
};

/* ====== DOM ====== */
const $ = (id) => document.getElementById(id);
if (!ENABLE_VERIFY) $("verifySection").style.display = "none";

/* ====== utils ====== */
const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s||"").trim());
const isECP   = (s) => /^ECP-\d{17,}$/.test(String(s||"").trim());

/* ====== verify ====== */
async function verify(q){
  const out = $("verifyResult");
  if (!q) { out.textContent = ""; return; }
  out.textContent = "Looking up…";

  // search public view; feed keeps hash hidden, verify can show it
  const params = new URLSearchParams({
    select: "record_id,hash,title,timestamp_human_utc,permalink,timestamp_iso",
    limit: "1",
    order: "timestamp_iso.desc",
    or: `record_id.eq.${q},hash.eq.${q}`
  });

  const res = await fetch(supa.url(`/rest/v1/v_echoprints_public?${params}`), { headers: supa.headers() });
  if (!res.ok) {
    out.innerHTML = `<span class="err">Error:</span> ${await res.text()}`;
    return;
  }
  const rows = await res.json();
  if (!rows.length) {
    out.innerHTML = `<span class="err">No match.</span>`;
    return;
  }
  const r = rows[0];
  const link = `/ledger/?q=${encodeURIComponent(r.record_id)}`;
  out.innerHTML = `
    <div class="ok">Verified</div>
    <div class="mono" style="margin:.25rem 0">${r.record_id}</div>
    <div class="tiny">Timestamp (UTC): <span class="mono">${r.timestamp_human_utc||"—"}</span></div>
    <div class="tiny">SHA-256: <span class="mono">${r.hash||"—"}</span></div>
    ${r.permalink ? `<div class="tiny">Source: <a href="${r.permalink}" target="_blank">${r.permalink}</a></div>` : ""}
    <div class="tiny" style="margin-top:.35rem"><a href="${link}">Permalink</a></div>
  `;
}

$("btnVerify")?.addEventListener("click", () => verify($("q").value.trim()));
$("btnClear")?.addEventListener("click", () => { $("q").value=""; $("verifyResult").textContent=""; });

// if a query param ?q=… is present, auto-verify
const qp = new URLSearchParams(location.search);
if (qp.get("q")) {
  $("q").value = qp.get("q");
  verify(qp.get("q"));
}

/* ====== recent feed ====== */
async function loadRecent(){
  $("recentStatus").textContent = "Loading…";
  const params = new URLSearchParams({
    select: "record_id,title,timestamp_human_utc,permalink,timestamp_iso",
    order: "timestamp_iso.desc",
    limit: "12"
  });
  const res = await fetch(supa.url(`/rest/v1/v_echoprints_public?${params}`), { headers: supa.headers() });
  if (!res.ok) {
    $("recentStatus").innerHTML = `Error: ${await res.text()}`;
    return;
  }
  const rows = await res.json();
  $("recent").innerHTML = rows.map(r => `
    <article class="item">
      <h4 class="mono">${r.record_id}</h4>
      <div class="tiny muted">${r.timestamp_human_utc || ""}</div>
      ${r.title ? `<div>${r.title}</div>` : ""}
      <div class="tiny" style="margin-top:.35rem">
        <a href="/ledger/?q=${encodeURIComponent(r.record_id)}">Verify</a>
        ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ""}
      </div>
    </article>
  `).join("");
  $("recentStatus").textContent = rows.length ? "" : "No records yet.";
}
loadRecent();
