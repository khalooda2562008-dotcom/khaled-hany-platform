const config = window.KH_CONFIG || {};

export const supabaseConfigured = Boolean(
  typeof config.supabaseUrl === 'string' &&
  typeof config.supabaseAnonKey === 'string' &&
  config.supabaseUrl.startsWith('https://') &&
  config.supabaseAnonKey.length > 20
);

let clientPromise;
const FETCH_TIMEOUT_MS = 20000;
const fetchWithTimeout = (input, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};
export async function getSupabase() {
  if (!supabaseConfigured) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        },
        global: {
          headers: { 'x-client-info': 'khaled-hany-platform/1.0.0' },
          fetch: fetchWithTimeout
        }
      });
    }).catch(error => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export function safeExternalUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
