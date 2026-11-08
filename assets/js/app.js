import { getSupabase, supabaseConfigured, safeExternalUrl } from './supabase.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  lang: localStorage.getItem('kh-lang') === 'en' ? 'en' : 'ar',
  light: localStorage.getItem('kh-theme') === 'light',
  motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  heroImage: '',
  projects: [],
  sectionRows: [], skills: [], education: [], journey: [], goals: [], contentItems: [], publicSettings: []
};

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3200);
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  $('#languageButton').textContent = state.lang === 'ar' ? 'EN' : 'عربي';
  $$('[data-ar][data-en]').forEach(element => {
    const value = element.getAttribute(`data-${state.lang}`);
    if (value !== null) element.textContent = value;
  });
  const title = state.lang === 'ar' ? 'خالد هاني | هويتي الرقمية' : 'Khaled Hany | Digital Identity';
  document.title = title;
  const heroPhoto = $('#heroPhoto');
  if (heroPhoto && state.heroImage) heroPhoto.alt = state.lang === 'ar' ? 'صورة خالد هاني' : 'Khaled Hany portrait';
  if (state.sectionRows.length) applySectionRows(state.sectionRows);
  if (state.skills.length) renderSkills(state.skills);
  if (state.education.length) renderEducation(state.education);
  if (state.journey.length) renderJourney(state.journey);
  if (state.goals.length) renderGoals(state.goals);
  if (state.contentItems.length) renderContentItems(state.contentItems);
  if (state.publicSettings.length) applyPublicSettings(state.publicSettings);
  localStorage.setItem('kh-lang', state.lang);
  const roles = state.lang === 'ar'
    ? ['طالب ذكاء اصطناعي', 'مهتم بهندسة البرمجيات', 'صانع محتوى في رحلتي']
    : ['Artificial Intelligence student', 'Interested in software engineering', 'Content creator in progress'];
  startRoleCycle(roles);
}

let roleTimer = 0;
function startRoleCycle(roles) {
  clearTimeout(roleTimer);
  const target = $('#roleText');
  if (!target) return;
  if (!state.motion) { target.textContent = roles[0]; return; }
  let wordIndex = 0, position = 0, deleting = false;
  const tick = () => {
    const word = roles[wordIndex % roles.length];
    target.textContent = word.slice(0, position);
    if (!deleting && position < word.length) position++;
    else if (!deleting) { deleting = true; roleTimer = setTimeout(tick, 1200); return; }
    else if (position > 0) position--;
    else { deleting = false; wordIndex++; }
    roleTimer = setTimeout(tick, deleting ? 34 : 68);
  };
  tick();
}

function setupNavigation() {
  const menu = $('#mainNav');
  const toggle = $('#menuButton');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  $$('#mainNav a').forEach(link => link.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));
  const sections = $$('main section[id]');
  const navLinks = $$('#mainNav a');
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    }), { rootMargin: '-33% 0px -58% 0px' });
    sections.forEach(section => navObserver.observe(section));
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: 0.1 });
    $$('.reveal').forEach(item => revealObserver.observe(item));
  } else {
    $$('.reveal').forEach(item => item.classList.add('visible'));
  }
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    $('#progressBar').style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

function setupAppearance() {
  document.body.classList.toggle('light', state.light);
  $('#themeButton').textContent = state.light ? '☾' : '☼';
  $('#themeButton').addEventListener('click', () => {
    state.light = !state.light;
    document.body.classList.toggle('light', state.light);
    $('#themeButton').textContent = state.light ? '☾' : '☼';
    localStorage.setItem('kh-theme', state.light ? 'light' : 'dark');
  });
  $('#languageButton').addEventListener('click', () => {
    state.lang = state.lang === 'ar' ? 'en' : 'ar';
    applyLanguage();
    renderProjects();
  });
  $('#motionButton').addEventListener('click', () => {
    state.motion = !state.motion;
    document.body.classList.toggle('motion-paused', !state.motion);
    $('#motionButton').textContent = state.motion ? 'Ⅱ' : '▶';
    $('#motionButton').setAttribute('aria-pressed', String(!state.motion));
    $('#motionButton').setAttribute('aria-label', state.motion ? 'Pause motion' : 'Resume motion');
    window.dispatchEvent(new CustomEvent('kh-motion-change', { detail: { enabled: state.motion } }));
    toast(state.lang === 'ar' ? (state.motion ? 'تم تشغيل الحركة' : 'تم إيقاف الحركة') : (state.motion ? 'Motion resumed' : 'Motion paused'));
    startRoleCycle(state.lang === 'ar' ? ['طالب ذكاء اصطناعي', 'مهتم بهندسة البرمجيات', 'صانع محتوى في رحلتي'] : ['Artificial Intelligence student', 'Interested in software engineering', 'Content creator in progress']);
  });
  $('#year').textContent = new Date().getFullYear();
}

function textNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text || '';
  return node;
}

function renderProjects() {
  const grid = $('#projectGrid');
  const empty = $('#emptyProjects');
  const filter = $('.filter-chip.active')?.dataset.filter || 'all';
  const selected = state.projects.filter(project => filter === 'all' || project.category === filter);
  grid.replaceChildren();
  selected.forEach(project => {
    const card = document.createElement('article');
    card.className = 'project-card surface-panel';
    const visual = document.createElement('div');
    visual.className = 'project-image';
    const imageUrl = safeExternalUrl(project.image_url);
    if (imageUrl) {
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.alt = project.image_alt || (state.lang === 'ar' ? project.title_ar : project.title_en) || 'Project image';
      image.src = imageUrl;
      visual.append(image);
    }
    const category = textNode('span', 'project-category', (project.category || 'project').toUpperCase());
    const title = textNode('h3', '', state.lang === 'ar' ? project.title_ar : (project.title_en || project.title_ar));
    const description = textNode('p', '', state.lang === 'ar' ? project.summary_ar : (project.summary_en || project.summary_ar));
    const links = textNode('div', 'project-links', '');
    const liveUrl = safeExternalUrl(project.live_url);
    const repoUrl = safeExternalUrl(project.github_url);
    if (liveUrl) {
      const link = textNode('a', '', state.lang === 'ar' ? 'معاينة المشروع ↗' : 'Live preview ↗');
      link.href = liveUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
    }
    if (repoUrl) {
      const link = textNode('a', '', 'GitHub ↗');
      link.href = repoUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
    }
    card.append(visual, category, title, description, links);
    grid.append(card);
  });
  empty.hidden = selected.length > 0;
  $('#projectCount').textContent = state.lang === 'ar' ? `${state.projects.length} مشروع منشور` : `${state.projects.length} published projects`;
}

function setupProjectFilters() {
  $$('.filter-chip').forEach(button => button.addEventListener('click', () => {
    $$('.filter-chip').forEach(item => item.classList.toggle('active', item === button));
    renderProjects();
  }));
}

function applySectionRows(rows) {
  for (const row of rows) {
    const section = document.getElementById(row.key);
    if (!section) continue;
    section.hidden = row.is_visible === false;
    const title = section.querySelector('.section-heading h2');
    const description = section.querySelector('.section-heading > p');
    if (title) title.textContent = state.lang === 'ar' ? row.title_ar : (row.title_en || row.title_ar);
    if (description) description.textContent = state.lang === 'ar' ? row.description_ar : (row.description_en || row.description_ar);
    if (row.key === 'about' && row.body_ar) {
      const body = section.querySelector('.about-panel > p');
      if (body) body.textContent = state.lang === 'ar' ? row.body_ar : (row.body_en || row.body_ar);
    }
  }
}

