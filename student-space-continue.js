/* GO SVT Maroc - Continue learning dashboard card */
(function () {
  'use strict';
  const ROOT_ID = 'gs-continue-learning';
  const labels = {
    ar: {
      eyebrow: 'خطوتك القادمة',
      title: 'تابع التعلم من حيث توقفت',
      recent: 'آخر درس اطلعت عليه',
      next: 'خطوتك التالية',
      resume: 'العودة إلى الدرس',
      plan: 'لديك مهمة في خطة المراجعة',
      noRecent: 'لم تسجل بعد زيارة درس. اختر درساً من مكتبتك وسيظهر هنا تلقائياً.',
      browse: 'اكتشف الدروس',
      completed: 'مكتملة',
      viewed: 'دروس تمت زيارتها',
      exercises: 'تمارين تمت زيارتها',
      pending: 'غير مكتملة'
    },
    fr: {
      eyebrow: 'VOTRE PROCHAINE ÉTAPE',
      title: 'Reprenez là où vous en étiez',
      recent: 'Dernier cours consulté',
      next: 'Votre prochaine étape',
      resume: 'Reprendre le cours',
      plan: 'Une tâche vous attend dans votre planning',
      noRecent: 'Aucun cours consulté pour le moment. Ouvrez un cours depuis la bibliothèque pour le retrouver ici.',
      browse: 'Découvrir les cours',
      completed: 'Terminés',
      viewed: 'Cours consultés',
      exercises: 'Exercices consultés',
      pending: 'À faire'
    }
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function getData() {
    if (!window.StudentSpace || typeof window.StudentSpace.getProfileData !== 'function') return null;
    try {
      // Prefer the authenticated account's mapped local profile. Never fall
      // back to another account's legacy profile while Supabase auth is active.
      let id = null;
      if (window.StudentAccount) {
        if (!window.StudentAccount.isLoggedIn()) return null;
        id = typeof window.StudentAccount.activeProfileId === 'function'
          ? window.StudentAccount.activeProfileId() : null;
      } else {
        const profile = typeof window.StudentSpace.getCurrentProfile === 'function'
          ? window.StudentSpace.getCurrentProfile() : null;
        id = profile && profile.id ? profile.id : null;
      }
      if (!id) return null;
      return window.StudentSpace.getProfileData(id);
    } catch (_) { return null; }
  }

  function renderCard() {
    const dashboard = document.getElementById('panel-dashboard');
    if (!dashboard || !dashboard.classList.contains('active')) return;
    const isFrench = document.documentElement.lang === 'fr';
    const t = isFrench ? labels.fr : labels.ar;
    const data = getData();
    if (!data) return;

    const lessons = Object.values((data.progress && data.progress.lessons) || {});
    const exercises = Object.values((data.progress && data.progress.exercises) || {});
    const recent = lessons.filter(function (item) {
      return item && item.path && /^cours\//.test(item.path);
    }).sort(function (a, b) {
      return (Number(b.lastViewed) || 0) - (Number(a.lastViewed) || 0);
    })[0];
    const pendingTask = (Array.isArray(data.studyPlan) ? data.studyPlan : [])
      .filter(function (item) { return item && !item.completed; })
      .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); })[0];

    const safeLessonPath = recent && /^cours\//i.test(recent.path) && /\.pdf$/i.test(recent.path) && !recent.path.split('/').includes('..')
      ? '/' + recent.path.split('/').map(encodeURIComponent).join('/') : '';
    const completed = lessons.filter(function (item) { return item && item.completed; }).length;
    const percent = lessons.length ? Math.round(completed / lessons.length * 100) : 0;
    const signature = JSON.stringify({ lang: isFrench ? 'fr' : 'ar', recent: recent ? [recent.path, recent.title, recent.lastViewed, recent.track, recent.level] : null, task: pendingTask ? [pendingTask.id, pendingTask.title, pendingTask.date, pendingTask.duration] : null, lessons: lessons.length, completed: completed, exercises: exercises.length });
    const card = document.createElement('section');
    card.id = ROOT_ID;
    card.className = 'gs-continue-card';
    card.setAttribute('dir', isFrench ? 'ltr' : 'rtl');
    card.dataset.signature = signature;

    const recentBlock = recent
      ? '<div class="gs-continue-item"><span class="gs-continue-icon">📖</span><div class="gs-continue-copy"><small>' + t.recent + '</small><strong>' + escapeHtml(recent.title || recent.path.split('/').pop()) + '</strong><span>' + escapeHtml(recent.track || recent.level || 'SVT') + '</span></div>' +
        (safeLessonPath ? '<a class="gs-continue-action" href="' + escapeHtml(safeLessonPath) + '" target="_blank" rel="noopener noreferrer">' + t.resume + ' ↗</a>' : '') + '</div>'
      : '<div class="gs-continue-empty"><span>🌱</span><p>' + t.noRecent + '</p><a href="#cours">' + t.browse + ' ←</a></div>';

    const nextBlock = pendingTask
      ? '<div class="gs-continue-next"><span>🎯</span><div><small>' + t.next + '</small><strong>' + escapeHtml(pendingTask.title || t.plan) + '</strong><span>' + escapeHtml(pendingTask.date || '') + ' · ' + (pendingTask.duration || 30) + (isFrench ? ' min' : ' دقيقة') + '</span></div><a href="#student-space" data-open-planner="true">' + (isFrench ? 'Voir le planning' : 'عرض الخطة') + '</a></div>'
      : '<div class="gs-continue-next"><span>🧪</span><div><small>' + t.next + '</small><strong>' + (isFrench ? 'Passez à un exercice pour consolider vos acquis' : 'انتقل إلى تمرين لترسيخ ما تعلمته') + '</strong></div><a href="#exercices">' + (isFrench ? 'Voir les exercices' : 'استكشف التمارين') + ' ←</a></div>';

    card.innerHTML =
      '<div class="gs-continue-heading"><div><span class="gs-continue-eyebrow">' + t.eyebrow + '</span><h3>' + t.title + '</h3></div><span class="gs-continue-mark">🧭</span></div>' +
      recentBlock + nextBlock +
      '<div class="gs-continue-stats"><div><strong>' + lessons.length + '</strong><span>' + t.viewed + '</span></div><div><strong>' + completed + '</strong><span>' + t.completed + '</span></div><div><strong>' + exercises.length + '</strong><span>' + t.exercises + '</span></div><div class="gs-continue-progress"><div><span>' + (isFrench ? 'Progression des cours terminés' : 'نسبة إتمام الدروس') + '</span><strong>' + percent + '%</strong></div><i><b style="width:' + percent + '%"></b></i></div></div>';

    const existing = document.getElementById(ROOT_ID);
    if (existing && existing.dataset.signature === signature) return;
    if (existing) existing.replaceWith(card);
    const anchor = dashboard.querySelector('.gs-learning-path') || dashboard.querySelector('.gs-daily-challenge');
    if (anchor) anchor.insertAdjacentElement('beforebegin', card);
    else dashboard.prepend(card);

    const plannerLink = card.querySelector('[data-open-planner]');
    if (plannerLink) plannerLink.addEventListener('click', function () {
      const tab = document.querySelector('.space-tab[data-tab="planner"]');
      if (tab) setTimeout(function () { tab.click(); }, 80);
    });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(function () { scheduled = false; renderCard(); }, 80);
  }

  function init() {
    const container = document.getElementById('student-space-content');
    if (!container) return;
    new MutationObserver(schedule).observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    schedule();
    window.addEventListener('storage', schedule);
    document.addEventListener('gosvt:favorites-updated', schedule);
    document.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('.lang-switcher')) window.setTimeout(schedule, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
