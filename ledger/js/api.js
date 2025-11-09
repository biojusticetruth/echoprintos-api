// /ledger/js/api.js
export function requireEnv(where = "api.js") {
  if (!window.ENV || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error(`Missing ENV in ${where}. Check /ledger/env.js`);
  }
}

export function supaHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: ENV.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
  };
}

export function supaUrl(path) {
  return `${ENV.SUPABASE_URL}${path}`;
}

// GET helper for PostgREST endpoints
export async function supaGet(path, paramsObj = {}) {
  const qs = new URLSearchParams(paramsObj).toString();
  const res = await fetch(supaUrl(`${path}${qs ? "?" + qs : ""}`), {
    headers: supaHeaders(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json();
}
