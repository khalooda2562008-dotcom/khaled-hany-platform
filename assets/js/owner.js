import { getSupabase, supabaseConfigured, safeExternalUrl } from './supabase.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = { client: null, user: null, role: null, sections: [], projects: [], media: [], messages: [], view: 'overview', editing: null, collection: 'skills', collectionRows: [], assetResults: [] };
const toast = (message, error = false) => { const n = $('#toast'); n.textContent = message; n.style.background = error ? '#ffccd2' : '#d8f5f2'; n.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => n.classList.remove('show'), 3500); };
const setBusy = (button, busy, label) => { if (!button) return; button.disabled = busy; if (label) button.dataset.oldLabel ??= button.textContent; button.textContent = busy ? 'جارٍ التنفيذ…' : (button.dataset.oldLabel || label || button.textContent); if (!busy) delete button.dataset.oldLabel; };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateLabel = value => value ? new Intl.DateTimeFormat('ar-EG', {dateStyle:'medium', timeStyle:'short'}).format(new Date(value)) : '—';
const requiredRole = ['owner','administrator','editor'];

function setNotice(message, error = false) { const box = $('#authNotice'); if (!box) return; box.textContent = message; box.style.borderColor = error ? '#74414c' : ''; box.style.color = error ? '#ffb7c0' : ''; }
function setConnection(online, text) { const el = $('#connectionState'); el.textContent = `● ${text}`; el.classList.toggle('online', online); }
function showDashboard() { $('#authScreen').hidden = true; $('#dashboard').hidden = false; }
function showLogin() { $('#dashboard').hidden = true; $('#authScreen').hidden = false; }
function setView(view) {
  if (view === 'sections' && state.role === 'editor') view = 'projects';
  state.view = view;
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const active = $(`.nav-item[data-view="${view}"] span`);
  $('#viewTitle').textContent = active?.textContent || 'مركز التحكم';
  $('#sidebar').classList.remove('open');
  if (view === 'sections') { loadSections(); loadCollection(state.collection); }
  if (view === 'projects') loadProjects();
  if (view === 'media') loadMedia();
  if (view === 'messages') loadMessages();
  if (view === 'users') loadRoles();
  if (view === 'activity') loadActivity();
  if (view === 'settings') loadSettings();
}

async function authenticate() {
  if (!supabaseConfigured) {
    setNotice('إعداد Supabase غير مكتمل. ضع Project URL وAnon Key في config.js ثم أعد تحميل الصفحة.', true);
    setConnection(false, 'غير مهيّأ'); return;
  }
  try {
    state.client = await getSupabase();
    const { data: { session }, error } = await state.client.auth.getSession();
    if (error) throw error;
    if (session?.user) await authorize(session.user);
    else { setConnection(false, 'في انتظار تسجيل الدخول'); }
  } catch (error) { setNotice(`تعذّر الاتصال بخدمة المصادقة: ${error.message}`, true); setConnection(false, 'خطأ اتصال'); }
}

async function authorize(user) {
  state.user = user;
  const { data, error } = await state.client.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (error) {
    if (error.code === '42P01' || error.message?.includes('user_roles')) setNotice('الجداول غير جاهزة. نفّذ ملف SQL migration أولًا.', true);
    else setNotice(`تعذّر التحقق من الصلاحيات: ${error.message}`, true);
    await state.client.auth.signOut(); state.user = null; setConnection(false, 'فشل التحقق'); return;
  }
  if (!data?.role || !requiredRole.includes(data.role)) {
    setNotice('تم تسجيل الدخول، لكن هذا الحساب لا يمتلك صلاحية دخول لوحة التحكم. اطلب من المالك تعيين دور مناسب.', true);
    await state.client.auth.signOut(); state.user = null; setConnection(false, 'غير مصرّح'); return;
  }
  state.role = data.role;
  $('#accountButton').title = `${user.email || user.id} · ${state.role} · تسجيل الخروج`;
  showDashboard(); setConnection(true, `متصل · ${state.role}`);
  $('#settingsUrl').textContent = window.KH_CONFIG?.supabaseUrl || 'غير مضبوط';
  $('#settingsAnon').textContent = window.KH_CONFIG?.supabaseAnonKey ? 'موجود (عام)' : 'غير مضبوط';
  const roleManager = state.role === 'owner';
  $('[data-view="users"]').hidden = !roleManager;
  $('[data-view="settings"]').hidden = !roleManager;
  $('[data-view="sections"]').hidden = state.role === 'editor';
  $$('[data-open-view="sections"]').forEach(el => el.hidden = state.role === 'editor');
  $('[data-view="messages"]').hidden = state.role === 'editor';
  await refreshOverview();
}

