/* ========= SUPABASE (HARDCODE — replace these 2 strings) ========= */
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c".

/* ---- helpers ---- */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("Request timeout")), ms))]);
const isHex64  = (s) => /^[0-9a-f]{64}$/i.test(String(s||"").trim());
const isECP    = (s) => /^ECP-\d{17,}$/.test(String(s||"").trim());
const tHash    = (h) => (h && h.length >= 12) ? `${h.slice(0,6)}…${h.slice(-6)}` : (h || "—");

const supa = {
  url: (path) => `${HARDCODE.SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": HARDCODE.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${HARDCODE.SUPABASE_ANON_KEY}`
  })
};

/* ---- VERIFY ---- */
async function verify(q){
  const out = $("#verifyResult");
  if (!out) return;
  out.textContent = "";

  const term = String(q || $("#q")?.value || "").trim();
  if (!term) return;
  if (!isECP(term) && !isHex64(term)) {
    out.innerHTML = `<span class="muted">Enter a valid ECP (ECP-YYYY…) or 64-hex hash.</span>`;
    return;
  }

  out.textContent = "Looking up…";
  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso,hash",
      limit: "1",
      order: "timestamp_iso.desc"
    });
    params.append("or", `(record_id.eq.${term},hash.eq.${term})`);

    const res = await withTimeout(
      fetch(supa.url(`/rest/v1/v_echoprints_public?${params}`), { headers: supa.headers() })
    );
    if (!res.ok) { out.textContent = `Error: ${await res.text()}`; return; }

    const rows = await res.json();
    if (!rows.length) { out.textContent = "No match."; return; }

    const r = rows[0];
    const verifyHref = `/?q=${encodeURIComponent(r.record_id)}`;

    out.innerHTML = `
      <div class="item">
        <h4 class="mono">${r.record_id}</h4>
        <div class="meta">${r.timestamp_human_utc || ""}</div>
        ${r.title ? `<div>${r.title}</div>` : ""}
        <div class="actions tiny">
          <a href="${verifyHref}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ""}
          ${r.hash ? ` · <code class="hash" data-full="${r.hash}" title="Tap to copy hash">${tHash(r.hash)}</code>` : ""}
        </div>
      </div>
    `;
    bindHashCopy();
  } catch (e) {
    out.textContent = `Network error: ${e.message}`;
  }
}

/* ---- RECENT FEED ---- */
async function loadRecent(){
  const status = $("#recentStatus"); const feed = $("#recent");
  if (!status || !feed) return;
  status.textContent = "Loading…";

  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso,hash",
      order: "timestamp_iso.desc",
      limit: "12"
    });
    const res = await withTimeout(
      fetch(supa.url(`/rest/v1/v_echoprints_public?${params}`), { headers: supa.headers() })
    );
    if (!res.ok) { status.textContent = `Error: ${await res.text()}`; return; }

    const rows = await res.json();
    feed.innerHTML = rows.map(r => {
      const verifyHref = `/?q=${encodeURIComponent(r.record_id)}`;
      return `
        <article class="item">
          <h4>${r.title ? escapeHtml(r.title) : "Untitled"}</h4>
          <div class="mono" style="margin:.15rem 0">${r.record_id}</div>
          <div class="meta">${r.timestamp_human_utc || ""}</div>
          <div class="actions tiny">
            <a href="${verifyHref}">Verify</a>
            ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ""}
            ${r.hash ? ` · <code class="hash" data-full="${r.hash}" title="Tap to copy hash">${tHash(r.hash)}</code>` : ""}
          </div>
        </article>
      `;
    }).join("");
    status.textContent = rows.length ? "" : "No records yet.";
    bindHashCopy();
  } catch (e) {
    status.textContent = `Network error: ${e.message}`;
  }
}

/* ---- clipboard helpers ---- */
function bindHashCopy(){
  $$(".hash").forEach(el => {
    el.onclick = async () => {
      const full = el.getAttribute("data-full") || el.textContent;
      try { await navigator.clipboard.writeText(full); flash(el, "Copied!"); }
      catch { flash(el, "Copied"); }
    };
  });
}
function flash(el, text){
  const old = el.textContent;
  el.textContent = text;
  setTimeout(()=>{ el.textContent = tHash(el.getAttribute("data-full") || old); }, 900);
}
async function pasteInto(){
  const input = $("#q"); if (!input) return;
  try {
    const t = await navigator.clipboard.readText();
    if (t) input.value = t.trim();
  } catch {
    const t = prompt("Paste value");
    if (t) input.value = t.trim();
  }
}

/* ---- events ---- */
$("#btnVerify")?.addEventListener("click", () => verify());
$("#btnClear") ?.addEventListener("click", () => { const i=$("#q"); if(i){ i.value=""; } $("#verifyResult").textContent=""; });
$("#btnPaste") ?.addEventListener("click", pasteInto);

/* support /?q=... deep-link */
const qp = new URLSearchParams(location.search);
if (qp.get("q")) { const v = qp.get("q"); const i=$("#q"); if(i){i.value=v;} verify(v); }

/* initial feed */
loadRecent();

/* ---- util ---- */
function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
