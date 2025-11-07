/* EchoprintOS — Generate • Verify • Posts (with hash guard & certificate overlay) */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- ENV ---
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {}
if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
  alert('Missing SUPABASE env'); throw new Error('Missing SUPABASE env')
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// --- helpers ---
const $  = (id)=>document.getElementById(id)
const iso = t => t ? new Date(t).toISOString() : ''
let page=0, pageSize=12, lastKey=''
const REC=new Map()

// --- sha256 (browser) ---
const toHex = buf => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')
async function sha256OfText(txt){ const b=new TextEncoder().encode(txt); return toHex(await crypto.subtle.digest('SHA-256', b)) }
async function sha256OfFile(file){ const b=await file.arrayBuffer();   return toHex(await crypto.subtle.digest('SHA-256', b)) }

// --- normalizers (support old column names) ---
const pick  = (r,keys)=>{ for(const k of keys){ if(r?.[k]!=null) return r[k] } return null }
const titleOf = r => pick(r,['title','post_title','name','caption','text']) || 'Untitled'
const linkOf  = r => pick(r,['permalink','perma_link','link','document_url','doc_url','file_url','url'])
const imgOf   = r => pick(r,['url','image_url','image','media_url','media','photo','photo_url','thumb_url','file_url'])
const tsOf    = r => pick(r,['timestamp_iso','sent_at','timestamp','created_at'])
const recIdOf = r => pick(r,['record_id','id'])

