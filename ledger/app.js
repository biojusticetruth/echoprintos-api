/* EchoprintOS — base site restored (no dummy rows)
   - Generate: browser hash → (tries Bitcoin stamp if lib present) → insert row → show card
   - Verify: by 64-hex hash OR by ECP-XXXXXXXXXXXXXX (derived from record UUID; recent fallback)
   - Recent: real rows from public.echoprints, newest first
   - Actions: Open post • View image • Open in Verify • View certificate • Download JSON/PNG
*/

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- ENV ---
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  alert('Missing SUPABASE env'); throw new Error('Missing SUPABASE env')
}
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// --- DOM helpers & state ---
const $  = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const byId = (id) => document.getElementById(id)
const REC = new Map()               // record_id -> normalized record (for card actions)
let page = 0, pageSize = 12, lastKey = ''

// --- utils ---
const toHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)))
const isHex64 = (s) => /^[a-f0-9]{64}$/i.test((s || '').trim())
const iso = (t) => t ? new Date(t).toISOString() : ''
const dt_disp = (t) => (t ? iso(t).replace('T',' ').slice(0,19) : '')
const ecpOf = (uuid) => uuid ? ('ECP-' + uuid.replace(/-/g,'').slice(0,16).toUpperCase()) : ''

// tolerant field pickers (support legacy column names)
const pick = (r, keys) => { for (const k of keys) { if (r && r[k] != null) return r[k] } return null }
const recIdOf = (r) => pick(r, ['record_id', 'id'])
const titleOf = (r)  => pick(r, ['title','post_title','name','caption','text']) || 'Untitled'
const linkOf = (r)   => pick(r, ['permalink','perma_link','link','document_url','doc_url','file_url','url'])
const imgOf = (r)    => pick(r, ['url','image_url','image','media_url','media','photo','photo_url','thumb_url','file_url'])
const tsOf = (r)     => pick(r, ['sent_at','timestamp_iso','timestamp','created_at'])

// --- SHA-256 (browser) ---
async function sha256OfText(txt) {
  const bytes = new TextEncoder().encode(txt)
  return toHex(await crypto.subtle.digest('SHA-256', bytes))
}
async function sha256OfFile(file) {
  const buf = await file.arrayBuffer()
  return toHex(await crypto.subtle.digest('SHA-256', buf))
}

// --- OpenTimestamps (best-effort in-browser) ---
async function tryStampWithOTS(hashHex) {
  try {
    if (!window.OpenTimestamps) return { ok:false, reason:'OTS lib not loaded' }
    const msg = new OpenTimestamps.Ops.OpSHA256().hash(fromHex(hashHex))
    const detached = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), msg)
    await OpenTimestamps.stamp(detached)        // ask calendars
    // we can’t upgrade to BTC proof instantly in-browser; save calendar attestations as .ots
    const proofBytes = detached.serializeToBytes()
    const b64 = btoa(String.fromCharCode(...proofBytes))
    return { ok:true, proofB64:b64 }
  } catch (e) {
    return { ok:false, reason:String(e?.message||e) }
  }
}

