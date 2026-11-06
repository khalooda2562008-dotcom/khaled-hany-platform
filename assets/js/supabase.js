const config = window.KH_CONFIG || {};

export const supabaseConfigured = Boolean(
  typeof config.supabaseUrl === 'string' &&
  typeof config.supabaseAnonKey === 'string' &&
  config.supabaseUrl.startsWith('https://') &&
  config.supabaseAnonKey.length > 20
);

let clientPromise;
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
        global: { headers: { 'x-client-info': 'khaled-hany-platform/1.0.0' } }
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
