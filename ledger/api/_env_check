// _env_check.js — quick visibility (no secrets leaked)
function show(v) {
  if (!v) return 'MISSING';
  const n = String(v).length;
  return `SET(len=${n})`;
}

module.exports = function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    NEXT_PUBLIC_SUPABASE_URL: show(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: show(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_URL: show(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: show(process.env.SUPABASE_SERVICE_ROLE_KEY),
    WEBHOOK_SECRET: show(process.env.WEBHOOK_SECRET),
  });
};
