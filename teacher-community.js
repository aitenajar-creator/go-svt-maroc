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
  let adminActivitySearchTimer = null;
  let libraryOffset = 0, libraryHasMore = false, libraryRequest = 0, libraryLoading = false, libraryRefreshPending = false, librarySearchTimer = null, mySearchTimer = null, myOffset = 0, myHasMore = false, myLoading = false, myRefreshPending = false, adminMembersLoading = false, adminResourcesLoading = false, adminMembersOffset = 0, adminResourcesOffset = 0, adminMembersMore = false, adminResourcesMore = false, adminResourcesRefreshPending = false, adminResourceSearchTimer = null, adminActivityOffset = 0, adminActivityMore = false, adminActivityLoading = false, adminActivityRefreshPending = false;

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
    const dialog = $('tc-auth-dialog');
    const registering = authView === 'register';
    $('tc-auth-title').textContent = registering ? 'إنشاء حساب في مجتمع الأساتذة' : 'الدخول إلى مجتمع الأساتذة';
    $('tc-register-fields').hidden = !registering;
    $('tc-name').required = registering;
    $('tc-password').autocomplete = registering ? 'new-password' : 'current-password';
    $('tc-auth-submit').textContent = registering ? 'إنشاء الحساب' : 'دخول';
    document.querySelectorAll('[data-auth-view]').forEach(b => {
      const selected = b.dataset.authView === authView;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    message('tc-auth-message', '');
    // Tabs can switch views while the native dialog is already open.
    // Calling showModal() again on an open dialog throws InvalidStateError.
    if (!dialog.open) dialog.showModal();
    (registering ? $('tc-name') : $('tc-email')).focus();
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
    if (isAdmin) { loadAdmin(); loadAdminActivity(true); }
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
      '<div class="tc-resource-actions">' +
      (['application/pdf','image/jpeg','image/png','image/webp'].includes(r.mime_type) ? '<button type="button" data-preview="' + escapeHtml(r.id) + '">👁 معاينة</button>' : '') +
      '<button type="button" data-download="' + escapeHtml(r.id) + '">⬇ تحميل</button>' +
      ((isAdmin || (own && member && member.status === 'approved')) ? '<button type="button" data-edit-resource="' + escapeHtml(r.id) + '">تعديل البيانات</button>' : '') +
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
      if (reset) void updateMyStats();
      resources = reset ? page : resources.concat(page);
      libraryOffset = start + page.length;
      libraryHasMore = page.length === PAGE_SIZE;
      $('tc-library-more').hidden = !libraryHasMore;
      renderLibrary();
    } catch (err) {
      if (requestId === libraryRequest) {
        $('tc-library-state').hidden = false;
        $('tc-library-state').textContent = 'تعذر الاتصال بالمكتبة. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.';
        if (reset) $('tc-library-more').hidden = true;
      }
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
  async function updateMyStats() {
    if (!user) return;
    const ids = ['total','shared','private','hidden'];
    ids.forEach(id => { const node = $('tc-my-stat-' + id); if (node) node.textContent = '…'; });
    try {
      const base = () => client.from('teacher_community_resources').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
      const results = await Promise.all([
        base(),
        base().eq('status','published').eq('is_shared',true),
        base().eq('status','published').eq('is_shared',false),
        base().eq('status','hidden')
      ]);
      const failed = results.find(result => result.error);
      if (failed) throw failed.error;
      results.forEach((result,index) => {
        const node = $('tc-my-stat-' + ids[index]);
        if (node) node.textContent = Number(result.count || 0).toLocaleString('ar-MA');
      });
      $('tc-my-stats-status').textContent = 'تم تحديث ملخص ملفاتك.';
    } catch (error) {
      ids.forEach(id => { const node = $('tc-my-stat-' + id); if (node) node.textContent = '—'; });
      $('tc-my-stats-status').textContent = 'تعذر تحديث ملخص ملفاتك. يمكنك إعادة تحميل الصفحة.';
      console.warn('[Teacher community stats]', error);
    }
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
    const retry = '<div class="tc-state" role="alert">تعذر تحميل ملفاتك. تحقق من الاتصال ثم أعد المحاولة.<br><button type="button" class="tc-filter-reset" data-retry-my-resources>إعادة تحميل ملفاتي</button></div>';
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
      if (error) {
        $('tc-my-resources-status').textContent = 'تعذر تحميل ملفاتك. تحقق من الاتصال ثم أعد المحاولة.';
        if (reset) $('tc-my-resources').innerHTML = retry;
        else $('tc-my-resources').insertAdjacentHTML('beforeend', retry);
        if (reset) $('tc-my-resources-more').hidden = true;
        return;
      }
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
    } catch (err) {
      $('tc-my-resources-status').textContent = 'تعذر الاتصال بملفاتك. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.';
      if (reset) $('tc-my-resources').innerHTML = retry;
      else $('tc-my-resources').insertAdjacentHTML('beforeend', retry);
      if (reset) $('tc-my-resources-more').hidden = true;
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
      // Accept only a signed URL served by this community's configured Supabase project.
      // A malformed or unexpected redirect must never be opened as a download target.
      let signedUrl;
      try {
        signedUrl = new URL(data && data.signedUrl);
      } catch (_) {
        throw new Error('تعذر تجهيز رابط تنزيل صالح. أعد المحاولة.');
      }
      if (signedUrl.protocol !== 'https:' || signedUrl.origin !== new URL(config.url).origin) {
        throw new Error('رابط التنزيل غير موثوق. أعد المحاولة أو أبلغ إدارة المنصة.');
      }
      if (!downloadTab || downloadTab.closed) {
        throw new Error('منع المتصفح فتح نافذة التنزيل. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.');
      }
      downloadTab.location.replace(data.signedUrl);
    } catch (err) {
      if (downloadTab && !downloadTab.closed) downloadTab.close();
      throw err;
    }
  }
  async function previewResource(id) {
    // Open synchronously from the user's click so popup blockers do not reject the preview.
    const previewTab = window.open('about:blank', '_blank');
    if (previewTab) {
      try { previewTab.opener = null; } catch (_) {}
      try { previewTab.document.title = 'جارٍ تجهيز المعاينة…'; } catch (_) {}
    }
    try {
      const r = resources.find(x => x.id === id) || await findResource(id);
      if (!r) throw new Error('لم يتم العثور على الملف.');
      const previewableTypes = ['application/pdf','image/jpeg','image/png','image/webp'];
      if (!previewableTypes.includes(r.mime_type)) {
        throw new Error('المعاينة متاحة حالياً لملفات PDF والصور فقط.');
      }
      const { data, error } = await client.storage.from('teacher-community').createSignedUrl(r.storage_path, 90);
      if (error) throw error;
      let signedUrl;
      try {
        signedUrl = new URL(data && data.signedUrl);
      } catch (_) {
        throw new Error('تعذر تجهيز رابط معاينة صالح. أعد المحاولة.');
      }
      if (signedUrl.protocol !== 'https:' || signedUrl.origin !== new URL(config.url).origin) {
        throw new Error('رابط المعاينة غير موثوق. أعد المحاولة أو أبلغ إدارة المنصة.');
      }
      if (!previewTab || previewTab.closed) {
        throw new Error('منع المتصفح فتح نافذة المعاينة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.');
      }
      previewTab.location.replace(data.signedUrl);
    } catch (err) {
      if (previewTab && !previewTab.closed) previewTab.close();
      throw err;
    }
  }
  let editingResourceId = null, editInProgress = false;
  async function openEditResource(id) {
    if (!user) throw new Error('سجّل الدخول أولاً.');
    const r = resources.find(x => x.id === id) || await findResource(id);
    if (!r) throw new Error('لم يتم العثور على الوثيقة.');
    const canEdit = isAdmin || (r.owner_id === user.id && member && member.status === 'approved');
    if (!canEdit) throw new Error('لا تملك صلاحية تعديل بيانات هذه الوثيقة.');
    editingResourceId = r.id;
    $('tc-edit-title').value = r.title || '';
    $('tc-edit-description').value = r.description || '';
    $('tc-edit-category').value = r.category || 'other';
    $('tc-edit-share').checked = r.is_shared === true;
    message('tc-edit-message','');
    $('tc-edit-dialog').showModal();
    $('tc-edit-title').focus();
  }
  async function handleEditResource(e) {
    e.preventDefault();
    if (editInProgress || !editingResourceId) return;
    const title = $('tc-edit-title').value.trim();
    const description = $('tc-edit-description').value.trim();
    if (title.length < 2 || title.length > 180) return message('tc-edit-message','يجب أن يتراوح العنوان بين حرفين و180 حرفاً.');
    if (description.length > 3000) return message('tc-edit-message','الوصف أطول من الحد المسموح.');
    const category = $('tc-edit-category').value;
    if (!Object.prototype.hasOwnProperty.call(categories, category)) return message('tc-edit-message','اختر تصنيفاً صالحاً.');
    editInProgress = true;
    const submit = $('tc-edit-submit');
    const closeButton = $('tc-edit-dialog').querySelector('.tc-dialog-close');
    submit.disabled = true; submit.textContent = 'جارٍ حفظ التعديلات...';
    if (closeButton) closeButton.disabled = true;
    try {
      const updated = await client.from('teacher_community_resources').update({
        title, description, category, is_shared: $('tc-edit-share').checked,
        updated_at: new Date().toISOString()
      }).eq('id', editingResourceId).select('id').maybeSingle();
      if (updated.error) throw updated.error;
      if (!updated.data) throw new Error('لم تُحفظ التعديلات. تحقق من صلاحية إدارة الوثيقة ثم أعد المحاولة.');
      $('tc-edit-dialog').close();
      editingResourceId = null;
      await Promise.all([loadLibrary(), loadMyResources(), isAdmin ? loadAdmin() : Promise.resolve(), isAdmin ? loadAdminActivity(true) : Promise.resolve()]);
    } catch (err) {
      message('tc-edit-message', err.message || 'تعذر حفظ التعديلات.');
    } finally {
      editInProgress = false;
      submit.disabled = false; submit.textContent = 'حفظ التعديلات';
      if (closeButton) closeButton.disabled = false;
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
    if (!isAdmin) return;
    if ((loadMembers && adminMembersLoading) || (loadResources && adminResourcesLoading)) {
      if (reset && loadResources) adminResourcesRefreshPending = true;
      return;
    }
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
    let adminResourceQuery = client.from('teacher_community_resources').select('*');
    const adminSearch = ($('tc-admin-resource-search')?.value || '').trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    const adminStatus = $('tc-admin-resource-status')?.value || 'all';
    const adminCategory = $('tc-admin-resource-category')?.value || '';
    if (adminSearch) {
      const pattern = '%' + adminSearch + '%';
      adminResourceQuery = adminResourceQuery.or('title.ilike.' + pattern + ',description.ilike.' + pattern + ',file_name.ilike.' + pattern);
    }
    if (adminCategory) adminResourceQuery = adminResourceQuery.eq('category', adminCategory);
    if (adminStatus === 'hidden') adminResourceQuery = adminResourceQuery.eq('status', 'hidden');
    if (adminStatus === 'shared') adminResourceQuery = adminResourceQuery.eq('status', 'published').eq('is_shared', true);
    if (adminStatus === 'private') adminResourceQuery = adminResourceQuery.eq('status', 'published').eq('is_shared', false);
    const [members, docs] = await Promise.all([
      only === 'resources' ? Promise.resolve({data:[],error:null}) : client.from('teacher_community_members').select('*').order('created_at',{ascending:false}).order('user_id',{ascending:false})
        .range(adminMembersOffset, adminMembersOffset + PAGE_SIZE - 1),
      only === 'members' ? Promise.resolve({data:[],error:null}) : adminResourceQuery.order('created_at',{ascending:false}).order('id',{ascending:false})
        .range(adminResourcesOffset, adminResourcesOffset + PAGE_SIZE - 1)
    ]);
    const memberPage = members.error ? [] : (members.data || []);
    const resourcePage = docs.error ? [] : (docs.data || []);
    let resourceOwners = {};
    if (loadResources && resourcePage.length) {
      const ownerIds = [...new Set(resourcePage.map(r => r.owner_id).filter(Boolean))];
      const ownerResult = ownerIds.length
        ? await client.from('teacher_community_members').select('user_id,display_name,professional_title,school_name').in('user_id', ownerIds)
        : {data:[],error:null};
      if (ownerResult.error) console.warn('[Teacher community admin resource owners]', ownerResult.error);
      else resourceOwners = Object.fromEntries((ownerResult.data || []).map(m => [m.user_id, m]));
    }
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
        $('tc-admin-resources').insertAdjacentHTML('beforeend', resourcePage.map(r => {
          const owner = resourceOwners[r.owner_id];
          const ownerLabel = owner ? owner.display_name : 'عضو غير متاح';
          const ownerDetail = owner && (owner.professional_title || owner.school_name);
          const statusLabel = r.status === 'hidden' ? 'مخفي' : (r.is_shared ? 'مشترك' : 'خاص');
          return '<article class="tc-admin-resource-row">' +
            '<div class="tc-admin-resource-main"><b>' + escapeHtml(r.title) + '</b><span>' + escapeHtml(r.file_name) + '</span>' +
            '<small>صاحب المورد: ' + escapeHtml(ownerLabel) + (ownerDetail ? ' · ' + escapeHtml(ownerDetail) : '') + '</small></div>' +
            '<div class="tc-admin-resource-meta"><span class="tc-admin-resource-status ' + (r.status === 'hidden' ? 'is-hidden' : (r.is_shared ? 'is-shared' : 'is-private')) + '">' + statusLabel + '</span>' +
            '<span>' + escapeHtml(categories[r.category] || categories.other) + '</span><span>' + escapeHtml(dateLabel(r.created_at)) + '</span>' +
            '<span>' + (Number(r.size_bytes) / 1048576).toFixed(1) + ' MB</span></div>' +
            '<div class="tc-admin-resource-actions"><button type="button" data-hide-resource="' + escapeHtml(r.id) + '">' + (r.status === 'hidden' ? 'إعادة النشر' : 'إخفاء') + '</button>' +
            '<button type="button" class="danger" data-admin-delete="' + escapeHtml(r.id) + '">حذف نهائياً</button></div></article>';
        }).join(''));
        if (reset && !resourcePage.length) $('tc-admin-resources').innerHTML = '<div class="tc-state">لا توجد موارد تطابق معايير البحث والتصفية الحالية.</div>';
      }
      $('tc-admin-resources-more').hidden = !adminResourcesMore;
    }
    } catch (err) {
      if (loadMembers) {
        $('tc-admin-members').insertAdjacentHTML('beforeend', '<div class="tc-state" role="alert">تعذر الاتصال بطلبات العضوية. <button type="button" data-retry-admin-members>إعادة المحاولة</button></div>');
      }
      if (loadResources) {
        $('tc-admin-resources').insertAdjacentHTML('beforeend', '<div class="tc-state" role="alert">تعذر الاتصال بموارد المجتمع. <button type="button" data-retry-admin-resources>إعادة المحاولة</button></div>');
      }
    } finally {
      if (loadMembers) adminMembersLoading = false;
      if (loadResources) adminResourcesLoading = false;
      if (loadMembers && memberMoreButton) memberMoreButton.disabled = false;
      if (loadResources && resourceMoreButton) resourceMoreButton.disabled = false;
      if (loadResources && adminResourcesRefreshPending) {
        adminResourcesRefreshPending = false;
        void loadAdmin(true, 'resources');
      }
    }
  }
  const activityActions = {
    uploaded: 'رفع مورد جديد', updated: 'تعديل بيانات مورد',
    hidden: 'إخفاء مورد', restored: 'إعادة نشر مورد',
    shared: 'مشاركة مورد', unshared: 'إلغاء مشاركة مورد',
    deleted: 'حذف مورد نهائياً'
  };
  const activityFields = {title:'العنوان',description:'الوصف',category:'التصنيف',status:'حالة النشر',is_shared:'المشاركة'};
  function activityDate(value) {
    try { return new Intl.DateTimeFormat('ar-MA',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }
    catch (_) { return ''; }
  }
  function activityDetails(details) {
    if (!details || typeof details !== 'object') return '';
    const displayValue = (key, value) => {
      if (value === null || value === undefined || value === '') return '—';
      if (key === 'category') return categories[value] || String(value);
      if (key === 'status') return ({published:'منشور',hidden:'مخفي'})[value] || String(value);
      if (key === 'is_shared') return value === true ? 'مشترك' : value === false ? 'خاص' : String(value);
      return String(value);
    };
    return Object.entries(details).map(([key,value]) => {
      const label = activityFields[key] || key;
      if (value && typeof value === 'object' && ('before' in value || 'after' in value)) {
        const before = displayValue(key, value.before);
        const after = displayValue(key, value.after);
        return label + ': ' + before + ' ← ' + after;
      }
      return label + ': ' + displayValue(key, value);
    }).join(' · ');
  }
  async function loadAdminActivity(reset = true) {
    if (!isAdmin) return;
    if (adminActivityLoading) {
      if (reset) adminActivityRefreshPending = true;
      return;
    }
    adminActivityLoading = true;
    const moreButton = $('tc-admin-activity-more');
    if (moreButton) moreButton.disabled = true;
    const panel = $('tc-admin-activity');
    if (reset) {
      adminActivityOffset = 0; adminActivityMore = false;
      panel.replaceChildren();
      panel.textContent = 'جارٍ تحميل سجل النشاط...';
      moreButton.hidden = true;
    }
    try {
      const start = reset ? 0 : adminActivityOffset;
      let activityQuery = client.from('teacher_community_resource_activity')
        .select('id,resource_id,resource_title,owner_id,actor_id,action,details,created_at');
      const actionFilter = $('tc-admin-activity-action') ? $('tc-admin-activity-action').value : '';
      const rawActivitySearch = $('tc-admin-activity-search') ? $('tc-admin-activity-search').value.trim() : '';
      const activitySearch = rawActivitySearch.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      const rawActorSearch = $('tc-admin-activity-actor') ? $('tc-admin-activity-actor').value.trim() : '';
      const actorSearch = rawActorSearch.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (actionFilter) activityQuery = activityQuery.eq('action', actionFilter);
      if (activitySearch) activityQuery = activityQuery.ilike('resource_title', '%' + activitySearch + '%');
      if (actorSearch) {
        const actorResult = await client.from('teacher_community_members')
          .select('user_id').ilike('display_name', '%' + actorSearch + '%').limit(100);
        if (actorResult.error) throw actorResult.error;
        const actorIds = (actorResult.data || []).map(person => person.user_id).filter(Boolean);
        if (!actorIds.length) {
          adminActivityOffset = 0; adminActivityMore = false;
          panel.innerHTML = '<div class="tc-state">لا توجد عمليات باسم أستاذ يطابق البحث.</div>';
          moreButton.hidden = true;
          return;
        }
        activityQuery = activityQuery.in('actor_id', actorIds);
      }
      const {data,error} = await activityQuery
        .order('created_at',{ascending:false}).order('id',{ascending:false})
        .range(start,start + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      const personIds = [...new Set(page.flatMap(row => [row.actor_id,row.owner_id]).filter(Boolean))];
      let people = {};
      if (personIds.length) {
        const peopleResult = await client.from('teacher_community_members')
          .select('user_id,display_name,professional_title,school_name').in('user_id',personIds);
        if (peopleResult.error) console.warn('[Teacher community activity people]',peopleResult.error);
        else people = Object.fromEntries((peopleResult.data || []).map(person => [person.user_id,person]));
      }
      adminActivityOffset = start + page.length;
      adminActivityMore = page.length === PAGE_SIZE;
      if (reset) panel.replaceChildren();
      if (!page.length && reset) {
        panel.innerHTML = '<div class="tc-state">لا توجد عمليات مسجلة بعد. ستظهر هنا عمليات رفع الموارد وتعديلها وإخفائها وإعادة نشرها وحذفها.</div>';
      } else {
        panel.insertAdjacentHTML('beforeend',page.map(row => {
          const actor = people[row.actor_id];
          const owner = people[row.owner_id];
          const actorName = row.actor_id === user.id ? 'إدارة المنصة' : (actor ? actor.display_name : 'حساب غير متاح');
          const actorRole = actor && (actor.professional_title || actor.school_name);
          const ownerName = owner ? owner.display_name : (row.owner_id === user.id ? 'إدارة المنصة' : 'عضو غير متاح');
          const action = activityActions[row.action] || 'عملية على مورد';
          const detail = activityDetails(row.details);
          return '<article class="tc-activity-row">' +
            '<div class="tc-activity-icon" aria-hidden="true">◷</div>' +
            '<div class="tc-activity-main"><b>' + escapeHtml(action) + '</b>' +
            '<span>' + escapeHtml(row.resource_title || 'مورد محذوف') + '</span>' +
            '<small>المنفذ: ' + escapeHtml(actorName) + (actorRole ? ' · ' + escapeHtml(actorRole) : '') +
            ' | صاحب المورد: ' + escapeHtml(ownerName) + '</small>' +
            (detail ? '<small class="tc-activity-details">' + escapeHtml(detail) + '</small>' : '') +
            '</div><time datetime="' + escapeHtml(row.created_at) + '">' + escapeHtml(activityDate(row.created_at)) + '</time></article>';
        }).join(''));
      }
      moreButton.hidden = !adminActivityMore;
    } catch (error) {
      console.error('[Teacher community activity]',error);
      panel.innerHTML = '<div class="tc-state" role="alert">تعذر تحميل سجل النشاط. تأكد من تطبيق ترحيل سجل التدقيق في قاعدة البيانات ثم أعد المحاولة.</div>';
      moreButton.hidden = true;
    } finally {
      adminActivityLoading = false;
      if (moreButton) moreButton.disabled = false;
      if (adminActivityRefreshPending) {
        adminActivityRefreshPending = false;
        void loadAdminActivity(true);
      }
    }
  }
  function csvCell(value) {
    const normalized = value == null ? '' : String(value);
    return '"' + normalized.replace(/"/g, '""') + '"';
  }
  async function exportMyResources() {
    if (!user) return;
    const button = $('tc-my-export');
    const status = $('tc-my-export-status');
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'جارٍ تجهيز الملف...';
    if (status) status.textContent = 'جارٍ جمع ملفاتك المطابقة للفلاتر الحالية...';
    try {
      const filter = $('tc-my-filter').value;
      const rawSearch = $('tc-my-search').value.trim();
      const search = rawSearch.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      const sort = $('tc-my-sort').value;
      const rows = [];
      const pageSize = 500;
      for (let offset = 0; offset < 10000; offset += pageSize) {
        let query = client.from('teacher_community_resources')
          .select('id,title,description,category,file_name,mime_type,size_bytes,is_shared,status,created_at,updated_at')
          .eq('owner_id', user.id);
        if (search) {
          const pattern = '%' + search + '%';
          query = query.or('title.ilike.' + pattern + ',description.ilike.' + pattern + ',file_name.ilike.' + pattern);
        }
        if (filter === 'shared') query = query.eq('status','published').eq('is_shared',true);
        if (filter === 'private') query = query.eq('status','published').eq('is_shared',false);
        if (filter === 'hidden') query = query.eq('status','hidden');
        const primaryOrder = sort === 'title' ? 'title' : 'created_at';
        const result = await query.order(primaryOrder,{ascending:sort === 'oldest' || sort === 'title'})
          .order('id',{ascending:sort === 'oldest' || sort === 'title'})
          .range(offset, offset + pageSize - 1);
        if (result.error) throw result.error;
        const page = result.data || [];
        rows.push(...page);
        if (page.length < pageSize) break;
        if (offset + pageSize >= 10000) throw new Error('تجاوزت النتائج 10000 ملف. ضيّق البحث أو اختر تصنيفاً محدداً ثم أعد التصدير.');
      }
      const categoryNames = {curriculum:'المناهج والتوجيهات',lesson:'الدروس والجذاذات',presentation:'العروض التقديمية',assessment:'الفروض والتقويم',exam:'الامتحانات',correction:'التصحيح',planning:'التخطيط السنوي',professional:'وثائق مهنية',training:'التكوين المستمر',other:'موارد أخرى'};
      const lines = [['العنوان','الوصف','التصنيف','اسم الملف','نوع الملف','الحجم بالبايت','حالة النشر','المشاركة','تاريخ الإضافة','آخر تحديث','معرّف المورد'],
        ...rows.map(row => [row.title,row.description,categoryNames[row.category] || row.category,row.file_name,row.mime_type,row.size_bytes,
          row.status === 'hidden' ? 'مخفي' : 'منشور',row.is_shared ? 'مشترك' : 'خاص',row.created_at,row.updated_at,row.id])];
      const csv = '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'my-teacher-resources-' + new Date().toISOString().slice(0,10) + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (status) status.textContent = 'تم تصدير ' + rows.length + ' ملفاً من ملفاتك وفق الفلاتر الحالية.';
    } catch (error) {
      console.error('[Teacher community personal export]', error);
      if (status) status.textContent = error.message || 'تعذر تصدير ملفاتك.';
    } finally {
      button.disabled = false;
      button.textContent = '⬇ تصدير ملفاتي CSV';
    }
  }
  async function exportAdminActivity() {
    if (!isAdmin || !user) return;
    const button = $('tc-admin-activity-export');
    const status = $('tc-admin-activity-export-status');
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'جارٍ تجهيز الملف...';
    if (status) status.textContent = 'جارٍ جمع العمليات المطابقة للفلاتر الحالية...';
    try {
      const actionFilter = $('tc-admin-activity-action').value;
      const rawSearch = $('tc-admin-activity-search').value.trim();
      const search = rawSearch.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      const rows = [];
      const pageSize = 500;
      for (let offset = 0; offset < 10000; offset += pageSize) {
        let query = client.from('teacher_community_resource_activity')
          .select('id,resource_id,resource_title,owner_id,actor_id,action,details,created_at');
        if (actionFilter) query = query.eq('action', actionFilter);
        if (search) query = query.ilike('resource_title', '%' + search + '%');
        const result = await query.order('created_at', {ascending:false})
          .order('id', {ascending:false}).range(offset, offset + pageSize - 1);
        if (result.error) throw result.error;
        const page = result.data || [];
        rows.push(...page);
        if (page.length < pageSize) break;
        if (offset + pageSize >= 10000) throw new Error('تجاوزت النتائج 10000 عملية. ضيّق البحث أو اختر نوع عملية محدداً ثم أعد التصدير.');
      }
      const ids = [...new Set(rows.flatMap(row => [row.actor_id, row.owner_id]).filter(Boolean))];
      const people = {};
      for (let i = 0; i < ids.length; i += 200) {
        const result = await client.from('teacher_community_members')
          .select('user_id,display_name').in('user_id', ids.slice(i, i + 200));
        if (result.error) throw result.error;
        (result.data || []).forEach(person => { people[person.user_id] = person.display_name; });
      }
      const actionNames = {uploaded:'رفع مورد',updated:'تعديل البيانات',hidden:'إخفاء مورد',restored:'إعادة نشر',shared:'مشاركة',unshared:'إلغاء المشاركة',deleted:'حذف مورد'};
      const header = ['التاريخ والوقت','العملية','عنوان المورد','المنفذ','صاحب المورد','معرّف المورد','تفاصيل التغيير'];
      const lines = [header, ...rows.map(row => [
        row.created_at, actionNames[row.action] || row.action, row.resource_title || 'مورد محذوف',
        row.actor_id === user.id ? 'إدارة المنصة' : (people[row.actor_id] || row.actor_id || ''),
        row.owner_id === user.id ? 'إدارة المنصة' : (people[row.owner_id] || row.owner_id || ''),
        row.resource_id || '', row.details ? JSON.stringify(row.details) : ''
      ])];
      const csv = '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'teacher-community-activity-' + new Date().toISOString().slice(0,10) + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (status) status.textContent = 'تم تجهيز ملف CSV ويحتوي على ' + rows.length + ' عملية مطابقة.';
    } catch (error) {
      console.error('[Teacher community activity export]', error);
      if (status) status.textContent = error.message || 'تعذر تصدير سجل النشاط.';
    } finally {
      button.disabled = false;
      button.textContent = '⬇ تصدير CSV';
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
    const closeButton = $('tc-upload-dialog').querySelector('.tc-dialog-close');
    if (closeButton) closeButton.disabled = true;
    try {
      // Keep path generation inside the guarded upload flow so any runtime error
      // still reaches finally and releases the dialog and submit-button locks.
      const path = user.id + '/' + crypto.randomUUID() + '.' + ext;
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
      await Promise.all([loadLibrary(),loadMyResources(),isAdmin ? loadAdminActivity(true) : Promise.resolve()]);
    } catch(err) { message('tc-upload-message',err.message || 'فشل رفع الملف.'); }
    finally {
      uploadInProgress = false;
      submit.disabled=false;
      submit.textContent='رفع وحفظ الوثيقة';
      if (closeButton) closeButton.disabled = false;
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
        await Promise.all([loadAdmin(),loadLibrary(),loadAdminActivity(true)]);
      } else if (b.dataset.adminDelete) {
        const id=b.dataset.adminDelete, r=await findResource(id);
        if (!r) return;
        if (!window.confirm('هل تريد حذف هذه الوثيقة من المجتمع نهائياً؟')) return;
        await safelyDeleteResource(r);
        await Promise.all([loadAdmin(),loadLibrary(),loadMyResources(),loadAdminActivity(true)]);
      }
    } catch(err) { alert(err.message || 'تعذر تنفيذ العملية.'); }
    finally { if (b.isConnected) b.disabled = false; }
  }
  async function inviteFriends() {
    const url = location.origin + location.pathname;
    const shareData = {
      title: 'مجتمع الأساتذة | GO SVT Maroc',
      text: 'انضم إلى مجتمع أساتذة علوم الحياة والأرض لتبادل الدروس والجذاذات والعروض والموارد المهنية.',
      url
    };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement('textarea');
        field.value = url;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('تعذر نسخ الرابط تلقائياً.');
      }
      alert('تم نسخ رابط مجتمع الأساتذة. يمكنك إرساله إلى زملائك.');
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      console.warn('[Teacher community invite]', error);
      alert('تعذر فتح المشاركة أو نسخ الرابط. يمكنك نسخ رابط الصفحة من شريط العنوان.');
    }
  }
  function wire() {
    $('tc-invite-friends').addEventListener('click', inviteFriends);
    $('tc-account').addEventListener('click',()=>user?$('tc-dashboard').scrollIntoView({behavior:'smooth'}):openAuth('login'));
    $('tc-hero-join').addEventListener('click',()=>user?$('tc-dashboard').scrollIntoView({behavior:'smooth'}):openAuth('register'));
    $('tc-auth-form').addEventListener('submit',handleAuth);
    document.querySelectorAll('[data-auth-view]').forEach(b=>b.addEventListener('click',()=>{authView=b.dataset.authView;openAuth(authView);}));
    $('tc-upload-open').addEventListener('click',()=>{if(!user)openAuth('login');else if(isAdmin || member?.status==='approved')$('tc-upload-dialog').showModal();else alert('طلب عضويتك قيد المراجعة.');});
    $('tc-upload-form').addEventListener('submit',handleUpload);
    $('tc-edit-form').addEventListener('submit',handleEditResource);
    $('tc-edit-dialog').addEventListener('cancel',e=>{if(editInProgress)e.preventDefault();});
    $('tc-upload-dialog').addEventListener('cancel',e=>{if(uploadInProgress)e.preventDefault();});
    $('tc-file').addEventListener('change',updateSelectedFileHint);
    $('tc-search').addEventListener('input',()=>{$('tc-search-clear').hidden = !$('tc-search').value;updateLibraryResetVisibility();clearTimeout(librarySearchTimer);librarySearchTimer=setTimeout(()=>loadLibrary(true),300);});
    $('tc-search-clear').addEventListener('click',()=>{clearTimeout(librarySearchTimer);$('tc-search').value='';$('tc-search-clear').hidden=true;updateLibraryResetVisibility();loadLibrary(true);$('tc-search').focus();});
    $('tc-category').addEventListener('change',()=>{updateLibraryResetVisibility();clearTimeout(librarySearchTimer);loadLibrary(true);});
    $('tc-file-type').addEventListener('change',()=>{updateLibraryResetVisibility();clearTimeout(librarySearchTimer);loadLibrary(true);});
    $('tc-library-sort').addEventListener('change',()=>{updateLibraryResetVisibility();clearTimeout(librarySearchTimer);loadLibrary(true);});
    $('tc-library-reset').addEventListener('click',()=>{
      clearTimeout(librarySearchTimer);
      $('tc-search').value=''; $('tc-search-clear').hidden=true; $('tc-category').value=''; $('tc-file-type').value=''; $('tc-library-sort').value='newest';
      updateLibraryResetVisibility(); loadLibrary(true);
    });
    $('tc-resource-grid').addEventListener('click',resourceAction); $('tc-my-resources').addEventListener('click',resourceAction);
    $('tc-admin-members').addEventListener('click',handleAdminAction); $('tc-admin-resources').addEventListener('click',handleAdminAction);
    $('tc-admin-resource-search').addEventListener('input',()=>{
      clearTimeout(adminResourceSearchTimer);
      adminResourceSearchTimer=setTimeout(()=>loadAdmin(true,'resources'),300);
    });
    $('tc-admin-resource-status').addEventListener('change',()=>loadAdmin(true,'resources'));
    $('tc-admin-resource-category').addEventListener('change',()=>loadAdmin(true,'resources'));
    $('tc-admin-resource-reset').addEventListener('click',()=>{
      clearTimeout(adminResourceSearchTimer);
      $('tc-admin-resource-search').value='';
      $('tc-admin-resource-status').value='all';
      $('tc-admin-resource-category').value='';
      loadAdmin(true,'resources');
    });
    $('tc-logout').addEventListener('click',async()=>{await client.auth.signOut();user=null;member=null;isAdmin=false;setSignedInUI();});
    document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-panel]').forEach(x=>{const selected=x===b;x.classList.toggle('active',selected);x.setAttribute('aria-pressed',String(selected));});['mine','pending','admin'].forEach(p=>$( 'tc-'+p+'-panel').hidden=p!==b.dataset.panel);}));
    $('tc-admin-tab').addEventListener('click',()=>{if(isAdmin){loadAdmin();loadAdminActivity(true);}});
    $('tc-admin-activity-more').addEventListener('click',()=>loadAdminActivity(false));
    $('tc-library-more').addEventListener('click',()=>loadLibrary(false));
    $('tc-my-resources-more').addEventListener('click',()=>loadMyResources(false));
    $('tc-my-filter').addEventListener('change',()=>{updateMyResetVisibility();loadMyResources(true);});
    $('tc-my-sort').addEventListener('change',()=>{updateMyResetVisibility();loadMyResources(true);});
    $('tc-my-search').addEventListener('input',()=>{ $('tc-my-search-clear').hidden = !$('tc-my-search').value; updateMyResetVisibility(); clearTimeout(mySearchTimer);mySearchTimer=setTimeout(()=>loadMyResources(true),300);});
    $('tc-my-search-clear').addEventListener('click',()=>{ clearTimeout(mySearchTimer); $('tc-my-search').value=''; $('tc-my-search-clear').hidden=true; updateMyResetVisibility(); loadMyResources(true); $('tc-my-search').focus(); });
    $('tc-my-reset').addEventListener('click',()=>{clearTimeout(mySearchTimer);$('tc-my-search').value='';$('tc-my-search-clear').hidden=true;$('tc-my-filter').value='all';$('tc-my-sort').value='newest';updateMyResetVisibility();loadMyResources(true);});
    $('tc-my-export').addEventListener('click',exportMyResources);
    $('tc-admin-members-more').addEventListener('click',()=>loadAdmin(false,'members'));
    $('tc-admin-resources-more').addEventListener('click',()=>loadAdmin(false,'resources'));
    $('tc-admin-activity-export').addEventListener('click',exportAdminActivity);
    $('tc-admin-activity-refresh').addEventListener('click',()=>loadAdminActivity(true));
    $('tc-admin-activity-action').addEventListener('change',()=>loadAdminActivity(true));
    const scheduleActivitySearch = () => {
      clearTimeout(adminActivitySearchTimer);
      adminActivitySearchTimer=setTimeout(()=>loadAdminActivity(true),300);
    };
    $('tc-admin-activity-search').addEventListener('input',scheduleActivitySearch);
    $('tc-admin-activity-actor').addEventListener('input',scheduleActivitySearch);
    $('tc-admin-activity-reset').addEventListener('click',()=>{
      clearTimeout(adminActivitySearchTimer);
      $('tc-admin-activity-search').value='';
      $('tc-admin-activity-actor').value='';
      $('tc-admin-activity-action').value='';
      loadAdminActivity(true);
    });
  }
  async function resourceAction(e) {
    const b=e.target.closest('button'); if(!b || b.disabled)return;
    if (!b.dataset.preview && !b.dataset.download && !b.dataset.editResource && !b.dataset.delete && !b.dataset.toggleShare && !b.dataset.retryMyResources) return;
    b.disabled = true;
    try {
      if(b.dataset.retryMyResources) await loadMyResources(true);
      if(b.dataset.preview) await previewResource(b.dataset.preview);
      if(b.dataset.editResource) await openEditResource(b.dataset.editResource);
      if(b.dataset.download) await downloadResource(b.dataset.download);
      if(b.dataset.delete) await deleteResource(b.dataset.delete);
      if(b.dataset.toggleShare) await toggleShare(b.dataset.toggleShare);
      if(isAdmin && (b.dataset.editResource || b.dataset.delete || b.dataset.toggleShare)) await loadAdminActivity(true);
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