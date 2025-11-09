// === Hardcoded config (no env) ===========================================
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";
const ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c"; // safe for public reads
const VIEW          = "v_echoprints_public";    // read-only view

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept: "application/json",
};

const $  = (s) => document.querySelector(s);
const qInput       = $("#q");
const resultEl     = $("#verifyResult");
const recentWrap   = $("#recent");
const recentStatus = $("#recentStatus");

const btnVerify = $("#btnVerify");
const btnClear  = $("#btnClear");
const btnPaste  = $("#btnPaste");

// ---- Helpers ------------------------------------------------
const isHex64 = (s) => /^[a-fA-F0-9]{64}$/.test(s || "");
const isEcpId = (s) => /^ECP[-–][A-Za-z0-9:_-]+$/.test(s || "");

const shortHash = (h) => h ? `${h.slice(0,8)}…${h.slice(-8)}` : "";
const safe = (s) => (s ?? "").toString();

function fmtItem(r) {
  const lines = [];
  if (r.title)       lines.push(`Title: ${r.title}`);
  if (r.record_id)   lines.push(`ECP:   ${r.record_id}`);
  if (r.hash)        lines.push(`Hash:  ${shortHash(r.hash)} (${r.hash.length} hex)`);
  if (r.timestamp_iso || r.created_at) {
    lines.push(`Time:  ${r.timestamp_iso || r.created_at}`);
  }
  if (r.permalink || r.url) {
    lines.push(`Link:  ${r.permalink || r.url}`);
  }
  return lines.join("\n");
}

async function loadRecent() {
  recentStatus.textContent = "Loading…";
  recentWrap.innerHTML = "";

  try {
    // ask for several possible time fields; the view will just return the ones it has
    const cols = "record_id,title,hash,timestamp_iso,created_at,captured_at,permalink,url";
    const rec  = await sbGet(`${VIEW}?select=${cols}&limit=30`);

    if (!rec.length) {
      recentStatus.textContent = "No records yet.";
      return;
    }

    // client-side sort by best available timestamp
    rec.sort((a, b) => {
      const ts = (r) => Date.parse(r.timestamp_iso || r.created_at || r.captured_at || 0);
      return ts(b) - ts(a);
    });

    recentStatus.textContent = "";
    const frag = document.createDocumentFragment();

    rec.forEach((r) => {
      const li = document.createElement("li");
      li.className = "item";
      const time  = (r.timestamp_iso || r.created_at || r.captured_at || "").toString();
      const title = (r.title || "(untitled)").toString();
      const ecp   = (r.record_id || "").toString();
      const link  = (r.permalink || r.url || "").toString();

      li.innerHTML = `
        <div><strong>${title}</strong></div>
        <div class="muted">${time}</div>
        <div class="mono">${ecp}${r.hash ? " • " + (r.hash.slice(0,8)+"…"+r.hash.slice(-8)) : ""}</div>
        ${link ? `<div><a class="link" href="${link}" target="_blank" rel="noopener">Source</a></div>` : ""}
      `;
      frag.appendChild(li);
    });

    recentWrap.appendChild(frag);
  } catch (err) {
    recentStatus.textContent = `Error loading recent: ${err.message}`;
  }
}

// ---- Verify -------------------------------------------------
async function verify() {
  const q = (qInput.value || "").trim();
  if (!q) { resultEl.textContent = "Enter an ECP or 64-hex hash."; return; }

  try {
    resultEl.textContent = "Verifying…";

    // Build an OR query against the public view
    // Example: or=(record_id.eq.ECP-...,hash.eq.abc...)
    const orParts = [];
    if (isEcpId(q))      orParts.push(`record_id.eq.${encodeURIComponent(q)}`);
    if (isHex64(q))      orParts.push(`hash.eq.${q.toLowerCase()}`);
    if (!orParts.length) orParts.push(`record_id.eq.${encodeURIComponent(q)}`); // fallback try

    const orParam = encodeURIComponent(`(${orParts.join(",")})`);

    // Select common columns you expose on the view
    const cols = "record_id,title,hash,timestamp_iso,created_at,permalink,url";
    const data = await sbGet(`${VIEW}?select=${cols}&or=${orParam}&limit=5`);

    if (!data.length) {
      resultEl.textContent = "No match. Double-check the value and try again.";
      return;
    }

    // Show the first match (and count remaining)
    const first = data[0];
    let out = fmtItem(first);
    if (data.length > 1) out += `\n(+ ${data.length - 1} more)`;
    resultEl.textContent = out;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}

// ---- Recent -------------------------------------------------
async function loadRecent() {
  recentStatus.textContent = "Loading…";
  recentWrap.innerHTML = "";

  try {
    // Order by most stable time column your view exposes
    const cols = "record_id,title,hash,timestamp_iso,created_at,permalink,url";
    // prefer timestamp_iso; if your view uses created_at, it will still sort (unknown columns are ignored server-side)
    const q   = `${VIEW}?select=${cols}&order=timestamp_iso.desc&limit=20`;
    const rec = await sbGet(q);

    if (!rec.length) {
      recentStatus.textContent = "No records yet.";
      return;
    }

    recentStatus.textContent = "";
    const frag = document.createDocumentFragment();

    rec.forEach((r) => {
      const li = document.createElement("li");
      li.className = "item";
      const time = safe(r.timestamp_iso || r.created_at);
      const title = safe(r.title) || "(untitled)";
      const ecp = safe(r.record_id);
      const link = safe(r.permalink || r.url || "");

      li.innerHTML = `
        <div><strong>${title}</strong></div>
        <div class="muted">${time}</div>
        <div class="mono">${ecp}${r.hash ? " • " + shortHash(r.hash) : ""}</div>
        ${link ? `<div><a class="link" href="${link}" target="_blank" rel="noopener">Source</a></div>` : "" }
      `;
      frag.appendChild(li);
    });

    recentWrap.appendChild(frag);
  } catch (err) {
    recentStatus.textContent = `Error loading recent: ${err.message}`;
  }
}

// ---- Wire up (with guards; won’t crash if a button is missing) ----
btnVerify && btnVerify.addEventListener("click", verify);

btnClear && btnClear.addEventListener("click", () => {
  qInput.value = "";
  resultEl.textContent = "";
});

if (btnPaste && navigator.clipboard?.readText) {
  btnPaste.addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { qInput.value = t.trim(); verify(); }
    } catch (_) {
      alert("Paste failed. Long-press in the field and choose Paste.");
    }
  });
}

// Prefill from ?q=… and auto-verify
const params = new URLSearchParams(location.search);
const initialQ = params.get("q");
if (initialQ) { qInput.value = initialQ; verify(); }

// Kick things off
loadRecent();
