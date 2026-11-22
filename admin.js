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
  let resourceCache = [];
  let roleRequestCache = [];
  let roleRequestsHasMore = false;
  let roleRequestsLoading = false;
  let uploadInProgress = false;
  let pedagogicalReportRows = null;

  async function getFileSha256(file) {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

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
  function initAdminTabs() {
    const tabs = Array.from(document.querySelectorAll('[data-admin-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-admin-tab-content], .admin-tab-content'));
    const tablist = document.getElementById('admin-tabs');
    if (tablist) tablist.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      const panelId = tab.dataset.adminTab;
      tab.id = tab.id || 'admin-tab-' + panelId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panelId);
      tab.tabIndex = index === 0 ? 0 : -1;
      const panel = document.getElementById(panelId);
      if (panel) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;
      }
    });
    function activate(id, moveFocus = false) {
      panels.forEach(panel => { panel.hidden = panel.id !== id; });
      tabs.forEach(tab => {
        const active = tab.dataset.adminTab === id;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        if (active && moveFocus) tab.focus();
      });
    }
    tabs.forEach((tab, index) => {
      if (tab.dataset.bound === 'true') return;
      tab.dataset.bound = 'true';
      tab.addEventListener('click', () => activate(tab.dataset.adminTab));
      tab.addEventListener('keydown', event => {
        const rtl = document.documentElement.dir === 'rtl';
        let nextIndex = index;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) nextIndex = (index + 1) % tabs.length;
        else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) nextIndex = (index - 1 + tabs.length) % tabs.length;
        else return;
        event.preventDefault();
        activate(tabs[nextIndex].dataset.adminTab, true);
      });
    });
    document.querySelectorAll('.admin-shortcuts a[href^="#"]').forEach(link => {
      if (link.dataset.shortcutBound === 'true') return;
      link.dataset.shortcutBound = 'true';
      link.addEventListener('click', event => {
        const targetId = link.getAttribute('href').slice(1);
        const matchingTab = tabs.find(tab => tab.dataset.adminTab === targetId);
        if (!matchingTab) return;
        event.preventDefault();
        activate(targetId);
        const panel = document.getElementById(targetId);
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    activate('platform-overview');
  }

  async function enter(user) {
    if (!await verifyAdmin(user)) { showDenied(); return; }
    loginPanel.hidden = true;
    dashboard.hidden = false;
    initAdminTabs();
    await Promise.all([
      loadResources(), loadFounderProfile(), loadPlatformOverview(),
      loadAccounts(), loadRoleRequests(), loadPlatformHealth(), loadActivity(), loadPlatformTrends(), loadPedagogicalReports()
    ]);
  }
  async function loadPlatformTrends() {
    const days = Number($('trend-period').value) || 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const previousStart = new Date(start.getTime() - days * 86400000);
    const iso = date => date.toISOString();
    const sources = [
      { label: 'الحسابات الجديدة', table: 'profiles' },
      { label: 'الموارد المضافة للمكتبة', table: 'site_content_items' },
      { label: 'الدروس الخاصة المضافة', table: 'private_student_lessons' },
      { label: 'التمارين المنشأة', table: 'exercises' },
      { label: 'الأقسام المنشأة', table: 'classes' },
      { label: 'طلبات تغيير الأدوار', table: 'role_change_requests' }
    ];
    const status = $('trends-message');
    const body = $('trends-table-body');
    status.textContent = 'جارٍ حساب مؤشرات النمو...';
    body.replaceChildren();
    const results = await Promise.all(sources.map(async source => {
      const countRange = async (from, to) => {
        let query = client.from(source.table).select('id', { count: 'exact', head: true })
          .gte('created_at', iso(from)).lt('created_at', iso(to));
        if (source.table === 'site_content_items') query = query.eq('is_deleted', false);
        if (source.table === 'exercises') query = query.eq('is_published', true);
        if (source.table === 'private_student_lessons') query = query.eq('is_published', true);
        const { count, error } = await query;
        if (error) throw error;
        return count ?? 0;
      };
      try {
        const [current, previous] = await Promise.all([
          countRange(start, end), countRange(previousStart, start)
        ]);
        return { label: source.label, current, previous };
      } catch (error) {
        return { label: source.label, error: error.message || String(error) };
      }
    }));
    results.forEach(result => {
      const tr = document.createElement('tr');
      const label = document.createElement('td'); label.textContent = result.label; tr.append(label);
      if (result.error) {
        const cell = document.createElement('td'); cell.colSpan = 3;
        cell.textContent = 'تعذر حساب المؤشر: ' + result.error; tr.append(cell);
      } else {
        const current = document.createElement('td'); current.textContent = String(result.current);
        const previous = document.createElement('td'); previous.textContent = String(result.previous);
        const change = document.createElement('td');
        const delta = result.current - result.previous;
        const percent = result.previous === 0 ? (result.current === 0 ? '0%' : 'جديد') : ((delta / result.previous) * 100).toFixed(1).replace(/\.0$/, '') + '%';
        change.textContent = (delta > 0 ? '+' : '') + delta + ' (' + percent + ')';
        change.className = delta > 0 ? 'trend-up' : delta < 0 ? 'trend-down' : 'trend-flat';
        tr.append(current, previous, change);
      }
      body.append(tr);
    });
    const failed = results.filter(x => x.error);
    status.textContent = 'الفترة الحالية: ' + start.toLocaleDateString('ar-MA') + ' – ' + end.toLocaleDateString('ar-MA') +
      ' · الفترة السابقة: ' + previousStart.toLocaleDateString('ar-MA') + ' – ' + start.toLocaleDateString('ar-MA') +
      (failed.length ? ' · تعذر حساب ' + failed.length + ' مؤشرات.' : ' · اكتمل الحساب بنجاح.');
    status.className = 'message ' + (failed.length ? 'error' : 'success');
  }
  let activityCache = [];
  let activityLoading = false;
  async function loadActivity() {
    if (activityLoading) return;
    activityLoading = true;
    const refreshButton = $('activity-refresh');
    if (refreshButton) { refreshButton.disabled = true; refreshButton.textContent = 'جارٍ التحديث...'; }
    try {
      const host = $('activity-list');
      const summary = $('activity-summary');
      summary.textContent = 'جارٍ تحديث سجل الأنشطة؛ ستبقى البيانات الحالية ظاهرة أثناء التحديث.';
      summary.className = 'message';
    const sources = [
      { type: 'accounts', label: 'حساب جديد', run: () => client.from('profiles').select('display_name,role,created_at').order('created_at', { ascending: false }).limit(12), map: row => ({ title: row.display_name || 'حساب جديد', detail: 'إنشاء حساب · ' + (({admin:'مدير',teacher:'أستاذ',student:'تلميذ'})[row.role] || row.role || 'دور غير محدد') }) },
      { type: 'content', label: 'مورد جديد في المكتبة', run: () => client.from('site_content_items').select('title,category,study_level,study_track,created_at,is_deleted').order('created_at', { ascending: false }).limit(12), map: row => ({ title: row.title || 'مورد دون عنوان', detail: [categoryLabels[row.category] || row.category, row.study_level, row.study_track, row.is_deleted ? 'مخفي' : 'نشط'].filter(Boolean).join(' · ') }) },
      { type: 'lessons', label: 'درس جديد لمساحة التلميذ', run: () => client.from('private_student_lessons').select('title,study_level,study_track,is_published,created_at').order('created_at', { ascending: false }).limit(12), map: row => ({ title: row.title || 'درس دون عنوان', detail: [row.study_level, row.study_track, row.is_published ? 'منشور' : 'مسودة'].filter(Boolean).join(' · ') }) },
      { type: 'requests', label: 'طلب تغيير دور', run: () => client.from('role_change_requests').select('requested_role,status,created_at').order('created_at', { ascending: false }).limit(12), map: row => ({ title: 'طلب دور ' + (({admin:'مدير',teacher:'أستاذ',student:'تلميذ'})[row.requested_role] || row.requested_role || 'غير محدد'), detail: ({pending:'قيد المراجعة',approved:'مقبول',rejected:'مرفوض'})[row.status] || row.status || 'حالة غير محددة' }) },
      { type: 'learning', label: 'تمرين جديد', run: () => client.from('exercises').select('title,is_published,created_at').order('created_at', { ascending: false }).limit(12), map: row => ({ title: row.title || 'تمرين دون عنوان', detail: row.is_published ? 'تمرين منشور' : 'مسودة' }) },
      { type: 'learning', label: 'قسم دراسي جديد', run: () => client.from('classes').select('name,academic_year,is_active,created_at').order('created_at', { ascending: false }).limit(12), map: row => ({ title: row.name || 'قسم دون اسم', detail: [row.academic_year, row.is_active ? 'نشط' : 'غير نشط'].filter(Boolean).join(' · ') }) }
    ];
    const results = await Promise.all(sources.map(async source => {
      try {
        const { data, error } = await source.run();
        if (error) return { source: source.label, error: error.message, rows: [] };
        return { source: source.label, rows: (data || []).map(row => ({ sourceKey: source.label, type: source.type, ...source.map(row), created_at: row.created_at })) };
      } catch (error) {
        return { source: source.label, error: error.message || String(error), rows: [] };
      }
    }));
    const previousCache = activityCache;
    activityCache = results.flatMap(result => result.error
      ? previousCache.filter(item => item.sourceKey === result.source)
      : result.rows
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    $('activity-export').disabled = activityCache.length === 0;
    renderActivity();
    const failed = results.filter(result => result.error);
    summary.textContent = 'تم تحميل أو الاحتفاظ بـ ' + activityCache.length + ' نشاطاً' +
      (failed.length ? ' · تعذر تحديث ' + failed.length + ' مصدر، فاحتُفظ ببياناته السابقة إن توفرت: ' + failed.map(x => x.source).join('، ') : ' · جميع المصادر استجابت بنجاح') +
      '. تُعرض حتى 12 إضافة أو طلباً من كل مصدر.';
    summary.className = 'message ' + (failed.length ? 'error' : 'success');
    } finally {
      activityLoading = false;
      if (refreshButton) { refreshButton.disabled = false; refreshButton.textContent = 'تحديث ↻'; }
    }
  }
  function renderActivity() {
    const host = $('activity-list');
    const filter = $('activity-type-filter').value;
    const query = normalizeResourceSearch($('activity-search').value);
    const rows = activityCache.filter(item => {
      const text = normalizeResourceSearch(item.title + ' ' + item.detail);
      return (filter === 'all' || item.type === filter) && text.includes(query);
    });
    $('activity-summary').textContent = 'الأنشطة المطابقة: ' + rows.length + ' من أصل ' + activityCache.length + ' نشاطاً محمّلاً. يُعرض هنا حتى 60 نشاطاً؛ زر التصدير يشمل جميع النتائج المطابقة المحمّلة.';
    host.replaceChildren();
    if (!rows.length) { host.textContent = 'لا توجد أنشطة مطابقة لمعايير البحث.'; return; }
    rows.slice(0, 60).forEach(item => {
      const row = document.createElement('article');
      row.className = 'health-row activity-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('small');
      detail.textContent = item.detail + ' · ' + new Date(item.created_at).toLocaleString('ar-MA');
      info.append(title, detail);
      const tag = document.createElement('span');
      tag.className = 'activity-tag';
      tag.textContent = ({content:'المكتبة',lessons:'الدروس',accounts:'الحسابات',learning:'التعلم',requests:'الطلبات'})[item.type] || 'نشاط';
      row.append(info, tag);
      host.append(row);
    });
  }
  async function loadPedagogicalReports() {
    const status = $('pedagogical-reports-message');
    const body = $('pedagogical-reports-body');
    status.textContent = 'جارٍ إعداد التقرير التربوي...';
    body.replaceChildren();
    const count = async (table, filters = []) => {
      let query = client.from(table).select('id', { count: 'exact', head: true });
      filters.forEach(([column, operator, value]) => { query = query[operator](column, value); });
      const { count: total, error } = await query;
      if (error) throw error;
      return total ?? 0;
    };
    try {
      const [lessons, exercises, resources] = await Promise.all([
        count('private_student_lessons', [['is_published','eq',true]]),
        count('exercises', [['is_published','eq',true]]),
        count('site_content_items', [['is_deleted','eq',false]])
      ]);
      $('report-total-lessons').textContent = String(lessons);
      $('report-total-exercises').textContent = String(exercises);
      $('report-total-resources').textContent = String(resources);
      const levels = ['TC','1BAC','2BAC'];
      const rows = await Promise.all(levels.map(async level => {
        const [levelLessons, levelResources] = await Promise.all([
          count('private_student_lessons', [['is_published','eq',true],['study_level','eq',level]]),
          count('site_content_items', [['is_deleted','eq',false],['study_level','eq',level]])
        ]);
        return { level, lessons: levelLessons, resources: levelResources };
      }));
      const shareCell = share => {
        const td = document.createElement('td');
        const wrap = document.createElement('div');
        wrap.className = 'report-share';
        const value = document.createElement('strong');
        value.textContent = share.toFixed(1).replace(/\.0$/, '') + '%';
        const track = document.createElement('span');
        track.className = 'report-share-track';
        const fill = document.createElement('span');
        fill.className = 'report-share-fill';
        fill.style.width = Math.max(0, Math.min(100, share)) + '%';
        track.append(fill);
        wrap.append(value, track);
        td.append(wrap);
        return td;
      };
      rows.forEach(item => {
        const tr = document.createElement('tr');
        [item.level, String(item.lessons)].forEach(value => {
          const td = document.createElement('td'); td.textContent = value; tr.append(td);
        });
        tr.append(shareCell(lessons ? item.lessons / lessons * 100 : 0));
        const resourceCell = document.createElement('td'); resourceCell.textContent = String(item.resources); tr.append(resourceCell);
        body.append(tr);
      });
      const trackBody = $('pedagogical-tracks-body');
      trackBody.replaceChildren();
      const tracks = [
        ['TC','TCS'], ['TC','TCL'],
        ['1BAC','1BACSE'], ['1BAC','1BACSM'], ['1BAC','1BACL'],
        ['2BAC','2BACSVT'], ['2BAC','2BACSP'], ['2BAC','2BACSM']
      ];
      const trackRows = await Promise.all(tracks.map(async ([level, track]) => {
        const [trackLessons, trackResources] = await Promise.all([
          count('private_student_lessons', [['is_published','eq',true],['study_level','eq',level],['study_track','eq',track]]),
          count('site_content_items', [['is_deleted','eq',false],['study_level','eq',level],['study_track','eq',track]])
        ]);
        return { level, track, lessons: trackLessons, resources: trackResources };
      }));
      pedagogicalReportRows = [
        ...rows.map(item => ({ level: item.level, track: 'كل المسالك', lessons: item.lessons, share: lessons ? Number((item.lessons / lessons * 100).toFixed(1)) : 0, resources: item.resources })),
        ...trackRows.map(item => ({ ...item, share: lessons ? Number((item.lessons / lessons * 100).toFixed(1)) : 0 }))
      ];
      $('pedagogical-reports-export').disabled = false;
      trackRows.forEach(item => {
        const tr = document.createElement('tr');
        [item.level, item.track, String(item.lessons)].forEach(value => {
          const td = document.createElement('td'); td.textContent = value; tr.append(td);
        });
        tr.append(shareCell(lessons ? item.lessons / lessons * 100 : 0));
        const resourceCell = document.createElement('td'); resourceCell.textContent = String(item.resources); tr.append(resourceCell);
        trackBody.append(tr);
      });
      status.textContent = 'تم تحديث التقرير بنجاح · الأرقام إجمالية للمحتوى المنشور فقط.';
      status.className = 'message success';
    } catch (error) {
      status.textContent = 'تعذر إكمال التقرير: ' + (error.message || String(error));
      status.className = 'message error';
    }
  }
  async function loadPlatformHealth() {
    const list = $('platform-health-list');
    const stamp = $('platform-health-time');
    list.replaceChildren();
    const checks = [
      ['profiles', 'حسابات المستخدمين', () => client.from('profiles').select('id', { count: 'exact', head: true })],
      ['student_progress', 'تقدم التلاميذ', () => client.from('student_progress').select('student_id', { count: 'exact', head: true })],
      ['student_notes', 'ملاحظات التلاميذ', () => client.from('student_notes').select('student_id', { count: 'exact', head: true })],
      ['student_study_plan', 'خطط المراجعة', () => client.from('student_study_plan').select('student_id', { count: 'exact', head: true })],
      ['student_favorites', 'المفضلة', () => client.from('student_favorites').select('student_id', { count: 'exact', head: true })],
      ['private_student_lessons', 'دروس مساحة التلميذ الخاصة', () => client.from('private_student_lessons').select('id', { count: 'exact', head: true })],
      ['site_content_items', 'مكتبة محتوى الموقع', () => client.from('site_content_items').select('id', { count: 'exact', head: true })],
      ['role_change_requests', 'طلبات تغيير الأدوار', () => client.from('role_change_requests').select('id', { count: 'exact', head: true })]
    ];
    const results = await Promise.all(checks.map(async ([key, label, run]) => {
      try {
        const result = await run();
        return { key, label, ok: !result.error, count: result.count, error: result.error && result.error.message };
      } catch (error) {
        return { key, label, ok: false, error: error.message || String(error) };
      }
    }));
    results.forEach(item => {
      const row = document.createElement('article');
      row.className = 'health-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.label;
      const detail = document.createElement('small');
      detail.textContent = item.ok ? 'استجابة ناجحة · ' + (item.count ?? 0) + ' سجل' : 'تعذر الفحص: ' + (item.error || 'خطأ غير محدد');
      info.append(title, detail);
      const badge = document.createElement('span');
      badge.className = 'health-status ' + (item.ok ? 'ok' : 'fail');
      badge.textContent = item.ok ? 'متصل' : 'يحتاج مراجعة';
      row.append(info, badge);
      list.append(row);
    });
    const failed = results.filter(x => !x.ok).length;
    stamp.textContent = 'آخر فحص: ' + new Date().toLocaleString('ar-MA') + (failed ? ' · خدمات تحتاج مراجعة: ' + failed : ' · جميع الفحوصات ناجحة');
    stamp.className = 'message ' + (failed ? 'error' : 'success');
  }
  let accountCache = [];
  let accountsHasMore = false;
  let accountsLoading = false;
  async function loadPlatformOverview() {
    const status = $('overview-message');
    status.textContent = 'جارٍ تحديث مؤشرات المنصة...';
    const jobs = await Promise.all([
      client.from('profiles').select('id', { count: 'exact', head: true }),
      client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      client.from('classes').select('id', { count: 'exact', head: true }),
      client.from('exercises').select('id', { count: 'exact', head: true }).eq('is_published', true),
      client.from('role_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('private_student_lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
      client.from('site_content_items').select('id', { count: 'exact', head: true }).eq('is_deleted', false)
    ]);
    const [usersResult, studentsResult, teachersResult, classesResult, exercisesResult, requestsResult, privateLessonsResult, libraryResult] = jobs;
    const errors = jobs.filter(x => x.error).map(x => x.error.message);
    $('overview-users').textContent = usersResult.error ? '—' : String(usersResult.count ?? 0);
    $('overview-students').textContent = studentsResult.error ? '—' : String(studentsResult.count ?? 0);
    $('overview-teachers').textContent = teachersResult.error ? '—' : String(teachersResult.count ?? 0);
    $('overview-classes').textContent = classesResult.error ? '—' : String(classesResult.count ?? 0);
    $('overview-exercises').textContent = exercisesResult.error ? '—' : String(exercisesResult.count ?? 0);
    $('overview-requests').textContent = requestsResult.error ? '—' : String(requestsResult.count ?? 0);
    $('overview-private-lessons').textContent = privateLessonsResult.error ? '—' : String(privateLessonsResult.count ?? 0);
    $('overview-library').textContent = libraryResult.error ? '—' : String(libraryResult.count ?? 0);
    status.textContent = errors.length ? 'تعذر تحميل بعض المؤشرات: ' + errors.join(' | ') : 'تم تحديث المؤشرات بنجاح.';
    status.className = 'message ' + (errors.length ? 'error' : 'success');
  }
  async function loadAccounts() {
    if (accountsLoading) return;
    accountCache = [];
    accountsHasMore = false;
    $('accounts-list').textContent = 'جارٍ تحميل الحسابات...';
    $('accounts-load-more').hidden = true;
    await loadMoreAccounts(true);
  }
  async function loadMoreAccounts(initial = false) {
    if (accountsLoading || !currentUser) return;
    accountsLoading = true;
    const button = $('accounts-load-more');
    const status = $('accounts-message');
    button.disabled = true;
    button.textContent = 'جارٍ تحميل الحسابات...';
    try {
      const from = accountCache.length;
      const to = from + 249;
      const result = await client.from('profiles').select('id,display_name,role,created_at').order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to);
      if (result.error) throw result.error;
      const batch = result.data || [];
      accountCache = accountCache.concat(batch);
      $('accounts-export').disabled = accountCache.length === 0;
      accountsHasMore = batch.length === 250;
      renderAccounts();
      status.textContent = 'تم تحميل ' + accountCache.length + ' حساباً' + (accountsHasMore ? '، ويمكن تحميل الدفعة التالية.' : '، وصلت إلى نهاية القائمة.');
    } catch (error) {
      status.textContent = 'تعذر تحميل الحسابات: ' + (error.message || String(error));
      if (initial && !accountCache.length) $('accounts-list').textContent = 'تعذر تحميل الحسابات.';
    } finally {
      accountsLoading = false;
      button.disabled = false;
      button.hidden = !accountsHasMore;
      button.textContent = 'تحميل 250 حساباً إضافياً ↓';
    }
  }
  function renderAccounts() {
    const list = $('accounts-list');
    const query = ($('accounts-search').value || '').trim().toLocaleLowerCase();
    const roleFilter = $('accounts-role-filter').value;
    const knownRoles = ['admin', 'teacher', 'student'];
    const rows = accountCache.filter(account => {
      const role = String(account.role || '').trim().toLocaleLowerCase();
      const matchesRole = roleFilter === 'all' ||
        (roleFilter === 'other' && !knownRoles.includes(role)) ||
        role === roleFilter;
      const searchable = (String(account.display_name || '') + ' ' + account.id + ' ' + String(account.role || '')).toLocaleLowerCase();
      return matchesRole && searchable.includes(query);
    });
    $('accounts-count').textContent = 'النتائج المطابقة: ' + rows.length + ' من أصل ' + accountCache.length + ' حساباً محمّلاً' + (accountsHasMore ? ' · توجد دفعات إضافية لم تُحمّل بعد؛ البحث يشمل الحسابات المحمّلة فقط.' : ' · تم تحميل القائمة كاملة.');
    list.replaceChildren();
    if (!rows.length) { list.textContent = 'لا توجد حسابات مطابقة لهذه المعايير.'; return; }
    rows.forEach(account => {
      const row = document.createElement('article'); row.className = 'resource-row';
      const info = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = account.display_name || 'دون اسم معروض';
      const meta = document.createElement('small');
      const roleLabel = ({admin:'مدير المنصة',teacher:'أستاذ',student:'تلميذ'})[account.role] || account.role || 'غير محدد';
      meta.textContent = roleLabel + ' · ' + new Date(account.created_at).toLocaleDateString('ar-MA') + ' · ' + account.id;
      info.append(name, meta);
      const copy = document.createElement('button'); copy.type='button'; copy.className='quiet-btn'; copy.textContent='نسخ المعرّف';
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(account.id); copy.textContent='تم النسخ'; } catch (_) { copy.textContent='تعذر النسخ'; } });
      row.append(info, copy); list.append(row);
    });
  }
  async function loadRoleRequests() {
    if (roleRequestsLoading) return;
    roleRequestCache = [];
    roleRequestsHasMore = false;
    $('role-requests-load-more').hidden = true;
    $('role-requests-list').textContent = 'جارٍ تحميل الطلبات...';
    await loadMoreRoleRequests(true);
  }
  async function loadMoreRoleRequests(initial = false) {
    if (roleRequestsLoading || !currentUser || (!initial && !roleRequestsHasMore)) return;
    roleRequestsLoading = true;
    const button = $('role-requests-load-more');
    if (button) {
      button.disabled = true;
      button.textContent = 'جارٍ تحميل الطلبات...';
    }
    const from = roleRequestCache.length;
    try {
      const { data, error } = await client.from('role_change_requests')
        .select('id,requested_by,target_user_id,requested_role,status,created_at,reviewed_by,reviewed_at')
        .order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, from + 49);
      if (error) throw error;
      const incoming = data || [];
      roleRequestCache = roleRequestCache.concat(incoming);
      roleRequestsHasMore = incoming.length === 50;
      renderRoleRequests();
      $('role-requests-message').textContent = roleRequestCache.length
        ? 'هذه القائمة للعرض فقط؛ لا يمكن تغيير حالة الطلب من خلالها.'
        : 'لا توجد طلبات تغيير أدوار مسجلة.';
      $('role-requests-message').className = 'message muted';
    } catch (error) {
      if (initial) {
        roleRequestCache = [];
        roleRequestsHasMore = false;
      } else {
        // Keep the retry option visible when a later batch fails.
        roleRequestsHasMore = true;
      }
      if (roleRequestCache.length) {
        renderRoleRequests();
        $('role-requests-message').textContent = 'تعذر تحميل الدفعة التالية؛ الطلبات السابقة ما زالت معروضة ومحفوظة. يمكنك إعادة المحاولة.';
      } else {
        $('role-requests-list').textContent = 'تعذر تحميل الطلبات. حاول تحديث القائمة.';
        $('role-requests-count').textContent = 'تعذر تحميل النتائج.';
        $('role-requests-message').textContent = 'تعذر تحميل الطلبات: ' + (error.message || String(error));
      }
      $('role-requests-message').className = 'message error';
    } finally {
      roleRequestsLoading = false;
      if (button) {
        button.hidden = !roleRequestsHasMore;
        button.disabled = false;
        button.textContent = 'إعادة المحاولة / تحميل 50 طلباً إضافياً ↓';
      }
    }
  }
  function getFilteredRoleRequests() {
    const filter = $('role-requests-filter').value;
    const query = normalizeResourceSearch($('role-requests-search').value);
    const knownStatuses = ['pending', 'approved', 'rejected'];
    return roleRequestCache.filter(item => {
      const state = String(item.status || '').trim().toLocaleLowerCase();
      const matchesStatus = filter === 'all' || (filter === 'other' && !knownStatuses.includes(state)) || state === filter;
      const searchable = normalizeResourceSearch([
        item.requested_role, item.status, item.requested_by, item.target_user_id,
        item.reviewed_by, item.created_at, item.reviewed_at
      ].filter(Boolean).join(' '));
      return matchesStatus && (!query || searchable.includes(query));
    });
  }
  function renderRoleRequests() {
    const list = $('role-requests-list');
    const rows = getFilteredRoleRequests();
    $('role-requests-count').textContent =
      'الطلبات المطابقة: ' + rows.length + ' من أصل ' + roleRequestCache.length +
      ' طلباً محمّلاً' + (roleRequestsHasMore
        ? ' — توجد نتائج أخرى يمكن تحميلها.'
        : ' — تم تحميل جميع النتائج المتاحة.');
    const exportButton = $('role-requests-export');
    if (exportButton) exportButton.disabled = !rows.length;
    list.replaceChildren();
    if (!rows.length) { list.textContent = 'لا توجد طلبات مطابقة لمعايير البحث والتصفية.'; return; }
    rows.forEach(item => {
      const row = document.createElement('article'); row.className = 'resource-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      const requestedRole = ({student:'تلميذ',teacher:'أستاذ',admin:'مدير'})[item.requested_role] || item.requested_role || 'غير محدد';
      const state = ({pending:'قيد المراجعة',approved:'مقبول',rejected:'مرفوض'})[item.status] || item.status || 'غير محدد';
      title.textContent = 'طلب ' + requestedRole + ' — ' + state;
      const meta = document.createElement('small');
      meta.textContent = 'مقدم الطلب: ' + item.requested_by + ' · الحساب المستهدف: ' + item.target_user_id + ' · ' + new Date(item.created_at).toLocaleString('ar-MA');
      info.append(title, meta);
      row.append(info); list.append(row);
    });
  }
  async function loadResources() {
    const list = $('resource-list');
    list.textContent = 'جارٍ تحميل المحتوى...';
    const { data, error } = await client.from('site_content_items')
      .select('id,title,category,language,study_level,study_track,file_name,storage_path,created_at,is_deleted')
      .order('created_at', { ascending: false }).limit(100);
    if (error) {
      resourceCache = [];
      list.textContent = 'تعذر تحميل الملفات: ' + error.message;
      $('resource-summary').textContent = 'تعذر تحميل ملخص الموارد.';
      return;
    }
    resourceCache = data || [];
    $('resource-count').textContent = String(resourceCache.filter(item => !item.is_deleted).length);
    renderResources();
  }
  function normalizeResourceSearch(value) {
    return String(value || '').toLocaleLowerCase().normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\u0640/g, '').trim();
  }
  function renderResourceStatistics() {
    const host = $('resource-statistics');
    if (!host) return;
    host.replaceChildren();
    const dimensions = [
      { title: 'حسب التصنيف', key: 'category', labels: categoryLabels },
      { title: 'حسب المستوى', key: 'study_level', labels: { TC: 'TC', '1BAC': '1BAC', '2BAC': '2BAC' } },
      { title: 'حسب الشعبة والمسلك', key: 'study_track', labels: {} },
      { title: 'حسب اللغة', key: 'language', labels: { francais: 'Français', arabe: 'العربية' } }
    ];
    dimensions.forEach(dimension => {
      const counts = new Map();
      resourceCache.filter(item => !item.is_deleted).forEach(item => {
        const raw = item[dimension.key];
        const key = raw || 'غير محدد';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      const card = document.createElement('article');
      card.className = 'stat-card resource-stat-card';
      const heading = document.createElement('strong');
      heading.textContent = dimension.title;
      const detail = document.createElement('small');
      const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      detail.textContent = entries.length
        ? entries.map(([key, count]) => (dimension.labels[key] || key) + ': ' + count).join(' · ')
        : 'لا توجد موارد نشطة';
      card.append(heading, detail);
      host.append(card);
    });
    const note = document.createElement('p');
    note.className = 'muted resource-stats-note';
    note.textContent = 'الإحصائيات محسوبة من الموارد النشطة ضمن آخر ' + resourceCache.length + ' مورداً محمّلاً (بحد أقصى 100)، وليست حصيلة شاملة إذا تجاوزت المكتبة هذا العدد.';
    host.append(note);
  }
  function renderResources() {
    const list = $('resource-list');
    renderResourceStatistics();
    const filter = $('resource-state-filter').value;
    const categoryFilter = $('resource-category-filter').value;
    const levelFilter = $('resource-level-filter').value;
    const trackFilter = $('resource-track-filter').value;
    const languageFilter = $('resource-language-filter').value;
    const searchTerm = normalizeResourceSearch($('resource-search').value);
    const rows = resourceCache.filter(item => {
      const matchesState = filter === 'all' || (filter === 'active' && !item.is_deleted) || (filter === 'deleted' && item.is_deleted);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesLevel = levelFilter === 'all' || (levelFilter === 'none' && !item.study_level) || item.study_level === levelFilter;
      const matchesTrack = trackFilter === 'all' || (trackFilter === 'none' && !item.study_track) || item.study_track === trackFilter;
      const matchesLanguage = languageFilter === 'all' || (languageFilter === 'none' && !item.language) || item.language === languageFilter;
      const searchableText = normalizeResourceSearch([item.title,item.file_name,item.study_track,item.category,item.language,item.study_level].filter(Boolean).join(' '));
      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
      return matchesState && matchesCategory && matchesLevel && matchesTrack && matchesLanguage && matchesSearch;
    });
    const activeCount = resourceCache.filter(item => !item.is_deleted).length;
    const hiddenCount = resourceCache.length - activeCount;
    $('resource-summary').textContent = 'الموارد النشطة: ' + activeCount + ' · المخفية أو التي تنتظر استكمال الحذف: ' + hiddenCount + ' · النتائج المطابقة: ' + rows.length + ' من أصل ' + resourceCache.length + ' مورد محمّل (بحد أقصى 100).';
    list.replaceChildren();
    if (!rows.length) {
      list.textContent = filter === 'deleted' ? 'لا توجد موارد مخفية أو عمليات حذف معلقة.' :
        filter === 'active' ? 'لا توجد موارد نشطة ضمن العناصر المحمّلة.' : 'لم تضف ملفات بعد. ابدأ بإضافة أول مورد.';
      return;
    }
    rows.forEach(item => {
      const row = document.createElement('article'); row.className = 'resource-row';
      const info = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.title;
      const meta = document.createElement('small');
      meta.textContent = [categoryLabels[item.category] || item.category,item.study_level,item.study_track,item.language === 'arabe' ? 'العربية' : 'Français'].filter(Boolean).join(' · ');
      info.append(title,meta);
      const actions = document.createElement('div'); actions.className = 'resource-actions';
      if (!item.is_deleted) {
        const open = document.createElement('a'); open.href = publicUrl(item.storage_path); open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'فتح الملف';
        actions.append(open);
      } else {
        const pending = document.createElement('small'); pending.textContent = 'مخفي عن الزوار — في انتظار إتمام حذف الملف'; pending.className = 'muted'; info.append(pending);
      }
      const del = document.createElement('button'); del.type = 'button'; del.className = 'delete-btn'; del.textContent = item.is_deleted ? 'إعادة محاولة الحذف' : 'حذف';
      del.addEventListener('click', () => removeResource(item, del));
      actions.append(del); row.append(info,actions); list.append(row);
    });
  }
  async function removeResource(item, button) {
    if (!item.is_deleted && !window.confirm('هل تريد حذف هذا الملف من الموقع؟')) return;
    button.disabled = true;
    try {
      // Hide the database record first. Public catalogue queries are then filtered by RLS.
      if (!item.is_deleted) {
        const { data, error } = await client.from('site_content_items')
          .update({ is_deleted: true }).eq('id', item.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('لم يتم العثور على المورد أو لا تملك صلاحية حذفه.');
        item.is_deleted = true;
      }

      // If storage cleanup fails, the hidden row remains as a retryable deletion task.
      const { error: storageError } = await client.storage.from('site-content').remove([item.storage_path]);
      if (storageError) {
        alert('أُخفي المورد عن الزوار، لكن تعذر حذف الملف من التخزين. يمكنك الضغط على «إعادة محاولة الحذف» لاحقاً. التفاصيل: ' + storageError.message);
        await loadResources();
        return;
      }

      const { error: metadataError } = await client.from('site_content_items').delete().eq('id', item.id);
      if (metadataError) {
        alert('حُذف الملف من التخزين، لكن بقي سجل إداري مخفي. أعد محاولة الحذف لإكمال التنظيف. التفاصيل: ' + metadataError.message);
        await loadResources();
        return;
      }
      await loadResources();
    } catch (error) {
      alert('تعذر حذف المورد: ' + (error.message || error));
    } finally {
      button.disabled = false;
    }
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
    if (!currentUser || uploadInProgress) return;
    const file = $('resource-file').files[0];
    if (!file) return message(uploadMessage, 'اختر ملفاً أولاً.', 'error');
    if (file.size > MAX_FILE_SIZE) return message(uploadMessage, 'حجم الملف يتجاوز 50MB.', 'error');
    if (!ALLOWED.has(file.type)) return message(uploadMessage, 'نوع الملف غير مسموح به.', 'error');
    const button = $('upload-btn');
    uploadInProgress = true;
    button.disabled = true;
    $('upload-progress').hidden = false; message(uploadMessage, 'جارٍ التحقق من الملف...');
    const category = $('category').value;
    if (['cours','exercices','examens','fiches','resumes'].includes(category) &&
        (!$('language').value || !$('study-level').value)) {
      uploadInProgress = false; button.disabled = false; $('upload-progress').hidden = true;
      return message(uploadMessage, 'يرجى تحديد اللغة والمستوى لهذا القسم.', 'error');
    }
    const path = category + '/' + crypto.randomUUID() + '-' + safeName(file.name);
    try {
      const fileSha256 = await getFileSha256(file);
      let duplicateQuery = client.from('site_content_items').select('id').eq('category', category).eq('file_sha256', fileSha256);
      const language = $('language').value || null;
      const studyLevel = $('study-level').value || null;
      const studyTrack = $('study-track').value || null;
      duplicateQuery = language === null ? duplicateQuery.is('language', null) : duplicateQuery.eq('language', language);
      duplicateQuery = studyLevel === null ? duplicateQuery.is('study_level', null) : duplicateQuery.eq('study_level', studyLevel);
      duplicateQuery = studyTrack === null ? duplicateQuery.is('study_track', null) : duplicateQuery.eq('study_track', studyTrack);
      const { data: duplicates, error: duplicateError } = await duplicateQuery.limit(1);
      if (duplicateError) throw duplicateError;
      if (duplicates && duplicates.length) {
        message(uploadMessage, 'هذا الملف سبق نشره في القسم والتصنيف نفسيهما. لم تتم إعادة رفعه.', 'error');
        return;
      }
      message(uploadMessage, 'جارٍ رفع الملف...');
      const { error: uploadError } = await client.storage.from('site-content').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const row = {
        title: $('resource-title').value.trim(), category,
        language,
        study_level: studyLevel,
        study_track: studyTrack,
        file_sha256: fileSha256,
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
    finally { uploadInProgress = false; button.disabled = false; $('upload-progress').hidden = true; }
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
  $('resource-state-filter').addEventListener('change', renderResources);
  $('resource-category-filter').addEventListener('change', renderResources);
  $('resource-level-filter').addEventListener('change', renderResources);
  $('resource-track-filter').addEventListener('change', renderResources);
  $('resource-language-filter').addEventListener('change', renderResources);
  $('resource-search').addEventListener('input', renderResources);
  $('overview-refresh').addEventListener('click', loadPlatformOverview);
  $('health-refresh').addEventListener('click', loadPlatformHealth);
  $('pedagogical-reports-refresh').addEventListener('click', loadPedagogicalReports);
  $('pedagogical-reports-export').addEventListener('click', () => {
    if (!currentUser || !pedagogicalReportRows || !pedagogicalReportRows.length) return;
    const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const rows = [
      ['المستوى','الشعبة أو المسلك','الدروس المنشورة','حصة من إجمالي الدروس (%)','موارد المكتبة'],
      ...pedagogicalReportRows.map(item => [item.level, item.track, item.lessons, item.share, item.resources])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'go-svt-maroc-pedagogical-report-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('activity-export').addEventListener('click', () => {
    if (!currentUser || !activityCache.length) return;
    const filter = $('activity-type-filter').value;
    const query = normalizeResourceSearch($('activity-search').value);
    const rows = activityCache.filter(item => {
      const text = normalizeResourceSearch(item.title + ' ' + item.detail);
      return (filter === 'all' || item.type === filter) && text.includes(query);
    });
    if (!rows.length) return;
    const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const output = [
      ['التصنيف','العنوان','التفاصيل','التاريخ'],
      ...rows.map(item => [
        ({content:'المكتبة',lessons:'الدروس',accounts:'الحسابات',learning:'التعلم',requests:'الطلبات'})[item.type] || 'نشاط',
        item.title, item.detail, new Date(item.created_at).toLocaleString('ar-MA')
      ])
    ];
    const csv = '\uFEFF' + output.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'go-svt-maroc-activity-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('activity-refresh').addEventListener('click', loadActivity);
  $('trends-refresh').addEventListener('click', loadPlatformTrends);
  $('trend-period').addEventListener('change', loadPlatformTrends);
  $('activity-type-filter').addEventListener('change', renderActivity);
  $('activity-search').addEventListener('input', renderActivity);
  $('accounts-export').addEventListener('click', () => {
    if (!currentUser || !accountCache.length) return;
    const query = ($('accounts-search').value || '').trim().toLocaleLowerCase();
    const roleFilter = $('accounts-role-filter').value;
    const knownRoles = ['admin','teacher','student'];
    const rows = accountCache.filter(account => {
      const role = String(account.role || '').trim().toLocaleLowerCase();
      const matchesRole = roleFilter === 'all' || (roleFilter === 'other' && !knownRoles.includes(role)) || role === roleFilter;
      const searchable = (String(account.display_name || '') + ' ' + account.id + ' ' + String(account.role || '')).toLocaleLowerCase();
      return matchesRole && searchable.includes(query);
    });
    if (!rows.length) return;
    const labels = {admin:'مدير المنصة',teacher:'أستاذ',student:'تلميذ'};
    const cell = value => '"' + String(value ?? '').replace(/"/g,'""') + '"';
    const output = [
      ['الاسم المعروض','الدور','معرّف الحساب','تاريخ التسجيل'],
      ...rows.map(account => [
        account.display_name || 'دون اسم معروض',
        labels[account.role] || account.role || 'غير محدد',
        account.id,
        new Date(account.created_at).toLocaleString('ar-MA')
      ])
    ];
    const csv = '\uFEFF' + output.map(row => row.map(cell).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'go-svt-maroc-accounts-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const partialNotice = accountsHasMore ? ' — تنبيه: الملف يشمل الحسابات المحمّلة فقط، ولم تكتمل القائمة.' : ' — الملف يشمل القائمة كاملة.';
    $('accounts-message').textContent = 'تم تصدير ' + rows.length + ' حساباً مطابقاً من ' + accountCache.length + ' حساباً محمّلاً' + partialNotice;
    $('accounts-message').className = 'message success';
  });
  $('accounts-refresh').addEventListener('click', loadAccounts);
  $('accounts-load-more').addEventListener('click', function () { loadMoreAccounts(false); });
  $('role-requests-export').addEventListener('click', () => {
    if (!currentUser || !roleRequestCache.length) return;
    const rows = getFilteredRoleRequests();
    if (!rows.length) return;
    const labels = {student:'تلميذ',teacher:'أستاذ',admin:'مدير'};
    const states = {pending:'قيد المراجعة',approved:'مقبول',rejected:'مرفوض'};
    const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const output = [
      ['الدور المطلوب','الحالة','مقدم الطلب (معرّف)','الحساب المستهدف (معرّف)','تاريخ الطلب','راجع الطلب (معرّف)','تاريخ المراجعة'],
      ...rows.map(item => [
        labels[item.requested_role] || item.requested_role || 'غير محدد',
        states[item.status] || item.status || 'غير محدد',
        item.requested_by, item.target_user_id,
        item.created_at ? new Date(item.created_at).toLocaleString('ar-MA') : '',
        item.reviewed_by || '',
        item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('ar-MA') : ''
      ])
    ];
    const csv = '\\uFEFF' + output.map(row => row.map(cell).join(',')).join('\\r\\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'go-svt-maroc-role-requests-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('role-requests-message').textContent =
      'تم تصدير ' + rows.length + ' طلباً مطابقاً من ' + roleRequestCache.length +
      ' طلباً محمّلاً' + (roleRequestsHasMore
        ? ' — قد توجد طلبات أخرى لم تُحمّل بعد.'
        : ' — تم تحميل جميع النتائج المتاحة.');
    $('role-requests-message').className = 'message success';
  });
  $('role-requests-refresh').addEventListener('click', loadRoleRequests);
  $('role-requests-load-more').addEventListener('click', () => loadMoreRoleRequests(false));
  $('role-requests-filter').addEventListener('change', renderRoleRequests);
  $('role-requests-search').addEventListener('input', renderRoleRequests);
  $('accounts-search').addEventListener('input', renderAccounts);
  $('accounts-role-filter').addEventListener('change', renderAccounts);
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