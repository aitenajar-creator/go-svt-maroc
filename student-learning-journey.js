/* GO SVT Maroc — Unified academic journey data layer.
 * Resource inventory is scoped by level and track, with Arabic/French content
 * kept distinct from the interface language. No student records are written.
 */
(function () {
  'use strict';

  const TRACKS = {
    TC: ['TCS', 'TCL'],
    '1BAC': ['1BACSE', '1BACSM', '1BACL'],
    '2BAC': ['2BACSVT', '2BACSP', '2BACSM']
  };
  const LANGUAGES = ['arabe', 'francais'];
  const TYPES = ['cours', 'exercices', 'examens', 'fiches', 'resumes'];
  let snapshot = null;
  let pending = null;
  let activeKey = '';

  function currentProfile() {
    try {
      if (!window.StudentAccount || !StudentAccount.isLoggedIn()) return null;
      const p = StudentAccount.getProfile();
      if (!p || ['admin', 'teacher'].includes(String(p.role || '').toLowerCase())) return null;
      const level = String(p.study_level || '').toUpperCase();
      const track = String(p.study_track || '').replace(/\s+/g, '').toUpperCase();
      if (!TRACKS[level] || !TRACKS[level].includes(track)) return null;
      return { id: String(p.id || p.user_id || ''), level, track };
    } catch (_) { return null; }
  }

  function activeContentLanguage() {
    const section = document.getElementById('cours');
    const active = section && section.querySelector('.tab-btn.active[data-subject]');
    const value = active && active.dataset.subject;
    return LANGUAGES.includes(value) ? value : 'francais';
  }

  function safePath(value) {
    const path = String(value || '').replace(/^\/+/, '');
    return path && !path.split('/').includes('..') ? '/' + path : '';
  }

  function matches(path, type, context, language) {
    const normalized = safePath(path);
    if (!normalized) return false;
    if (window.GoSVTPathways && typeof GoSVTPathways.matches === 'function') {
      try { return GoSVTPathways.matches(normalized, type, language, context.level, context.track); }
      catch (_) { return false; }
    }
    const parts = normalized.split('/').filter(Boolean);
    if (parts[1] !== language || parts[2] !== context.level || parts[0] !== type) return false;
    const folderTrack = parts.slice(3, -1).map(x => x.replace(/\s+/g, '').toUpperCase())
      .find(x => Object.values(TRACKS).flat().includes(x));
    return !folderTrack || folderTrack === context.track;
  }

  function readQuizFiles(context) {
    // Match the public quiz catalogue used by pathways.js. quiz-map.json links
    // quizzes to selected courses, but it is not the complete quiz inventory;
    // counting it would silently omit standalone quizzes and could count stale
    // mappings. content.json is the authoritative published-file manifest.
    const manifestUrl = window.CONFIG && window.CONFIG.MANIFEST_URL;
    if (!manifestUrl) return Promise.resolve({ arabe: [], francais: [] });
    const separator = manifestUrl.includes('?') ? '&' : '?';
    return fetch(manifestUrl + separator + 'pw=' + Date.now(), {
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(response => response.ok ? response.json() : [])
      .then(paths => {
        const files = Array.isArray(paths) ? paths : [];
        const quizFiles = Array.from(new Set(files.filter(path =>
          typeof path === 'string' &&
          /^\\/?quiz\\//i.test(path) &&
          /\\.json$/i.test(path)
        )));
        return Object.fromEntries(LANGUAGES.map(language => [
          language, quizFiles.filter(path => matches(path, 'quiz', context, language))
        ]));
      })
      .catch(error => {
        console.warn('[GoSVT] Quiz inventory unavailable:', error);
        return { arabe: [], francais: [] };
      });
  }

  function build(context) {
    if (typeof window.loadManifest !== 'function') {
      return Promise.reject(new Error('Content manifest loader unavailable'));
    }
    return Promise.all([window.loadManifest(), readQuizFiles(context)]).then(([files, quizzesByLanguage]) => {
      let list = Array.isArray(files) ? files : [];
      if (typeof window.isHiddenDuplicateCourseCopy === 'function') {
        list = list.filter(path => !window.isHiddenDuplicateCourseCopy(path));
      }
      // Repository README files document folders; they are not student learning resources.
      // Exclude them from the inventory without changing the shared manifest or library pipeline.
      list = Array.from(new Set(list.filter(path => !/(^|\/)README(?:\.[^/]*)?$/i.test(String(path)))));
      const byLanguage = {};
      const quizzes = {};
      LANGUAGES.forEach(language => {
        byLanguage[language] = {};
        TYPES.forEach(type => {
          byLanguage[language][type] = list.filter(path =>
            matches(path, type, context, language) &&
            !(type === 'exercices' && matches(path, 'examens', context, language))
          ).length;
        });
        quizzes[language] = quizzesByLanguage[language].length;
      });
      const counts = {};
      TYPES.forEach(type => {
        counts[type] = LANGUAGES.reduce((sum, language) => sum + byLanguage[language][type], 0);
      });
      return Object.freeze({
        profileKey: [context.id, context.level, context.track].join('|'),
        level: context.level,
        track: context.track,
        counts: Object.freeze(counts),
        byLanguage: Object.freeze(Object.fromEntries(LANGUAGES.map(language => [
          language, Object.freeze(byLanguage[language])
        ]))),
        quizzes: LANGUAGES.reduce((sum, language) => sum + quizzes[language], 0),
        quizzesByLanguage: Object.freeze(quizzes),
        total: Object.values(counts).reduce((sum, value) => sum + value, 0) +
          LANGUAGES.reduce((sum, language) => sum + quizzes[language], 0),
        generatedAt: Date.now()
      });
    });
  }

  function refresh() {
    const context = currentProfile();
    if (!context) {
      snapshot = null;
      pending = null;
      activeKey = '';
      return Promise.resolve(null);
    }
    const key = [context.id, context.level, context.track].join('|');
    if (snapshot && snapshot.profileKey === key) return Promise.resolve(snapshot);
    if (pending && activeKey === key) return pending;
    activeKey = key;
    pending = build(context).then(value => {
      if (activeKey !== key) return null;
      snapshot = value;
      pending = null;
      document.dispatchEvent(new CustomEvent('gosvt:journey-ready', { detail: { profileKey: key } }));
      return value;
    }).catch(error => {
      if (activeKey === key) pending = null;
      console.warn('[GoSVT] Academic resource inventory unavailable:', error);
      return null;
    });
    return pending;
  }

  function getSnapshot() {
    const context = currentProfile();
    if (!context || !snapshot) return null;
    const key = [context.id, context.level, context.track].join('|');
    return snapshot.profileKey === key ? snapshot : null;
  }

  function chooseLanguage(data, type) {
    const preferred = activeContentLanguage();
    // Quiz inventories are stored separately from manifest-backed resources.
    // Read that per-language map explicitly so recommendations never route a
    // learner to a language with zero quizzes when the other language has them.
    const available = type === 'quiz'
      ? (data.quizzesByLanguage || {})
      : (data.byLanguage[type] || {});
    if (Number(available[preferred]) > 0) return preferred;
    const alternate = preferred === 'francais' ? 'arabe' : 'francais';
    if (Number(available[alternate]) > 0) return alternate;
    return preferred;
  }

  function getNextStep(stats) {
    const data = getSnapshot();
    const s = stats || {};
    if (!data) return null;
    const has = key => Number(data.counts[key]) > 0;
    const hasQuizzes = data.quizzes > 0;
    const summaryCount = Number(data.counts.fiches) + Number(data.counts.resumes);
    const hasAny = has('cours') || has('exercices') || has('examens') || hasQuizzes || summaryCount > 0;
    if (!hasAny) return { key: 'none', section: 'cours', href: '#cours', subject: activeContentLanguage(), available: false };

    const step = (key, section, type) => ({
      key, section, href: '#' + section,
      subject: type ? chooseLanguage(data, type) : activeContentLanguage(),
      available: true
    });

    if (!Number(s.lessonsViewed)) {
      if (has('cours')) return step('cours', 'cours', 'cours');
      if (summaryCount) return step('resumes', 'resumes', data.counts.fiches ? 'fiches' : 'resumes');
      if (has('exercices')) return step('exercices', 'exercices', 'exercices');
      if (hasQuizzes) return step('quiz', 'quiz', 'quiz');
      if (has('examens')) return step('examens', 'examens', 'examens');
    }
    if (Number(s.lessonsViewed) > Number(s.completedLessons) && has('cours')) {
      return step('continue', 'cours', 'cours');
    }
    if (has('exercices') && !Number(s.exercisesDone)) return step('exercices', 'exercices', 'exercices');
    if (hasQuizzes && !Number(s.testsTaken)) return step('quiz', 'quiz', 'quiz');
    if (hasQuizzes && Number(s.testsTaken) && Number(s.averageScore) < 70) return step('quiz-review', 'quiz', 'quiz');
    if (has('examens')) return step('examens', 'examens', 'examens');
    if (summaryCount) return step('resumes', 'resumes', data.counts.fiches ? 'fiches' : 'resumes');
    if (hasQuizzes) return step('quiz', 'quiz', 'quiz');
    if (has('exercices')) return step('exercices', 'exercices', 'exercices');
    if (has('cours')) return step('cours', 'cours', 'cours');
    return { key: 'none', section: 'cours', href: '#cours', subject: activeContentLanguage(), available: false };
  }

  window.StudentLearningJourney = Object.freeze({ refresh, getSnapshot, getNextStep });
  document.addEventListener('gosvt:auth-changed', refresh);
  document.addEventListener('gosvt:journey-refresh', refresh);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})();
