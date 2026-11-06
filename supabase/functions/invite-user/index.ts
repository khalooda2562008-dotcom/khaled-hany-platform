import { corsJson, corsPreflight, isAllowedOrigin } from '../_shared/http.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  if (!isAllowedOrigin(req)) return corsJson(req, { error: 'Origin is not allowed.' }, 403);
  const json = (body: unknown, status = 200) => corsJson(req, body, status);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return json({ error: 'Server is not configured.' }, 503);
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Unauthorized' }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);
    const { data: role, error: roleError } = await caller.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (roleError || role?.role !== 'owner') return json({ error: 'Only the primary owner can invite administrators.' }, 403);

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const roleName = String(body.role || 'registered_user');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['registered_user', 'editor', 'administrator'].includes(roleName)) return json({ error: 'Invalid email or role.' }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { invited_by: user.id } });
    if (error) throw error;
    const { error: upsertError } = await admin.from('user_roles').upsert({ user_id: data.user.id, role: roleName, granted_by: user.id }, { onConflict: 'user_id' });
    if (upsertError) throw upsertError;
    return json({ ok: true, userId: data.user.id });
  } catch (error) {
    console.error('invite-user:', error);
    return json({ error: 'Invitation failed.' }, 500);
  }
});
