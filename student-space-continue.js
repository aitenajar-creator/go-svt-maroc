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
      pending: 'غير مكتملة',
      quizScope: 'الاختبارات تشمل جميع المسالك',
      lessonScope: 'إحصاءات الدروس والتمارين تخص مسارك'
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
      pending: 'À faire',
      quizScope: 'Quiz : tous les parcours',
      lessonScope: 'Cours et exercices : votre parcours'
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
    if (!data) {
      // Never leave the previous account's learning summary visible after logout
      // or while the authenticated profile is unavailable.
      const staleCard = document.getElementById(ROOT_ID);
      if (staleCard) staleCard.remove();
      return;
    }

    // Count only actual progress records; ignore nulls, arrays, and malformed legacy values.
    function isProgressRecord(item) {
      return !!item && typeof item === 'object' && !Array.isArray(item);
    }
    const progress = data.progress && typeof data.progress === 'object' && !Array.isArray(data.progress)
      ? data.progress : {};
    const currentProfile = window.StudentAccount && typeof window.StudentAccount.getProfile === 'function'
      ? window.StudentAccount.getProfile()
      : (window.StudentSpace && typeof window.StudentSpace.getCurrentProfile === 'function'
        ? window.StudentSpace.getCurrentProfile() : null);
    const selectedLevel = String(currentProfile && currentProfile.study_level || '').toUpperCase();
    const selectedTrack = String(currentProfile && currentProfile.study_track || '').replace(/\\s+/g, '').toUpperCase();
    const inSelectedPathway = item => isProgressRecord(item) && item.level === selectedLevel && item.track === selectedTrack;
    const lessons = Object.values(progress.lessons && typeof progress.lessons === 'object' && !Array.isArray(progress.lessons)
      ? progress.lessons : {}).filter(inSelectedPathway);
    const exercises = Object.values(progress.exercises && typeof progress.exercises === 'object' && !Array.isArray(progress.exercises)
      ? progress.exercises : {}).filter(inSelectedPathway);
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
    const attempts = Array.isArray(data.quizResults) ? data.quizResults : [];
    const signature = JSON.stringify({ lang: isFrench ? 'fr' : 'ar', recent: recent ? [recent.path, recent.title, recent.lastViewed, recent.track, recent.level] : null, task: pendingTask ? [pendingTask.id, pendingTask.title, pendingTask.date, pendingTask.duration] : null, quiz: attempts.map(function (item) { return [item && item.quizId, item && item.date, item && item.percentage, item && Array.isArray(item.mistakes) ? item.mistakes.map(function (mistake) { return mistake && [mistake.question, mistake.selected, mistake.correct, mistake.date]; }) : []]; }), lessons: lessons.length, completed: completed, exercises: exercises.length, journey: window.StudentLearningJourney && window.StudentLearningJourney.getSnapshot ? (window.StudentLearningJourney.getSnapshot() || {}).generatedAt || 'pending' : 'unavailable', subject: ['cours', 'exercices', 'quiz', 'examens', 'resumes'].map(function (id) {
        const section = document.getElementById(id);
        const active = section && section.querySelector('.tab-btn.active[data-subject]');
        return id + ':' + (active && active.dataset.subject || '');
      }).join('|') });
    const card = document.createElement('section');
    card.id = ROOT_ID;
    card.className = 'gs-continue-card';
    card.setAttribute('dir', isFrench ? 'ltr' : 'rtl');
    card.dataset.signature = signature;

    const recentBlock = recent
      ? '<div class="gs-continue-item"><span class="gs-continue-icon">📖</span><div class="gs-continue-copy"><small>' + t.recent + '</small><strong>' + escapeHtml(recent.title || recent.path.split('/').pop()) + '</strong><span>' + escapeHtml(recent.track || recent.level || 'SVT') + '</span></div>' +
        (safeLessonPath ? '<a class="gs-continue-action" href="' + escapeHtml(safeLessonPath) + '" target="_blank" rel="noopener noreferrer">' + t.resume + ' ↗</a>' : '') + '</div>'
      : '<div class="gs-continue-empty"><span>🌱</span><p>' + t.noRecent + '</p><a href="#cours">' + t.browse + ' ←</a></div>';

    // Keep this selection consistent with the analytics panel: only dated quiz
    // attempts are eligible, and dates are numeric millisecond timestamps.
    const latestWithMistakes = attempts.filter(function (item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const quizId = typeof item.quizId === 'string' ? item.quizId.trim() : '';
      const percentage = Number(item.percentage);
      const date = Number(item.date);
      const hasReviewableMistake = Array.isArray(item.mistakes) && item.mistakes.some(function (mistake) {
        return mistake && typeof mistake.question === 'string' && mistake.question.trim() &&
          typeof mistake.selected === 'string' && mistake.selected.trim() &&
          typeof mistake.correct === 'string' && mistake.correct.trim() &&
          mistake.selected.trim() !== mistake.correct.trim();
      });
      return quizId.length > 0 && quizId.length <= 200 &&
        Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 &&
        Number.isFinite(date) && date > 0 && hasReviewableMistake;
    }).sort(function (a, b) { return Number(b.date) - Number(a.date); })[0];
    const profile = window.StudentSpace && typeof window.StudentSpace.getCurrentProfile === 'function'
      ? window.StudentSpace.getCurrentProfile() : null;
    const stats = profile && window.StudentSpace && typeof window.StudentSpace.getDashboardStatsForPath === 'function'
      ? window.StudentSpace.getDashboardStatsForPath(profile.study_level, profile.study_track)
      : (window.StudentSpace && typeof window.StudentSpace.getDashboardStats === 'function'
        ? window.StudentSpace.getDashboardStats() : {});
    const guidedStep = window.StudentLearningJourney &&
      typeof window.StudentLearningJourney.getNextStep === 'function'
      ? window.StudentLearningJourney.getNextStep(stats) : null;
    const guidedLabels = {
      cours: { icon: '📖', title: isFrench ? 'Commencez par un cours de votre parcours' : 'ابدأ بدرس من مسارك الدراسي', label: isFrench ? 'Ouvrir les cours' : 'فتح الدروس' },
      continue: { icon: '📘', title: isFrench ? 'Poursuivez les cours déjà consultés' : 'أكمل الدروس التي بدأت بها', label: isFrench ? 'Continuer' : 'متابعة التعلم' },
      exercices: { icon: '🧩', title: isFrench ? 'Appliquez vos acquis dans un exercice' : 'طبّق مكتسباتك في تمرين', label: isFrench ? 'Voir les exercices' : 'فتح التمارين' },
      quiz: { icon: '⚡', title: isFrench ? 'Vérifiez votre compréhension avec un quiz' : 'تحقق من فهمك باختبار قصير', label: isFrench ? 'Lancer un quiz' : 'بدء اختبار' },
      'quiz-review': { icon: '🎯', title: isFrench ? 'Consolidez les notions à retravailler' : 'عزّز المفاهيم التي تحتاج إلى مراجعة', label: isFrench ? 'Revoir les quiz' : 'مراجعة الاختبارات' },
      resumes: { icon: '🗂️', title: isFrench ? 'Commencez par les fiches de votre parcours' : 'ابدأ بملخصات مسارك الدراسي', label: isFrench ? 'Voir les fiches' : 'فتح الملخصات' },
      examens: { icon: '🏆', title: isFrench ? 'Mobilisez vos acquis dans un examen' : 'وظّف مكتسباتك في امتحان', label: isFrench ? 'Voir les examens' : 'فتح الامتحانات' }
    };
    const guidedRecommendation = guidedStep && guidedStep.available && guidedLabels[guidedStep.key]
      ? { ...guidedLabels[guidedStep.key], href: guidedStep.href, guided: true, section: guidedStep.section, subject: guidedStep.subject } : null;
    const noContentRecommendation = guidedStep && !guidedStep.available
      ? { icon: '📭', title: isFrench ? 'Aucune ressource n’est encore publiée pour ce parcours et cette langue.' : 'لا تتوفر حالياً موارد منشورة لهذا المسلك ضمن اللغتين.', href: '#cours', label: isFrench ? 'Consulter la bibliothèque' : 'الاطلاع على المكتبة' } : null;
    const recommendation = latestWithMistakes
      ? { icon: '🧠', title: isFrench ? 'Revoir les erreurs de votre dernier quiz' : 'راجع أخطاء آخر اختبار أنجزته', href: '#gs-performance-analytics', label: isFrench ? 'Voir mon analyse' : 'عرض تحليل أدائي' }
      : pendingTask
        ? { icon: '🎯', title: escapeHtml(pendingTask.title || t.plan), detail: escapeHtml(pendingTask.date || '') + ' · ' + (pendingTask.duration || 30) + (isFrench ? ' min' : ' دقيقة'), href: '#student-space', label: isFrench ? 'Voir le planning' : 'عرض الخطة', planner: true }
        : recent
          ? { icon: '📖', title: isFrench ? 'Continuez votre apprentissage' : 'واصل التعلم انطلاقاً من آخر درس', href: safeLessonPath || '#cours', label: isFrench ? 'Reprendre' : 'استكمال التعلم' }
          : guidedRecommendation || noContentRecommendation || { icon: '🧪', title: isFrench ? 'Commencez par un exercice adapté à votre niveau' : 'ابدأ بتمرين مناسب لمستواك الدراسي', href: '#exercices', label: isFrench ? 'Voir les exercices' : 'استكشف التمارين' };
    const guidedAttrs = recommendation.guided
      ? ' data-journey-open="true" data-open-section="' + escapeHtml(recommendation.section) + '" data-open-subject="' + escapeHtml(recommendation.subject) + '"' : '';
    const nextBlock = '<div class="gs-continue-next"><span>' + recommendation.icon + '</span><div><small>' + t.next + '</small><strong>' + recommendation.title + '</strong>' + (recommendation.detail ? '<span>' + recommendation.detail + '</span>' : '') + '</div><a href="' + escapeHtml(recommendation.href) + '"' + (recommendation.planner ? ' data-open-planner="true"' : '') + guidedAttrs + '>' + recommendation.label + ' ←</a></div>';

    card.innerHTML =
      '<div class="gs-continue-heading"><div><span class="gs-continue-eyebrow">' + t.eyebrow + '</span><h3>' + t.title + '</h3></div><span class="gs-continue-mark">🧭</span></div>' +
      recentBlock + nextBlock +
      '<a class="gs-continue-model-link" href="/laboratory.html#tectonic-model"><span>🌍</span><span><strong>' + (isFrench ? 'Modèles interactifs de SVT' : 'النماذج التفاعلية لعلوم الحياة والأرض') + '</strong><small>' + (isFrench ? 'Explorez les plaques tectoniques et les expériences virtuelles' : 'استكشف الصفائح التكتونية والتجارب الافتراضية') + '</small></span><b>←</b></a>' +
      '<div class="gs-continue-stats"><div><strong>' + lessons.length + '</strong><span>' + t.viewed + '</span></div><div><strong>' + completed + '</strong><span>' + t.completed + '</span></div><div><strong>' + exercises.length + '</strong><span>' + t.exercises + '</span></div><div class="gs-continue-progress"><div><span>' + (isFrench ? 'Progression des cours terminés' : 'نسبة إتمام الدروس') + '</span><strong>' + percent + '%</strong></div><i><b style="width:' + percent + '%"></b></i></div><small class="gs-continue-scope">' + t.lessonScope + ' · ' + t.quizScope + '</small></div>';

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
    const guidedLink = card.querySelector('[data-journey-open]');
    if (guidedLink) guidedLink.addEventListener('click', function () {
      const section = document.getElementById(guidedLink.dataset.openSection);
      const subject = guidedLink.dataset.openSubject;
      const button = section && section.querySelector('.tab-btn[data-subject="' + subject + '"]');
      if (button && !button.classList.contains('active')) button.click();
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
    // Refresh immediately when Supabase changes the active student or signs out.
    document.addEventListener('gosvt:auth-changed', schedule);
    document.addEventListener('gosvt:journey-ready', schedule);
    document.addEventListener('click', function (event) {
      if (!event.target.closest) return;
      if (event.target.closest('.tab-btn, .lang-switcher')) window.setTimeout(schedule, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