// --- certificate downloads ---
function downloadJSON(n) {
  const base = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/'
  const verify_hint = `${location.origin}${base}#hash=${encodeURIComponent(n.hash||'')}`
  const cert = {
    schema: 'echoprint.v1',
    record: {
      record_id: n.record_id || null,
      ecp_id: n.ecp || null,
      title: n.title || null,
      hash: n.hash || null,
      permalink: n.permalink || null,
      url: n.url || null,
      sent_at: n.ts || null
    },
    proof: {
      hash_algo: 'sha-256',
      bitcoin: n.ots ? 'calendar-attested (OTS .ots file available)' : 'pending',
      verify_url: verify_hint,
      generated_at: new Date().toISOString()
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(cert,null,2)], {type:'application/json'}))
  a.download = `${(n.ecp || n.record_id || n.hash || 'echoprint').toString().slice(0,24)}.echoprint.json`
  a.click(); URL.revokeObjectURL(a.href)
}
async function downloadCertificatePNG(n) {
  const W=1080,H=1440,P=48,canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H
  const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H)
  ctx.fillStyle='#111'; ctx.font='bold 48px Inter, Arial'; ctx.fillText('Echoprint Certificate', P, P+12)
  ctx.font='16px Inter, Arial'; ctx.fillStyle='#666'; ctx.fillText('Recorded through EchoprintOS provenance ledger.', P, P+48)
  let y=P+80
  if(n.url){
    try{
      const img = await new Promise((res,rej)=>{ const i=new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=n.url })
      const iw = Math.min(W-P*2, img.width), ih = iw*(img.height/img.width)
      ctx.drawImage(img,(W-iw)/2,y,iw,ih); y+=ih+24
    }catch{}
  }
  const row = (label,val)=>{ ctx.fillStyle='#111'; ctx.font='bold 22px Inter, Arial'; ctx.fillText(label,P,y); y+=26; ctx.font='18px Inter, Arial'; wrap(String(val||'N/A')); y+=14 }
  function wrap(text){ const max=W-P*2; let line=''; for(const w of String(text).split(' ')){ const t=(line?line+' ':'')+w; if(ctx.measureText(t).width>max){ ctx.fillText(line,P,y); y+=26; line=w } else line=t } if(line) ctx.fillText(line,P,y) }
  row('Title', n.title)
  row('Echoprint ID', n.ecp || n.record_id)
  row('SHA-256', n.hash || 'N/A')
  row('Timestamp (UTC)', dt_disp(n.ts))
  row('Bitcoin Proof', n.ots ? 'OTS calendar-attested (.ots available)' : 'Pending / upgrade later')
  canvas.toBlob(b=>{
    const a=document.createElement('a')
    a.href=URL.createObjectURL(b)
    a.download=`${(n.ecp || n.record_id || n.hash || 'echoprint').toString().slice(0,24)}.certificate.png`
    a.click(); URL.revokeObjectURL(a.href)
  })
}

// --- overlay viewer ---
function openOverlay(html) {
  const ov = byId('overlay'), panel = byId('panel')
  panel.innerHTML = html
  ov.style.display='block'
  ov.onclick = (e)=>{ if (e.target===ov) ov.style.display='none' }
}

// --- normalize a row for UI ---
function normalize(r) {
  const record_id = recIdOf(r)
  const n = {
    raw: r,
    record_id,
    ecp: ecpOf(record_id||''),
    title: titleOf(r),
    hash: r.hash || null,
    permalink: linkOf(r),
    url: imgOf(r),
    ts: tsOf(r),
    ots: !!r.ots_proof || false // if you later add an ots_proof column
  }
  REC.set(n.record_id, n)
  return n
}

