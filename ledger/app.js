// init supabase
const { SUPABASE_URL, SUPABASE_ANON_KEY } = (window.__ENV||{});
const supabase = window._supabase_createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// helpers
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmtUTC = (d) => new Date(d).toISOString().replace('T',' ').replace('Z',' UTC');
const ecpOf = (row) => {
  // prefer stored ecp_id; else derive from uuid/record_id
  if (row.ecp_id && /^ECP-[A-Z0-9]{4,}$/.test(row.ecp_id)) return row.ecp_id;
  const base = (row.record_id || row.id || '').toString().replace(/[^a-f0-9]/gi,'').slice(0,8).toUpperCase();
  return base ? `ECP-${base}` : 'ECP—';
};

// render one card
function renderCard(row) {
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="ecp">${ecpOf(row)}</div>
    <h3 class="title">${row.title || 'Untitled'}</h3>
    <div class="hash"><strong>Hash:</strong> ${row.hash || '—'}</div>
    <div class="ts"><strong>Timestamp (UTC):</strong> ${row.timestamp ? fmtUTC(row.timestamp) : '—'}</div>
    <div class="actions">
      <button class="btn view-cert">View certificate</button>
      <button class="btn-ghost open-verify">Open in Verify</button>
      <button class="btn-ghost dl-json">Download JSON</button>
    </div>
  `;
  el.querySelector('.view-cert').onclick = () => renderCertificate(row);
  el.querySelector('.open-verify').onclick = () => openInVerify(row);
  el.querySelector('.dl-json').onclick = () => downloadJSON(row);
  return el;
}

// load recent
async function loadRecent() {
  $('#recent-list').innerHTML = '';
  const { data, error } = await supabase
    .from('echoprints')
    .select('id,ecp_id,record_id,title,hash,timestamp,db_created_at,links,bitcoin')
    .order('db_created_at', { ascending: false })
    .limit(20);
  if (error) { $('#recent-list').textContent = error.message; return; }
  data.forEach(row => $('#recent-list').appendChild(renderCard(row)));
}

// verify input
async function doVerify() {
  const q = $('#verify-input').value.trim();
  if (!q) return;
  let req = supabase.from('echoprints').select('*').limit(1);
  if (/^ECP[-\s]?[A-Z0-9]+$/i.test(q)) req = req.eq('ecp_id', q.toUpperCase().replace(/\s/,''));
  else req = req.eq('hash', q.toLowerCase());
  const { data, error } = await req;
  const box = $('#verify-result'); box.innerHTML = '';
  if (error) { box.textContent = error.message; return; }
  if (!data?.length) { box.textContent = 'No match.'; return; }
  box.appendChild(renderCard(data[0]));
}
$('#verify-btn').onclick = doVerify;
$('#recent-btn').onclick = loadRecent;

// modal wiring
const certModal = $('#cert-modal');
const certBody  = $('#cert-body');
const certOpen  = $('#cert-open');
const certJson  = $('#cert-json');
$('#cert-close').onclick = () => certModal.close();
$('#cert-dismiss').onclick = () => certModal.close();

function renderCertificate(row) {
  const btc = row.bitcoin?.anchored ? 'anchored' : (row.bitcoin ? 'pending' : '—');
  certBody.innerHTML = `
    <div class="card">
      <div class="ecp">${ecpOf(row)}</div>
      <h3 class="title" style="margin-bottom:6px">${row.title || 'Untitled'}</h3>
      <div class="hash"><strong>Hash:</strong> ${row.hash || '—'}</div>
      <div class="ts"><strong>Timestamp (UTC):</strong> ${row.timestamp ? fmtUTC(row.timestamp) : '—'}</div>
      <div class="ts"><strong>Bitcoin:</strong> ${btc}</div>
    </div>`;
  certOpen.onclick = () => openInVerify(row);
  certJson.onclick = () => downloadJSON(row);
  certModal.showModal();
}

function openInVerify(row){
  $('#verify-input').value = ecpOf(row);
  certModal.close();
  window.scrollTo({top:0,behavior:'smooth'});
  doVerify();
}

function downloadJSON(row){
  const blob = new Blob([JSON.stringify(row,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${ecpOf(row)}.json`;
  a.click();
}

// first paint
loadRecent();
