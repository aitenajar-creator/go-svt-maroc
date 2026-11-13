(function () {
  'use strict';
  const config = window.GoSVTTeacherSupabaseConfig;
  const $ = id => document.getElementById(id);
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories = {
    curriculum:'المناهج والتوجيهات', lesson:'الدروس والجذاذات', presentation:'العروض التقديمية',
    assessment:'الفروض والتقويم', exam:'الامتحانات', correction:'التصحيح',
    planning:'التخطيط السنوي', professional:'وثائق مهنية', training:'التكوين المستمر', other:'موارد أخرى'
  };
  const icons = {pdf:'📕',doc:'📘',docx:'📘',ppt:'📊',pptx:'📊',xls:'📗',xlsx:'📗',odt:'📘',odp:'📊',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',webp:'🖼️',zip:'🗜️',txt:'📄'};
  const allowed = new Set(['pdf','doc','docx','ppt','pptx','xls','xlsx','odt','odp','jpg','jpeg','png','webp','txt','zip']);
  const MAX_FILE = 50 * 1024 * 1024;
  let client = null, user = null, member = null, isAdmin = false, authView = 'login', resources = [];

  function message(id, value, good) {
    const el = $(id); if (!el) return;
    el.textContent = value || ''; el.classList.toggle('success', !!good);
  }
  function openAuth(view) {
    authView = view || 'login';
    $('tc-auth-title').textContent = authView === 'register' ? 'إنشاء حساب في مجتمع الأساتذة' : 'الدخول إلى مجتمع الأساتذة';
    $('tc-register-fields').hidden = authView !== 'register';
    $('tc-name').required = authView === 'register';
    $('tc-password').autocomplete = authView === 'register' ? 'new-password' : 'current-password';
    $('tc-auth-submit').textContent = authView === 'register' ? 'إنشاء الحساب' : 'دخول';
    document.querySelectorAll('[data-auth-view]').forEach(b => b.classList.toggle('active', b.dataset.authView === authView));
    message('tc-auth-message', '');
    $('tc-auth-dialog').showModal();
  }
  function setSignedInUI() {
    const approved = isAdmin || (member && member.status === 'approved');
    $('tc-account').textContent = user ? 'حسابي المهني' : 'دخول الأساتذة';
    $('tc-dashboard').hidden = !user;
    $('tc-upload-open').disabled = !approved;
    $('tc-hero-join').textContent = user ? 'الانتقال إلى مساحتي المهنية ←' : 'انضم إلى مجتمع الأساتذة ←';
    if (!user) {
      $('tc-library-state').hidden = false;
      $('tc-library-state').textContent = 'سجّل الدخول إلى مجتمع الأساتذة للاطلاع على الموارد المشتركة.';
      $('tc-resource-grid').innerHTML = '';
      return;
    }
    $('tc-member-label').textContent = (member && member.display_name) || user.email || '';
    $('tc-admin-tab').hidden = !isAdmin;
    $('tc-pending-panel').hidden = false;
    $('tc-membership-status').textContent = isAdmin
      ? 'أنت مدير المنصة. يمكنك إدارة طلبات الانضمام والموارد المشتركة.'
      : member && member.status === 'approved'
        ? 'عضويتك مفعّلة. يمكنك رفع مواردك ومشاركتها وتحميل موارد الزملاء.'
        : member && member.status === 'suspended'
          ? 'تم تعليق عضويتك في مجتمع الأساتذة. يرجى التواصل مع إدارة المنصة.'
          : 'تم استلام طلبك. ستصبح المكتبة والرفع متاحين بعد موافقة إدارة المنصة.';
    if (approved) loadLibrary();
    else {
      $('tc-library-state').hidden = false;
      $('tc-library-state').textContent = 'طلب عضويتك قيد المراجعة. ستظهر المكتبة بعد موافقة إدارة المنصة.';
      $('tc-resource-grid').innerHTML = '';
    }
    loadMyResources();
    if (isAdmin) loadAdmin();
  }
  async function ensureMember() {
    if (!user) return null;
    const { data, error } = await client.from('teacher_community_members')
      .select('user_id,display_name,professional_title,school_name,status,created_at')
      .eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const meta = user.user_metadata || {};
    const displayName = String(meta.teacher_display_name || meta.display_name || (user.email || 'أستاذ').split('@')[0]).trim().slice(0,100) || 'أستاذ';
    const row = {
      user_id: user.id, display_name: displayName,
      professional_title: String(meta.professional_title || '').slice(0,120),
      school_name: String(meta.school_name || '').slice(0,160), status: 'pending'
    };
    const inserted = await client.from('teacher_community_members').insert(row).select().single();
    if (inserted.error) throw inserted.error;
    return inserted.data;
  }
  async function refreshSession() {
    if (!client) return;
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    user = data && data.user || null; member = null; isAdmin = false;
    if (user) {
      const adminCheck = await client.rpc('gosvt_teacher_community_is_admin');
      if (adminCheck.error) throw adminCheck.error;
      isAdmin = adminCheck.data === true;
      if (!isAdmin) member = await ensureMember();
      else {
        member = { display_name: user.user_metadata?.teacher_display_name || user.email, status: 'approved' };
      }
    }
    setSignedInUI();
  }
  function fileExt(name) { return (String(name).split('.').pop() || '').toLowerCase(); }
  function fileIcon(name) { return icons[fileExt(name)] || '📄'; }
  function dateLabel(value) {
    try { return new Intl.DateTimeFormat('ar-MA',{year:'numeric',month:'short',day:'numeric'}).format(new Date(value)); }
    catch (_) { return ''; }
  }
  function resourceCard(r, own) {
    const owner = r.owner_id === (user && user.id) ? 'ملفي' : 'مساهمة من المجتمع';
    const adminOwn = isAdmin && r.owner_id === user.id ? 'إدارة المنصة' : owner;
    return '<article class="tc-resource-card" data-resource-id="' + escapeHtml(r.id) + '">' +
      '<div class="tc-resource-top"><span class="tc-file-icon">' + fileIcon(r.file_name) + '</span><span class="tc-pill">' + escapeHtml(categories[r.category] || categories.other) + '</span></div>' +
      '<h3>' + escapeHtml(r.title) + '</h3><p>' + escapeHtml(r.description || 'لا يوجد وصف إضافي لهذه الوثيقة.') + '</p>' +
      '<div class="tc-resource-meta"><span>' + escapeHtml(adminOwn) + '</span><span>· ' + escapeHtml(dateLabel(r.created_at)) + '</span><span>· ' + (r.size_bytes/1048576).toFixed(1) + ' MB</span></div>' +
      '<div class="tc-resource-meta"><span>' + escapeHtml(r.file_name) + '</span>' + (r.is_shared ? '<span class="tc-pill">مشترك</span>' : '<span class="tc-pill">خاص</span>') + '</div>' +
      '<div class="tc-resource-actions"><button type="button" data-download="' + escapeHtml(r.id) + '">⬇ تحميل</button>' +
      ((own || isAdmin) ? '<button type="button" class="danger" data-delete="' + escapeHtml(r.id) + '">حذف</button>' : '') +
      ((own || isAdmin) ? '<button type="button" data-toggle-share="' + escapeHtml(r.id) + '">' + (r.is_shared ? 'إلغاء المشاركة' : 'مشاركة') + '</button>' : '') +
      '</div></article>';
  }
  async function loadLibrary() {
    if (!user || !(isAdmin || (member && member.status === 'approved'))) return;
    const { data, error } = await client.from('teacher_community_resources')
      .select('*').eq('status','published').eq('is_shared',true).order('created_at',{ascending:false}).limit(150);
    if (error) { $('tc-library-state').textContent = 'تعذر تحميل المكتبة: ' + error.message; return; }
    resources = data || [];
    renderLibrary();
  }
  function renderLibrary() {
    const q = ($('tc-search').value || '').trim().toLowerCase(), category = $('tc-category').value;
    const filtered = resources.filter(r => (!category || r.category === category) &&
      (!q || [r.title,r.description,r.file_name,categories[r.category]].join(' ').toLowerCase().includes(q)));
    $('tc-library-state').hidden = filtered.length > 0;
    $('tc-library-state').textContent = filtered.length ? '' : 'لا توجد موارد مطابقة حالياً. جرّب تغيير كلمات البحث أو التصنيف.';
    $('tc-resource-grid').innerHTML = filtered.map(r => resourceCard(r, r.owner_id === user.id)).join('');
  }
  async function loadMyResources() {
    if (!user) return;
    const { data, error } = await client.from('teacher_community_resources').select('*')
      .eq('owner_id',user.id).order('created_at',{ascending:false}).limit(100);
    if (error) { $('tc-my-resources').innerHTML = '<div class="tc-state">تعذر تحميل ملفاتك.</div>'; return; }
    $('tc-my-resources').innerHTML = data && data.length ? data.map(r => resourceCard(r,true)).join('') : '<div class="tc-state">لم ترفع أي ملفات بعد. ابدأ بمشاركة أول مورد تربوي.</div>';
  }
  async function downloadResource(id) {
    // Open the tab during the original click gesture; browsers may block window.open
    // when it is called only after the asynchronous signed-URL request completes.
    const downloadTab = window.open('about:blank', '_blank');
    if (downloadTab) {
      try { downloadTab.opener = null; } catch (_) {}
      try { downloadTab.document.title = 'جارٍ تجهيز التنزيل…'; } catch (_) {}
    }
    try {
      const r = resources.find(x => x.id === id) || await findResource(id);
      if (!r) throw new Error('لم يتم العثور على الملف.');
      const { data, error } = await client.storage.from('teacher-community').createSignedUrl(r.storage_path, 90, { download: r.file_name });
      if (error) throw error;
      if (!downloadTab || downloadTab.closed) {
        throw new Error('منع المتصفح فتح نافذة التنزيل. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.');
      }
      downloadTab.location.replace(data.signedUrl);
    } catch (err) {
      if (downloadTab && !downloadTab.closed) downloadTab.close();
      throw err;
    }
  }
  async function findResource(id) {
    const { data, error } = await client.from('teacher_community_resources').select('*').eq('id',id).maybeSingle();
    if (error) throw error; return data;
  }
  async function deleteResource(id) {
    const r = await findResource(id); if (!r) return;
    if (r.owner_id !== user.id && !isAdmin) throw new Error('لا يمكنك حذف ملف أستاذ آخر.');
    if (!window.confirm('هل تريد حذف هذه الوثيقة نهائياً؟')) return;
    const removed = await client.storage.from('teacher-community').remove([r.storage_path]);
    if (removed.error) throw removed.error;
    const { error } = await client.from('teacher_community_resources').delete().eq('id',id);
    if (error) throw error;
    await Promise.all([loadLibrary(),loadMyResources()]);
  }
  async function toggleShare(id) {
    const r = await findResource(id); if (!r) return;
    if (r.owner_id !== user.id && !isAdmin) throw new Error('لا يمكنك تعديل ملف أستاذ آخر.');
    const { error } = await client.from('teacher_community_resources').update({is_shared:!r.is_shared,updated_at:new Date().toISOString()}).eq('id',id);
    if (error) throw error;
    await Promise.all([loadLibrary(),loadMyResources()]);
  }
  async function loadAdmin() {
    const [members, docs] = await Promise.all([
      client.from('teacher_community_members').select('*').order('created_at',{ascending:false}).limit(100),
      client.from('teacher_community_resources').select('*').order('created_at',{ascending:false}).limit(100)
    ]);
    if (members.error || docs.error) return;
    $('tc-admin-members').innerHTML = (members.data || []).map(m =>
      '<div class="tc-admin-row"><span><b>' + escapeHtml(m.display_name) + '</b><br>' + escapeHtml(m.professional_title || m.school_name || m.status) + '</span><span>' + escapeHtml(m.status) + '</span><span>' +
      (m.status !== 'approved' ? '<button data-approve-member="' + escapeHtml(m.user_id) + '">موافقة</button>' : '') +
      (m.status !== 'suspended' ? '<button class="reject" data-suspend-member="' + escapeHtml(m.user_id) + '">تعليق</button>' : '') + '</span></div>'
    ).join('') || '<div class="tc-state">لا توجد طلبات.</div>';
    $('tc-admin-resources').innerHTML = (docs.data || []).map(r =>
      '<div class="tc-admin-row"><span><b>' + escapeHtml(r.title) + '</b><br>' + escapeHtml(r.file_name) + '</span><span>' + escapeHtml(r.status) + '</span><span><button data-hide-resource="' + escapeHtml(r.id) + '">' + (r.status === 'hidden' ? 'نشر' : 'إخفاء') + '</button><button class="danger" data-admin-delete="' + escapeHtml(r.id) + '">حذف نهائياً</button></span></div>'
    ).join('') || '<div class="tc-state">لا توجد موارد.</div>';
  }
  async function handleAuth(e) {
    e.preventDefault(); message('tc-auth-message','');
    const email = $('tc-email').value.trim().toLowerCase(), password = $('tc-password').value;
    const submit = $('tc-auth-submit'); submit.disabled = true;
    try {
      if (authView === 'register') {
        const name = $('tc-name').value.trim();
        if (name.length < 2) throw new Error('يرجى إدخال الاسم الكامل.');
        const { data, error } = await client.auth.signUp({email,password,options:{data:{
          teacher_display_name:name, professional_title:$('tc-title').value.trim(), school_name:$('tc-school').value.trim(), account_area:'teacher_community'
        },emailRedirectTo:location.origin + location.pathname}});
        if (error) throw error;
        if (data.session) { user=data.user; member=await ensureMember(); await refreshSession(); $('tc-auth-dialog').close(); }
        else message('tc-auth-message','تم إرسال طلب التسجيل. تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول. بعد ذلك ستراجع الإدارة طلب عضويتك.',true);
      } else {
        const { error } = await client.auth.signInWithPassword({email,password});
        if (error) throw error;
        await refreshSession(); $('tc-auth-dialog').close();
      }
    } catch(err) { message('tc-auth-message',err.message || 'تعذر إتمام العملية.'); }
    finally { submit.disabled = false; }
  }
  async function handleUpload(e) {
    e.preventDefault(); message('tc-upload-message','');
    if (!user || !(isAdmin || (member && member.status === 'approved'))) { message('tc-upload-message','يجب تفعيل عضويتك قبل رفع الملفات.'); return; }
    const file = $('tc-file').files[0], title = $('tc-file-title').value.trim();
    if (!file) return message('tc-upload-message','اختر ملفاً أولاً.');
    const ext = fileExt(file.name);
    if (!allowed.has(ext)) return message('tc-upload-message','صيغة الملف غير مسموح بها.');
    if (file.size <= 0 || file.size > MAX_FILE) return message('tc-upload-message','حجم الملف يجب ألا يتجاوز 50 MB.');
    if (title.length < 2) return message('tc-upload-message','أدخل عنواناً واضحاً للوثيقة.');
    const submit = $('tc-upload-submit'); submit.disabled = true; submit.textContent = 'جارٍ رفع الملف...';
    const path = user.id + '/' + crypto.randomUUID() + '.' + ext;
    try {
      const upload = await client.storage.from('teacher-community').upload(path,file,{contentType:file.type || 'application/octet-stream',upsert:false});
      if (upload.error) throw upload.error;
      const row = {owner_id:user.id,title,description:$('tc-file-description').value.trim(),category:$('tc-file-category').value,
        file_name:file.name,mime_type:file.type || 'application/octet-stream',size_bytes:file.size,storage_path:path,
        is_shared:$('tc-file-share').checked,status:'published'};
      const saved = await client.from('teacher_community_resources').insert(row);
      if (saved.error) {
        await client.storage.from('teacher-community').remove([path]);
        throw saved.error;
      }
      $('tc-upload-form').reset(); $('tc-upload-dialog').close();
      await Promise.all([loadLibrary(),loadMyResources()]);
    } catch(err) { message('tc-upload-message',err.message || 'فشل رفع الملف.'); }
    finally { submit.disabled=false; submit.textContent='رفع وحفظ الوثيقة'; }
  }
  async function handleAdminAction(e) {
    const b=e.target.closest('button'); if(!b || !isAdmin) return;
    try {
      if (b.dataset.approveMember || b.dataset.suspendMember) {
        const id=b.dataset.approveMember || b.dataset.suspendMember, status=b.dataset.approveMember?'approved':'suspended';
        const {error}=await client.from('teacher_community_members').update({status,updated_at:new Date().toISOString()}).eq('user_id',id);
        if(error) throw error; await loadAdmin();
      } else if (b.dataset.hideResource) {
        const id=b.dataset.hideResource, r=await findResource(id);
        const {error}=await client.from('teacher_community_resources').update({status:r.status==='hidden'?'published':'hidden',updated_at:new Date().toISOString()}).eq('id',id);
        if(error) throw error; await Promise.all([loadAdmin(),loadLibrary()]);
      } else if (b.dataset.adminDelete) {
        const id=b.dataset.adminDelete, r=await findResource(id);
        if (!window.confirm('هل تريد حذف هذه الوثيقة من المجتمع نهائياً؟')) return;
        const removed=await client.storage.from('teacher-community').remove([r.storage_path]);
        if(removed.error) throw removed.error;
        const {error}=await client.from('teacher_community_resources').delete().eq('id',id);
        if(error) throw error;
        await Promise.all([loadAdmin(),loadLibrary(),loadMyResources()]);
      }
    } catch(err) { alert(err.message || 'تعذر تنفيذ العملية.'); }
  }
  function wire() {
    $('tc-account').addEventListener('click',()=>user?$('tc-dashboard').scrollIntoView({behavior:'smooth'}):openAuth('login'));
    $('tc-hero-join').addEventListener('click',()=>user?$('tc-dashboard').scrollIntoView({behavior:'smooth'}):openAuth('register'));
    $('tc-auth-form').addEventListener('submit',handleAuth);
    document.querySelectorAll('[data-auth-view]').forEach(b=>b.addEventListener('click',()=>{authView=b.dataset.authView;openAuth(authView);}));
    $('tc-upload-open').addEventListener('click',()=>{if(!user)openAuth('login');else if(isAdmin || member?.status==='approved')$('tc-upload-dialog').showModal();else alert('طلب عضويتك قيد المراجعة.');});
    $('tc-upload-form').addEventListener('submit',handleUpload);
    $('tc-file').addEventListener('change',()=>{const f=$('tc-file').files[0];$('tc-file-hint').textContent=f?f.name+' · '+(f.size/1048576).toFixed(1)+' MB':'PDF وWord وPowerPoint وExcel وغيرها · الحد الأقصى 50 MB';});
    $('tc-search').addEventListener('input',renderLibrary); $('tc-category').addEventListener('change',renderLibrary);
    $('tc-resource-grid').addEventListener('click',resourceAction); $('tc-my-resources').addEventListener('click',resourceAction);
    $('tc-admin-members').addEventListener('click',handleAdminAction); $('tc-admin-resources').addEventListener('click',handleAdminAction);
    $('tc-logout').addEventListener('click',async()=>{await client.auth.signOut();user=null;member=null;isAdmin=false;setSignedInUI();});
    document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x===b));['mine','pending','admin'].forEach(p=>$( 'tc-'+p+'-panel').hidden=p!==b.dataset.panel);}));
    $('tc-admin-tab').addEventListener('click',()=>{if(isAdmin)loadAdmin();});
  }
  async function resourceAction(e) {
    const b=e.target.closest('button'); if(!b)return;
    try {
      if(b.dataset.download) await downloadResource(b.dataset.download);
      if(b.dataset.delete) await deleteResource(b.dataset.delete);
      if(b.dataset.toggleShare) await toggleShare(b.dataset.toggleShare);
    } catch(err) { alert(err.message || 'تعذر تنفيذ العملية.'); }
  }
  async function init() {
    wire();
    if (!config || !window.supabase || !window.supabase.createClient) {
      $('tc-library-state').textContent='إعداد الاتصال غير متاح. تحقق من تحميل إعداد Supabase.';
      return;
    }
    // This portal connects to its own Supabase project, separate from student and legacy teacher accounts.
    // Its independent Auth project permits the same email address to register a distinct community account.
    client=window.supabase.createClient(config.url,config.publishableKey,{auth:{
      storageKey:'gosvt_teacher_community_auth_v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true
    }});
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){user=null;member=null;isAdmin=false;setSignedInUI();}
      if(event==='SIGNED_IN' || event==='TOKEN_REFRESHED') setTimeout(()=>refreshSession().catch(err=>console.warn('[Teacher community]',err)),0);
    });
    try { await refreshSession(); } catch(err) { console.error('[Teacher community]',err); $('tc-library-state').textContent='تعذر التحقق من الحساب. أعد تحميل الصفحة.'; }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();