(function () {
  'use strict';
  const client = window.supabaseClient;
  const $ = (id) => document.getElementById(id);
  const loginPanel = $('login-panel');
  const dashboard = $('dashboard');
  const loginMessage = $('login-message');
  const uploadMessage = $('upload-message');
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const ALLOWED = new Set([
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg','image/png','image/webp'
  ]);
  const categoryLabels = {cours:'الدروس',exercices:'التمارين',examens:'الامتحانات',fiches:'الجذاذات',resumes:'الملخصات',documents:'الوثائق',ressources:'الموارد',divers:'متفرقات'};
  let currentUser = null;

  function message(node, text, kind) {
    node.textContent = text || '';
    node.className = 'message' + (kind ? ' ' + kind : '');
  }
  function safeName(name) {
    return String(name || 'file').normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(-120) || 'file';
  }
  function publicUrl(path) {
    return client.storage.from('site-content').getPublicUrl(path).data.publicUrl;
  }
  async function verifyAdmin(user) {
    if (!user) return false;
    const { data, error } = await client.from('profiles').select('role,display_name').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!data || data.role !== 'admin') return false;
    currentUser = user;
    $('admin-identity').textContent = data.display_name || user.email || '';
    return true;
  }
  function showDenied() {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    message(loginMessage, 'هذا الحساب غير مخوّل لإدارة الموقع. يرجى الدخول بحساب المدير المعتمد.', 'error');
  }
  async function enter(user) {
    if (!await verifyAdmin(user)) { showDenied(); return; }
    loginPanel.hidden = true;
    dashboard.hidden = false;
    await loadResources();
    await loadFounderProfile();
  }
  async function loadResources() {
    const list = $('resource-list');
    list.innerHTML = '<p class="muted">جاري تحميل المحتوى...</p>';
    const { data, error } = await client.from('site_content_items')
      .select('id,title,category,language,study_level,study_track,file_name,storage_path,created_at')
      .order('created_at', { ascending: false }).limit(100);
    if (error) { list.textContent = 'تعذر تحميل الملفات: ' + error.message; return; }
    $('resource-count').textContent = String(data.length);
    if (!data.length) { list.innerHTML = '<p class="muted">لم تضف ملفات بعد. ابدأ بإضافة أول مورد.</p>'; return; }
    list.replaceChildren();
    data.forEach(item => {
      const row = document.createElement('article'); row.className = 'resource-row';
      const info = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.title;
      const meta = document.createElement('small');
      meta.textContent = [categoryLabels[item.category] || item.category,item.study_level,item.study_track,item.language === 'arabe' ? 'العربية' : 'Français'].filter(Boolean).join(' · ');
      info.append(title,meta);
      const actions = document.createElement('div'); actions.className = 'resource-actions';
      const open = document.createElement('a'); open.href = publicUrl(item.storage_path); open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'فتح الملف';
      const del = document.createElement('button'); del.type = 'button'; del.className = 'delete-btn'; del.textContent = 'حذف';
      del.addEventListener('click', () => removeResource(item, del));
      actions.append(open,del); row.append(info,actions); list.append(row);
    });
  }
  async function removeResource(item, button) {
    if (!window.confirm('هل تريد حذف هذا الملف من الموقع؟')) return;
    button.disabled = true;
    const { error: storageError } = await client.storage.from('site-content').remove([item.storage_path]);
    if (storageError) { button.disabled = false; alert('تعذر حذف الملف: ' + storageError.message); return; }
    const { error } = await client.from('site_content_items').delete().eq('id', item.id);
    if (error) { alert('حُذف الملف من التخزين لكن تعذر حذف بياناته: ' + error.message); }
    await loadResources();
  }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!client) { message(loginMessage, window.GoSVTAuthConfigError || 'تعذر الاتصال بخدمة الدخول.', 'error'); return; }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true; message(loginMessage, 'جارٍ التحقق من الحساب...');
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value });
      if (error) throw error;
      await enter(data.user);
    } catch (error) { message(loginMessage, error.message || 'تعذر تسجيل الدخول.', 'error'); }
    finally { button.disabled = false; }
  });
  $('upload-form').addEventListener('submit', async event => {
    event.preventDefault();
    const uploadForm = event.currentTarget;
    if (!currentUser) return;
    const file = $('resource-file').files[0];
    if (!file) return message(uploadMessage, 'اختر ملفاً أولاً.', 'error');
    if (file.size > MAX_FILE_SIZE) return message(uploadMessage, 'حجم الملف يتجاوز 50MB.', 'error');
    if (!ALLOWED.has(file.type)) return message(uploadMessage, 'نوع الملف غير مسموح به.', 'error');
    const button = $('upload-btn'); button.disabled = true;
    $('upload-progress').hidden = false; message(uploadMessage, 'جارٍ رفع الملف...');
    const category = $('category').value;
    if (['cours','exercices','examens','fiches','resumes'].includes(category) &&
        (!$('language').value || !$('study-level').value)) {
      button.disabled = false; $('upload-progress').hidden = true;
      return message(uploadMessage, 'يرجى تحديد اللغة والمستوى لهذا القسم.', 'error');
    }
    const path = category + '/' + crypto.randomUUID() + '-' + safeName(file.name);
    try {
      const { error: uploadError } = await client.storage.from('site-content').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const row = {
        title: $('resource-title').value.trim(), category,
        language: $('language').value || null,
        study_level: $('study-level').value || null,
        study_track: $('study-track').value || null,
        storage_path: path, file_name: file.name, mime_type: file.type,
        size_bytes: file.size, created_by: currentUser.id
      };
      const { error: insertError } = await client.from('site_content_items').insert(row);
      if (insertError) {
        await client.storage.from('site-content').remove([path]);
        throw insertError;
      }
      $('upload-form').reset();
      message(uploadMessage, 'تم رفع الملف وحفظ بياناته بنجاح. سيظهر في مكتبة الإدارة.', 'success');
      await loadResources();
    } catch (error) { message(uploadMessage, error.message || 'تعذر رفع الملف.', 'error'); }
    finally { button.disabled = false; $('upload-progress').hidden = true; }
  });
  const founderFields = {
    name_ar:'founder-name-ar', name_fr:'founder-name-fr',
    role_ar:'founder-role-ar', role_fr:'founder-role-fr',
    bio_ar:'founder-bio-ar', bio_fr:'founder-bio-fr',
    vision_ar:'founder-vision-ar', vision_fr:'founder-vision-fr'
  };
  let currentPortraitPath = null;
  async function loadFounderProfile() {
    const {data,error}=await client.from('site_founder_profile').select('*').eq('id','main').maybeSingle();
    if(error) { message($('founder-message'),'تعذر تحميل النبذة: '+error.message,'error'); return; }
    if(!data) return;
    Object.entries(founderFields).forEach(([key,id])=>{ $(id).value=data[key] || ''; });
    currentPortraitPath=data.portrait_path || null;
    if(currentPortraitPath) {
      const url=publicUrl(currentPortraitPath);
      $('founder-photo-preview').src=url; $('founder-photo-preview').hidden=false;
    }
  }
  $('founder-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!currentUser) return;
    const button=$('founder-save'); button.disabled=true;
    message($('founder-message'),'جارٍ حفظ التعديلات...');
    let uploadedPath=null;
    try {
      const photo=$('founder-photo').files[0];
      if(photo) {
        if(!['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size>5*1024*1024)
          throw new Error('الصورة يجب أن تكون JPG أو PNG أو WebP وألا يتجاوز حجمها 5MB.');
        uploadedPath='founder/'+crypto.randomUUID()+'-'+safeName(photo.name);
        const {error}=await client.storage.from('site-content').upload(uploadedPath,photo,{contentType:photo.type,upsert:false});
        if(error) throw error;
      }
      const row={id:'main',updated_by:currentUser.id,updated_at:new Date().toISOString()};
      Object.entries(founderFields).forEach(([key,id])=>{row[key]=$(id).value.trim();});
      row.portrait_path=uploadedPath || currentPortraitPath;
      const {error}=await client.from('site_founder_profile').upsert(row,{onConflict:'id'});
      if(error) {
        if(uploadedPath) await client.storage.from('site-content').remove([uploadedPath]);
        throw error;
      }
      if(uploadedPath && currentPortraitPath) await client.storage.from('site-content').remove([currentPortraitPath]);
      currentPortraitPath=row.portrait_path;
      if(currentPortraitPath){$('founder-photo-preview').src=publicUrl(currentPortraitPath);$('founder-photo-preview').hidden=false;}
      $('founder-photo').value='';
      message($('founder-message'),'تم حفظ النبذة والصورة بنجاح. ستظهر التعديلات في الصفحة الرئيسية بعد تحديثها.','success');
    } catch(error) { message($('founder-message'),error.message || 'تعذر حفظ النبذة.','error'); }
    finally { button.disabled=false; }
  });
  $('refresh-btn').addEventListener('click', loadResources);
  $('signout-btn').addEventListener('click', async () => {
    await client.auth.signOut();
    currentUser = null; dashboard.hidden = true; loginPanel.hidden = false;
    $('admin-password').value = '';
  });
  if (!client) { message(loginMessage, window.GoSVTAuthConfigError || 'تعذر تحميل Supabase.', 'error'); return; }
  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    if (data.session) return enter(data.session.user);
  }).catch(error => message(loginMessage, error.message || 'تعذر استعادة الجلسة.', 'error'));
})();