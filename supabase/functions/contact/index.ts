import { corsJson, corsPreflight, isAllowedOrigin } from '../_shared/http.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  if (!isAllowedOrigin(req)) return corsJson(req, { ok: false, error: 'Origin is not allowed.' }, 403);
  const json = (body: unknown, status = 200) => corsJson(req, body, status);
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const salt = Deno.env.get('RATE_LIMIT_SALT');
    if (!url || !serviceKey || !salt) {
      return json({ ok: false, error: 'Server storage, SITE_ORIGIN and RATE_LIMIT_SALT must be configured.' }, 503);
    }

    const body = await req.json();
    if (clean(body.website, 160)) return json({ ok: true, emailSent: false });
    const name = clean(body.name, 100);
    const email = clean(body.email, 254).toLowerCase();
    const message = clean(body.message, 5000);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 5) {
      return json({ ok: false, error: 'Please provide a valid name, email address and message.' }, 400);
    }

    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const forwarded = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${forwarded}`));
    const digest = [...new Uint8Array(digestBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
    const { data: allowed, error: limitError } = await client.rpc('consume_contact_rate_limit', { digest, max_requests: 5, window_seconds: 3600 });
    if (limitError) throw new Error('Rate-limit service unavailable.');
    if (!allowed) return json({ ok: false, error: 'Too many messages. Please try again later.' }, 429);

    const { data: inserted, error: insertError } = await client.from('contact_messages')
      .insert({ name, email, message, ip_digest: digest, user_agent: clean(req.headers.get('user-agent'), 350) })
      .select('id').single();
    if (insertError) throw insertError;

    let emailSent = false;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const notifyTo = Deno.env.get('OWNER_NOTIFICATION_EMAIL');
    const from = Deno.env.get('RESEND_FROM_EMAIL');
    if (resendKey && notifyTo && from) {
      try {
        const mail = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [notifyTo], reply_to: email, subject: `New website message from ${name}`, text: `Name: ${name}\nEmail: ${email}\n\n${message}` })
        });
        emailSent = mail.ok;
        if (!mail.ok) {
          const detail = await mail.text();
          await client.from('contact_messages').update({ email_notification_error: detail.slice(0, 1000) }).eq('id', inserted.id);
        }
      } catch (mailError) {
        await client.from('contact_messages').update({ email_notification_error: String(mailError).slice(0, 1000) }).eq('id', inserted.id);
      }
    }
    await client.from('contact_messages').update({ email_notification_sent: emailSent }).eq('id', inserted.id);
    return json({ ok: true, emailSent });
  } catch (error) {
    console.error('contact handler:', error);
    return json({ ok: false, error: 'The message could not be stored. Please try again later.' }, 500);
  }
});