async function loadSections() {
  if (!state.client) return;
  const tbody = $('#sectionsTable'); tbody.innerHTML = '<tr><td colspan="6">جارٍ تحميل الأقسام…</td></tr>';
  const { data, error } = await state.client.from('site_sections').select('id,key,title_ar,title_en,description_ar,description_en,body_ar,body_en,is_visible,sort_order,updated_at').order('sort_order');
  if (error) { tbody.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }
  state.sections = data || []; renderSections();
}
function renderSections() {
  const q = ($('#sectionSearch').value || '').toLowerCase();
  const rows = state.sections.filter(x => [x.key,x.title_ar,x.title_en].some(v => String(v||'').toLowerCase().includes(q)));
  $('#sectionCount').textContent = `${rows.length} قسم`;
  $('#sectionsTable').innerHTML = rows.length ? rows.map(x => `<tr><td><code>${escapeHTML(x.key)}</code></td><td>${escapeHTML(x.title_ar)}</td><td>${escapeHTML(x.title_en)}</td><td>${Number(x.sort_order)||0}</td><td><span class="status-chip ${x.is_visible?'':'off'}">${x.is_visible?'ظاهر':'مخفي'}</span></td><td><div class="table-actions"><button class="small-action" data-edit-section="${x.id}">تعديل</button><button class="small-action" data-history-table="site_sections" data-history-id="${x.id}">النسخ</button><button class="small-action" data-toggle-section="${x.id}">${x.is_visible?'إخفاء':'إظهار'}</button></div></td></tr>`).join('') : '<tr><td colspan="6">لا توجد نتائج.</td></tr>';
}
function openEditor(title, eyebrow, fields, record, onSave) {
  const form = $('#editorForm'); state.editing = { record, onSave };
  $('#editorTitle').textContent = title; $('#editorEyebrow').textContent = eyebrow;
  $('#editorFields').innerHTML = fields.map(f => {
    const value = record?.[f.name] ?? f.value ?? '';
    if (f.type === 'checkbox') return `<label class="check-field"><input type="checkbox" name="${f.name}" ${value ? 'checked' : ''}> ${f.label}</label>`;
    if (f.type === 'select') return `<label class="${f.full===false?'':'full'}">${f.label}<select name="${f.name}">${f.options.map(o=>`<option value="${escapeHTML(o.value)}" ${String(o.value)===String(value)?'selected':''}>${escapeHTML(o.label)}</option>`).join('')}</select></label>`;
    if (f.type === 'textarea') return `<label class="${f.full===false?'':'full'}">${f.label}<textarea name="${f.name}" maxlength="${f.maxlength||8000}" ${f.required?'required':''}>${escapeHTML(value)}</textarea></label>`;
    return `<label class="${f.full===false?'':'full'}">${f.label}<input name="${f.name}" type="${f.type||'text'}" value="${escapeHTML(value)}" maxlength="${f.maxlength||500}" ${f.required?'required':''} ${f.placeholder?`placeholder="${escapeHTML(f.placeholder)}"`:''}></label>`;
  }).join('');
  $('#editorDialog').showModal();
}
function closeEditor() { $('#editorDialog').close(); state.editing = null; }
$('#editorForm').addEventListener('submit', async e => {
  e.preventDefault(); if (!state.editing) return;
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  $$('input[type=checkbox]', $('#editorFields')).forEach(el => data[el.name] = el.checked);
  const submit = $('button[type=submit]', e.currentTarget); setBusy(submit, true);
  try { await state.editing.onSave(data); closeEditor(); toast('تم حفظ التغييرات بنجاح.'); }
  catch (error) { toast(`لم يتم الحفظ: ${error.message}`, true); }
  finally { setBusy(submit, false); }
});
$('#closeEditor').onclick = closeEditor; $('#cancelEditor').onclick = closeEditor;

function sectionFields() { return [
  {name:'key',label:'مفتاح القسم (إنجليزي)',required:true,placeholder:'about'},
  {name:'sort_order',label:'ترتيب القسم',type:'number',value:10,full:false},
  {name:'title_ar',label:'العنوان العربي',required:true},
  {name:'title_en',label:'العنوان الإنجليزي',required:true},
  {name:'description_ar',label:'الوصف العربي',type:'textarea'},
  {name:'description_en',label:'الوصف الإنجليزي',type:'textarea'},
  {name:'body_ar',label:'المحتوى العربي',type:'textarea'},
  {name:'body_en',label:'المحتوى الإنجليزي',type:'textarea'},
  {name:'is_visible',label:'إظهار القسم للعامة',type:'checkbox'}
]; }
function editSection(id) {
  const record = state.sections.find(x=>x.id===id) || {is_visible:true,sort_order:state.sections.length+1};
  openEditor(id?'تعديل القسم':'إضافة قسم','PAGE CONTENT / BILINGUAL',sectionFields(),record,async form => {
    const payload = {...form, sort_order:Number(form.sort_order)||0};
    const query = id ? state.client.from('site_sections').update(payload).eq('id',id) : state.client.from('site_sections').insert(payload);
    const {error}=await query; if(error) throw error; await loadSections(); 
  });
}
$('#newSection').onclick=()=>editSection(null);
$('#sectionsTable').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit-section]'),toggle=e.target.closest('[data-toggle-section]');
 if(edit) editSection(edit.dataset.editSection);
 const history=e.target.closest('[data-history-table]'); if(history) showRevisionHistory(history.dataset.historyTable,history.dataset.historyId);
 if(toggle){const x=state.sections.find(v=>v.id===toggle.dataset.toggleSection);if(!x)return;const {error}=await state.client.from('site_sections').update({is_visible:!x.is_visible}).eq('id',x.id);if(error)toast(error.message,true);else{toast('تم تحديث ظهور القسم.');loadSections();}}
});
$('#sectionSearch').addEventListener('input',renderSections);

async function showRevisionHistory(table,recordId){
 if(!['site_sections','projects','personal_goals','content_items','skills','education_entries','journey_milestones'].includes(table))return;
 if(state.role==='editor')return;
 $('#revisionList').innerHTML='<div class="empty-state">جارٍ تحميل النسخ السابقة…</div>';
 $('#revisionDialog').showModal();
 const {data,error}=await state.client.from('content_revisions').select('id,revision_number,content_snapshot,created_at,changed_by').eq('table_name',table).eq('record_id',recordId).order('revision_number',{ascending:false}).limit(30);
 if(error){$('#revisionList').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}
 $('#revisionList').innerHTML=(data||[]).length?data.map(r=>`<div class="timeline-event"><i></i><div><strong>النسخة رقم ${r.revision_number}</strong><small>${dateLabel(r.created_at)} · ${escapeHTML(r.content_snapshot?.title_ar||r.content_snapshot?.key||r.content_snapshot?.name_ar||'محتوى سابق')}</small></div><button class="small-action" data-restore-revision="${r.id}" data-table="${table}" data-record="${recordId}">استعادة</button></div>`).join(''):'<div class="empty-state">لا توجد نسخ سابقة محفوظة لهذا العنصر حتى الآن. يبدأ حفظ النسخ بعد أول تعديل.</div>';
}
$('#closeRevisions').onclick=()=>$('#revisionDialog').close();
$('#revisionList').addEventListener('click',async e=>{
 const button=e.target.closest('[data-restore-revision]');if(!button)return;
 if(!confirm('استعادة هذه النسخة؟ سيتم حفظ الحالة الحالية كنسخة جديدة قبل الاستعادة.'))return;
 const {error}=await state.client.rpc('restore_content_revision',{target_table:button.dataset.table,target_record:button.dataset.record,target_revision:button.dataset.restoreRevision});
 if(error){toast(error.message,true);return;}
 toast('تمت استعادة النسخة.');$('#revisionDialog').close();
 if(button.dataset.table==='site_sections')loadSections();else if(button.dataset.table==='projects')loadProjects();else loadCollection(button.dataset.table);
 
});

