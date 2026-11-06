import { corsJson, corsPreflight, isAllowedOrigin } from '../_shared/http.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  if (!isAllowedOrigin(req)) return corsJson(req, { error: 'Origin is not allowed.' }, 403);
  const json = (data: unknown, status = 200) => corsJson(req, data, status);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const key = Deno.env.get('AI_API_KEY');
    const endpoint = Deno.env.get('AI_API_URL') || 'https://api.openai.com/v1/chat/completions';
    const model = Deno.env.get('AI_MODEL');
    if (!url || !anon || !key || !model) return json({ error: 'AI integration is not configured on the server.' }, 503);
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Unauthorized' }, 401);
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);
    const { data: role, error: roleError } = await client.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (roleError || !['owner', 'administrator', 'editor'].includes(role?.role)) return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const task = String(body.task || '').slice(0, 80);
    const content = String(body.content || '').slice(0, 12000);
    const language = body.language === 'en' ? 'English' : 'Arabic';
    if (!task || !content) return json({ error: 'Task and content are required.' }, 400);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: `You are a content editing assistant. Work only with facts explicitly included in the supplied text. Never invent the owner's credentials, achievements, projects, metrics, or biography. Respond in ${language}. Clearly identify unverifiable claims instead of adding them.` },
        { role: 'user', content: `Task: ${task}\n\nSource content:\n${content}` }
      ], temperature: 0.3 })
    });
    if (!response.ok) {
      console.error('AI provider error', response.status, (await response.text()).slice(0, 1000));
      return json({ error: 'AI provider request failed.' }, 502);
    }
    const result = await response.json();
    return json({ ok: true, text: result.choices?.[0]?.message?.content || '' });
  } catch (error) {
    console.error('ai-assist:', error);
    return json({ error: 'AI assistance failed.' }, 500);
  }
});
