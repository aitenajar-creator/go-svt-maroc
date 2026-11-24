/* GO SVT Maroc — Student Learning Command Center.
 * Uses real StudentSpace statistics; opening a link never marks learning as completed.
 */
(function () {
  'use strict';

  const ROOT = 'gs-learning-command-center';
  const TEXT = {
    ar: {
      eyebrow: 'مركز التعلم الذكي', title: 'خطتك التعليمية', subtitle: 'تعلّم، طبّق، ثم تحقق من فهمك. المؤشرات أدناه مستمدة من نشاطك الفعلي.',
      lesson: 'الدروس', practice: 'التطبيق والتمارين', quiz: 'التقييم الذاتي',
      lessonEmpty: 'ابدأ بزيارة درس', practiceEmpty: 'ابدأ بتمرين', quizEmpty: 'أنجز اختباراً',
      lessonCount: (done, seen) => done + ' مكتمل من ' + seen + ' تمت زيارته',
      practiceCount: n => n + ' مورد تدريبي تمت زيارته',
      quizCount: (n, avg) => n + ' محاولة مسجلة · المعدل ' + avg + '%',
      library: 'مكتبة الدروس', lab: 'المختبرات والتجارب', exams: 'الامتحانات', progress: 'تتبع التقدم',
      libraryDesc: 'الدروس والملخصات حسب مسارك الدراسي', labDesc: 'نماذج وصور وتجارب علمية تفاعلية',
      examsDesc: 'تدرب على الفروض والامتحانات', progressDesc: 'راجع إنجازاتك ونتائجك المسجلة',
      level: 'مستواك', refresh: 'تحديث المؤشرات', tip: 'طريقة فعالة للتعلم', resources: 'الموارد المتاحة لمسارك', resourceNote: 'أعداد الملفات الفعلية المتاحة حسب مستواك ومسلكك، مع فصل اللغتين.', courses: 'دروس', exercises: 'تمارين', summaries: 'ملخصات', quizzes: 'اختبارات', exams: 'امتحانات', arabic: 'العربية', french: 'الفرنسية',
      tipText: 'اقرأ الوثيقة، استخرج المعطيات، فسّرها علمياً، ثم تحقق من فهمك بسؤال أو تمرين.'
    },
    fr: {
      eyebrow: 'CENTRE D’APPRENTISSAGE', title: 'Votre parcours d’apprentissage', subtitle: 'Apprendre, pratiquer puis vérifier. Les indicateurs reflètent votre activité réelle.',
      lesson: 'Cours', practice: 'Pratique et exercices', quiz: 'Auto-évaluation',
      lessonEmpty: 'Consultez un cours', practiceEmpty: 'Commencez un exercice', quizEmpty: 'Effectuez un quiz',
      lessonCount: (done, seen) => done + ' terminé(s) sur ' + seen + ' consulté(s)',
      practiceCount: n => n + ' ressource(s) consultée(s)',
      quizCount: (n, avg) => n + ' tentative(s) · moyenne ' + avg + '%',
      library: 'Bibliothèque', lab: 'Laboratoires et expériences', exams: 'Examens', progress: 'Suivi des progrès',
      libraryDesc: 'Cours et résumés selon votre parcours', labDesc: 'Modèles, images et expériences interactives',
      examsDesc: 'Entraînez-vous aux devoirs et examens', progressDesc: 'Consultez vos activités et résultats',
      level: 'Votre niveau', refresh: 'Actualiser les indicateurs', tip: 'Une méthode efficace', resources: 'Ressources de votre parcours', resourceNote: 'Nombre réel de fichiers selon votre niveau et filière, langues séparées.', courses: 'Cours', exercises: 'Exercices', summaries: 'Fiches et résumés', quizzes: 'Quiz', exams: 'Examens', arabic: 'Arabe', french: 'Français',
      tipText: 'Lisez le document, relevez les données, interprétez-les puis vérifiez votre compréhension.'
    }
  };

  const tracks = {
    TCS: ['الجذع المشترك العلمي', 'Tronc commun scientifique'],
    TCL: ['الجذع المشترك الأدبي', 'Tronc commun lettres'],
    '1BACSE': ['الأولى باكالوريا علوم تجريبية', '1ère Bac sciences expérimentales'],
    '1BACSM': ['الأولى باكالوريا علوم رياضية', '1ère Bac sciences mathématiques'],
    '1BACL': ['الأولى باكالوريا آداب', '1ère Bac lettres'],
    '2BACSVT': ['الثانية باكالوريا علوم الحياة والأرض', '2ème Bac SVT'],
    '2BACSP': ['الثانية باكالوريا علوم فيزيائية', '2ème Bac sciences physiques'],
    '2BACSM': ['الثانية باكالوريا علوم رياضية', '2ème Bac sciences mathématiques']
  };

  function language() { return document.documentElement.lang === 'fr' ? 'fr' : 'ar'; }
  function account() {
    try { return window.StudentAccount && StudentAccount.isLoggedIn() ? StudentAccount.getProfile() : null; }
    catch (_) { return null; }
  }
  function getStats() {
    try {
      return window.StudentSpace && typeof window.StudentSpace.getDashboardStats === 'function'
        ? window.StudentSpace.getDashboardStats()
        : null;
    } catch (_) { return null; }
  }
  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function render() {
    const panel = document.getElementById('panel-dashboard');
    if (!panel) return;
    const welcome = panel.querySelector('.gs-student-welcome');
    if (!welcome) return;

    const existing = document.getElementById(ROOT);
    const profile = account();
    if (!profile || ['admin', 'teacher'].includes(String(profile.role || '').toLowerCase())) {
      if (existing) existing.remove();
      return;
    }

    const stats = getStats();
    if (!stats) return;
    const L = language(), t = TEXT[L];
    const level = String(profile.study_level || '').toUpperCase();
    const track = String(profile.study_track || '').toUpperCase();
    const trackLabel = tracks[track] ? tracks[track][L] : track;
    const seen = number(stats.lessonsViewed);
    const completed = number(stats.completedLessons);
    const exercises = number(stats.exercisesDone);
    const attempts = number(stats.testsTaken);
    const average = number(stats.averageScore);
    const journey = window.StudentLearningJourney;
    if (journey && typeof journey.refresh === 'function') journey.refresh();
    const inventory = journey && typeof journey.getSnapshot === 'function' ? journey.getSnapshot() : null;
    const signature = [
      profile.id || profile.user_id || profile.email || 'student', L, level, track,
      seen, completed, exercises, attempts, average,
      inventory ? [inventory.counts.cours, inventory.counts.exercices, inventory.quizzes, inventory.counts.examens].join(',') : 'inventory-pending'
    ].join('|');
    if (existing && existing.dataset.signature === signature) return;

    const card = document.createElement('section');
    card.id = ROOT;
    card.className = 'gs-command-center';
    card.dataset.signature = signature;
    card.setAttribute('aria-label', t.title);

    const head = document.createElement('div');
    head.className = 'gs-cc-heading';
    const copy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'gs-cc-eyebrow';
    eyebrow.textContent = t.eyebrow;
    const title = document.createElement('h3');
    title.textContent = t.title;
    const subtitle = document.createElement('p');
    subtitle.textContent = t.subtitle;
    copy.append(eyebrow, title, subtitle);
    const badge = document.createElement('div');
    badge.className = 'gs-cc-profile';
    badge.textContent = [level, trackLabel].filter(Boolean).join(' · ');
    head.append(copy, badge);
    card.append(head);

    const steps = [
      { href: '#cours', icon: '📖', name: t.lesson, status: seen ? t.lessonCount(completed, seen) : t.lessonEmpty, done: completed > 0 },
      { href: '#exercices', icon: '🧩', name: t.practice, status: exercises ? t.practiceCount(exercises) : t.practiceEmpty, done: exercises > 0 },
      { href: '#quiz', icon: '⚡', name: t.quiz, status: attempts ? t.quizCount(attempts, average) : t.quizEmpty, done: attempts > 0 }
    ];
    const stepBox = document.createElement('div');
    stepBox.className = 'gs-cc-steps';
    steps.forEach(item => {
      const link = document.createElement('a');
      link.href = item.href;
      link.className = 'gs-cc-step' + (item.done ? ' is-done' : '');
      const icon = document.createElement('span');
      icon.textContent = item.icon;
      const name = document.createElement('strong');
      name.textContent = item.name;
      const status = document.createElement('small');
      status.textContent = item.status;
      link.append(icon, name, status);
      stepBox.append(link);
    });
    card.append(stepBox);

    if (inventory) {
      const inventoryBox = document.createElement('section');
      inventoryBox.className = 'gs-cc-inventory';
      inventoryBox.setAttribute('aria-label', t.resources);
      const inventoryHeading = document.createElement('div');
      inventoryHeading.className = 'gs-cc-inventory-heading';
      const inventoryTitle = document.createElement('strong');
      inventoryTitle.textContent = t.resources;
      const inventoryNote = document.createElement('small');
      inventoryNote.textContent = t.resourceNote;
      inventoryHeading.append(inventoryTitle, inventoryNote);
      const inventoryGrid = document.createElement('div');
      inventoryGrid.className = 'gs-cc-inventory-grid';
      [
        [t.courses, inventory.counts.cours, 'cours'],
        [t.exercises, inventory.counts.exercices, 'exercices'],
        [t.summaries, inventory.counts.fiches + inventory.counts.resumes, 'summaries'],
        [t.quizzes, inventory.quizzes, 'quiz'],
        [t.exams, inventory.counts.examens, 'examens']
      ].forEach(([label, count, type]) => {
        const item = document.createElement('div');
        item.className = 'gs-cc-inventory-item';
        const value = document.createElement('strong');
        value.textContent = String(number(count));
        const caption = document.createElement('span');
        caption.textContent = label;
        const details = document.createElement('small');
        const arabicCount = type === 'quiz'
          ? inventory.quizzesByLanguage.arabe
          : type === 'summaries'
            ? inventory.byLanguage.arabe.fiches + inventory.byLanguage.arabe.resumes
            : inventory.byLanguage.arabe[type];
        const frenchCount = type === 'quiz'
          ? inventory.quizzesByLanguage.francais
          : type === 'summaries'
            ? inventory.byLanguage.francais.fiches + inventory.byLanguage.francais.resumes
            : inventory.byLanguage.francais[type];
        details.textContent = t.arabic + ': ' + number(arabicCount) + ' · ' + t.french + ': ' + number(frenchCount);
        item.append(value, caption, details);
        inventoryGrid.append(item);
      });
      inventoryBox.append(inventoryHeading, inventoryGrid);
      card.append(inventoryBox);
    }

    const actions = [
      { href: '#cours', icon: '📚', title: t.library, desc: t.libraryDesc },
      { href: 'student-task-categories.html?category=biology', icon: '🔬', title: t.lab, desc: t.labDesc },
      { href: '#examens', icon: '🏆', title: t.exams, desc: t.examsDesc },
      { href: '#student-space', tab: 'progress', icon: '📈', title: t.progress, desc: t.progressDesc }
    ];
    const actionBox = document.createElement('div');
    actionBox.className = 'gs-cc-actions';
    actions.forEach(item => {
      const link = document.createElement('a');
      link.className = 'gs-cc-action';
      link.href = item.href;
      if (item.tab) link.dataset.studentTab = item.tab;
      const icon = document.createElement('span');
      icon.textContent = item.icon;
      const body = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = item.title;
      const desc = document.createElement('small');
      desc.textContent = item.desc;
      body.append(name, desc);
      link.append(icon, body);
      actionBox.append(link);
    });
    card.append(actionBox);

    const footer = document.createElement('div');
    footer.className = 'gs-cc-footer';
    const tip = document.createElement('div');
    tip.className = 'gs-cc-tip';
    const tipTitle = document.createElement('strong');
    tipTitle.textContent = '💡 ' + t.tip;
    const tipText = document.createElement('span');
    tipText.textContent = t.tipText;
    tip.append(tipTitle, tipText);
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = t.refresh;
    refresh.addEventListener('click', render);
    footer.append(tip, refresh);
    card.append(footer);

    if (existing) existing.replaceWith(card);
    else welcome.insertAdjacentElement('afterend', card);
  }

  let timer;
  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(render, 140);
  }
  function init() {
    const root = document.getElementById('student-space-content');
    if (!root) return;
    new MutationObserver(records => {
      const relevant = records.some(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target && target.closest('#' + ROOT)) return false;
        return [...record.addedNodes, ...record.removedNodes].some(node =>
          node.nodeType === 1 && node.id !== ROOT && !node.closest('#' + ROOT));
      });
      if (relevant) schedule();
    }).observe(root, { subtree: true, childList: true });
    document.addEventListener('gosvt:auth-changed', schedule);
    document.addEventListener('gosvt:progress-updated', schedule);
    document.addEventListener('gosvt:journey-ready', schedule);
    document.addEventListener('click', event => {
      const target = event.target.closest && event.target.closest('.lang-switcher, [data-student-tab]');
      if (!target) return;
      if (target.dataset.studentTab) {
        event.preventDefault();
        const tab = document.querySelector('.space-tab[data-tab="' + target.dataset.studentTab + '"]');
        if (tab) tab.click();
        return;
      }
      schedule();
    });
    window.addEventListener('storage', schedule);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
