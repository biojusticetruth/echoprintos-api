import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV ?? {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  alert('Fill /env.js with your Project URL + anon key.'); throw new Error('missing env');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ——— Helpers
const isHex64 = (s) => /^[0-9a-fA-F]{64}$/.test((s||'').trim());
const isUUID  = (s) => /^[0-9a-fA-F-]{36}$/.test((s||'').trim());
const isECP   = (s) => /^ECP\s+\d{6,}$/.test((s||'').trim());

// ECP (digits only) derived from the first 16 hex chars of UUID
const ecpFromUUID = (uuid) => {
  const hex = uuid.replace(/-/g,'').slice(0,16);
  const n = BigInt('0x' + hex);
  return 'ECP ' + n.toString(10);
};

const sha256Hex = async (bytes) => {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
};

const dl = (filename, text) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'application/json'}));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
};

// ——— Generate
document.getElementById('genBtn').onclick = async () => {
  const title = document.getElementById('genTitle').value?.trim() || 'Untitled';
  const text  = document.getElementById('genText').value;
  const file  = document.getElementById('genFile').files[0];
  const link  = document.getElementById('genLink').value?.trim() || null;
  const msgEl = document.getElementById('genMsg');

  if (!text && !file) { msgEl.textContent = 'Add text or choose a file.'; return; }
  let bytes = file ? new Uint8Array(await file.arrayBuffer())
                   : new TextEncoder().encode(text);
  const hash = await sha256Hex(bytes);
  const sent_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('echoprints')
    .insert([{ title, hash, permalink: link, sent_at }])
    .select()
    .single();

  if (error) { msgEl.textContent = 'Insert failed: ' + error.message; return; }
  msgEl.textContent = `Saved ${ecpFromUUID(data.record_id)} • ${hash.slice(0,8)}…`;
  await loadRecent();
};

// ——— Verify (ECP | hash | UUID)
document.getElementById('verifyBtn').onclick = async () => {
  const key = document.getElementById('verifyKey').value.trim();
  const out = document.getElementById('verifyOut');
  if (!key) return;

  try {
    let rec = null;

    if (isHex64(key)) {
      const { data, error } = await supabase.from('echoprints').select().eq('hash', key).limit(1);
      if (error) throw error; rec = data?.[0] || null;

    } else if (isUUID(key)) {
      const { data, error } = await supabase.from('echoprints').select().eq('record_id', key).limit(1);
      if (error) throw error; rec = data?.[0] || null;

    } else if (isECP(key)) {
      // scan in pages until found (simple, works with anon SELECT)
      let from = 0, size = 200;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('echoprints')
          .select('id,record_id,title,hash,created_at,permalink,url,platform,sent_at')
          .order('created_at', { ascending:false })
          .range(from, from + size - 1);
        if (error) throw error;
        if (!data.length) break;
        rec = data.find(r => ecpFromUUID(r.record_id) === key) || null;
        if (rec) break;
        from += size;
      }
    } else {
      out.textContent = 'Enter ECP ID, 64-hex hash, or UUID.';
      return;
    }

    if (!rec) { out.textContent = 'No match.'; return; }
    out.textContent = `✓ ${ecpFromUUID(rec.record_id)} • ${rec.hash}`;
  } catch (e) {
    out.textContent = String(e.message || e);
  }
};

// ——— Recent
async function loadRecent() {
  const list = document.getElementById('recent');
  list.innerHTML = 'Loading…';

  const { data, error } = await supabase
    .from('echoprints')
    .select('id,record_id,title,hash,created_at,permalink,url,platform,sent_at')
    .order('created_at', { ascending:false })
    .limit(50);

  if (error) { list.textContent = error.message; return; }

  list.innerHTML = '';
  (data||[]).forEach(row => {
    const card = document.createElement('div');
    card.className = 'row';
    const ecp = ecpFromUUID(row.record_id);
    const ts  = row.created_at || row.sent_at;

    card.innerHTML = `
      <div><strong>${row.title || '(untitled)'}</strong></div>
      <div class="meta">${ecp}</div>
      <div class="meta">hash: ${row.hash || '(none)'} · time: ${ts || '(n/a)'}${row.platform?` · ${row.platform}`:''}</div>
      <div class="btns">
        ${row.permalink ? `<a class="btn" target="_blank" href="${row.permalink}">Open post</a>`:''}
        ${row.url ? `<a class="btn" target="_blank" href="${row.url}">View image</a>`:''}
        <button class="btn openVerify">Open in Verify</button>
        <button class="btn viewCert">View certificate</button>
        <button class="btn dlJson">Download JSON</button>
        <button class="btn dlCert">Download certificate</button>
      </div>
    `;

    // wire buttons
    card.querySelector('.openVerify').onclick = () => {
      const v = document.getElementById('verifyKey');
      v.value = row.hash || row.record_id; // you can paste ECP too
      document.getElementById('verifySection').scrollIntoView({behavior:'smooth'});
    };

    const certObj = {
      echoprint: { ecp, record_id: row.record_id, hash: row.hash, timestamp: ts },
      source: { title: row.title, platform: row.platform || null, permalink: row.permalink || null, url: row.url || null }
    };

    card.querySelector('.viewCert').onclick = () => {
      document.getElementById('certPre').textContent = JSON.stringify(certObj, null, 2);
      document.getElementById('overlay').style.display = 'flex';
    };
    card.querySelector('.dlJson').onclick = () => dl(`${ecp.replace(' ','_')}.json`, JSON.stringify(row, null, 2));
    card.querySelector('.dlCert').onclick = () => dl(`${ecp.replace(' ','_')}_certificate.json`, JSON.stringify(certObj, null, 2));

    list.appendChild(card);
  });
}

loadRecent();
