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
  let uploadInProgress = false;
  const PAGE_SIZE = 50;
  let libraryOffset = 0, libraryHasMore = false, libraryRequest = 0, libraryLoading = false, libraryRefreshPending = false, librarySearchTimer = null, mySearchTimer = null, myOffset = 0, myHasMore = false, myLoading = false, myRefreshPending = false, adminMembersLoading = false, adminResourcesLoading = false, adminMembersOffset = 0, adminResourcesOffset = 0, adminMembersMore = false, adminResourcesMore = false;

  function message(id, value, good) {
    const el = $(id); if (!el) return;
    el.textContent = value || ''; el.classList.toggle('success', !!good);
  }
  function updateSelectedFileHint() {
    const input = $('tc-file');
    const hint = $('tc-file-hint');
    if (!input || !hint) return;
    const file = input.files && input.files[0];
    hint.classList.remove('tc-file-hint-error', 'tc-file-hint-valid');
    if (!file) {
      hint.textContent = 'PDF وWord وPowerPoint وExcel وغيرها · الحد الأقصى 50 MB';
      return;
    }
    const ext = fileExt(file.name);
    const size = (file.size / 1048576).toFixed(1);
    if (!allowed.has(ext)) {
      hint.textContent = 'صيغة غير مدعومة: .' + (ext || 'غير معروفة') + ' · اختر PDF أو Office أو صورة أو TXT أو ZIP.';
      hint.classList.add('tc-file-hint-error');
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE) {
      hint.textContent = file.name + ' · ' + size + ' MB — الحجم غير مقبول؛ الحد الأقصى 50 MB.';
      hint.classList.add('tc-file-hint-error');
      return;
    }
    hint.textContent = '✓ ' + file.name + ' · ' + size + ' MB · جاهز للرفع';
    hint.classList.add('tc-file-hint-valid');
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
    if (inserted.error) {
      // SIGNED_IN and the form handler can refresh the session almost simultaneously.
      // If both try to create the first membership row, reuse the row created by the other request.
      if (inserted.error.code === '23505') {
        const existing = await client.from('teacher_community_members')
          .select('user_id,display_name,professional_title,school_name,status,created_at')
          .eq('user_id', user.id).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) return existing.data;
      }
      throw inserted.error;
    }
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
  function fileMime(file) {
    // Prefer the allow-listed extension mapping over browser-provided MIME.
    // Some browsers/operating systems report application/octet-stream for valid files.
    const byExtension = {
      pdf:'application/pdf', doc:'application/msword',
      docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ppt:'application/vnd.ms-powerpoint',
      pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xls:'application/vnd.ms-excel',
      xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      odt:'application/vnd.oasis.opendocument.text',
      odp:'application/vnd.oasis.opendocument.presentation',
      jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
      txt:'text/plain', zip:'application/zip'
    };
    return byExtension[fileExt(file.name)] || (file.type && file.type !== 'application/octet-stream' ? file.type : '');
  }
  function fileIcon(name) { return icons[fileExt(name)] || '📄'; }
  function dateLabel(value) {
    try { return new Intl.DateTimeFormat('ar-MA',{year:'numeric',month:'short',day:'numeric'}).format(new Date(value)); }
    catch (_) { return ''; }
  }
  function resourceCard(r, own) {
    const owner = r.owner_id === (user && user.id) ? 'ملفي' : 'مساهمة من المجتمع';
    const adminOwn = isAdmin && r.owner_id === user.id ? 'إدارة المنصة' : owner;
    const statusLabel = r.status === 'hidden' ? 'مخفي عن المكتبة' : (r.is_shared ? 'منشور ومشترك' : 'منشور — خاص');
    const statusClass = r.status === 'hidden' ? 'tc-resource-status-hidden' : (r.is_shared ? 'tc-resource-status-shared' : 'tc-resource-status-private');
    return '<article class="tc-resource-card" data-resource-id="' + escapeHtml(r.id) + '">' +
      '<div class="tc-resource-top"><span class="tc-file-icon">' + fileIcon(r.file_name) + '</span><span class="tc-pill">' + escapeHtml(categories[r.category] || categories.other) + '</span></div>' +
      '<h3>' + escapeHtml(r.title) + '</h3><p>' + escapeHtml(r.description || 'لا يوجد وصف إضافي لهذه الوثيقة.') + '</p>' +
      '<div class="tc-resource-meta"><span>' + escapeHtml(adminOwn) + '</span><span>· ' + escapeHtml(dateLabel(r.created_at)) + '</span><span>· ' + (r.size_bytes/1048576).toFixed(1) + ' MB</span></div>' +
      '<div class="tc-resource-meta"><span>' + escapeHtml(r.file_name) + '</span><span class="tc-resource-status ' + statusClass + '" role="status">' + statusLabel + '</span></div>' +
      '<div class="tc-resource-actions"><button type="button" data-download="' + escapeHtml(r.id) + '">⬇ تحميل</button>' +
      ((own || isAdmin) ? '<button type="button" class="danger" data-delete="' + escapeHtml(r.id) + '">حذف</button>' : '') +
      ((isAdmin || (own && member && member.status === 'approved')) ? '<button type="button" data-toggle-share="' + escapeHtml(r.id) + '">' + (r.is_shared ? 'إلغاء المشاركة' : 'مشاركة') + '</button>' : '') +
      '</div></article>';
  }
  async function loadLibrary(reset = true) {
    if (!user || !(isAdmin || (member && member.status === 'approved'))) return;
    if (libraryLoading) {
      // Queue a fresh query when search/category changes during an active request.
      // Ignore duplicate pagination clicks so the same range is never appended twice.
      if (reset) libraryRefreshPending = true;
      return;
    }
    libraryLoading = true;
    const moreButton = $('tc-library-more');
    if (moreButton) moreButton.disabled = true;
    if (reset) {
      resources = []; libraryOffset = 0; libraryHasMore = false;
      $('tc-resource-grid').replaceChildren();
      if ($('tc-library-results-summary')) $('tc-library-results-summary').hidden = true;
      $('tc-library-state').hidden = false;
      $('tc-library-state').textContent = 'جارٍ البحث في جميع الموارد المشتركة...';
      $('tc-library-more').hidden = true;
    }
    const requestId = ++libraryRequest;
    try {
      const rawSearch = ($('tc-search').value || '').trim();
      // Restrict PostgREST filter syntax characters so user input remains plain search text.
      const q = rawSearch.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      const category = $('tc-category').value;
      const fileType = $('tc-file-type') ? $('tc-file-type').value : '';
      const sort = $('tc-library-sort') ? $('tc-library-sort').value : 'newest';
      let query = client.from('teacher_community_resources')
        .select('*').eq('status','published').eq('is_shared',true);
      if (category) query = query.eq('category', category);
      const fileMimeTypes = {
        pdf: ['application/pdf'],
        word: ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.oasis.opendocument.text'],
        presentation: ['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.presentation'],
        spreadsheet: ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        image: ['image/jpeg','image/png','image/webp'],
        other: ['text/plain','application/zip']
      };
      if (fileType && fileMimeTypes[fileType]) query = query.in('mime_type', fileMimeTypes[fileType]);
      if (q) {
        const pattern = '%' + q + '%';
        query = query.or('title.ilike.' + pattern + ',description.ilike.' + pattern + ',file_name.ilike.' + pattern);
      }
      const start = reset ? 0 : libraryOffset;
      const primaryOrder = sort === 'title' ? 'title' : 'created_at';
      const ascending = sort === 'oldest' || sort === 'title';
      const { data, error } = await query
        .order(primaryOrder,{ascending}).order('id',{ascending:sort === 'title' || sort === 'oldest'})
        .range(start, start + PAGE_SIZE - 1);
      if (requestId !== libraryRequest) return;
      if (error) {
        $('tc-library-state').hidden = false;
        $('tc-library-state').textContent = 'تعذر تحميل المكتبة: ' + error.message;
        return;
      }
      const page = data || [];
      resources = reset ? page : resources.concat(page);
      libraryOffset = start + page.length;
      libraryHasMore = page.length === PAGE_SIZE;
      $('tc-library-more').hidden = !libraryHasMore;
      renderLibrary();
    } finally {
      libraryLoading = false;
      if (moreButton) moreButton.disabled = false;
      if (libraryRefreshPending && user) {
        libraryRefreshPending = false;
        void loadLibrary(true);
      }
    }
  }
  function updateLibraryResetVisibility() {
    const active = Boolean(($('tc-search').value || '').trim() || $('tc-category').value ||
      $('tc-file-type').value || $('tc-library-sort').value !== 'newest');
    $('tc-library-reset').hidden = !active;
  }
  function updateMyResetVisibility() {
    const active = Boolean(($('tc-my-search').value || '').trim() ||
      $('tc-my-filter').value !== 'all' || $('tc-my-sort').value !== 'newest');
    $('tc-my-reset').hidden = !active;
  }
  function renderLibrary() {
    $('tc-library-state').hidden = resources.length > 0;
    $('tc-library-state').textContent = resources.length ? '' : 'لا توجد موارد مطابقة. جرّب تغيير كلمات البحث أو التصنيف.';
    const summary = $('tc-library-results-summary');
    if (summary) {
      summary.hidden = resources.length === 0;
      summary.textContent = resources.length ? 'الموارد المعروضة: ' + resources.length : '';
    }
    $('tc-resource-grid').innerHTML = resources.map(r => resourceCard(r, r.owner_id === user.id)).join('');
  }
  async function loadMyResources(reset = true) {
    if (!user) return;
    if (myLoading) {
      // A successful upload/delete may request a refresh while pagination is
      // still in flight. Queue that refresh instead of silently dropping it.
      if (reset) myRefreshPending = true;
      return;
    }
    myLoading = true;
    const moreButton = $('tc-my-resources-more');
    if (moreButton) moreButton.disabled = true;
    if (reset) { myOffset = 0; myHasMore = false; $('tc-my-resources').replaceChildren(); $('tc-my-resources-status').textContent = 'جارٍ تحميل ملفاتك...'; }
    try {
      const start = reset ? 0 : myOffset;
      const filter = $('tc-my-filter') ? $('tc-my-filter').value : 'all';
      const sort = $('tc-my-sort') ? $('tc-my-sort').value : 'newest';
      const rawSearch = $('tc-my-search') ? $('tc-my-search').value : '';
      const q = rawSearch.trim().replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      let query = client.from('teacher_community_resources').select('*').eq('owner_id',user.id);
      if (q) { const pattern = '%' + q + '%'; query = query.or('title.ilike.' + pattern + ',description.ilike.' + pattern + ',file_name.ilike.' + pattern); }
      if (filter === 'shared') query = query.eq('status','published').eq('is_shared',true);
      if (filter === 'private') query = query.eq('status','published').eq('is_shared',false);
      if (filter === 'hidden') query = query.eq('status','hidden');
      const primaryOrder = sort === 'title' ? 'title' : 'created_at';
      const ascending = sort === 'oldest' || sort === 'title';
      const { data, error } = await query.order(primaryOrder,{ascending}).order('id',{ascending:sort === 'title' || sort === 'oldest'})
        .range(start, start + PAGE_SIZE - 1);
      if (error) { $('tc-my-resources-status').textContent = 'تعذر تحميل ملفاتك. تحقق من الاتصال ثم أعد المحاولة.'; $('tc-my-resources').innerHTML = '<div class="tc-state" role="alert">تعذر تحميل ملفاتك. تحقق من الاتصال ثم أعد المحاولة.</div>'; $('tc-my-resources-more').hidden = true; return; }
      const page = data || [];
      myOffset = start + page.length; myHasMore = page.length === PAGE_SIZE;
      $('tc-my-resources').insertAdjacentHTML('beforeend', page.map(r => resourceCard(r,true)).join(''));
      $('tc-my-resources-more').hidden = !myHasMore;
      if (page.length) $('tc-my-resources-status').textContent = `تم تحميل ${myOffset} من ملفاتك.`;
      if (reset && !page.length) {
        const emptyText = q ? 'لا توجد ملفات تطابق عبارة البحث. جرّب كلمات أخرى.' : filter === 'all'
          ? 'لم ترفع أي ملفات بعد. ابدأ بمشاركة أول مورد تربوي.'
          : filter === 'shared' ? 'لا توجد موارد مشتركة ضمن ملفاتك حالياً.'
          : filter === 'private' ? 'لا توجد ملفات خاصة ضمن مواردك المنشورة.'
          : 'لا توجد ملفات مخفية ضمن مواردك حالياً.';
        $('tc-my-resources').innerHTML = '<div class="tc-state">' + emptyText + '</div>'; $('tc-my-resources-status').textContent = emptyText;
      }
    } finally {
      myLoading = false;
      if (moreButton) moreButton.disabled = false;
      if (myRefreshPending && user) {
        myRefreshPending = false;
        void loadMyResources(true);
      }
    }
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
  // Hide metadata before removing the private object. If storage or metadata
  // deletion fails, the resource stays hidden and can be retried by its owner/admin.
  async function safelyDeleteResource(r) {
    const hidden = await client.from('teacher_community_resources')
      .update({status:'hidden',updated_at:new Date().toISOString()})
      .eq('id',r.id).select('id').maybeSingle();
    if (hidden.error) throw new Error('تعذر إخفاء الوثيقة قبل حذفها: ' + hidden.error.message);
    if (!hidden.data) throw new Error('لم تعد الوثيقة متاحة للحذف أو لا تملك صلاحية إدارتها.');

    // Refresh immediately so other members no longer see a stale shared card
    // if the subsequent Storage deletion needs to be retried.
    await Promise.all([loadLibrary(),loadMyResources(),isAdmin ? loadAdmin() : Promise.resolve()]);

    const removed = await client.storage.from('teacher-community').remove([r.storage_path]);
    if (removed.error) {
      throw new Error('أُخفيت الوثيقة لحمايتها، لكن تعذر حذف الملف من التخزين. أعد المحاولة لاحقاً. ' + removed.error.message);
    }

    const deleted = await client.from('teacher_community_resources').delete().eq('id',r.id).select('id').maybeSingle();
    if (deleted.error) {
      throw new Error('حُذف الملف من التخزين، لكن تعذر حذف بياناته. بقي السجل مخفياً ويمكن إعادة محاولة الحذف. ' + deleted.error.message);
    }
    if (!deleted.data) {
      throw new Error('حُذف الملف من التخزين، لكن لم يُحذف سجل الوثيقة. بقي السجل مخفياً؛ أعد المحاولة أو أبلغ الإدارة.');
    }
  }
  async function deleteResource(id) {
    const r = await findResource(id); if (!r) return;
    if (r.owner_id !== user.id && !isAdmin) throw new Error('لا يمكنك حذف ملف أستاذ آخر.');
    if (!window.confirm('هل تريد حذف هذه الوثيقة نهائياً؟')) return;

    if (!isAdmin && member && member.status === 'suspended') {
      // Suspended owners cannot UPDATE metadata. Delete the private object first:
      // this also invalidates any previously issued signed download URL.
      // Keep the metadata row until Storage confirms deletion so the owner can retry.
      const removed = await client.storage.from('teacher-community').remove([r.storage_path]);
      if (removed.error) {
        throw new Error('تعذر حذف الملف من التخزين؛ لم نحذف بيانات الوثيقة حتى تتمكن من إعادة المحاولة. ' + removed.error.message);
      }
      const deleted = await client.from('teacher_community_resources')
        .delete().eq('id',r.id).select('id').maybeSingle();
      if (deleted.error) throw new Error('حُذف الملف من التخزين، لكن تعذر حذف بيانات الوثيقة. أبلغ الإدارة لتنظيف السجل المتبقي.');
      if (!deleted.data) throw new Error('حُذف الملف من التخزين، لكن تعذر العثور على سجل الوثيقة لإزالته. أبلغ الإدارة.');
    } else {
      await safelyDeleteResource(r);
    }
    await Promise.all([loadLibrary(),loadMyResources(),isAdmin ? loadAdmin() : Promise.resolve()]);
  }
  async function toggleShare(id) {
    const r = await findResource(id); if (!r) return;
    if (r.owner_id !== user.id && !isAdmin) throw new Error('لا يمكنك تعديل ملف أستاذ آخر.');
    const updated = await client.from('teacher_community_resources').update({is_shared:!r.is_shared,updated_at:new Date().toISOString()})
      .eq('id',id).select('id').maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) throw new Error('لم يتم تغيير حالة المشاركة؛ قد تكون العضوية معلقة أو لم تعد تملك صلاحية تعديل هذه الوثيقة.');
    await Promise.all([loadLibrary(),loadMyResources()]);
  }
  async function loadAdmin(reset = true, only = 'both') {
    const loadMembers = only !== 'resources', loadResources = only !== 'members';
    if (!isAdmin || (loadMembers && adminMembersLoading) || (loadResources && adminResourcesLoading)) return;
    if (loadMembers) adminMembersLoading = true;
    if (loadResources) adminResourcesLoading = true;
    const memberMoreButton = $('tc-admin-members-more'), resourceMoreButton = $('tc-admin-resources-more');
    if (loadMembers && memberMoreButton) memberMoreButton.disabled = true;
    if (loadResources && resourceMoreButton) resourceMoreButton.disabled = true;
    try {
    if (reset) {
      if (loadMembers) {
        adminMembersOffset = 0; adminMembersMore = false;
        $('tc-admin-members').replaceChildren();
      }
      if (loadResources) {
        adminResourcesOffset = 0; adminResourcesMore = false;
        $('tc-admin-resources').replaceChildren();
      }
    }
    const [members, docs] = await Promise.all([
      only === 'resources' ? Promise.resolve({data:[],error:null}) : client.from('teacher_community_members').select('*').order('created_at',{ascending:false}).order('user_id',{ascending:false})
        .range(adminMembersOffset, adminMembersOffset + PAGE_SIZE - 1),
      only === 'members' ? Promise.resolve({data:[],error:null}) : client.from('teacher_community_resources').select('*').order('created_at',{ascending:false}).order('id',{ascending:false})
        .range(adminResourcesOffset, adminResourcesOffset + PAGE_SIZE - 1)
    ]);
    const memberPage = members.error ? [] : (members.data || []);
    const resourcePage = docs.error ? [] : (docs.data || []);
    if (loadMembers) {
      if (members.error) {
        console.error('[Teacher community admin members]', members.error);
        $('tc-admin-members').insertAdjacentHTML('beforeend',
          '<div class="tc-state" role="alert">تعذر تحميل طلبات العضوية. <button type="button" data-retry-admin-members>إعادة المحاولة</button></div>');
      } else {
        adminMembersOffset += memberPage.length;
        adminMembersMore = memberPage.length === PAGE_SIZE;
        $('tc-admin-members').insertAdjacentHTML('beforeend', memberPage.map(m =>
          '<div class="tc-admin-row"><span><b>' + escapeHtml(m.display_name) + '</b><br>' + escapeHtml(m.professional_title || m.school_name || m.status) + '</span><span>' + escapeHtml(m.status) + '</span><span>' +
          (m.status !== 'approved' ? '<button data-approve-member="' + escapeHtml(m.user_id) + '">موافقة</button>' : '') +
          (m.status !== 'suspended' ? '<button class="reject" data-suspend-member="' + escapeHtml(m.user_id) + '">تعليق</button>' : '') + '</span></div>'
        ).join(''));
        if (reset && !memberPage.length) $('tc-admin-members').innerHTML = '<div class="tc-state">لا توجد طلبات.</div>';
      }
      $('tc-admin-members-more').hidden = !adminMembersMore;
    }
    if (loadResources) {
      if (docs.error) {
        console.error('[Teacher community admin resources]', docs.error);
        $('tc-admin-resources').insertAdjacentHTML('beforeend',
          '<div class="tc-state" role="alert">تعذر تحميل الموارد. <button type="button" data-retry-admin-resources>إعادة المحاولة</button></div>');
      } else {
        adminResourcesOffset += resourcePage.length;
        adminResourcesMore = resourcePage.length === PAGE_SIZE;
        $('tc-admin-resources').insertAdjacentHTML('beforeend', resourcePage.map(r =>
          '<div class="tc-admin-row"><span><b>' + escapeHtml(r.title) + '</b><br>' + escapeHtml(r.file_name) + '</span><span>' + escapeHtml(r.status) + '</span><span><button data-hide-resource="' + escapeHtml(r.id) + '">' + (r.status === 'hidden' ? 'نشر' : 'إخفاء') + '</button><button class="danger" data-admin-delete="' + escapeHtml(r.id) + '">حذف نهائياً</button></span></div>'
        ).join(''));
        if (reset && !resourcePage.length) $('tc-admin-resources').innerHTML = '<div class="tc-state">لا توجد موارد.</div>';
      }
      $('tc-admin-resources-more').hidden = !adminResourcesMore;
    }
    } finally {
      if (loadMembers) adminMembersLoading = false;
      if (loadResources) adminResourcesLoading = false;
      if (loadMembers && memberMoreButton) memberMoreButton.disabled = false;
      if (loadResources && resourceMoreButton) resourceMoreButton.disabled = false;
    }
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
    if (uploadInProgress) return;
    if (!user || !(isAdmin || (member && member.status === 'approved'))) { message('tc-upload-message','يجب تفعيل عضويتك قبل رفع الملفات.'); return; }
    const file = $('tc-file').files[0], title = $('tc-file-title').value.trim();
    if (!file) return message('tc-upload-message','اختر ملفاً أولاً.');
    const ext = fileExt(file.name);
    if (!allowed.has(ext)) return message('tc-upload-message','صيغة الملف غير مسموح بها.');
    if (file.size <= 0 || file.size > MAX_FILE) return message('tc-upload-message','حجم الملف يجب ألا يتجاوز 50 MB.');
    if (file.name.length > 255) return message('tc-upload-message','اسم الملف طويل جداً. أعد تسميته إلى أقل من 256 حرفاً.');
    if (title.length < 2) return message('tc-upload-message','أدخل عنواناً واضحاً للوثيقة.');
    const mimeType = fileMime(file);
    if (!mimeType) return message('tc-upload-message','تعذر تحديد نوع الملف. أعد حفظه بصيغة مدعومة ثم حاول مجدداً.');
    uploadInProgress = true;
    const submit = $('tc-upload-submit'); submit.disabled = true; submit.textContent = 'جارٍ رفع الملف...';
    const path = user.id + '/' + crypto.randomUUID() + '.' + ext;
    try {
      const upload = await client.storage.from('teacher-community').upload(path,file,{contentType:mimeType,upsert:false});
      if (upload.error) throw upload.error;
      const row = {owner_id:user.id,title,description:$('tc-file-description').value.trim(),category:$('tc-file-category').value,
        file_name:file.name,mime_type:mimeType,size_bytes:file.size,storage_path:path,
        is_shared:$('tc-file-share').checked,status:'published'};
      const saved = await client.from('teacher_community_resources').insert(row);
      if (saved.error) {
        const cleanup = await client.storage.from('teacher-community').remove([path]);
        if (cleanup.error) {
          console.error('[Teacher community] Uploaded object cleanup failed:', path, cleanup.error);
          throw new Error('تعذر حفظ بيانات الوثيقة، كما تعذر تنظيف الملف المؤقت تلقائياً. أبلغ إدارة المنصة ليتم تنظيفه بأمان. ' + saved.error.message);
        }
        throw saved.error;
      }
      $('tc-upload-form').reset(); $('tc-upload-dialog').close();
      await Promise.all([loadLibrary(),loadMyResources()]);
    } catch(err) { message('tc-upload-message',err.message || 'فشل رفع الملف.'); }
    finally {
      uploadInProgress = false;
      submit.disabled=false;
      submit.textContent='رفع وحفظ الوثيقة';
    }
  }
  async function handleAdminAction(e) {
    const b=e.target.closest('button'); if(!b || !isAdmin || b.disabled) return;
    b.disabled = true;
    try {
      if (b.dataset.retryAdminMembers) {
        await loadAdmin(true,'members');
      } else if (b.dataset.retryAdminResources) {
        await loadAdmin(true,'resources');
      } else if (b.dataset.approveMember || b.dataset.suspendMember) {
        const id=b.dataset.approveMember || b.dataset.suspendMember, status=b.dataset.approveMember?'approved':'suspended';
        const updated=await client.from('teacher_community_members').update({status,updated_at:new Date().toISOString()})
          .eq('user_id',id).select('user_id').maybeSingle();
        if(updated.error) throw updated.error;
        if(!updated.data) throw new Error('لم يتغير وضع العضوية؛ لم يتم العثور على السجل أو لا تملك صلاحية تعديله.');
        await loadAdmin();
      } else if (b.dataset.hideResource) {
        const id=b.dataset.hideResource, r=await findResource(id);
        if(!r) throw new Error('لم تعد الوثيقة موجودة. حدّث القائمة.');
        const updated=await client.from('teacher_community_resources').update({status:r.status==='hidden'?'published':'hidden',updated_at:new Date().toISOString()})
          .eq('id',id).select('id').maybeSingle();
        if(updated.error) throw updated.error;
        if(!updated.data) throw new Error('لم تتغير حالة الوثيقة؛ تحقق من صلاحيات الإدارة ثم أعد تحميل القائمة.');
        await Promise.all([loadAdmin(),loadLibrary()]);
      } else if (b.dataset.adminDelete) {
        const id=b.dataset.adminDelete, r=await findResource(id);
        if (!r) return;
        if (!window.confirm('هل تريد حذف هذه الوثيقة من المجتمع نهائياً؟')) return;
        await safelyDeleteResource(r);
        await Promise.all([loadAdmin(),loadLibrary(),loadMyResources()]);
      }
    } catch(err) { alert(err.message || 'تعذر تنفيذ العملية.'); }
    finally { if (b.isConnected) b.disabled = false; }
  }
  function wire() {
    $('tc-account').addEventListener('click',()=>user?$('tc-dashboard').scrollIntoView({behavior:'smooth'}):openAuth('login'));
    $('tc-hero-join').addEventListener('click',()=>user?$('tc-dashboard').scrollIntoView({behavior:'smooth'}):openAuth('register'));
    $('tc-auth-form').addEventListener('submit',handleAuth);
    document.querySelectorAll('[data-auth-view]').forEach(b=>b.addEventListener('click',()=>{authView=b.dataset.authView;openAuth(authView);}));
    $('tc-upload-open').addEventListener('click',()=>{if(!user)openAuth('login');else if(isAdmin || member?.status==='approved')$('tc-upload-dialog').showModal();else alert('طلب عضويتك قيد المراجعة.');});
    $('tc-upload-form').addEventListener('submit',handleUpload);
    $('tc-file').addEventListener('change',updateSelectedFileHint);
    $('tc-search').addEventListener('input',()=>{updateLibraryResetVisibility();clearTimeout(librarySearchTimer);librarySearchTimer=setTimeout(()=>loadLibrary(true),300);});
    $('tc-category').addEventListener('change',()=>{updateLibraryResetVisibility();clearTimeout(librarySearchTimer);loadLibrary(true);});
    $('tc-file-type').addEventListener('change',()=>{updateLibraryResetVisibility();clearTimeout(librarySearchTimer);loadLibrary(true);});
    $('tc-library-sort').addEventListener('change',()=>{updateLibraryResetVisibility();clearTimeout(librarySearchTimer);loadLibrary(true);});
    $('tc-library-reset').addEventListener('click',()=>{
      clearTimeout(librarySearchTimer);
      $('tc-search').value=''; $('tc-category').value=''; $('tc-file-type').value=''; $('tc-library-sort').value='newest';
      updateLibraryResetVisibility(); loadLibrary(true);
    });
    $('tc-resource-grid').addEventListener('click',resourceAction); $('tc-my-resources').addEventListener('click',resourceAction);
    $('tc-admin-members').addEventListener('click',handleAdminAction); $('tc-admin-resources').addEventListener('click',handleAdminAction);
    $('tc-logout').addEventListener('click',async()=>{await client.auth.signOut();user=null;member=null;isAdmin=false;setSignedInUI();});
    document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x===b));['mine','pending','admin'].forEach(p=>$( 'tc-'+p+'-panel').hidden=p!==b.dataset.panel);}));
    $('tc-admin-tab').addEventListener('click',()=>{if(isAdmin)loadAdmin();});
    $('tc-library-more').addEventListener('click',()=>loadLibrary(false));
    $('tc-my-resources-more').addEventListener('click',()=>loadMyResources(false));
    $('tc-my-filter').addEventListener('change',()=>{updateMyResetVisibility();loadMyResources(true);});
    $('tc-my-sort').addEventListener('change',()=>{updateMyResetVisibility();loadMyResources(true);});
    $('tc-my-search').addEventListener('input',()=>{ $('tc-my-search-clear').hidden = !$('tc-my-search').value; updateMyResetVisibility(); clearTimeout(mySearchTimer);mySearchTimer=setTimeout(()=>loadMyResources(true),300);});
    $('tc-my-search-clear').addEventListener('click',()=>{ clearTimeout(mySearchTimer); $('tc-my-search').value=''; $('tc-my-search-clear').hidden=true; updateMyResetVisibility(); loadMyResources(true); $('tc-my-search').focus(); });
    $('tc-my-reset').addEventListener('click',()=>{clearTimeout(mySearchTimer);$('tc-my-search').value='';$('tc-my-search-clear').hidden=true;$('tc-my-filter').value='all';$('tc-my-sort').value='newest';updateMyResetVisibility();loadMyResources(true);});
    $('tc-admin-members-more').addEventListener('click',()=>loadAdmin(false,'members'));
    $('tc-admin-resources-more').addEventListener('click',()=>loadAdmin(false,'resources'));
  }
  async function resourceAction(e) {
    const b=e.target.closest('button'); if(!b || b.disabled)return;
    if (!b.dataset.download && !b.dataset.delete && !b.dataset.toggleShare) return;
    b.disabled = true;
    try {
      if(b.dataset.download) await downloadResource(b.dataset.download);
      if(b.dataset.delete) await deleteResource(b.dataset.delete);
      if(b.dataset.toggleShare) await toggleShare(b.dataset.toggleShare);
    } catch(err) { alert(err.message || 'تعذر تنفيذ العملية.'); }
    finally { if (b.isConnected) b.disabled = false; }
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