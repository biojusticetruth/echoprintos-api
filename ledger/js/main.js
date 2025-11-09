// /ledger/js/main.js
import { requireEnv, supaGet } from "./api.js";

requireEnv("main.js");

const VIEW = "v_echoprints_public";   // if you created v2, change to: v_echoprints_public_v2
const $ = (id) => document.getElementById(id);
const isHex64 = (s) => /^[0-9a-f]{64}$/i.test(String(s || "").trim());
const isECP   = (s) => /^ECP-\d{17,}$/.test(String(s || "").trim());

async function verify(q) {
  const out = $("verifyResult");
  if (!out) return;

  q = (q || "").trim();
  if (!q || (!isECP(q) && !isHex64(q))) {
    out.innerHTML = `<span style="color:#ffbf66">Enter an ECP (ECP-YYYY…) or a 64-hex hash.</span>`;
    return;
  }

  out.textContent = "Looking up…";

  try {
    const rows = await supaGet(`/rest/v1/${VIEW}`, {
      select: "record_id,ecp_id,hash,title,permalink,timestamp_human_utc,timestamp_iso",
      or: `(record_id.eq.${q},ecp_id.eq.${q},hash.eq.${q})`,
      order: "timestamp_iso.desc",
      limit: "1",
    });

    if (!rows.length) {
      out.innerHTML = `<span style="color:#ff8c8c">No match.</span>`;
      return;
    }

    const r = rows[0];
    const link = `/ledger/?q=${encodeURIComponent(r.record_id || r.ecp_id)}`;

    out.innerHTML = `
      <div style="color:#7ef3c4">Verified</div>
      <div class="mono" style="margin:.25rem 0">${r.record_id || r.ecp_id}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${r.timestamp_human_utc || "—"}</span></div>
      <div class="tiny">SHA-256: <span class="mono">${r.hash || "—"}</span></div>
      ${r.permalink ? `<div class="tiny">Source: <a href="${r.permalink}" target="_blank">${r.permalink}</a></div>` : ""}
      <div class="tiny" style="margin-top:.35rem"><a href="${link}">Permalink</a></div>
    `;
  } catch (e) {
    out.innerHTML = `<span style="color:#ff8c8c">Error:</span> ${e.message}`;
  }
}

async function loadRecent() {
  const status = $("recentStatus");
  const feed = $("recent");
  if (!status || !feed) return;

  status.textContent = "Loading…";
  try {
    const rows = await supaGet(`/rest/v1/${VIEW}`, {
      select: "record_id,ecp_id,title,permalink,timestamp_human_utc,timestamp_iso",
      order: "timestamp_iso.desc",
      limit: "12",
    });

    feed.innerHTML = rows
      .map((r) => {
        const id = r.record_id || r.ecp_id;
        return `
          <article class="item">
            <h4 class="mono">${id}</h4>
            <div class="tiny muted">${r.timestamp_human_utc || ""}</div>
            ${r.title ? `<div>${r.title}</div>` : ""}
            <div class="tiny" style="margin-top:.35rem">
              <a href="/ledger/?q=${encodeURIComponent(id)}">Verify</a>
              ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ""}
            </div>
          </article>`;
      })
      .join("");

    status.textContent = rows.length ? "" : "No records yet.";
  } catch (e) {
    status.textContent = `Error: ${e.message}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnVerify")?.addEventListener("click", () => verify($("q").value));
  $("btnClear")?.addEventListener("click", () => {
    $("q").value = "";
    $("verifyResult").textContent = "";
  });

  const qp = new URLSearchParams(location.search);
  if (qp.get("q")) {
    $("q").value = qp.get("q");
    verify(qp.get("q"));
  }

  loadRecent();
});
