/* ====== CONFIG (fill these) ====== */
const SUPABASE_URL  = 'https://cyndhzyfaffprdebclnw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c';
const TABLE_READ    = 'echoprints'; // or 'v_echoprints_public'

/* Read from your public read-only view */
const TABLE_READ = "v_echoprints_public";

const HEADERS = {
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`,
};

/* ========= HELPERS ========= */
const $ = (sel) => document.querySelector(sel);

function fmtUTC(tsIso) {
  try {
    const d = new Date(tsIso);
    const w = d.toUTCString(); // "Sun, 26 Oct 2025 15:45:55 GMT"
    return w.replace("GMT", "UTC");
  } catch { return tsIso || "—"; }
}

function setCert(data) {
  $("#certTitle").textContent = data?.title || "—";
  $("#certEcp").textContent   = data?.record_id || "—";
  $("#certTs").textContent    = data?.timestamp_iso ? fmtUTC(data.timestamp_iso) : "—";

  // Hash (only show if present)
  if (data?.hash) {
    $("#rowHash").style.display = "";
    $("#certHash").textContent = data.hash;
  } else {
    $("#rowHash").style.display = "none";
  }

  // Substack link (if we have an URL or we have a fallback)
  const url = data?.url || data?.permalink || "";
  const open = $("#openOnSubstack");
  if (url) {
    open.href = url;
    open.style.display = "";
  } else if (SUBSTACK_FALLBACK) {
    open.href = SUBSTACK_FALLBACK;
    open.style.display = "";
  } else {
    open.removeAttribute("href");
    open.style.display = "none";
  }
}

/* ========= DATA ========= */
async function getByEcp(ecp) {
  const u = `${SUPABASE_URL}/rest/v1/${TABLE_READ}`
          + `?select=title,record_id,hash,timestamp_iso,url,permalink,source,platform`
          + `&record_id=eq.${encodeURIComponent(ecp)}&limit=1`;
  const r = await fetch(u, { headers: HEADERS });
  const j = await r.json();
  return j[0] || null;
}

async function getByHash(sha) {
  const u = `${SUPABASE_URL}/rest/v1/${TABLE_READ}`
          + `?select=title,record_id,hash,timestamp_iso,url,permalink,source,platform`
          + `&hash=eq.${encodeURIComponent(sha)}&limit=1`;
  const r = await fetch(u, { headers: HEADERS });
  const j = await r.json();
  return j[0] || null;
}

async function getRecent(limit = 10) {
  const u = `${SUPABASE_URL}/rest/v1/${TABLE_READ}`
          + `?select=title,record_id,timestamp_iso,url,permalink,source,platform`
          + `&order=timestamp_iso.desc&limit=${limit}`;
  const r = await fetch(u, { headers: HEADERS });
  return await r.json();
}

/* ========= UI WIRES ========= */
function showCert()  { $("#certOverlay").classList.add("show"); $("#certOverlay").setAttribute("aria-hidden","false"); }
function hideCert()  { $("#certOverlay").classList.remove("show"); $("#certOverlay").setAttribute("aria-hidden","true"); }

async function doVerify() {
  const ecp  = $("#ecpInput").value.trim();
  const hash = $("#hashInput").value.trim();

  let data = null;
  if (ecp)  data = await getByEcp(ecp);
  else if (hash) data = await getByHash(hash);

  if (!data) {
    alert("No matching record found. Try the full ECP or the full 64-hex hash.");
    return;
  }

  setCert(data);
  showCert();
}

function clearForm() {
  $("#ecpInput").value = "";
  $("#hashInput").value = "";
}

function badgeLabel(row) {
  const s = (row.source || row.platform || "").toLowerCase();
  if (s.includes("substack")) return "Substack";
  if (s.includes("x/")) return "X";
  if (s.includes("twitter")) return "Twitter";
  if (s.includes("instagram")) return "Instagram";
  if (s.includes("youtube")) return "YouTube";
  return "";
}

function anchorUrl(row) {
  return row.url || row.permalink || "";
}

async function renderFeed() {
  const feed = $("#feed");
  feed.innerHTML = "";
  const rows = await getRecent(12);
  if (!rows || !rows.length) { $("#feedEmpty").style.display = ""; return; }
  $("#feedEmpty").style.display = "none";

  rows.forEach(row => {
    const card = document.createElement("div");
    card.className = "item";

    // Title + badge
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = row.title || "Untitled";

    const b = badgeLabel(row);
    if (b) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = b;
      t.appendChild(badge);
    }
    card.appendChild(t);

    // Meta: ECP + TS
    const meta = document.createElement("div");
    meta.className = "meta";
    const line1 = document.createElement("div");
    line1.textContent = `ECP: ${row.record_id || "—"}`;
    const line2 = document.createElement("div");
    line2.textContent = `TIMESTAMP (UTC): ${row.timestamp_iso ? fmtUTC(row.timestamp_iso) : "—"}`;
    meta.appendChild(line1);
    meta.appendChild(line2);
    card.appendChild(meta);

    // Card click opens link (if present)
    const url = anchorUrl(row);
    if (url) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => window.open(url, "_blank", "noopener"));
    }

    feed.appendChild(card);
  });
}

/* ========= BOOT ========= */
document.addEventListener("DOMContentLoaded", () => {
  $("#btnVerify").addEventListener("click", doVerify);
  $("#btnReset").addEventListener("click", clearForm);
  $("#btnCloseCert").addEventListener("click", hideCert);
  $("#btnCloseBottom").addEventListener("click", hideCert);
  renderFeed();
});
