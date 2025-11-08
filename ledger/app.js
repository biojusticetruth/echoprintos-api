/* =========================================================
   EchoprintOS – ledger/app.js
   - works with view: v_echoprints_public
   - expects columns: ecp_id, hash, title,
                      timestamp_human_utc, timestamp_iso, permalink
   - HTML ids it uses:
       #q, #btnVerify, #btnClear, #verifyResult,
       #recentStatus, #recent
   ========================================================= */

/* ====== feature toggle ====== */
const ENABLE_VERIFY = true;   // set to false to hide the Verify card

/* ====== tiny dom helper ====== */
const $ = (id) => document.getElementById(id);

/* ====== env check ====== */
function showEnvError(where) {
  const msg = `Missing ENV in ${where}. Check ledger/env.js (SUPABASE_URL, SUPABASE_ANON_KEY).`;
  console.error(msg);
  const t =
    $("verifyResult") ||
    $("recentStatus");
  if (t) t.innerHTML = `<span style="color:#ff8c8c">${msg}</span>`;
}

if (!window.ENV || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  showEnvError("app.js bootstrap");
}

/* ====== supabase helpers ====== */
const supa = {
  url: (path) => `${ENV.SUPABASE_URL}${path}`,
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": ENV.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_ANON_KEY}`,
  }),
};

const VIEW_NAME = "v_echoprints_public";
const BASE_FIELDS =
  "ecp_id,hash,title,permalink,timestamp_human_utc,timestamp_iso";

/* ====== general helpers ====== */
const withTimeout = (p, ms = 12000) =>
  Promise.race([
    p,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error("Request timeout")), ms)
    ),
  ]);

const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s || "").trim());
const looksLikeEcp = (s) => /^ECP-\d{17,}$/.test(String(s || "").trim());

/* =========================================================
   VERIFY
   ========================================================= */
if (!ENABLE_VERIFY) {
  const sec = $("verifySection");
  if (sec) sec.style.display = "none";
}

async function verify(inputValue) {
  const out = $("verifyResult");
  if (!out) return;

  const q = (inputValue || "").trim();
  if (!q) {
    out.textContent = "";
    return;
  }

  // let people paste either ECP-... or 64-hex
  if (!looksLikeEcp(q) && !isHex64(q)) {
    out.innerHTML =
      `<span style="color:#ffbf66">Enter an ECP (ECP-YYYY…) or a 64-hex hash.</span>`;
    return;
  }

  out.textContent = "Looking up…";

  try {
    // note: we query the **view** and we use **ecp_id**, NOT record_id
    const params = new URLSearchParams({
      select: BASE_FIELDS,
      limit: "1",
      order: "timestamp_iso.desc",
    });

    // PostgREST or=…; form depends on what we got
    if (isHex64(q)) {
      // hash search
      params.append("or", `(hash.eq.${q})`);
    } else {
      // ecp search
      params.append("or", `(ecp_id.eq.${encodeURIComponent(q)})`);
    }

    const res = await withTimeout(
      fetch(supa.url(`/rest/v1/${VIEW_NAME}?${params}`), {
        headers: supa.headers(),
      })
    );

    if (!res.ok) {
      out.innerHTML = `<span style="color:#ff8c8c">Error:</span> ${await res.text()}`;
      return;
    }

    const rows = await res.json();
    if (!rows.length) {
      out.innerHTML = `<span style="color:#ff8c8c">No match.</span>`;
      return;
    }

    const r = rows[0];
    const displayTime = r.timestamp_human_utc || r.timestamp_iso || "—";

    // permalink to THIS ledger, using ecp_id
    const selfLink = `/ledger/?q=${encodeURIComponent(r.ecp_id)}`;

    out.innerHTML = `
      <div style="color:#7ef3c4;font-weight:600;margin-bottom:.35rem">Verified</div>
      <div class="mono" style="margin:.25rem 0">${r.ecp_id}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${displayTime}</span></div>
      ${
        r.hash
          ? `<div class="tiny mono" style="margin-top:.25rem">SHA-256: ${r.hash}</div>`
          : ""
      }
      ${
        r.permalink
          ? `<div class="tiny" style="margin-top:.35rem">Source: <a href="${r.permalink}" target="_blank" rel="noopener">${r.permalink}</a></div>`
          : ""
      }
      <div class="tiny" style="margin-top:.35rem"><a href="${selfLink}">Permalink</a></div>
    `;
  } catch (e) {
    out.innerHTML = `<span style="color:#ff8c8c">Network error:</span> ${e.message}`;
  }
}

// wire buttons that already exist in your HTML
$("btnVerify")?.addEventListener("click", () => {
  const v = $("q")?.value || "";
  verify(v);
});
$("btnClear")?.addEventListener("click", () => {
  if ($("q")) $("q").value = "";
  if ($("verifyResult")) $("verifyResult").textContent = "";
});

// support ?q=ECP-... in URL
const qp = new URLSearchParams(location.search);
if (qp.get("q")) {
  const v = qp.get("q");
  if ($("q")) $("q").value = v;
  verify(v);
}

/* =========================================================
   RECENT FEED (no hash on the card)
   ========================================================= */
async function loadRecent() {
  const status = $("recentStatus");
  const feed = $("recent");
  if (!status || !feed) return;

  status.textContent = "Loading…";

  try {
    const params = new URLSearchParams({
      select: BASE_FIELDS,
      order: "timestamp_iso.desc",
      limit: "12",
    });

    const res = await withTimeout(
      fetch(supa.url(`/rest/v1/${VIEW_NAME}?${params}`), {
        headers: supa.headers(),
      })
    );

    if (!res.ok) {
      status.innerHTML = `Error: ${await res.text()}`;
      return;
    }

    const rows = await res.json();

    if (!rows.length) {
      status.textContent = "No records yet.";
      feed.innerHTML = "";
      return;
    }

    // render
    feed.innerHTML = rows
      .map((r) => {
        const time = r.timestamp_human_utc || r.timestamp_iso || "";
        const ecp = r.ecp_id || "(missing ecp_id)";
        const title = r.title ? `<div>${r.title}</div>` : "";
        const viewLink = `/ledger/?q=${encodeURIComponent(ecp)}`;
        const postLink = r.permalink
          ? ` · <a href="${r.permalink}" target="_blank" rel="noopener">Post</a>`
          : "";
        return `
          <article class="item">
            <h4 class="mono">${ecp}</h4>
            <div class="tiny muted">${time}</div>
            ${title}
            <div class="tiny" style="margin-top:.35rem">
              <a href="${viewLink}">Verify</a>${postLink}
            </div>
          </article>
        `;
      })
      .join("");

    status.textContent = "";
  } catch (e) {
    status.innerHTML = `Network error: ${e.message}`;
  }
}

// run once
loadRecent();
