/* ========= SUPABASE (HARDCODE — replace these 2 strings) ========= */
const SUPABASE_URL = "https://cyndhzyfaffprdebclnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c"

/* ========= helpers ========= */
const $ = (sel) => document.querySelector(sel);
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("Request timeout")), ms))]);

function isECP(s){ return /^ECP[-\u2013\u2014]?\d{10,}$/.test(String(s||"").trim()); }
function isHex64(s){ return /^[0-9a-f]{64}$/i.test(String(s||"").trim()); }
function clipHash(h){ if(!h) return ""; return h.length>24 ? `${h.slice(0,10)}…${h.slice(-10)}` : h; }
async function copy(text){ try{ await navigator.clipboard.writeText(text); }catch{} }

/* ========= VERIFY ========= */
const box = $("#q");
const out = $("#verifyResult");

async function verify(q){
  if (!out) return;
  if (!q || (!isECP(q) && !isHex64(q))) { out.innerHTML = ""; return; }

  try {
    const params = new URLSearchParams({
      select: "record_id,hash,title,permalink,timestamp_human_utc,timestamp_iso,url",
      limit: "1",
      order: "timestamp_iso.desc"
    });
    params.append("or", `(record_id.eq.${q},hash.eq.${q})`);

    const res = await withTimeout(fetch(
      `${SUPABASE_URL}/rest/v1/v_echoprints_public?${params}`,
      { headers:{
          "Content-Type":"application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }}
    ));
    if (!res.ok) { out.innerHTML = ""; return; }
    const rows = await res.json();
    if (!rows.length) { out.innerHTML = ""; return; }

    const r = rows[0];
    const human = r.timestamp_human_utc || (r.timestamp_iso ? new Date(r.timestamp_iso).toISOString().replace('T',' ').replace('Z',' UTC') : '—');
    const linkVerify = `?q=${encodeURIComponent(r.record_id)}#verify`;
    const linkPost = r.permalink || r.url || null;

    out.innerHTML = `
      <div class="mono pill" style="display:inline-block;margin:0 0 6px 0">${r.record_id}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${human}</span></div>
      ${r.hash ? `
      <div class="tiny hashline">
        <span>SHA-256:</span>
        <span class="mono truncate" title="${r.hash}">${clipHash(r.hash)}</span>
        <button class="btn small ghost" id="copyHash">Copy</button>
      </div>` : ""}
      <div class="tiny rowline">
        <a href="${linkVerify}">Permalink</a>
        ${linkPost ? ` · <a href="${linkPost}" target="_blank" rel="noopener">Source</a>` : ""}
      </div>
    `;

    $("#copyHash")?.addEventListener("click", ()=>copy(r.hash));
  } catch {
    out.innerHTML = "";
  }
}

$("#btnVerify")?.addEventListener("click", ()=>verify(box.value.trim()));
$("#btnClear") ?.addEventListener("click", ()=>{ box.value=""; out.innerHTML=""; });

/* allow deep-link: ?q=ECP-…#verify */
const qp = new URLSearchParams(location.search);
if (qp.get("q")) {
  const q = qp.get("q");
  box.value = q;
  verify(q);
  // focus the Verify section if present
  document.getElementById("verifySection")?.scrollIntoView({behavior:"smooth", block:"start"});
}

/* ========= RECENT ========= */
const recentStatus = $("#recentStatus");
const recent = $("#recent");

async function loadRecent(){
  if (!recent) return;
  try {
    const params = new URLSearchParams({
      select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso,url",
      order: "timestamp_iso.desc",
      limit: "12"
    });
    const res = await withTimeout(fetch(
      `${SUPABASE_URL}/rest/v1/v_echoprints_public?${params}`,
      { headers:{
          "Content-Type":"application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }}
    ));
    if (!res.ok) { recentStatus.textContent = await res.text(); return; }
    const rows = await res.json();
    if (!rows.length) { recentStatus.textContent = "No records yet."; return; }

    recent.innerHTML = rows.map(r=>{
      const human = r.timestamp_human_utc || (r.timestamp_iso ? new Date(r.timestamp_iso).toISOString().replace('T',' ').replace('Z',' UTC') : '');
      const linkVerify = `?q=${encodeURIComponent(r.record_id)}#verify`;
      const linkPost = r.permalink || r.url || null;
      return `
        <article class="item">
          ${r.title ? `<h4>${escapeHtml(r.title)}</h4>` : `<h4>(untitled)</h4>`}
          <div class="mono pill" style="margin:6px 0 4px 0">${r.record_id}</div>
          <div class="tiny muted">${human}</div>
          <div class="tiny rowline">
            <a href="${linkVerify}">Verify</a>
            ${linkPost ? ` · <a href="${linkPost}" target="_blank" rel="noopener">Post</a>` : ""}
          </div>
        </article>`;
    }).join("");
    recentStatus.textContent = "";
  } catch (e) {
    recentStatus.textContent = e.message || "Network error";
  }
}
function escapeHtml(s){ return String(s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
loadRecent();