const collectionConfig = {
 skills: {title:'المهارة / الاهتمام', fields:[
  {name:'name_ar',label:'الاسم بالعربية',required:true},{name:'name_en',label:'Name (English)',required:true},
  {name:'category',label:'الفئة',full:false},{name:'sort_order',label:'الترتيب',type:'number',full:false},
  {name:'description_ar',label:'وصف عربي',type:'textarea'},{name:'description_en',label:'English description',type:'textarea'},
  {name:'is_visible',label:'ظاهر للعامة',type:'checkbox'}], label:r=>r.name_ar||r.name_en, subtitle:r=>r.category},
 education_entries: {title:'السجل الدراسي', fields:[
  {name:'institution_ar',label:'المؤسسة بالعربية',required:true},{name:'institution_en',label:'Institution (English)',required:true},
  {name:'program_ar',label:'التخصص بالعربية',required:true},{name:'program_en',label:'Program (English)',required:true},
  {name:'detail_ar',label:'تفاصيل عربية',type:'textarea'},{name:'detail_en',label:'English details',type:'textarea'},
  {name:'start_date',label:'تاريخ البداية',type:'date',full:false},{name:'end_date',label:'تاريخ النهاية',type:'date',full:false},
  {name:'sort_order',label:'الترتيب',type:'number',full:false},{name:'is_current',label:'الدراسة الحالية',type:'checkbox',full:false},{name:'is_visible',label:'ظاهر للعامة',type:'checkbox'}], label:r=>r.institution_ar||r.institution_en, subtitle:r=>r.program_ar||r.program_en},
 journey_milestones: {title:'محطة في الرحلة', fields:[
  {name:'title_ar',label:'العنوان بالعربية',required:true},{name:'title_en',label:'Title (English)',required:true},
  {name:'description_ar',label:'الوصف العربي',type:'textarea'},{name:'description_en',label:'English description',type:'textarea'},
  {name:'milestone_date',label:'التاريخ',type:'date',full:false},{name:'tag',label:'وسم',full:false},{name:'sort_order',label:'الترتيب',type:'number',full:false},{name:'is_visible',label:'ظاهر للعامة',type:'checkbox'}], label:r=>r.title_ar||r.title_en, subtitle:r=>r.tag||r.milestone_date||''},
 personal_goals: {title:'هدف شخصي', fields:[
  {name:'title_ar',label:'العنوان بالعربية',required:true},{name:'title_en',label:'Title (English)',required:true},
  {name:'description_ar',label:'الوصف العربي',type:'textarea'},{name:'description_en',label:'English description',type:'textarea'},
  {name:'priority',label:'الأولوية',type:'select',full:false,options:[1,2,3,4,5].map(v=>({value:v,label:String(v)}))},
  {name:'status',label:'الحالة',type:'select',full:false,options:[{value:'active',label:'نشط'},{value:'done',label:'مكتمل'},{value:'paused',label:'متوقف'}]},
  {name:'sort_order',label:'الترتيب',type:'number',full:false}], label:r=>r.title_ar||r.title_en, subtitle:r=>r.status},
 content_items: {title:'عنصر محتوى', fields:[
  {name:'item_type',label:'النوع',type:'select',full:false,options:[{value:'video',label:'فيديو'},{value:'article',label:'مقال'},{value:'resource',label:'مورد تعليمي'},{value:'social',label:'رابط اجتماعي'}]},
  {name:'sort_order',label:'الترتيب',type:'number',full:false},
  {name:'title_ar',label:'العنوان بالعربية',required:true},{name:'title_en',label:'Title (English)',required:true},
  {name:'description_ar',label:'الوصف العربي',type:'textarea'},{name:'description_en',label:'English description',type:'textarea'},
  {name:'url',label:'الرابط الأصلي',type:'url',required:true},{name:'image_url',label:'رابط صورة اختياري',type:'url'},
  {name:'creator_label',label:'القناة / الناشر',full:true},{name:'status',label:'حالة النشر',type:'select',options:[{value:'draft',label:'مسودة'},{value:'review',label:'بانتظار المراجعة'},{value:'published',label:'منشور'},{value:'archived',label:'مؤرشف'}]}], label:r=>r.title_ar||r.title_en, subtitle:r=>r.item_type}
};
async function loadCollection(name=state.collection){
 if(!state.client||!collectionConfig[name])return;state.collection=name;
 $$('.collection-tabs [data-collection]').forEach(b=>b.classList.toggle('active',b.dataset.collection===name));
 $('#structuredList').innerHTML='<div class="empty-state">جارٍ تحميل المحتوى…</div>';
 const {data,error}=await state.client.from(name).select('*').order('sort_order');
 if(error){$('#structuredList').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}
 state.collectionRows=data||[];renderCollection();
}
function renderCollection(){const cfg=collectionConfig[state.collection];$('#structuredList').innerHTML=state.collectionRows.length?state.collectionRows.map(x=>`<div class="compact-row"><div><strong>${escapeHTML(cfg.label(x))}</strong><small>${escapeHTML(cfg.subtitle(x)||'—')}</small></div><span class="tag push">${x.is_visible===false?'HIDDEN':(x.published===false?'DRAFT':escapeHTML(x.status||'ACTIVE'))}</span><div class="table-actions"><button class="small-action" data-edit-collection="${x.id}">تعديل</button>${state.role!=='editor'?`<button class="small-action" data-history-table="${state.collection}" data-history-id="${x.id}">النسخ</button>`:''}${['owner','administrator'].includes(state.role)?`<button class="small-action danger" data-delete-collection="${x.id}">حذف</button>`:''}</div></div>`).join(''):'<div class="empty-state">لا توجد عناصر. أضف المحتوى الحقيقي الذي تريد عرضه.</div>';}
function editCollection(id){const cfg=collectionConfig[state.collection],record=state.collectionRows.find(x=>x.id===id)||{is_visible:true,sort_order:state.collectionRows.length+1,priority:3,status:state.collection==='content_items'?'draft':'active',published:false};openEditor(id?'تعديل المحتوى':`إضافة ${cfg.title}`,'STRUCTURED CONTENT / CMS',cfg.fields,record,async form=>{if(form.sort_order!==undefined)form.sort_order=Number(form.sort_order)||0;if(form.priority!==undefined)form.priority=Number(form.priority)||3;if(state.collection==='content_items'){if(!safeExternalUrl(form.url))throw new Error('الرابط الأصلي يجب أن يبدأ بـ http أو https.');if(form.image_url&&!safeExternalUrl(form.image_url))throw new Error('رابط الصورة غير صالح.');form.image_url=form.image_url||null;form.published=form.status==='published';}const {error}=id?await state.client.from(state.collection).update(form).eq('id',id):await state.client.from(state.collection).insert(form);if(error)throw error;await loadCollection(state.collection);});}
$('#collectionTabs').addEventListener('click',e=>{const b=e.target.closest('[data-collection]');if(b)loadCollection(b.dataset.collection);});
$('#addStructured').onclick=()=>editCollection(null);
$('#structuredList').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-collection]'),del=e.target.closest('[data-delete-collection]');if(edit)editCollection(edit.dataset.editCollection);const history=e.target.closest('[data-history-table]');if(history)showRevisionHistory(history.dataset.historyTable,history.dataset.historyId);if(del){const item=state.collectionRows.find(x=>x.id===del.dataset.deleteCollection);if(!item||!confirm('حذف هذا العنصر نهائيًا؟'))return;const {error}=await state.client.from(state.collection).delete().eq('id',item.id);if(error)toast(error.message,true);else{toast('تم حذف العنصر.');loadCollection(state.collection);}}});

