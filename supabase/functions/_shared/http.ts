const SITE_ORIGIN = Deno.env.get('SITE_ORIGIN') || '';

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin') || '';
  if (!SITE_ORIGIN || !origin) return false;
  try {
    const configured = new URL(SITE_ORIGIN);
    const supplied = new URL(origin);
    return configured.origin === origin && supplied.origin === origin &&
      (supplied.protocol === 'https:' || supplied.hostname === 'localhost' || supplied.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function responseHeaders(req: Request): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  if (isAllowedOrigin(req)) headers.set('Access-Control-Allow-Origin', SITE_ORIGIN);
  return headers;
}

export function corsJson(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(req) });
}

export function corsPreflight(req: Request): Response {
  return new Response(null, {
    status: isAllowedOrigin(req) ? 204 : 403,
    headers: responseHeaders(req)
  });
}
