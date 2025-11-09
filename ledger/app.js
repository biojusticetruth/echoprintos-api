<script>
// ===== feature toggles =====
const ENABLE_VERIFY = true;

// ===== tiny helpers =====
const $ = (id) => document.getElementById(id);
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("Request timeout")), ms))]);

const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s||"").trim());
const isECP   = (s) => /^ECP-\d{17,}$/.test(String(s||"").trim()); // ECP-YYYYMMDDHHMMSSmmm

function idFromRow(r){ return r.record_id || r.ecp_id || ""; }
function humanUTC(r){  return r.timestamp_human_utc || ""; }

function showEnvError(where) {
  const msg = `Missing ENV in ${where}. Set window.ENV in ledger/env.js (SUPABASE_URL, SUPABASE_ANON_KEY).`;
  console.error(msg);
  const t = $("verifyResult") || $("recentStatus");
  if (t) t.innerHTML = `<span style="color:#ff8c8c">${msg}</span>`;
}

// ===== env glue =====
if (!window.ENV || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) showEnvError("app.js bootstrap");
const supa = {
  url: (path) => `${ENV.SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": ENV.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_ANON_KEY}`
  })
};

// ===== VERIFY =====
if (!ENABLE_VERIFY) { const sec = $("verifySection"); if (sec) sec.style.display = "none"; }

async function verify(q){
  const out = $("verifyResult");
  if (!out) return;

  q = (q||"").trim();
  if (!q) { out.textContent = ""; return; }
  if (!isECP(q) && !isHex64(q)) {
    out.innerHTML = `<span style="color:#ffbf66">Enter an ECP (ECP-YYYYMMDDHHMMSSmmm) or a 64-hex hash.</span>`;
    return;
  }

  out.textContent = "Looking up…";

  try {
    const params = new URLSearchParams({
      // request BOTH names so we’re schema-tolerant
      select: "record_id,ecp_id,hash,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "1"
    });
    // PostgREST OR syntax (note the equals + commas, wrapped once):
    // match by either id field OR by hash
    params.append("or", `(record_id.eq.${q},ecp_id.eq.${q},hash.eq.${q})`);

    const res = await withTimeout(fetch(
      supa.url(`/rest/v1/v_echoprints_public?${params}`),
      { headers: supa.headers() }
    ));
    if (!res.ok) { out.innerHTML = `<span style="color:#ff8c8c">Error:</span> ${await res.text()}`; return; }

    const rows = await res.json();
    if (!rows.length) { out.innerHTML = `<span style="color:#ff8c8c">No match.</span>`; return; }

    const r    = rows[0];
    const rid  = idFromRow(r);
    const link = `/ledger/?q=${encodeURIComponent(rid)}`;

    out.innerHTML = `
      <div style="color:#7ef3c4">Verified</div>
      <div class="mono" style="margin:.25rem 0">${rid}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${humanUTC(r) || "—"}</span></div>
      <div class="tiny">SHA-256: <span class="mono">${r.hash || "—"}</span></div>
      ${r.permalink ? `<div class="tiny">Source: <a href="${r.permalink}" target="_blank">${r.permalink}</a></div>` : ""}
      <div class="tiny" style="margin-top:.35rem"><a href="${link}">Permalink</a></div>
    `;
  } catch (e) {
    out.innerHTML = `<span style="color:#ff8c8c">Network error:</span> ${e.message}`;
  }
}

$("btnVerify")?.addEventListener("click", () => verify($("q").value.trim()));
$("btnClear")?.addEventListener("click", () => { $("q").value=""; $("verifyResult").textContent=""; });

const qp = new URLSearchParams(location.search);
if (qp.get("q")) { $("q").value = qp.get("q"); verify(qp.get("q")); }

// ===== RECENT FEED =====
async function loadRecent(){
  const status = $("recentStatus"); const feed = $("recent");
  if (!status || !feed) return;
  status.textContent = "Loading…";

  try {
    const params = new URLSearchParams({
      select: "record_id,ecp_id,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "12"
    });
    const res = await withTimeout(fetch(
      supa.url(`/rest/v1/v_echoprints_public?${params}`),
      { headers: supa.headers() }
    ));
    if (!res.ok) { status.innerHTML = `Error: ${await res.text()}`; return; }

    const rows = await res.json();
    feed.innerHTML = rows.map(r => {
      const rid = idFromRow(r);
      return `
        <article class="item">
          <h4 class="mono">${rid}</h4>
          <div class="tiny muted">${humanUTC(r)}</div>
          ${r.title ? `<div>${r.title}</div>` : ""}
          <div class="tiny" style="margin-top:.35rem">
            <a href="/ledger/?q=${encodeURIComponent(rid)}">Verify</a>
            ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ""}
          </div>
        </article>
      `;
    }).join("");
    status.textContent = rows.length ? "" : "No records yet.";
  } catch (e) {
    status.innerHTML = `Network error: ${e.message}`;
  }
}
loadRecent();
</script>