async function loadProjects() {
 if(!state.client)return; $('#projectList').innerHTML='<div class="empty-state">جارٍ تحميل المشاريع…</div>';
 const {data,error}=await state.client.from('projects').select('*').order('sort_order');
 if(error){$('#projectList').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}
 state.projects=data||[];renderProjects();
}
function renderProjects(){const q=($('#projectSearch').value||'').toLowerCase();const list=state.projects.filter(p=>[p.title_ar,p.title_en,p.category].some(v=>String(v||'').toLowerCase().includes(q)));$('#projectCount').textContent=`${list.length} مشروع`;
 $('#projectList').innerHTML=list.length?list.map(p=>`<article class="project-admin-card">${p.image_url?`<img class="project-thumb" src="${escapeHTML(safeExternalUrl(p.image_url)||'')}" alt="">`:'<div class="project-thumb"></div>'}<div><strong>${escapeHTML(p.title_ar||p.title_en)}</strong><small>${escapeHTML(p.category||'—')} · ${p.published?'منشور':'مسودة'}</small></div><div class="table-actions"><button class="small-action" data-edit-project="${p.id}">تعديل</button>${state.role!=='editor'?`<button class="small-action" data-history-table="projects" data-history-id="${p.id}">النسخ</button>`:''}${['owner','administrator'].includes(state.role)?`<button class="small-action danger" data-delete-project="${p.id}">حذف</button>`:''}</div></article>`).join(''):'<div class="empty-state">لا توجد مشاريع. أضف أول مشروع حقيقي عندما يكون جاهزًا.</div>';
}
function projectFields(){const isEditor=state.role==='editor';return[
 {name:'title_ar',label:'اسم المشروع بالعربية',required:true},{name:'title_en',label:'Project title (English)',required:true},
 {name:'summary_ar',label:'الوصف العربي',type:'textarea'},{name:'summary_en',label:'English summary',type:'textarea'},
 {name:'category',label:'التصنيف',type:'select',options:[{value:'ai',label:'AI'},{value:'web',label:'Web'},{value:'tools',label:'Tools'},{value:'other',label:'Other'}],full:false},
 {name:'sort_order',label:'الترتيب',type:'number',full:false},
 {name:'image_url',label:'رابط الصورة',full:true},{name:'image_alt',label:'وصف الصورة',full:true},
 {name:'live_url',label:'رابط المعاينة',type:'url',full:true},{name:'github_url',label:'رابط GitHub',type:'url',full:true},
 ...(isEditor?[{name:'status',label:'حالة الطلب',type:'select',options:[{value:'draft',label:'مسودة خاصة'},{value:'review',label:'إرسال للمالك للمراجعة'}]}]:[{name:'published',label:'نشر المشروع على الموقع',type:'checkbox'}])
];}
function editProject(id){const p=state.projects.find(x=>x.id===id)||{category:'web',sort_order:state.projects.length+1,published:false,status:'draft'};openEditor(id?'تعديل المشروع':'إضافة مشروع','PROJECT / PORTFOLIO',projectFields(),p,async form=>{const payload={...form,sort_order:Number(form.sort_order)||0,updated_by:state.user.id};for(const key of ['image_url','live_url','github_url']){if(payload[key]&&!safeExternalUrl(payload[key]))throw new Error(`الرابط غير صالح في ${key}`);payload[key]=payload[key]||null;}if(state.role==='editor'){payload.published=false;payload.status=['draft','review'].includes(payload.status)?payload.status:'draft';if(!id)payload.created_by=state.user.id;}else{payload.published=Boolean(payload.published);payload.status=payload.published?'published':'draft';if(!id)payload.created_by=state.user.id;}const {error}=id?await state.client.from('projects').update(payload).eq('id',id):await state.client.from('projects').insert(payload);if(error)throw error;await loadProjects();});}
$('#newProject').onclick=()=>editProject(null);$('#projectSearch').addEventListener('input',renderProjects);
$('#projectList').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-project]'),del=e.target.closest('[data-delete-project]');if(edit)editProject(edit.dataset.editProject);const history=e.target.closest('[data-history-table]');if(history)showRevisionHistory(history.dataset.historyTable,history.dataset.historyId);if(del){const p=state.projects.find(x=>x.id===del.dataset.deleteProject);if(!p||!confirm(`حذف المشروع «${p.title_ar||p.title_en}» نهائيًا؟`))return;const {error}=await state.client.from('projects').delete().eq('id',p.id);if(error)toast(error.message,true);else{toast('تم حذف المشروع.');loadProjects();}}});