function renderSkills(rows) {
  const grid = $('.skills-grid'); if (!grid) return;
  grid.replaceChildren();
  rows.forEach((item, index) => {
    const card = document.createElement('article'); card.className = 'skill-panel surface-panel reveal';
    const number = document.createElement('span'); number.className = 'skill-number'; number.textContent = String(index + 1).padStart(2, '0');
    const glyph = document.createElement('div'); glyph.className = 'skill-glyph'; glyph.textContent = ['{ }','⌁','▤','◫','✳'][index % 5];
    const title = document.createElement('h3'); title.textContent = state.lang === 'ar' ? item.name_ar : (item.name_en || item.name_ar);
    const description = document.createElement('p'); description.textContent = state.lang === 'ar' ? item.description_ar : (item.description_en || item.description_ar);
    const label = document.createElement('small'); label.textContent = state.lang === 'ar' ? 'مجال اهتمام وتعلّم' : 'LEARNING INTEREST';
    card.append(number,glyph,title,description,label); grid.append(card);
  });
}
function renderEducation(rows) {
  const root = $('.education-panel'); if (!root) return;
  root.replaceChildren();
  rows.forEach((item, index) => {
    const symbol = document.createElement('div'); symbol.className = 'education-symbol'; symbol.textContent = 'أ';
    const content = document.createElement('div');
    const overline = document.createElement('span'); overline.className = 'panel-overline'; overline.textContent = 'ACADEMIC BACKGROUND';
    const title = document.createElement('h3'); title.textContent = state.lang === 'ar' ? item.institution_ar : (item.institution_en || item.institution_ar);
    const program = document.createElement('p'); program.textContent = `${state.lang === 'ar' ? item.program_ar : (item.program_en || item.program_ar)}${item.detail_ar ? ` · ${state.lang === 'ar' ? item.detail_ar : (item.detail_en || item.detail_ar)}` : ''}`;
    content.append(overline,title,program);
    const tag = document.createElement('span'); tag.className = 'education-tag'; tag.textContent = item.is_current ? (state.lang === 'ar' ? 'المسار الحالي' : 'CURRENT PATH') : (item.start_date || '');
    root.append(symbol,content,tag);
  });
}
function renderJourney(rows) {
  const root = $('#journeyList'); if (!root) return;
  root.replaceChildren();
  rows.forEach((item,index) => {
    const card = document.createElement('article'); card.className = 'timeline-item reveal';
    const point = document.createElement('span'); point.className = 'timeline-point';
    const small = document.createElement('small'); small.textContent = item.tag || item.milestone_date || `${String(index+1).padStart(2,'0')} / JOURNEY`;
    const title = document.createElement('h3'); title.textContent = state.lang === 'ar' ? item.title_ar : (item.title_en || item.title_ar);
    const desc = document.createElement('p'); desc.textContent = state.lang === 'ar' ? item.description_ar : (item.description_en || item.description_ar);
    card.append(point,small,title,desc); root.append(card);
  });
}
function renderGoals(rows) {
  const root = $('.focus-grid'); if (!root) return;
  root.replaceChildren();
  rows.forEach((item,index) => {
    const card = document.createElement('article'); card.className = 'focus-card surface-panel reveal';
    const number = document.createElement('span'); number.textContent = String(index+1).padStart(2,'0');
    const title = document.createElement('h3'); title.textContent = state.lang === 'ar' ? item.title_ar : (item.title_en || item.title_ar);
    const desc = document.createElement('p'); desc.textContent = state.lang === 'ar' ? item.description_ar : (item.description_en || item.description_ar);
    card.append(number,title,desc); root.append(card);
  });
}