// --- render a card into the template ---
function renderCard(n) {
  const tpl = byId('card-template')
  const node = tpl.content.cloneNode(true)
  node.querySelector('.title').textContent = n.title
  node.querySelector('.ecp').textContent   = n.ecp || n.record_id || ''
  node.querySelector('.hash').textContent  = n.hash || ''
  node.querySelector('.uuid').textContent  = n.record_id || ''
  node.querySelector('.plink').textContent = n.permalink || (n.url||'')
  node.querySelector('.tsline').textContent = `Timestamp (UTC): ${dt_disp(n.ts)}${n.ots ? ' • OTS calendar-attested' : ''}`

  // expanded details
  const more = node.querySelector('.more')
  more.innerHTML = `
    ${n.url? `<div class="muted">media</div><div style="margin:6px 0"><a href="${n.url}" target="_blank" rel="noopener">Open image</a></div>
      <details style="margin-top:6px"><summary>Preview</summary>
        <img src="${n.url}" style="max-width:100%;border-radius:8px;border:1px solid #ddd;margin-top:8px">
      </details>` : ''}
    ${n.permalink? `<div class="muted" style="margin-top:6px">link</div><div><a href="${n.permalink}" target="_blank" rel="noopener">${n.permalink}</a></div>` : ''}
    <div class="muted" style="margin-top:6px">record_id</div><div style="word-break:break-all">${n.record_id||''}</div>
    ${n.hash? `<div class="muted" style="margin-top:6px">hash</div><div style="word-break:break-all">${n.hash}</div>` : ''}
  `

  // actions
  const el = node.querySelector('article.card')
  el.dataset.key = n.record_id

  const btnOpenPost = el.querySelector('.open-post')
  const btnViewImg  = el.querySelector('.view-image')
  const btnOpenVer  = el.querySelector('.open-verify')
  const btnViewCert = el.querySelector('.view-cert')
  const btnJSON     = el.querySelector('.download-json')
  const btnPNG      = el.querySelector('.download-cert')

  if (n.permalink) { btnOpenPost.hidden = false; btnOpenPost.onclick = ()=> window.open(n.permalink, '_blank') }
  if (n.url)       { btnViewImg.hidden = false;  btnViewImg.onclick  = ()=> window.open(n.url, '_blank') }
  btnOpenVer.onclick = ()=>{
    const inp = byId('verify-input'); inp.value = n.hash || n.ecp || ''; byId('verify-btn').click()
    window.scrollTo({top:0, behavior:'smooth'})
  }
  btnViewCert.onclick = ()=>{
    openOverlay(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2 style="margin:0">Echoprint Certificate</h2>
        <button onclick="document.getElementById('overlay').style.display='none'">Close</button>
      </div>
      ${n.url?`<img src="${n.url}" style="max-width:100%;border:1px solid #ddd;border-radius:8px;margin:10px 0">`:''}
      <div><strong>Title:</strong> ${n.title}</div>
      <div style="margin-top:6px"><strong>Echoprint ID:</strong> ${n.ecp || n.record_id}</div>
      <div style="margin-top:6px"><strong>SHA-256:</strong> <code>${n.hash||'N/A'}</code></div>
      <div style="margin-top:6px"><strong>Timestamp (UTC):</strong> ${dt_disp(n.ts)}</div>
      <div style="margin-top:6px"><strong>Bitcoin Proof:</strong> ${n.ots?'OTS calendar-attested':'Pending / upgrade later'}</div>
      <div class="row" style="margin-top:10px">
        <button id="cjson">Download JSON</button>
        <button id="cpng">Download certificate (.png)</button>
      </div>
    `)
    byId('cjson').onclick = ()=> downloadJSON(n)
    byId('cpng').onclick  = ()=> downloadCertificatePNG(n)
  }
  btnJSON.onclick = ()=> downloadJSON(n)
  btnPNG.onclick  = ()=> downloadCertificatePNG(n)

  return node
}

// --- fetch helpers ---
async function fetchRecent(reset=false) {
  const list = byId('recent-list'); if (!list) return
  const s = (byId('search')?.value || '').trim()
  const key = JSON.stringify({s})
  if (reset || key !== lastKey) { page=0; list.innerHTML=''; lastKey=key }
  let q = sb.from('echoprints').select('*')
  if (s) q = q.or(['title','post_title','caption','text'].map(c=>`${c}.ilike.%${s}%`).join(','))
  q = q.order('created_at',{ascending:false}).range(page*pageSize, page*pageSize+pageSize-1)
  const { data, error } = await q
  if (error) { list.innerHTML = `<div class="muted">Error: ${error.message}</div>`; return }
  if (!data || (!data.length && page===0)) { list.innerHTML = `<div class="muted">No records.</div>`; return }
  const frags = document.createDocumentFragment()
  for (const r of data) frags.appendChild(renderCard(normalize(r)))
  list.appendChild(frags); page++
}

async function verifyLookup(v) {
  const out = byId('verify-result'); out.innerHTML = ''
  const list = []

  // 1) pure hash
  if (isHex64(v)) {
    const { data, error } = await sb.from('echoprints').select('*').eq('hash', v).limit(5)
    if (!error && data?.length) list.push(...data.map(normalize))
  }

  // 2) ECP-XXXXXXXXXXXXXX → fall back search in recent window and match locally
  if (!list.length && /^ECP-[A-F0-9]{8,16}$/i.test(v)) {
    // pull a bigger window once
    const { data, error } = await sb.from('echoprints').select('*').order('created_at',{ascending:false}).limit(200)
    if (!error && data?.length) {
      const rows = data.map(normalize)
      const hit = rows.find(n => n.ecp.toUpperCase() === v.toUpperCase())
      if (hit) list.push(hit)
    }
  }

  // 3) exact UUID (if user pasted one)
  if (!list.length && /^[0-9a-f-]{36}$/i.test(v)) {
    const { data, error } = await sb.from('echoprints').select('*').eq('record_id', v).limit(1)
    if (!error && data?.length) list.push(...data.map(normalize))
  }

  if (!list.length) {
    out.innerHTML = `<div class="muted">No matching record.</div>`
    return
  }
  const frag = document.createDocumentFragment()
  for (const n of list) frag.appendChild(renderCard(n))
  out.appendChild(frag)
}

// --- GENERATE wiring ---
function updateInsertState() {
  const ok = isHex64(byId('genHash')?.value)
  const btn = byId('btnInsert'); if (btn) btn.disabled = !ok
}
;['genHash','genText','genFile'].forEach(id => byId(id)?.addEventListener('input', updateInsertState))

byId('btnHashText')?.addEventListener('click', async ()=>{
  const txt = (byId('genText')?.value || '').trim()
  if (!txt) { byId('genMsg').textContent='Enter text to hash.'; return }
  byId('genHash').value = await sha256OfText(txt)
  byId('genMsg').textContent='Text hashed ✓'; updateInsertState()
})
byId('btnHashFile')?.addEventListener('click', async ()=>{
  const f = byId('genFile')?.files?.[0]
  if (!f) { byId('genMsg').textContent='Choose a file to hash.'; return }
  byId('genHash').value = await sha256OfFile(f)
  byId('genMsg').textContent = `File hashed ✓ (${f.name})`; updateInsertState()
})
byId('btnClearGen')?.addEventListener('click', ()=>{
  ['genTitle','genPermalink','genURL','genText','genHash'].forEach(id => byId(id) && (byId(id).value=''))
  if (byId('genFile')) byId('genFile').value=''
  byId('genMsg').textContent=''; updateInsertState()
})

byId('btnInsert')?.addEventListener('click', async (e)=>{
  const msgEl = byId('genMsg')
  const h = (byId('genHash')?.value || '').trim()
  if (!isHex64(h)) { e.preventDefault(); msgEl.textContent='Invalid or missing 64-hex hash.'; return }

  msgEl.textContent = 'Stamping with OpenTimestamps (best-effort)…'
  let ots = null
  try {
    const r = await tryStampWithOTS(h)
    if (r.ok) ots = r.proofB64
  } catch {}

  msgEl.textContent = 'Saving…'
  const row = {
    record_id: (crypto.randomUUID && crypto.randomUUID()) || undefined,
    title: (byId('genTitle')?.value || 'Untitled').trim(),
    hash: h,
    permalink: (byId('genPermalink')?.value || '').trim() || null,
    url: (byId('genURL')?.value || '').trim() || null,
    sent_at: new Date().toISOString(),
    // if you later add these optional columns server-side, they’ll be captured:
    // ots_proof: ots ? ots : null,
    // timestamp_iso: new Date().toISOString()
  }
  const { data, error } = await sb.from('echoprints').insert(row).select().single()
  if (error) { msgEl.textContent = `Error: ${error.message}`; return }

  msgEl.textContent = 'Inserted ✓'
  const n = normalize(data)
  // reflect any OTS attempt in UI-only
  if (ots) n.ots = true

  // show in Verify + Recent
  const out = byId('verify-result'); out.innerHTML = ''
  out.appendChild(renderCard(n))
  const list = byId('recent-list')
  if (list && list.firstChild) list.insertBefore(renderCard(n), list.firstChild); else list?.appendChild(renderCard(n))
})

// --- VERIFY wiring ---
byId('verify-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault()
  const v = byId('verify-input')?.value.trim()
  if (!v) { byId('verify-result').innerHTML = '<div class="muted">Enter an ECP-… or a 64-hex hash.</div>'; return }
  await verifyLookup(v)
})
byId('recent-btn')?.addEventListener('click', async ()=>{
  const { data, error } = await sb.from('echoprints').select('*').order('created_at',{ascending:false}).limit(10)
  const out = byId('verify-result'); out.innerHTML = ''
  if (error) { out.innerHTML = `<div class="muted">Error: ${error.message}</div>`; return }
  const frag = document.createDocumentFragment()
  for (const r of data) frag.appendChild(renderCard(normalize(r)))
  out.appendChild(frag)
})
byId('clear-btn')?.addEventListener('click', ()=>{
  byId('verify-input').value=''; byId('verify-result').innerHTML=''
})

// --- RECENT wiring ---
byId('refresh')?.addEventListener('click', ()=> fetchRecent(true))
byId('more')?.addEventListener('click',    ()=> fetchRecent(false))

// --- boot ---
updateInsertState()
fetchRecent(true)
