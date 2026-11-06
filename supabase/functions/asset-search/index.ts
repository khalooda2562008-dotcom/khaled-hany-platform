import { corsJson, corsPreflight, isAllowedOrigin } from '../_shared/http.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const text = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  if (!isAllowedOrigin(req)) return corsJson(req, { error: 'Origin is not allowed.' }, 403);
  const out = (data: unknown, status = 200) => corsJson(req, data, status);
  if (req.method !== 'POST') return out({ error: 'Method not allowed' }, 405);
  try {
    const { query, provider } = await req.json();
    const q = text(query, 120);
    if (q.length < 2) return out({ error: 'Query is too short.' }, 400);
    if (!['unsplash', 'pexels', 'pixabay'].includes(provider)) return out({ error: 'Unsupported provider.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const authorization = req.headers.get('Authorization');
    if (!supabaseUrl || !anonKey || !authorization) return out({ error: 'Authentication is required.' }, 401);
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return out({ error: 'Authentication is required.' }, 401);
    const { data: role, error: roleError } = await authClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (roleError || !['owner', 'administrator', 'editor'].includes(role?.role)) return out({ error: 'Insufficient permissions.' }, 403);

    let items: any[] = [];
    if (provider === 'unsplash') {
      const key = Deno.env.get('UNSPLASH_ACCESS_KEY');
      if (!key) return out({ error: 'UNSPLASH_ACCESS_KEY is not configured on the server.' }, 503);
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=18`, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } });
      if (!response.ok) throw new Error(`Unsplash returned ${response.status}`);
      const data = await response.json();
      items = (data.results || []).map((item: any) => ({ provider: 'Unsplash', id: item.id, title: item.alt_description || item.description || 'Unsplash photo', preview: item.urls?.small, source: item.links?.html, download: item.links?.download_location, creator: item.user?.name || 'Unknown creator', creator_url: item.user?.links?.html, license: 'Unsplash License — verify current API terms', license_verified: false, attribution: `Photo by ${item.user?.name || 'Unknown'} on Unsplash`, kind: 'image' }));
    }
    if (provider === 'pexels') {
      const key = Deno.env.get('PEXELS_API_KEY');
      if (!key) return out({ error: 'PEXELS_API_KEY is not configured on the server.' }, 503);
      const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=18`, { headers: { Authorization: key } });
      if (!response.ok) throw new Error(`Pexels returned ${response.status}`);
      const data = await response.json();
      items = (data.photos || []).map((item: any) => ({ provider: 'Pexels', id: String(item.id), title: item.alt || 'Pexels photo', preview: item.src?.medium, source: item.url, download: item.src?.original, creator: item.photographer || 'Unknown creator', creator_url: item.photographer_url, license: 'Pexels License — verify at source', license_verified: false, attribution: `Photo by ${item.photographer || 'Unknown'} on Pexels`, kind: 'image' }));
    }
    if (provider === 'pixabay') {
      const key = Deno.env.get('PIXABAY_API_KEY');
      if (!key) return out({ error: 'PIXABAY_API_KEY is not configured on the server.' }, 503);
      const response = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&per_page=18&safesearch=true`);
      if (!response.ok) throw new Error(`Pixabay returned ${response.status}`);
      const data = await response.json();
      items = (data.hits || []).map((item: any) => ({ provider: 'Pixabay', id: String(item.id), title: item.tags || 'Pixabay image', preview: item.webformatURL, source: item.pageURL, download: item.largeImageURL, creator: item.user || 'Unknown creator', license: 'Pixabay Content License — verify at source', license_verified: false, attribution: `Image by ${item.user || 'Unknown'} on Pixabay`, kind: 'image' }));
    }
    return out({ items, notice: 'Provider terms and attribution must be reviewed before publishing. API results are not a substitute for a license check.' });
  } catch (error) {
    console.error('asset-search:', error);
    return out({ error: 'Asset provider request failed.' }, 502);
  }
});