function renderContentItems(rows) {
  const root = $('.content-cards'); if (!root) return;
  root.replaceChildren();
  rows.forEach(item => {
    const card = document.createElement('article'); card.className = 'content-feature surface-panel reveal';
    const body = document.createElement('div');
    const imageUrl = safeExternalUrl(item.image_url);
    if (imageUrl) { const image = document.createElement('img'); image.src = imageUrl; image.alt = ''; image.loading = 'lazy'; image.className = 'content-item-image'; card.append(image); }
    const glyph = document.createElement('span'); glyph.className = 'feature-icon'; glyph.textContent = item.item_type === 'video' ? '▶' : item.item_type === 'article' ? '✎' : item.item_type === 'resource' ? '⌘' : '↗';
    const label = document.createElement('span'); label.className = 'panel-overline'; label.textContent = `${item.item_type.toUpperCase()} / ${item.creator_label || 'KHALED HANY'}`;
    const title = document.createElement('h3'); title.textContent = state.lang === 'ar' ? item.title_ar : (item.title_en || item.title_ar);
    const description = document.createElement('p'); description.textContent = state.lang === 'ar' ? item.description_ar : (item.description_en || item.description_ar);
    const anchor = document.createElement('a'); anchor.className = 'feature-state'; anchor.href = safeExternalUrl(item.url) || '#content'; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = state.lang === 'ar' ? 'فتح المصدر ↗' : 'Open source ↗';
    body.append(label,title,description,anchor); card.append(glyph,body); root.append(card);
  });
}
function applyPublicSettings(rows) {
  state.publicSettings = rows;
  for (const entry of rows) {
    const v = entry.value || {};
    if (entry.setting_key === 'site_brand') {
      const lead = $('.hero-lead'); if (lead && (v.hero_ar || v.hero_en)) lead.textContent = state.lang === 'ar' ? (v.hero_ar || v.hero_en) : (v.hero_en || v.hero_ar);
      loadHeroPhoto(safeExternalUrl(v.hero_image_url));
      if (v.name_ar || v.name_en) {
        document.title = state.lang === 'ar' ? `${v.name_ar || v.name_en} | هويتي الرقمية` : `${v.name_en || v.name_ar} | Digital Identity`;
        const englishBrand = v.name_en || 'Khaled Hany';
        const firstName = v.first_name_en || englishBrand.split(' ')[0];
        const arabicLast = v.last_name_ar || 'هاني';
        const brand = $('.brand-copy strong'); if (brand) brand.textContent = englishBrand.toUpperCase();
        const footer = $('.footer-brand'); if (footer) footer.textContent = englishBrand.toUpperCase();
        const heroFirst = $('.hero-name'); if (heroFirst) heroFirst.textContent = firstName;
        const heroArabic = $('.hero-arabic'); if (heroArabic) heroArabic.textContent = arabicLast;
      }
    }
    if (entry.setting_key === 'appearance') {
      const root = document.documentElement;
      for (const [key,variable] of [['cyan','--cyan'],['violet','--violet'],['background','--bg']]) if (typeof v[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(v[key])) root.style.setProperty(variable,v[key]);
    }
    if (entry.setting_key === 'seo') {
      const description = state.lang === 'ar' ? v.description_ar : (v.description_en || v.description_ar);
      if (typeof description === 'string' && description.trim()) document.querySelector('meta[name="description"]')?.setAttribute('content',description.slice(0,300));
    }
    if (entry.setting_key === 'social_links' && Array.isArray(v.links)) {
      const target = $('.contact-intro');
      if (target) {
        const wrap = document.createElement('div'); wrap.className = 'contact-social-links';
        v.links.slice(0,8).forEach(link => {
          const href = safeExternalUrl(link.url);
          if (!href || !link.label) return;
          const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `${String(link.label).slice(0,40)} ↗`; wrap.append(a);
        });
        target.querySelector('.contact-social-links')?.remove();
        if (wrap.childElementCount) target.append(wrap);
      }
    }
  }
}

async function loadPublishedData() {
  if (!supabaseConfigured) return;
  try {
    const client = await getSupabase();
    const [sectionsResult, projectsResult, skillsResult, educationResult, journeyResult, goalsResult, contentResult, settingsResult] = await Promise.all([
      client.from('site_sections').select('key,title_ar,title_en,description_ar,description_en,body_ar,body_en,is_visible,sort_order').eq('is_visible', true).order('sort_order'),
      client.from('projects').select('id,title_ar,title_en,summary_ar,summary_en,category,image_url,image_alt,live_url,github_url,sort_order').eq('published', true).order('sort_order'),
      client.from('skills').select('id,name_ar,name_en,category,description_ar,description_en,sort_order').eq('is_visible', true).order('sort_order'),
      client.from('education_entries').select('id,institution_ar,institution_en,program_ar,program_en,detail_ar,detail_en,start_date,end_date,is_current,sort_order').eq('is_visible', true).order('sort_order'),
      client.from('journey_milestones').select('id,title_ar,title_en,description_ar,description_en,milestone_date,tag,sort_order').eq('is_visible', true).order('sort_order'),
      client.from('personal_goals').select('id,title_ar,title_en,description_ar,description_en,priority,status,sort_order').eq('status', 'active').order('sort_order'),
      client.from('content_items').select('id,item_type,title_ar,title_en,description_ar,description_en,url,image_url,creator_label,sort_order').eq('published', true).order('sort_order'),
      client.from('site_settings').select('setting_key,value').eq('is_public', true)
    ]);
    if (sectionsResult.error) throw sectionsResult.error;
    if (sectionsResult.data?.length) { state.sectionRows = sectionsResult.data; applySectionRows(state.sectionRows); }
    if (!projectsResult.error && Array.isArray(projectsResult.data)) state.projects = projectsResult.data;
    if (!skillsResult.error && skillsResult.data?.length) { state.skills = skillsResult.data; renderSkills(state.skills); }
    if (!educationResult.error && educationResult.data?.length) { state.education = educationResult.data; renderEducation(state.education); }
    if (!journeyResult.error && journeyResult.data?.length) { state.journey = journeyResult.data; renderJourney(state.journey); }
    if (!goalsResult.error && goalsResult.data?.length) { state.goals = goalsResult.data; renderGoals(state.goals); }
    if (!contentResult.error && contentResult.data?.length) { state.contentItems = contentResult.data; renderContentItems(state.contentItems); }
    if (!settingsResult.error && settingsResult.data?.length) { state.publicSettings = settingsResult.data; applyPublicSettings(state.publicSettings); }
    renderProjects();
  } catch (error) {
    console.warn('[KhaledHany] Published content could not be refreshed:', error.message);
  }
}

async function setupContactForm() {
  const form = $('#contactForm');
  const button = $('#sendButton');
  if (!supabaseConfigured) return;
  try {
    const client = await getSupabase();
    if (!client) return;
    button.disabled = false;
    $('#contactStatus').querySelector('span').textContent = state.lang === 'ar' ? 'نموذج التواصل جاهز بعد إعداد الخدمة' : 'Contact service configured';
    $('#contactStatus').querySelector('i').style.background = 'var(--green)';
  } catch (error) {
    console.warn('[KhaledHany] Supabase client unavailable:', error.message);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const feedback = $('#formFeedback');
    feedback.classList.remove('error');
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.name = String(payload.name || '').trim();
    payload.email = String(payload.email || '').trim();
    payload.message = String(payload.message || '').trim();
    if (payload.name.length < 2 || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.message.length < 10) {
      feedback.classList.add('error');
      feedback.textContent = state.lang === 'ar' ? 'راجع الاسم والبريد، واكتب رسالة لا تقل عن 10 أحرف.' : 'Check your name and email, and enter a message of at least 10 characters.';
      return;
    }
    button.disabled = true;
    button.dataset.original = button.textContent;
    button.textContent = state.lang === 'ar' ? 'جارٍ الإرسال…' : 'Sending…';
    try {
      const client = await getSupabase();
      const { data, error } = await client.functions.invoke('contact', { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'The server did not confirm message storage.');
      feedback.textContent = state.lang === 'ar' ? 'تم حفظ رسالتك بنجاح.' : 'Your message was stored successfully.';
      if (data.emailSent === false) feedback.textContent += state.lang === 'ar' ? ' لم يتم تأكيد إرسال إشعار البريد.' : ' Email notification was not confirmed.';
      form.reset();
    } catch (error) {
      feedback.classList.add('error');
      feedback.textContent = state.lang === 'ar' ? `تعذّر تأكيد حفظ الرسالة: ${error.message}` : `Message storage could not be confirmed: ${error.message}`;
    } finally {
      button.disabled = false;
      button.innerHTML = `<span>${state.lang === 'ar' ? 'إرسال الرسالة' : 'Send message'}</span><span>↗</span>`;
    }
  });
}

const localHeroImages = ['./assets/images/me.jpg', './assets/images/me.jpeg', './assets/images/me.png', './assets/images/me.webp'];

async function loadHeroPhoto(preferredUrl = '') {
  const frame = $('#heroPortrait');
  const image = $('#heroPhoto');
  if (!frame || !image) return;
  const candidates = preferredUrl ? [preferredUrl, ...localHeroImages] : localHeroImages;
  for (const candidate of candidates) {
    let resolved;
    try { resolved = new URL(candidate, document.baseURI).href; } catch { continue; }
    try {
      const probe = await fetch(resolved, { method: 'HEAD', cache: 'no-store' });
      if (!probe.ok) continue;
    } catch { continue; }
    if (state.heroImage === resolved && !image.hidden) return;
    image.src = resolved;
    image.alt = state.lang === 'ar' ? 'صورة خالد هاني' : 'Khaled Hany portrait';
    image.hidden = false;
    frame.classList.add('has-photo');
    state.heroImage = resolved;
    return;
  }
  image.hidden = true;
  image.removeAttribute('src');
  frame.classList.remove('has-photo');
  state.heroImage = '';
}

async function boot() {
  setupNavigation();
  setupAppearance();
  applyLanguage();
  setupProjectFilters();
  renderProjects();
  await loadHeroPhoto();
  if (supabaseConfigured) await loadPublishedData();
  await setupContactForm();
}

boot().catch(error => {
  console.error('[KhaledHany] Startup error:', error);
  toast(state.lang === 'ar' ? 'حدث خطأ أثناء تحميل أحد المكونات. ما زال محتوى الموقع متاحًا.' : 'A component failed to load. The website content remains available.');
});
