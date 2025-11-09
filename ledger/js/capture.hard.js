const $ = (s) => document.querySelector(s);
const toHex = (buf) => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");

$("#webhook").value = localStorage.getItem("echoprint_webhook") || "";
$("#webhook").addEventListener("change", e => localStorage.setItem("echoprint_webhook", e.target.value.trim()));

$("#btnHash").addEventListener("click", async () => {
  const title = $("#title").value.trim();
  const txt   = $("#text").value;
  const file  = $("#file").files?.[0] || null;

  let data;
  if (file) {
    data = await file.arrayBuffer();
  } else {
    data = new TextEncoder().encode(txt || "").buffer;
  }

  const digest = await crypto.subtle.digest("SHA-256", data);
  const hash = toHex(digest);
  const now  = new Date();
  const ecp  = "ECP-" + now.toISOString().replace(/\D/g, "").slice(0, 17); // ECP-YYYYMMDDHHMMSSmmm

  $("#hash").textContent = hash;
  $("#ecp").textContent  = ecp;
  $("#ts").textContent   = now.toISOString();
  $("#out").style.display = "";

  const payload = {
    record_id: ecp,
    title: title || (file?.name || "Untitled"),
    permalink: null,
    timestamp_iso: now.toISOString(),
    hash
  };

  // Copy JSON
  $("#btnCopyJSON").onclick = async () => {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    alert("Verification JSON copied.");
  };

  // Download JSON
  $("#btnDownload").onclick = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "verification.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Optional: send to Make webhook you control
  $("#btnSend").onclick = async () => {
    const url = ($("#webhook").value || "").trim();
    if (!url) return alert("Add your Make webhook URL first.");
    const res = await fetch(url, {method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)});
    alert(res.ok ? "Sent to Make." : "Webhook error.");
  };
});
