import { getSupabase, supabaseConfigured, safeExternalUrl } from '../assets/js/supabase.js';

const $ = (selector, root = document) => root.querySelector(selector);
let client = null;
let mode = 'login';
let activeUser = null;

function message(target, text, kind = '') {
  const node = $(target);
  node.textContent = text;
  node.className = `message ${kind}`.trim();
}
function setMode(next) {
  mode = next;
  $('#loginTab').classList.toggle('active', mode === 'login');
  $('#signupTab').classList.toggle('active', mode === 'signup');
  $('#authTitle').textContent = mode === 'login' ? 'مرحبًا بعودتك' : 'إنشاء حساب جديد';
  $('#nameField').hidden = mode !== 'signup';
  $('#authForm [name="display_name"]').required = mode === 'signup';
  $('#authForm [name="password"]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#authSubmit').innerHTML = mode === 'login' ? 'دخول <span>↗</span>' : 'إنشاء الحساب <span>↗</span>';
  message('#authMessage', mode === 'login' ? 'سجّل الدخول باستخدام البريد وكلمة المرور.' : 'سيُنشأ حساب عادي بصلاحية Registered User؛ تأكيد البريد يعتمد على إعدادات Supabase.', '');
}
function showProfile(show) {
  $('#authPanel').hidden = show;
  $('#profilePanel').hidden = !show;
}
async function loadProfile(user) {
  activeUser = user;
  const [{ data: profile, error: profileError }, { data: roleData }] = await Promise.all([
    client.from('profiles').select('display_name,bio,avatar_url,preferred_language').eq('id', user.id).single(),
    client.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
  ]);
  if (profileError) throw profileError;
  $('#userEmail').textContent = user.email || '';
  $('#roleBadge').textContent = String(roleData?.role || 'registered_user').toUpperCase();
  const form = $('#profileForm');
  form.elements.display_name.value = profile?.display_name || user.user_metadata?.name || '';
  form.elements.bio.value = profile?.bio || '';
  form.elements.avatar_url.value = profile?.avatar_url || '';
  form.elements.preferred_language.value = profile?.preferred_language || 'ar';
  showProfile(true);
}

$('#loginTab').addEventListener('click', () => setMode('login'));
$('#signupTab').addEventListener('click', () => setMode('signup'));

$('#authForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseConfigured) return message('#authMessage', 'أضف Supabase URL وAnon Key داخل config.js أولًا.', 'error');
  const button = $('#authSubmit');
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    if (mode === 'signup') {
      const displayName = String(form.get('display_name') || '').trim();
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { name: displayName } } });
      if (error) throw error;
      if (data.session && data.user) {
        await loadProfile(data.user);
      } else {
        setMode('login');
        message('#authMessage', 'تم إرسال طلب إنشاء الحساب. افتح رسالة تأكيد البريد ثم سجّل الدخول.', 'success');
      }
    } else {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadProfile(data.user);
    }
  } catch (error) {
    message('#authMessage', error.message || 'تعذّر إتمام العملية.', 'error');
  } finally {
    button.disabled = false;
  }
});

$('#profileForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!activeUser) return;
  const button = $('button[type="submit"]', event.currentTarget);
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const avatar = String(form.get('avatar_url') || '').trim();
    if (avatar && !safeExternalUrl(avatar)) throw new Error('رابط الصورة يجب أن يبدأ بـ https:// أو http://.');
    const payload = {
      id: activeUser.id,
      display_name: String(form.get('display_name') || '').trim().slice(0, 80),
      bio: String(form.get('bio') || '').trim().slice(0, 500),
      avatar_url: avatar || null,
      preferred_language: form.get('preferred_language') === 'en' ? 'en' : 'ar',
      updated_at: new Date().toISOString()
    };
    if (!payload.display_name) throw new Error('الاسم المعروض مطلوب.');
    const { id, ...profileValues } = payload;
    const { error } = await client.from('profiles').update(profileValues).eq('id', id);
    if (error) throw error;
    message('#profileMessage', 'تم حفظ بيانات حسابك بنجاح.', 'success');
  } catch (error) {
    message('#profileMessage', error.message || 'تعذّر حفظ البيانات.', 'error');
  } finally {
    button.disabled = false;
  }
});

$('#logoutButton').addEventListener('click', async () => {
  const { error } = await client.auth.signOut();
  if (error) message('#profileMessage', error.message, 'error');
  else { activeUser = null; showProfile(false); setMode('login'); }
});

async function boot() {
  if (!supabaseConfigured) {
    $('#authSubmit').disabled = true;
    return message('#authMessage', 'هذه الصفحة جاهزة، لكن الحسابات غير مفعّلة بعد. أضف بيانات مشروع Supabase العامة إلى config.js ثم طبّق Migration قاعدة البيانات.', 'error');
  }
  try {
    client = await getSupabase();
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (session?.user) await loadProfile(session.user);
    client.auth.onAuthStateChange((_event, sessionState) => {
      if (!sessionState?.user) { activeUser = null; showProfile(false); }
    });
  } catch (error) {
    message('#authMessage', `تعذّر الاتصال بخدمة الحسابات: ${error.message}`, 'error');
  }
}
setMode('login');
boot();
