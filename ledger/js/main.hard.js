/* ====== CONFIG (fill these) ====== */
const SUPABASE_URL  = 'https://cyndhzyfaffprdebclnw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bmRoenlmYWZmcHJkZWJjbG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTQxNDUsImV4cCI6MjA3NzA3MDE0NX0.DynJLTGOKDlvLPy_W5jThsWYANens2yGKzY8am6XD6c';
const TABLE_READ    = 'echoprints'; // or 'v_echoprints_public'

/* ====== DOM ====== */
const el = (id) => document.getElementById(id);
const $sheet  = el('epv-sheet');
const $title  = el('epv-title');
const $rec    = el('epv-record');
const $ts     = el('epv-ts');
const $open   = el('epv-open');

const $ecp    = el('epv-ecp');
const $hash   = el('epv-hash');
const $verify = el('epv-verify');
const $reset  = el('epv-reset');
const $close  = el('epv-close');

/* ====== Helpers ====== */
const BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`,
};

function cleanEcp(s) {
  if (!s) return '';
  return s.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
}

function formatUtc(tsIso) {
  if (!tsIso) return '—';
  const d = new Date(tsIso);
  const w = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  const ss = String(d.getUTCSeconds()).padStart(2,'0');
  return `${w}, ${dd} ${m} ${d.getUTCFullYear()} ${hh}:${mm}:${ss} UTC`;
}

async function q(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return j[0] || null;
}

async function getByEcp(ecp) {
  const u = `${BASE}/${TABLE_READ}?select=title,record_id,hash,timestamp_iso,url,source`
          + `&record_id=eq.${encodeURIComponent(ecp)}&limit=1`;
  return q(u);
}

async function getByHash(sha) {
  const u = `${BASE}/${TABLE_READ}?select=title,record_id,hash,timestamp_iso,url,source`
          + `&hash=eq.${encodeURIComponent(sha)}&limit=1`;
  return q(u);
}

function showCert(row) {
  $title.textContent = row?.title || 'Untitled';
  $rec.textContent   = row?.record_id || '—';
  $ts.textContent    = formatUtc(row?.timestamp_iso);

  if (row?.url) {
    $open.href = row.url;
    $open.removeAttribute('hidden');
  } else {
    $open.setAttribute('hidden','hidden');
    $open.removeAttribute('href');
  }
  $sheet.classList.add('open');
  document.body.style.overflow='hidden';
}

function hideCert() {
  $sheet.classList.remove('open');
  document.body.style.overflow='';
}

/* ====== Wire up ====== */
$verify.addEventListener('click', async () => {
  try {
    const ecp = cleanEcp($ecp.value);
    const sha = ($hash.value||'').trim();
    if (!ecp && !sha) { alert('Enter an ECP-… or a full SHA-256 hash.'); return; }

    const row = ecp ? await getByEcp(ecp) : await getByHash(sha);
    if (!row) { alert('No matching record found.'); return; }
    showCert(row);
  } catch (err) {
    console.error(err);
    alert('Could not verify right now.');
  }
});

$reset.addEventListener('click', () => {
  $ecp.value = '';
  $hash.value = '';
  hideCert();
});

$close.addEventListener('click', hideCert);
$sheet.addEventListener('click', (e) => {
  if (e.target === $sheet) hideCert();
});