// --- certificate JSON / PNG / overlay ---
function downloadJSON(n){
  const base = location.pathname.includes('/ledger') ? '/ledger/' : '/'
  const cert={schema:'echoprint.v1',
    record:{record_id:n.record_id||null,title:n.title||null,hash:n.hash||null,
            platform:n.platform||null,permalink:n.permalink||null,url:n.url||null,
            sent_at:n.ts||null},
    proof:{hash_algo:'sha-256',
           verify_url:`${location.origin}${base}#verify?q=${encodeURIComponent(n.hash||n.permalink||'')}`,
           generated_at:new Date().toISOString()}}
  const a=document.createElement('a')
  a.href=URL.createObjectURL(new Blob([JSON.stringify(cert,null,2)],{type:'application/json'}))
  a.download=`${(n.record_id||n.hash||'echoprint').slice(0,16)}.echoprint.json`
  a.click(); URL.revokeObjectURL(a.href)
}
async function downloadCertificatePNG(n){
  const W=1080,H=1440,P=48,canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H
  const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H)
  ctx.fillStyle='#111'; ctx.font='bold 48px Inter, Arial'; ctx.fillText('Echoprint Certificate', P, P+12)
  ctx.font='16px Inter, Arial'; ctx.fillStyle='#666'; ctx.fillText('Recorded through EchoprintOS provenance ledger.', P, P+48)
  let y=P+80
  if(n.url){
    try{
      const img=await new Promise((res,rej)=>{ const i=new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=n.url })
      const iw=Math.min(W-P*2, img.width), ih=iw*(img.height/img.width)
      ctx.drawImage(img,(W-iw)/2,y,iw,ih); y+=ih+24
    }catch{}
  }
  const row=(label,val)=>{ ctx.fillStyle='#111'; ctx.font='bold 22px Inter, Arial'; ctx.fillText(label,P,y); y+=26; ctx.font='18px Inter, Arial'; wrap(String(val||'N/A')); y+=14 }
  function wrap(text){ const max=W-P*2; let line=''; for(const w of text.split(' ')){ const t=(line?line+' ':'')+w; if(ctx.measureText(t).width>max){ ctx.fillText(line,P,y); y+=26; line=w } else line=t } if(line) ctx.fillText(line,P,y) }
  row('Title', n.title); row('Record ID', n.record_id); row('SHA-256', n.hash||'N/A'); row('Timestamp (UTC)', iso(n.ts))
  canvas.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`${(n.record_id||n.hash||'echoprint').slice(0,16)}.certificate.png`; a.click(); URL.revokeObjectURL(a.href) })
}
function openCertificate(r){
  const n = { record_id:recIdOf(r), title:titleOf(r), hash:r.hash||null,
              platform:r.platform||null, permalink:linkOf(r), url:imgOf(r), ts:tsOf(r) }
  const overlay = $('certOverlay'), pane = $('certPane')
  pane.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2>Echoprint Certificate</h2>
      <button id="closeCert" style="border:0;background:#eee;padding:6px 10px;border-radius:8px;cursor:pointer">Close</button>
    </div>
    <div class="m">This is a preview of your certificate.</div>
    ${n.url?`<img src="${n.url}" alt="">`:''}
    <div style="margin-top:10px"><strong>Title:</strong> ${n.title}</div>
    <div style="margin-top:6px"><strong>Record ID:</strong> ${n.record_id||''}</div>
    <div style="margin-top:6px"><strong>SHA-256:</strong> <code>${n.hash||'N/A'}</code></div>
    <div style="margin-top:6px"><strong>Timestamp (UTC):</strong> ${iso(n.ts)}</div>
    <div class="row">
      <button id="btnCertPNG">Download Certificate (.png)</button>
      <button id="btnJSON">Download JSON</button>
      <button id="btnPrint">Print / Save PDF</button>
    </div>`
  overlay.style.display='block'
  $('closeCert').onclick=()=>overlay.style.display='none'
  overlay.onclick=(e)=>{ if(e.target===overlay) overlay.style.display='none' }
  $('btnPrint').onclick=()=>window.print()
  $('btnJSON').onclick =()=>downloadJSON(n)
  $('btnCertPNG').onclick=()=>downloadCertificatePNG(n)
}

// --- shared card body (used by Verify + Posts) ---
function cardBody(r){
  const n = { record_id:recIdOf(r), title:titleOf(r), hash:r.hash||null,
              platform:r.platform||null, permalink:linkOf(r), url:imgOf(r), ts:tsOf(r) }
  REC.set(n.record_id, n)
  const dt=iso(n.ts).replace('T',' ').slice(0,19)
  return `
    <div class="muted" style="font-size:13px">EchoprintOS Record ID: ${n.record_id||''}</div>
    <div class="muted" style="font-size:13px">Timestamp (UTC): ${dt||''}</div>
    ${n.hash?`<div class="muted" style="margin-top:6px">hash:</div><div style="word-break:break-all">${n.hash}</div>`:''}
    <div class="row" style="margin-top:6px">
      <a href="#" data-action="expand" data-key="${n.record_id}">View</a>
      ${n.permalink?`<a href="${n.permalink}">Open post</a>`:''}
      ${n.url?`<a href="${n.url}">View image</a>`:''}
      ${n.hash?`<a href="#verify" onclick="document.getElementById('q').value='${n.hash}';document.getElementById('btnVerify').click();return false;">Open in Verify</a>`:''}
      <a href="#" data-action="cert" data-key="${n.record_id}">View certificate</a>
      <a href="#" data-action="json" data-key="${n.record_id}">Download JSON</a>
      <a href="#" data-action="png"  data-key="${n.record_id}">Download certificate</a>
    </div>
    <div id="x-${n.record_id}" style="display:none;margin-top:10px"></div>`
}
function expandCard(r, mountId){
  const n = { record_id:recIdOf(r), title:titleOf(r), hash:r.hash||null,
              platform:r.platform||null, permalink:linkOf(r), url:imgOf(r), ts:tsOf(r) }
  const mount=document.getElementById(mountId)
  const dt=iso(n.ts).replace('T',' ').slice(0,19)
  mount.innerHTML = `
    ${n.url?`<div class="muted">media</div><div style="margin:6px 0"><a href="${n.url}">Open image</a></div>
      <details style="margin-top:6px"><summary>Preview</summary>
        <img src="${n.url}" style="max-width:100%;border-radius:8px;border:1px solid var(--line);margin-top:8px">
      </details>`:''}
    ${n.permalink?`<div class="muted" style="margin-top:6px">link</div><div><a href="${n.permalink}">${n.permalink}</a></div>`:''}
    <div class="muted" style="margin-top:6px">title</div><div>${n.title}</div>
    <div class="muted" style="margin-top:6px">record_id</div><div style="word-break:break-all">${n.record_id||''}</div>
    ${n.hash?`<div class="muted" style="margin-top:6px">hash</div><div style="word-break:break-all">${n.hash}</div>`:''}
    <div class="muted" style="margin-top:6px">timestamp (UTC)</div><div>${dt}</div>
    <div class="muted" style="margin-top:10px">Verified by EchoprintOS</div>`
  mount.style.display='block'
}

// --- global click handlers (cards) ---
document.addEventListener('click',(e)=>{
  const t=e.target.closest('[data-action]'); if(!t) return
  e.preventDefault()
  const n=REC.get(t.dataset.key); if(!n) return
  if(t.dataset.action==='expand') expandCard(n,'x-'+t.dataset.key)
  if(t.dataset.action==='json')   downloadJSON(n)
  if(t.dataset.action==='cert')   openCertificate(n)
  if(t.dataset.action==='png')    downloadCertificatePNG(n)
})

// --- tabs: show one panel at a time ---
function setTab(tab){
  ['generate','verify','posts'].forEach(id=>{ const el=$(id); if(el) el.hidden=(id!==tab) })
  document.querySelectorAll('.tab').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab))
  if(tab==='verify' && $('q')) $('q').focus()
}
function route(){ const tab=(location.hash||'#verify').slice(1)||'verify'; setTab(tab); if(tab==='posts'){ fetchPosts(true) } }
addEventListener('hashchange', route)

// --- VERIFY ---
const out = $('out')
function renderVerify(rows){
  if(!rows || rows.length===0){ out.innerHTML='<div class="muted">No records found.</div>'; return }
  out.innerHTML = rows.map(r=>`<div class="card"><strong>${titleOf(r)}</strong>${cardBody(r)}</div>`).join('')
}
$('btnVerify')?.addEventListener('click', async ()=>{
  const v=$('q').value.trim()
  if(!v){ out.innerHTML='<div class="muted">Enter a hash or permalink.</div>'; return }
  const isHash=/^[a-f0-9]{64}$/i.test(v)
  let { data, error } = await supabase.from('echoprints').select('*').eq(isHash?'hash':'permalink', v).limit(5)
  if(error || !data?.length){
    const r2 = await supabase.from('echoprints').select('*').eq('perma_link', v).limit(5)
    data = r2.data
  }
  renderVerify(data||[])
})
$('btnRecent')?.addEventListener('click', async ()=>{
  const { data, error } = await supabase.from('echoprints').select('*').order('created_at',{ascending:false}).limit(10)
  out.innerHTML = error ? `<div class="muted">Error: ${error.message}</div>` : ''
  if(!error) renderVerify(data)
})
$('btnClear')?.addEventListener('click', ()=>{ $('q').value=''; out.innerHTML='' })

// --- POSTS (live feed) ---
const list = $('list')
function postCard(r){
  const dt = tsOf(r) ? iso(tsOf(r)).replace('T',' ').slice(0,19) : ''
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <strong>${titleOf(r)}</strong>
      <div>${r.platform?`<span class="pill">${r.platform}</span>`:''}${dt?`<span class="pill">${dt}</span>`:''}</div>
    </div>${cardBody(r)}
  </div>`
}
async function fetchPosts(reset=false){
  if(!list) return
  const p=$('platform')?.value.trim()||'', s=$('search')?.value.trim()||'', i=$('imgonly')?.checked||false
  const k=JSON.stringify({p,s,i}); if(reset||k!==lastKey){ page=0; list.innerHTML=''; lastKey=k }
  let q = supabase.from('echoprints').select('*')
  if(p) q=q.eq('platform',p)
  if(s) q=q.or(['title','post_title','caption','text'].map(col=>`${col}.ilike.%${s}%`).join(','))
  if(i) q=q.or('url.not.is.null,image_url.not.is.null,image.not.is.null,media_url.not.is.null,media.not.is.null,photo.not.is.null,photo_url.not.is.null,thumb_url.not.is.null,file_url.not.is.null')
  q = q.order('created_at',{ascending:false}).range(page*pageSize, page*pageSize+pageSize-1)
  const { data, error } = await q
  if(error){ list.innerHTML = `<div class="muted">Error: ${error.message}</div>`; return }
  if(!data || (!data.length && page===0)){ list.innerHTML='<div class="muted">No posts found.</div>'; return }
  list.insertAdjacentHTML('beforeend', data.map(postCard).join('')); page++
}
$('refresh')?.addEventListener('click', ()=>fetchPosts(true))
$('more')?.addEventListener('click',    ()=>fetchPosts(false))

