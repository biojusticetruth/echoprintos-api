// api/image.js
export default async function handler(req, res) {
  const { ecp_id, hash } = req.query;
  if (!ecp_id && !hash) return res.status(400).send("missing params");

  const base = "https://echoprintos-api.vercel.app";
  const path = hash
    ? `/image?hash=${encodeURIComponent(hash)}`
    : `/image?ecp_id=${encodeURIComponent(ecp_id)}`;

  const upstream = await fetch(base + path, { cache: "no-store" });

  res.setHeader("Access-Control-Allow-Origin", "*");
  upstream.headers.forEach((v, k) => {
    if (!["transfer-encoding"].includes(k.toLowerCase())) res.setHeader(k, v);
  });
  res.status(upstream.status);
  upstream.body.pipe(res);
}
