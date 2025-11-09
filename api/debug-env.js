// /api/debug-env.js
export default function handler(req, res) {
  // DO NOT print secrets — only booleans.
  const hasUrl  = typeof process.env.SUPABASE_URL === 'string' && process.env.SUPABASE_URL.startsWith('https://');
  const hasKey  = typeof process.env.SUPABASE_SERVICE_ROLE_KEY === 'string' && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 30;
  const runtime = process.env.VERCEL_REGION ? 'node-serverless' : 'unknown';
  res.status(200).json({
    ok: true,
    runtime,
    SUPABASE_URL: hasUrl,
    SUPABASE_SERVICE_ROLE_KEY: hasKey,
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL || null
  });
}