async function loadMedia(){if(!state.client)return;$('#mediaLibrary').innerHTML='<div class="empty-state">جارٍ تحميل مكتبة الوسائط…</div>';const {data,error}=await state.client.from('media_assets').select('*').order('created_at',{ascending:false}).limit(100);if(error){$('#mediaLibrary').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}state.media=data||[];renderMedia();}
function renderMedia(){
 $('#mediaCount').textContent=`${state.media.length} ملف`;
 $('#mediaLibrary').innerHTML=state.media.length?state.media.map(m=>{
  const imageAsset=String(m.mime_type||'').startsWith('image/')||m.asset_kind==='image';
  return `<article class="media-item">${m.public_url&&/^https?:/.test(m.public_url)?`<img src="${escapeHTML(m.public_url)}" alt="${escapeHTML(m.alt_text||'')}">`:'<div class="asset-placeholder">3D / FILE</div>'}<div><strong>${escapeHTML(m.title||m.file_name||'Asset')}</strong><small>${escapeHTML(m.provider||'Upload')} · ${escapeHTML(m.license||'غير محدد')}</small><small>${escapeHTML(m.source_url||m.storage_path||'')}</small><div class="table-actions"><button class="small-action" data-copy-media="${m.id}">نسخ الرابط</button>${state.role==='owner'&&imageAsset?`<button class="small-action" data-use-hero="${m.id}">خلفية الواجهة</button>`:''}<button class="small-action danger" data-delete-media="${m.id}">حذف</button></div></div></article>`;
 }).join(''):'<div class="empty-state">لا توجد وسائط محفوظة. ابحث عن مصدر أو ارفع ملفًا.</div>';
}
$('#mediaUpload').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{await uploadMedia(file);}catch(error){toast(error.message,true);}finally{e.target.value='';}});
async function uploadMedia(file){
 if(file.size>50*1024*1024)throw new Error('الحد الأقصى لحجم الملف 50MB.');
 const extension=file.name.split('.').pop()?.toLowerCase()||'';
 const mimeByExtension={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',glb:'model/gltf-binary',hdr:'image/vnd.radiance',exr:'image/x-exr',ktx2:'image/ktx2'};
 const allowed=['image/png','image/jpeg','image/webp','model/gltf-binary','image/vnd.radiance','image/x-exr','image/ktx2'];
 const mediaType=allowed.includes(file.type)?file.type:(mimeByExtension[extension]||'');
 if(!allowed.includes(mediaType))throw new Error('نوع الملف غير مدعوم. استخدم PNG أو JPEG أو WebP أو GLB أو HDR أو EXR أو KTX2.');
 const assetKind=mediaType==='model/gltf-binary'?'3D model':mediaType==='image/vnd.radiance'||mediaType==='image/x-exr'?'HDRI':mediaType==='image/ktx2'?'texture':'image';
 const safeName=file.name.replace(/[^\p{L}\p{N}._-]/gu,'_');
 const path=`${state.user.id}/${crypto.randomUUID()}-${safeName}`;
 const {data,error}=await state.client.storage.from('site-media').upload(path,file,{upsert:false,contentType:mediaType});
 if(error)throw error;
 const {data:pub}=state.client.storage.from('site-media').getPublicUrl(data.path);
 const {error:dbError}=await state.client.from('media_assets').insert({title:file.name,file_name:file.name,mime_type:mediaType,file_size:file.size,storage_path:data.path,public_url:pub.publicUrl,asset_kind:assetKind,provider:'upload',license:'owner-upload',source_url:null,imported_by:state.user.id});
 if(dbError){await state.client.storage.from('site-media').remove([data.path]);throw dbError;}
 toast('تم رفع الملف وحفظ بياناته.');await loadMedia();
}
$('#mediaLibrary').addEventListener('click',async e=>{
 const copy=e.target.closest('[data-copy-media]'),hero=e.target.closest('[data-use-hero]'),del=e.target.closest('[data-delete-media]');
 if(copy){const m=state.media.find(x=>x.id===copy.dataset.copyMedia),url=safeExternalUrl(m?.public_url);if(!url)return toast('لا يوجد رابط صالح لهذا الملف.',true);try{await navigator.clipboard.writeText(url);toast('تم نسخ رابط الوسيط.');}catch{toast('تعذّر النسخ؛ افتح الملف وانسخ رابطه يدويًا.',true);}return;}
 if(hero){if(state.role!=='owner')return toast('تغيير إعدادات الواجهة متاح للمالك فقط.',true);const m=state.media.find(x=>x.id===hero.dataset.useHero),url=safeExternalUrl(m?.public_url);if(!m||!url||!(String(m.mime_type||'').startsWith('image/')||m.asset_kind==='image'))return toast('اختر صورة صالحة من مكتبة الوسائط.',true);if(!confirm('تأكيد أن لديك حق استخدام هذه الصورة كخلفية عامة للموقع؟'))return;const {data:record,error:readError}=await state.client.from('site_settings').select('value,is_public').eq('setting_key','site_brand').maybeSingle();if(readError)return toast(readError.message,true);if(!record)return toast('إعداد site_brand غير موجود.',true);const value={...(record.value||{}),hero_image_url:url};const {error}=await state.client.from('site_settings').update({value,is_public:true,updated_by:state.user.id}).eq('setting_key','site_brand');if(error)return toast(error.message,true);toast('تم تعيين الصورة لخلفية الواجهة الرئيسية.');return;}
 if(del){const m=state.media.find(x=>x.id===del.dataset.deleteMedia);if(!m||!confirm('حذف سجل الوسيط؟ إذا كان له مسار تخزين سيتم حذف الملف أيضًا.'))return;let storageError=null;if(m.storage_path){const r=await state.client.storage.from('site-media').remove([m.storage_path]);storageError=r.error;}const {error}=await state.client.from('media_assets').delete().eq('id',m.id);if(error||storageError)toast((error||storageError).message,true);else{toast('تم الحذف.');loadMedia();}}
});

async function searchCommons(query){const url=new URL('https://commons.wikimedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:`${query} filetype:bitmap`,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'520'});const r=await fetch(url);if(!r.ok)throw new Error('Wikimedia Commons search failed');const json=await r.json();return Object.values(json.query?.pages||{}).map(p=>{const info=p.imageinfo?.[0]||{},meta=info.extmetadata||{};return{provider:'Wikimedia Commons',id:p.pageid,title:p.title?.replace(/^File:/,''),preview:info.thumburl||info.url,source:info.descriptionurl,download:info.url,creator:meta.Artist?.value?.replace(/<[^>]*>/g,'')||'غير محدد',license:meta.LicenseShortName?.value||meta.License?.value||'غير محدد',attribution:meta.AttributionRequired?.value||'راجع صفحة الملف',kind:'image'};}).filter(x=>x.preview&&x.source);}
async function searchPolyhaven(query){const r=await fetch('https://api.polyhaven.com/assets?t=models');if(!r.ok)throw new Error('Poly Haven API unavailable');const all=await r.json();const q=query.toLowerCase();return Object.entries(all).filter(([id,item])=>(id+' '+(item.name||'')+' '+(item.categories||[]).join(' ')).toLowerCase().includes(q)).slice(0,15).map(([id,item])=>({provider:'Poly Haven',id,title:item.name||id,preview:`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=512`,source:`https://polyhaven.com/a/${encodeURIComponent(id)}`,download:null,creator:'Poly Haven community',license:'CC0 1.0',attribution:'Not required (CC0)',kind:'3D model'}));}
function renderAssetResults(items){$('#assetResults').innerHTML=items.length?items.map((a,i)=>`<article class="asset-card">${a.preview?`<img src="${escapeHTML(a.preview)}" loading="lazy" alt="${escapeHTML(a.title)}">`:'<div class="asset-placeholder">3D</div>'}<div class="asset-card-body"><strong>${escapeHTML(a.title)}</strong><p>${escapeHTML(a.creator)}<br>License: ${escapeHTML(a.license)}</p><div class="asset-meta"><span>${escapeHTML(a.provider)}</span><span>${escapeHTML(a.kind)}</span></div><div class="asset-actions"><button class="small-action" data-preview-asset="${i}">مراجعة</button><button class="small-action" data-save-asset="${i}">حفظ المصدر</button></div></div></article>`).join(''):'<div class="empty-state">لم يتم العثور على نتائج مطابقة.</div>';state.assetResults=items;}
$('#assetSearch').addEventListener('submit',async e=>{e.preventDefault();const query=$('#assetQuery').value.trim(),provider=$('#assetProvider').value;$('#assetResults').innerHTML='<div class="empty-state">جارٍ البحث في المصدر…</div>';try{const tasks=[];if(provider==='all'||provider==='commons')tasks.push(searchCommons(query));if(provider==='all'||provider==='polyhaven')tasks.push(searchPolyhaven(query));if(['unsplash','pexels','pixabay'].includes(provider)){const {data,error}=await state.client.functions.invoke('asset-search',{body:{query,provider}});if(error)throw error;if(data?.error)throw new Error(data.error);tasks.push(Promise.resolve(data.items||[]));}const settled=await Promise.allSettled(tasks);const items=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);const errors=settled.filter(x=>x.status==='rejected');if(!items.length&&errors.length)throw errors[0].reason;renderAssetResults(items);if(errors.length)toast('بعض المصادر لم تستجب؛ تم عرض النتائج المتاحة.',true);}catch(error){$('#assetResults').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}<br>يمكنك رفع ملفك يدويًا أو إعادة المحاولة لاحقًا.</div>`;}});
$('#assetResults').addEventListener('click',async e=>{const preview=e.target.closest('[data-preview-asset]'),save=e.target.closest('[data-save-asset]');const item=state.assetResults?.[Number((preview||save)?.dataset.previewAsset??(preview||save)?.dataset.saveAsset)];if(!item)return;if(preview){$('#previewTitle').textContent=item.title;$('#previewBody').innerHTML=`${item.preview?`<img src="${escapeHTML(item.preview)}" style="width:100%;max-height:55vh;object-fit:contain;border-radius:12px" alt="">`:''}<p>${escapeHTML(item.provider)} · ${escapeHTML(item.kind)}</p><p>المؤلف: ${escapeHTML(item.creator)}<br>الترخيص: ${escapeHTML(item.license)}<br>الإسناد: ${escapeHTML(item.attribution)}</p><a href="${escapeHTML(item.source)}" target="_blank" rel="noopener noreferrer">فتح صفحة المصدر ↗</a>`;$('#assetPreview').showModal();}else{try{const {error}=await state.client.from('media_assets').insert({title:item.title,provider:item.provider,source_url:item.source,public_url:item.preview,license:item.license,creator:item.creator,attribution:item.attribution,asset_kind:item.kind,metadata:{provider_id:item.id,download_url:item.download||null,license_verified:Boolean(item.license_verified),kind:item.kind},imported_by:state.user.id});if(error)throw error;toast('حُفظ مرجع الأصل وترخيصه في مكتبة الوسائط.');await loadMedia();}catch(error){toast(error.message,true);}}});
$('#closePreview').onclick=()=>$('#assetPreview').close();

async function loadMessages(){if(!state.client)return;const {data,error}=await state.client.from('contact_messages').select('id,name,email,message,created_at,read_at,status').order('created_at',{ascending:false}).limit(200);if(error){$('#messagesTable').innerHTML=`<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`;return;}state.messages=data||[];renderMessages();}
function renderMessages(){const q=($('#messageSearch').value||'').toLowerCase(),rows=state.messages.filter(m=>[m.name,m.email,m.message].some(v=>String(v||'').toLowerCase().includes(q)));$('#messagesTable').innerHTML=rows.length?rows.map(m=>{const archived=m.status==='archived';return `<tr><td>${escapeHTML(m.name)}</td><td>${escapeHTML(m.email)}</td><td>${escapeHTML(m.message?.slice(0,120))}${(m.message||'').length>120?'…':''}</td><td>${dateLabel(m.created_at)}</td><td><span class="status-chip ${archived?'off':m.read_at?'':'off'}">${archived?'مؤرشفة':m.read_at?'مقروءة':'جديدة'}</span></td><td><div class="table-actions"><button class="small-action" data-read-message="${m.id}">${m.read_at?'إعادة فتح':'تعليم كمقروءة'}</button><button class="small-action" data-archive-message="${m.id}">${archived?'إلغاء الأرشفة':'أرشفة'}</button><button class="small-action danger" data-delete-message="${m.id}">حذف</button></div></td></tr>`;}).join(''):'<tr><td colspan="6">لا توجد رسائل.</td></tr>';$('#unreadCount').textContent=state.messages.filter(x=>!x.read_at&&x.status!=='archived').length;}
$('#messageSearch').addEventListener('input',renderMessages);$('#messagesTable').addEventListener('click',async e=>{const rd=e.target.closest('[data-read-message]'),archive=e.target.closest('[data-archive-message]'),del=e.target.closest('[data-delete-message]');if(rd){const m=state.messages.find(x=>x.id===rd.dataset.readMessage);const nextReadAt=m.read_at?null:new Date().toISOString();const {error}=await state.client.from('contact_messages').update({read_at:nextReadAt,status:nextReadAt?'read':'new'}).eq('id',m.id);if(error)toast(error.message,true);else{await loadMessages();toast('تم تحديث حالة الرسالة.');}}if(archive){const m=state.messages.find(x=>x.id===archive.dataset.archiveMessage);const nextStatus=m.status==='archived'?(m.read_at?'read':'new'):'archived';const {error}=await state.client.from('contact_messages').update({status:nextStatus,read_at:m.read_at||new Date().toISOString()}).eq('id',m.id);if(error)toast(error.message,true);else{await loadMessages();toast(nextStatus==='archived'?'تمت أرشفة الرسالة.':'تم إلغاء الأرشفة.');}}if(del){if(!confirm('حذف الرسالة نهائيًا؟'))return;const {error}=await state.client.from('contact_messages').delete().eq('id',del.dataset.deleteMessage);if(error)toast(error.message,true);else{await loadMessages();toast('تم حذف الرسالة.');}}});

async function loadRoles(){if(state.role!=='owner')return;const {data,error}=await state.client.from('user_roles').select('user_id,role,created_at').order('created_at');if(error){$('#userRoles').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}$('#userRoles').innerHTML=(data||[]).map(x=>`<div class="compact-row"><div><strong>${escapeHTML(x.user_id)}</strong><small>${dateLabel(x.created_at)}</small></div><span class="tag push">${escapeHTML(x.role)}</span></div>`).join('')||'<div class="empty-state">لا توجد أدوار مسجلة.</div>';}
$('#inviteForm').addEventListener('submit',async e=>{e.preventDefault();if(state.role!=='owner'){toast('هذه العملية للمالك الأساسي فقط.',true);return;}const fd=new FormData(e.currentTarget);const {data,error}=await state.client.functions.invoke('invite-user',{body:{email:fd.get('email'),role:fd.get('role')}});if(error||data?.error)toast(data?.error||error.message,true);else{toast('تم إرسال الدعوة عبر Supabase Auth.');e.currentTarget.reset();loadRoles();}});
$('#aiForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const b=$('button[type=submit]',e.currentTarget);setBusy(b,true);$('#aiResult').hidden=false;$('#aiResult').textContent='جارٍ إرسال الطلب إلى خدمة الذكاء الاصطناعي…';try{const {data,error}=await state.client.functions.invoke('ai-assist',{body:{task:fd.get('task'),language:fd.get('language'),content:fd.get('content')}});if(error||data?.error)throw new Error(data?.error||error.message);$('#aiResult').textContent=data.text||'لم تُرجع الخدمة نصًا.';}catch(error){$('#aiResult').textContent=`تعذّر تشغيل المساعد: ${error.message}`;}finally{setBusy(b,false);}});
$('#roleForm').addEventListener('submit',async e=>{e.preventDefault();if(state.role!=='owner'){toast('هذه العملية للمالك الأساسي فقط.',true);return;}const fd=new FormData(e.currentTarget);const {data,error}=await state.client.rpc('owner_set_role',{target_user_id:fd.get('userId'),new_role:fd.get('role')});if(error)toast(error.message,true);else{toast('تم تحديث الدور.');e.currentTarget.reset();loadRoles();}});

async function loadSettings(){if(!state.client||state.role!=='owner')return;$('#settingsList').innerHTML='<div class="empty-state">جارٍ تحميل إعدادات الموقع…</div>';const {data,error}=await state.client.from('site_settings').select('setting_key,value,is_public,updated_at').order('setting_key');if(error){$('#settingsList').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}state.siteSettings=data||[];renderSettings();}
function renderSettings(){$('#settingsList').innerHTML=state.siteSettings.length?state.siteSettings.map(x=>`<div class="compact-row"><div><strong>${escapeHTML(x.setting_key)}</strong><small>${x.is_public?'Public website setting':'Private setting'} · ${dateLabel(x.updated_at)}</small></div><span class="tag push">${x.is_public?'PUBLIC':'PRIVATE'}</span><div class="table-actions"><button class="small-action" data-edit-setting="${escapeHTML(x.setting_key)}">تعديل JSON</button><button class="small-action danger" data-delete-setting="${escapeHTML(x.setting_key)}">حذف</button></div></div>`).join(''):'<div class="empty-state">لا توجد إعدادات مخصصة. أضف إعدادًا واضح الاسم والبنية.</div>';}
function editSetting(key){const record=state.siteSettings.find(x=>x.setting_key===key)||{setting_key:'site_brand',value:{name_ar:'خالد هاني',name_en:'Khaled Hany'},is_public:true};const fields=[{name:'setting_key',label:'مفتاح الإعداد',required:true},{name:'value_json',label:'القيمة بصيغة JSON',type:'textarea',full:true,required:true},{name:'is_public',label:'السماح للواجهة العامة بقراءة هذا الإعداد',type:'checkbox'}];const prepared={...record,value_json:JSON.stringify(record.value,null,2)};openEditor(key?'تعديل إعداد الموقع':'إضافة إعداد جديد','SITE SETTINGS / JSON',fields,prepared,async form=>{let value;try{value=JSON.parse(form.value_json);}catch{throw new Error('صيغة JSON غير صحيحة.');}if(!/^[a-z][a-z0-9_-]{1,48}$/.test(form.setting_key))throw new Error('مفتاح الإعداد يجب أن يكون إنجليزيًا وبصيغة slug.');const payload={setting_key:form.setting_key,value,is_public:Boolean(form.is_public),updated_by:state.user.id};const {error}=key?await state.client.from('site_settings').update({value,is_public:payload.is_public,updated_by:state.user.id}).eq('setting_key',key):await state.client.from('site_settings').insert(payload);if(error)throw error;await loadSettings();});}
$('#newSetting').onclick=()=>editSetting(null);$('#settingsList').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-setting]'),del=e.target.closest('[data-delete-setting]');if(edit)editSetting(edit.dataset.editSetting);if(del){if(!confirm(`حذف إعداد ${del.dataset.deleteSetting}؟`))return;const {error}=await state.client.from('site_settings').delete().eq('setting_key',del.dataset.deleteSetting);if(error)toast(error.message,true);else{toast('تم حذف الإعداد.');loadSettings();}}});

async function loadActivity(){if(!state.client)return;const {data,error}=await state.client.from('activity_logs').select('id,action,details,created_at').order('created_at',{ascending:false}).limit(100);if(error){$('#activityList').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}$('#activityList').innerHTML=(data||[]).map(x=>`<div class="timeline-event"><i></i><div><strong>${escapeHTML(x.action)}</strong><small>${escapeHTML(JSON.stringify(x.details||{}))}</small></div><time>${dateLabel(x.created_at)}</time></div>`).join('')||'<div class="empty-state">لا توجد أحداث مسجلة بعد.</div>';}

async function refreshOverview(){if(!state.client)return;const results=await Promise.all([
 state.client.from('projects').select('id,published,title_ar,title_en,created_at',{count:'exact'}).eq('published',true).order('created_at',{ascending:false}).limit(5),
 state.client.from('site_sections').select('id,is_visible'),
 state.client.from('contact_messages').select('id,read_at'),
 state.client.from('media_assets').select('id'),
 state.role==='owner'||state.role==='administrator' ? state.client.from('user_roles').select('user_id', {count:'exact',head:true}) : Promise.resolve({count:null,error:{message:'not permitted'}})
]);
 const [p,s,m,a,u]=results;$('#statUsers').textContent=u.error?'—':(u.count ?? 0);$('#statProjects').textContent=p.error?'—':(p.count ?? 0);$('#statSections').textContent=s.error?'—':(s.data||[]).filter(x=>x.is_visible).length;$('#statMessages').textContent=m.error?'—':(m.data||[]).filter(x=>!x.read_at).length;$('#statMedia').textContent=a.error?'—':(a.data||[]).length;
 $('#overviewProjects').innerHTML=p.error?'<div class="empty-state">تعذّر تحميل المشاريع.</div>':(p.data||[]).map(x=>`<div class="compact-row"><div><strong>${escapeHTML(x.title_ar||x.title_en)}</strong><small>${x.published?'منشور':'مسودة'} · ${dateLabel(x.created_at)}</small></div><span class="tag push">${x.published?'PUBLIC':'DRAFT'}</span></div>`).join('')||'<div class="empty-state">لم تضف مشاريع بعد.</div>';
 setHealth('healthDatabase','healthDatabaseText',!p.error&&!s.error,'متاح','تحقق من الاتصال');setHealth('healthAuth','healthAuthText',Boolean(state.user),'جلسة نشطة','غير متاح');
 if(!m.error)$('#unreadCount').textContent=(m.data||[]).filter(x=>!x.read_at).length;
}
function setHealth(dot,text,good,goodLabel,badLabel){$( `#${dot}`).style.background=good?'#67d8ab':'#e9bd78';$(`#${text}`).textContent=good?goodLabel:badLabel;}

$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('#loginButton');setBusy(b,true);try{if(!supabaseConfigured)throw new Error('أكمل إعداد Supabase في config.js أولًا.');state.client=await getSupabase();const fd=new FormData(e.currentTarget);const {data,error}=await state.client.auth.signInWithPassword({email:fd.get('email'),password:fd.get('password')});if(error)throw error;await authorize(data.user);}catch(error){setNotice(error.message,true);}finally{setBusy(b,false);}});
async function logout(){if(state.client)await state.client.auth.signOut();state.user=null;state.role=null;showLogin();setConnection(false,'تم تسجيل الخروج');setNotice('تم إنهاء الجلسة بأمان.');}
$('#logoutButton').onclick=logout;$('#accountButton').onclick=()=>{if(confirm('تسجيل الخروج من لوحة المالك؟'))logout();};$('#viewSite').onclick=()=>window.open('../','_blank','noopener,noreferrer');
$('#sideNav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b&&!b.hidden)setView(b.dataset.view);});$$('[data-open-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.openView)));$('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('open');

await authenticate();
