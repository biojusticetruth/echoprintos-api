import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window._env;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- helpers ----------
const $ = (q) => document.querySelector(q);
const bytesToHex = (buf) => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
async function sha256Bytes(bytes){ return await crypto.subtle.digest("SHA-256", bytes); }
async function sha256Text(txt){ return await sha256Bytes(new TextEncoder().encode(txt)); }
async function sha256File(file){ return await sha256Bytes(await file.arrayBuffer()); }

function safeTs(row){
  const t = row.timestamp || row.created_at || row.db_created_at;
  try{ return new Date(t).toISOString().replace("T"," ").replace("Z"," UTC"); }catch(_){ return "—"; }
}
function btcStatus(row){
  if (row.bitcoin_anchored_at) return "anchored";
  if (row.bitcoin_receipt_b64) return "pending";
  return "—";
}

// ---------- UI elements ----------
const el = {
  title: $("#title"), link: $("#permalink"), media: $("#media"),
  text: $("#text"), file: $("#file"),
  hashBtn: $("#hash-text"), hashFileBtn: $("#hash-file"),
  hashOut: $("#hash"),
  save: $("#save"), btc: $("#btc"),
  verifyIn: $("#verify-input"), verifyBtn: $("#verify-btn"),
  verifyResult: $("#verify-result"),
  recentBtn: $("#recent-btn"), recentList: $("#recent-list"),
  modal: $("#cert-modal"), certBody: $("#cert-body"),
  openVerify: $("#open-verify"), dlJson: $("#dl-json"),
  closeModal: $("#cert-close")
};

let lastRowForModal = null;

// ---------- hashing ----------
el.hashBtn.onclick = async () => {
  const txt = el.text.value.trim();
  if (!txt) { el.hashOut.value = ""; return; }
  const hex = bytesToHex(await sha256Text(txt));
  el.hashOut.value = hex;
};

el.hashFileBtn.onclick = async () => {
  const f = el.file.files?.[0];
  if (!f) return;
  const hex = bytesToHex(await sha256File(f));
  el.hashOut.value = hex;
};

// ---------- save to ledger ----------
el.save.onclick = async () => {
  const hash = el.hashOut.value.trim();
  if (!/^[a-f0-9]{64}$/i.test(hash)) { alert("Compute a valid 64-hex hash first."); return; }

  const { data, error } = await db.from("echoprints").insert({
    title: el.title.value?.trim() || "Untitled",
    permalink: el.link.value?.trim() || null,
    media_url: el.media.value?.trim() || null,
    hash,
  }).select("id, record_id, title, hash, created_at, timestamp, permalink, media_url, bitcoin_receipt_b64, bitcoin_anchored_at").single();

  if (error) { alert("Save failed: "+error.message); return; }

  // enable BTC anchoring & refresh list
  el.btc.disabled = false;
  el.btc.dataset.hash = data.hash;
  await loadRecent();
  renderVerifyResult(data);
};

// ---------- anchor to bitcoin (OTS) ----------
el.btc.onclick = async () => {
  const hash = el.btc.dataset.hash || el.hashOut.value.trim();
  if (!/^[a-f0-9]{64}$/i.test(hash)) { alert("Need a saved 64-hex hash."); return; }

  // 1) ask serverless to stamp
  const r = await fetch("/api/anchor", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ hash }) });
  const j = await r.json();
  if (!r.ok) { alert("Anchor error: "+(j.error || r.status)); return; }

  // 2) store receipt (pending)
  await db.from("echoprints").update({ bitcoin_receipt_b64: j.receipt_b64 }).eq("hash", hash);

  // 3) try upgrade once (it will stay pending until chain confirms)
  try {
    const up = await fetch("/api/upgrade", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ receipt_b64: j.receipt_b64 }) });
    const uj = await up.json();
    if (up.ok && uj.anchored_at) {
      await db.from("echoprints").update({ bitcoin_anchored_at: uj.anchored_at }).eq("hash", hash);
    }
  } catch(_) {}

  await loadRecent();
  alert("Anchoring requested. It may show as pending until confirmed.");
};

