(() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ECP_CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert("Missing Supabase ENV. Open index.html and set SUPABASE_URL + SUPABASE_ANON_KEY.");
  }
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // DOM
  const fileInput = document.getElementById('g-file');
  const fileName = document.getElementById('g-file-name');
  const btnGenerate = document.getElementById('btn-generate');
  const gTitle = document.getElementById('g-title');
  const gLink = document.getElementById('g-link');
  const gMedia = document.getElementById('g-media');
  const gText = document.getElementById('g-text');
  const gResult = document.getElementById('generate-result');

  const vInput = document.getElementById('v-input');
  const btnVerify = document.getElementById('btn-verify');
  const btnClear = document.getElementById('btn-clear');
  const vResult = document.getElementById('verify-result');

  const feedList = document.getElementById('feed-list');
  const btnMore = document.getElementById('btn-more');

  // modal
  const modal = document.getElementById('cert-modal');
  const certClose = document.getElementById('cert-close');
  const certQuote = document.getElementById('cert-quote');
  const certImage = document.getElementById('cert-image');
  const cEcp = document.getElementById('c-ecp');
  const cHash = document.getElementById('c-hash');
  const cTime = document.getElementById('c-time');
  const dlPNG = document.getElementById('dl-png');
  const dlJSON = document.getElementById('dl-json');
  const dlBoth = document.getElementById('dl-both');

  let feedPage = 0;

  /* ---------- helpers ---------- */
  const fmtUTC = (d) =>
    new Date(d).toISOString().replace('T', ' ').replace('Z',' UTC');

  const toHex = (buf) =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');

  async function sha256FromText(text) {
    const enc = new TextEncoder().encode(text);
    return toHex(await crypto.subtle.digest('SHA-256', enc));
  }
  async function sha256FromFile(file) {
    const buf = await file.arrayBuffer();
    return toHex(await crypto.subtle.digest('SHA-256', buf));
  }

  function ecpNow(){
    const d = new Date();
    const p = (n, l=2) => String(n).padStart(l,'0');
    return `ECP-${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${String(d.getUTCMilliseconds()).padStart(3,'0')}`;
  }

  function card(record){
    const { title, record_id, hash, timestamp, permalink, media_url } = record;
    const el = document.createElement('div');
    el.className = 'ecp-card';

    el.innerHTML = `
      <div class="stack">
        <h3 class="card-title" style="margin:2px 0 6px">${title || record_id}</h3>
        <div class="ecp-meta">
          <div><strong>Record ID:</strong> ${record_id}</div>
          <div><strong>SHA-256:</strong> ${hash}</div>
          <div><strong>Timestamp (UTC):</strong> ${fmtUTC(timestamp || record.created_at || new Date())}</div>
          ${ permalink ? `<div><strong>Permalink:</strong> <a href="${permalink}" target="_blank" rel="noopener">${permalink}</a></div>` : '' }
          ${ media_url ? `<div><strong>Media:</strong> <a href="${media_url}" target="_blank" rel="noopener">${media_url}</a></div>` : '' }
        </div>
        <div class="ecp-actions">
          <button class="btn secondary js-view">View Certificate</button>
          <button class="btn ghost js-json">Download Data (.json)</button>
          <button class="btn ghost js-png">Download Certificate (.png)</button>
          <button class="btn ghost js-both">Download Both (.zip)</button>
        </div>
      </div>
    `;

    const data = {
      title: title || record_id,
      record_id, hash,
      timestamp: fmtUTC(timestamp || record.created_at || new Date()),
      permalink, media_url
    };

    el.querySelector('.js-view').addEventListener('click', () => openCertificate(data));
    el.querySelector('.js-json').addEventListener('click', () => downloadJSON(data));
    el.querySelector('.js-png').addEventListener('click', () => downloadPNG(data));
    el.querySelector('.js-both').addEventListener('click', () => downloadZIP(data));

    return el;
  }

  function downloadJSON(data){
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.record_id}.json`;
    a.click();
  }

  async function renderCertCanvas(data){
    // Put values in modal
    certQuote.textContent = data.title || data.record_id;
    cEcp.textContent = data.record_id;
    cHash.textContent = data.hash;
    cTime.textContent = data.timestamp;
    if (data.media_url) {
      certImage.src = data.media_url;
      certImage.style.display = 'block';
    } else {
      certImage.style.display = 'none';
    }
    await new Promise(r => setTimeout(r, 50)); // allow paint
    const node = document.getElementById('cert-art');
    const dataUrl = await window.htmlToImage.toPng(node, {pixelRatio:2});
    return dataUrl;
  }

  async function downloadPNG(data){
    const dataUrl = await renderCertCanvas(data);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${data.record_id}.png`;
    a.click();
  }

  async function downloadZIP(data){
    const png = await renderCertCanvas(data);
    const zip = new JSZip();
    zip.file(`${data.record_id}.json`, JSON.stringify(data,null,2));
    zip.file(`${data.record_id}.png`, png.split('base64,')[1], {base64:true});
    const blob = await zip.generateAsync({type:"blob"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.record_id}.zip`;
    a.click();
  }

  async function openCertificate(data){
    await renderCertCanvas(data);
    modal.showModal();
  }

  certClose.addEventListener('click', () => modal.close());
  dlPNG.addEventListener('click', async () => {
    const data = currentCertData();
    downloadPNG(data);
  });
  dlJSON.addEventListener('click', () => {
    const data = currentCertData();
    downloadJSON(data);
  });
  dlBoth.addEventListener('click', () => {
    const data = currentCertData();
    downloadZIP(data);
  });

  function currentCertData(){
    return {
      title: certQuote.textContent,
      record_id: cEcp.textContent,
      hash: cHash.textContent,
      timestamp: cTime.textContent
    };
  }

  /* ---------- Generate flow ---------- */
  fileInput.addEventListener('change', e => {
    fileName.textContent = e.target.files?.[0]?.name || 'No file selected';
  });

  btnGenerate.addEventListener('click', async () => {
    try{
      const title = (gTitle.value || '').trim();
      const permalink = (gLink.value || '').trim() || null;
      const media_url = (gMedia.value || '').trim() || null;
      const text = (gText.value || '').trim();
      const file = fileInput.files?.[0];

      if (!text && !file) {
        alert("Add text or choose a file to hash.");
        return;
      }

      let hash;
      if (file) hash = await sha256FromFile(file);
      else hash = await sha256FromText(text);

      const record_id = ecpNow();
      const insert = {
        record_id, title, hash,
        permalink, media_url
      };
      const { data, error } = await supabase
        .from('echoprints')
        .insert(insert)
        .select()
        .single();

      if (error) throw error;

      const cardEl = card({
        ...insert,
        timestamp: data?.timestamp || new Date().toISOString()
      });

      gResult.innerHTML = "";
      gResult.appendChild(cardEl);

      // also prepend to feed
      feedList.prepend(cardEl.cloneNode(true));

    }catch(err){
      console.error(err);
      alert("Could not save. Check RLS policies and your Supabase keys.");
    }
  });

  /* ---------- Verify ---------- */
  btnVerify.addEventListener('click', async () => {
    const q = (vInput.value || '').trim();
    if (!q) return;

    try{
      let query = supabase.from('echoprints').select('*').limit(1);
      if (q.startsWith('ECP-')) query = query.eq('record_id', q);
      else query = query.eq('hash', q);

      const { data, error } = await query.single();
      if (error) throw error;

      vResult.innerHTML = "";
      vResult.appendChild(card(data));
    }catch(err){
      console.error(err);
      vResult.innerHTML = `<div class="muted">No record found.</div>`;
    }
  });

  btnClear.addEventListener('click', () => {
    vInput.value = '';
    vResult.innerHTML = '';
  });

  /* ---------- Feed ---------- */
  async function loadFeed(page=0){
    const { data, error } = await supabase
      .from('echoprints')
      .select('*')
      .order('timestamp', { ascending:false })
      .range(page*10, page*10 + 9);

    if (error) return;

    data.forEach(r => feedList.appendChild(card(r)));
  }

  btnMore.addEventListener('click', () => {
    feedPage += 1;
    loadFeed(feedPage);
  });

  // First load + auto refresh
  loadFeed(0);
  setInterval(() => {
    // optimistic refresh: reload first page
    feedList.innerHTML = '';
    feedPage = 0;
    loadFeed(0);
  }, 25000);
})();
