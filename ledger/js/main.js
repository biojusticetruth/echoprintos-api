// /ledger/js/main.js

/* ========= helpers ========= */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const withTimeout = (p, ms=12000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), ms))]);

const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s||'').trim());
const isECP   = (s) => /^ECP-\d{10,}$/.test(String(s||'').trim()); // your long format

/* ========= env ========= */
if (!window.ENV || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.error("Missing ENV. Check /ledger/env.js");
}

const supa = {
  url: (path) => `${ENV.SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": ENV.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_ANON_KEY}`
  })
};

/* ========= VERIFY (if present) ========= */
function bindVerify(){
  const form = $('#verify-form');
  const input = $('#verify-input');
  const out = $('#verify-result');
  if (!form || !input || !out) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { out.textContent = ""; return; }
    if (!isECP(q) && !isHex64(q)) {
      out.innerHTML = `<span class="warn">Enter an ECP (ECP-YYYY…) or a 64-hex hash.</span>`;
      return;
    }
    out.textContent = "Looking up…";

    try {
      const params = new URLSearchParams({
        select: "record_id,title,permalink,timestamp_human_utc,timestamp_iso,hash",
        limit: "1",
        order: "timestamp_iso.desc"
      });
      // PostgREST OR filter
      params.append("or", `(record_id.eq.${q},hash.eq.${q})`);

      const res = await withTimeout(fetch(
        supa.url(`/rest/v1/v_echoprints_public?${params}`),
        { headers: supa.headers() }
      ));
      if (!res.ok) {
        out.innerHTML = `<span class="err">Error:</span> ${await res.text()}`;
        return;
      }
      const rows = await res.json();
      if (!rows.length) { out.innerHTML = `<span class="warn">No match.</span>`; return; }

      const r = rows[0];
      out.innerHTML = `
        <article class="card">
          <header class="card-head">
            <h3 class="title">${r.title || 'Untitled'}</h3>
            <div class="pill mono">${r.record_id}</div>
          </header>
          <dl class="meta">
            <dt>Timestamp</dt><dd class="mono">${r.timestamp_human_utc||'—'}</dd>
            <dt>SHA-256</dt><dd class="mono">${r.hash||'—'}</dd>
            ${r.permalink ? `<dt>Source</dt><dd><a href="${r.permalink}" target="_blank">${r.permalink}</a></dd>` : ''}
          </dl>
          <nav class="actions">
            <a class="btn ghost" href="/ledger/?q=${encodeURIComponent(r.record_id)}">Permalink</a>
          </nav>
        </article>
      `;
    } catch (e) {
      out.innerHTML = `<span class="err">Network error:</span> ${e.message}`;
    }
  });

  // Support /ledger/?q=ECP…
  const qp = new URLSearchParams(location.search);
  if (qp.get('q')) { input.value = qp.get('q'); form.dispatchEvent(new Event('submit')); }
}

/* ========= RECENT FEED (if present) ========= */
async function loadRecent(){
  const list = $('#recent-list');
  const status = $('#recent-status');
  if (!list || !status) return;

  status.textContent = 'Loading…';
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
    if (!res.ok) { status.textContent = await res.text(); return; }
    const rows = await res.json();

    list.innerHTML = rows.map(r => `
      <article class="mini">
        <div class="top">
          <h4 class="mono">${r.record_id}</h4>
          <div class="tiny muted">${r.timestamp_human_utc || ''}</div>
        </div>
        <div class="title">${r.title ? r.title : ''}</div>
        <div class="row tiny">
          <a href="/ledger/?q=${encodeURIComponent(r.record_id)}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ''}
        </div>
      </article>
    `).join('');
    status.textContent = rows.length ? '' : 'No records yet.';
  } catch (e) {
    status.textContent = `Network error: ${e.message}`;
  }
}

/* ========= bootstrap ========= */
document.addEventListener('DOMContentLoaded', ()=>{
  bindVerify();
  loadRecent();
});