// ---------- verify ----------
el.verifyBtn.onclick = async () => {
  const q = el.verifyIn.value.trim();
  if (!q) return;

  let qry = db.from("echoprints")
    .select("id, record_id, title, hash, created_at, timestamp, permalink, media_url, bitcoin_receipt_b64, bitcoin_anchored_at")
    .limit(1);

  if (/^ECP-[A-Z0-9]+$/i.test(q)) {
    qry = qry.eq("record_id", q);
  } else if (/^[a-f0-9]{64}$/i.test(q)) {
    qry = qry.eq("hash", q.toLowerCase());
  } else {
    el.verifyResult.innerHTML = `<p class="meta">Enter an ECP (ECP-XXXXXX) or 64-hex hash.</p>`;
    return;
  }

  const { data, error } = await qry.single();
  if (error) { el.verifyResult.innerHTML = `<p class="meta">Not found.</p>`; return; }

  renderVerifyResult(data);
};

// ---------- recent ----------
el.recentBtn.onclick = loadRecent;
async function loadRecent(){
  const { data, error } = await db
    .from("echoprints")
    .select("id, record_id, title, hash, created_at, timestamp, permalink, media_url, bitcoin_receipt_b64, bitcoin_anchored_at")
    .order("created_at", { ascending:false })
    .limit(20);

  if (error) { el.recentList.innerHTML = `<div class="meta">Error: ${error.message}</div>`; return; }
  el.recentList.innerHTML = data.map(renderCard).join("");
  attachCardHandlers(data);
}

// ---------- rendering ----------
function renderCard(row){
  const ecp = row.record_id || "ECP—";
  return `
    <article class="cardRow">
      <div class="ecp-pill">${ecp}</div>
      <h3 class="title">${row.title || "Untitled"}</h3>
      <div class="meta"><strong>Hash:</strong> ${row.hash || "—"}</div>
      <div class="meta"><strong>Timestamp (UTC):</strong> ${safeTs(row)}</div>
      <div class="meta"><strong>Bitcoin:</strong> ${btcStatus(row)}</div>
      <div class="actions">
        <button class="btn view-cert" data-id="${row.id}">View certificate</button>
        <button class="btn btn-ghost dl-json" data-id="${row.id}">Download JSON</button>
      </div>
    </article>`;
}

function attachCardHandlers(rows){
  const byId = Object.fromEntries(rows.map(r=>[r.id,r]));
  [...document.querySelectorAll(".view-cert")].forEach(b=>b.onclick=()=>openCert(byId[b.dataset.id]));
  [...document.querySelectorAll(".dl-json")].forEach(b=>b.onclick=()=>downloadJson(byId[b.dataset.id]));
}

function renderVerifyResult(row){
  el.verifyResult.innerHTML = renderCard(row);
  attachCardHandlers([row]);
}

function openCert(row){
  lastRowForModal = row;
  const btc = btcStatus(row);
  el.certBody.innerHTML = `
    <div class="cardRow">
      <div class="ecp-pill">${row.record_id || "ECP—"}</div>
      <h3 class="title">${row.title || "Untitled"}</h3>
      ${row.permalink ? `<div class="meta"><strong>Permalink:</strong> <a href="${row.permalink}" target="_blank" rel="noopener">${row.permalink}</a></div>` : ""}
      ${row.media_url ? `<div class="meta"><strong>Media:</strong> <a href="${row.media_url}" target="_blank" rel="noopener">${row.media_url}</a></div>` : ""}
      <div class="meta"><strong>Hash:</strong> ${row.hash}</div>
      <div class="meta"><strong>Timestamp (UTC):</strong> ${safeTs(row)}</div>
      <div class="meta"><strong>Bitcoin:</strong> ${btc}</div>
    </div>`;
  el.modal.showModal();
}
function downloadJson(row){
  const blob = new Blob([JSON.stringify(row,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${row.record_id || "echoprint"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// modal buttons
el.closeModal.onclick = ()=>el.modal.close();
el.openVerify.onclick = ()=>{
  if (!lastRowForModal) return;
  el.verifyIn.value = lastRowForModal.record_id || lastRowForModal.hash;
  el.modal.close();
  renderVerifyResult(lastRowForModal);
};

// initial load
loadRecent();