// --- GENERATE (guard requires 64-hex hash) ---
const isHex64 = s => /^[a-f0-9]{64}$/i.test((s||'').trim())
function updateInsertState(){ const ok=isHex64($('genHash')?.value); const btn=$('btnInsert'); if(btn) btn.disabled=!ok }
;['genHash','genText','genFile'].forEach(id=>$(id)?.addEventListener('input', updateInsertState))
$('btnHashText')?.addEventListener('click', async ()=>{
  const txt=($('genText')?.value||'').trim(); if(!txt){ $('genMsg').textContent='Enter text to hash.'; return }
  $('genHash').value = await sha256OfText(txt); $('genMsg').textContent='Text hashed ✓'; updateInsertState()
})
$('btnHashFile')?.addEventListener('click', async ()=>{
  const f=$('genFile')?.files?.[0]; if(!f){ $('genMsg').textContent='Choose a file to hash.'; return }
  $('genHash').value = await sha256OfFile(f); $('genMsg').textContent=`File hashed ✓ (${f.name})`; updateInsertState()
})
$('btnClearGen')?.addEventListener('click', ()=>{
  ['genTitle','genPermalink','genURL','genText','genHash'].forEach(id=>$(id)&&($(id).value=''))
  $('genPlatform') && ( $('genPlatform').value='' ); $('genFile') && ( $('genFile').value='' ); $('genMsg') && ( $('genMsg').textContent='' )
  updateInsertState()
})
$('btnInsert')?.addEventListener('click', async (e)=>{
  const h = $('genHash')?.value || ''
  if(!isHex64(h)){ e.preventDefault(); $('genMsg').textContent='Invalid or missing 64-hex hash.'; return }
  const row={
    record_id: crypto.randomUUID?.() || undefined,
    title: ($('genTitle')?.value||'Untitled').trim(),
    hash: h.trim(),
    platform: ($('genPlatform')?.value||'').trim() || null,
    permalink: ($('genPermalink')?.value||'').trim() || null,
    url: ($('genURL')?.value||'').trim() || null,
    sent_at: new Date().toISOString()
  }
  $('genMsg').textContent='Saving…'
  const { data, error } = await supabase.from('echoprints').insert(row).select().single()
  $('genMsg').textContent = error ? `Error: ${error.message}` : 'Inserted ✓'
  if(!error){
    openCertificate(data)
    renderVerify([data])
    list && list.insertAdjacentHTML('afterbegin', postCard(data))
  }
})

// --- boot ---
if(!location.hash) location.hash = '#verify'
route()
updateInsertState()
fetchPosts(true)
$('btnRecent')?.click()
