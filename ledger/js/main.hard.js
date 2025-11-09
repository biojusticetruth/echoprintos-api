async function verify(q){
  const out = document.getElementById('verifyResult');
  if (!out) return;
  out.textContent = '';

  if (!q) return;
  out.textContent = 'Looking up…';

  // try record_id first; if not, treat as permalink
  const isEcp = /^ECP-\d{17,}$/.test(q.trim());
  const param = isEcp ? `record_id=${encodeURIComponent(q.trim())}`
                      : `permalink=${encodeURIComponent(q.trim())}`;

  try {
    const r = await fetch(`/api/verify?${param}`);
    const data = await r.json();
    if (!r.ok || !data.ok) { out.textContent = data.error || 'Not found'; return; }

    const x = data.record;
    out.innerHTML = `
      <div style="color:#7ef3c4">Verified</div>
      <div class="mono" style="margin:.25rem 0">${x.record_id}</div>
      <div class="tiny">Timestamp (UTC): <span class="mono">${x.timestamp_human_utc||'—'}</span></div>
      <div class="tiny">SHA-256: <span class="mono">${x.hash||'—'}</span></div>
      ${x.permalink ? `<div class="tiny">Source: <a href="${x.permalink}" target="_blank">${x.permalink}</a></div>` : ''}
    `;
  } catch(e){
    out.textContent = `Network error: ${e.message}`;
  }
}

async function loadRecent(){
  const status = document.getElementById('recentStatus');
  const feed   = document.getElementById('recent');
  if (!status || !feed) return;
  status.textContent = 'Loading…';
  try {
    const r = await fetch('/api/recent?limit=12');
    const data = await r.json();
    if (!r.ok || !data.ok) { status.textContent = data.error || 'Error'; return; }
    const rows = data.rows || [];
    feed.innerHTML = rows.map(r => `
      <li class="item">
        <h4 class="mono">${r.record_id}</h4>
        <div class="tiny muted">${r.timestamp_human_utc || ''}</div>
        ${r.title ? `<div>${r.title}</div>` : ''}
        <div class="tiny" style="margin-top:.35rem">
          <a href="/ledger/?q=${encodeURIComponent(r.record_id)}">Verify</a>
          ${r.permalink ? ` · <a href="${r.permalink}" target="_blank">Post</a>` : ''}
        </div>
      </li>
    `).join('');
    status.textContent = rows.length ? '' : 'No records yet.';
  } catch(e){
    status.textContent = `Network error: ${e.message}`;
  }
}
