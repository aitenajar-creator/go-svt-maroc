/* GO SVT Maroc — Unified academic journey data layer.
 * Reads the existing content manifest and the authenticated learner profile.
 * No student records are written; no curriculum units are invented.
 */
(function () {
  'use strict';

  const TRACKS = {
    TC: ['TCS', 'TCL'],
    '1BAC': ['1BACSE', '1BACSM', '1BACL'],
    '2BAC': ['2BACSVT', '2BACSP', '2BACSM']
  };
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
      const track = String(p.study_track || '').replace(/\\s+/g, '').toUpperCase();
      if (!TRACKS[level] || !TRACKS[level].includes(track)) return null;
      const language = document.documentElement.lang === 'fr' ? 'francais' : 'arabe';
      return { id: String(p.id || p.user_id || ''), level, track, language, profile: p };
    } catch (_) { return null; }
  }

  function safePath(value) {
    const path = String(value || '').replace(/^\\/+/, '');
    return path && !path.split('/').includes('..') ? '/' + path : '';
  }

  function matches(path, type, context) {
    const normalized = safePath(path);
    if (!normalized) return false;
    if (window.GoSVTPathways && typeof GoSVTPathways.matches === 'function') {
      try { return GoSVTPathways.matches(normalized, type, context.language, context.level, context.track); }
      catch (_) { return false; }
    }
    const parts = normalized.split('/').filter(Boolean);
    if (parts[1] !== context.language || parts[2] !== context.level) return false;
    if (parts[0] !== type) return false;
    const folderTrack = parts.slice(3, -1).map(x => x.replace(/\\s+/g, '').toUpperCase())
      .find(x => Object.values(TRACKS).flat().includes(x));
    return !folderTrack || folderTrack === context.track;
  }

  function readQuizMap(context) {
    return fetch('/quiz-map.json', { cache: 'no-cache', credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : {})
      .then(map => {
        if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
        return Array.from(new Set(Object.values(map).filter(path =>
          typeof path === 'string' && matches(path, 'quiz', context)
        )));
      })
      .catch(() => []);
  }

  function build(context) {
    if (typeof window.loadManifest !== 'function') {
      return Promise.reject(new Error('Content manifest loader unavailable'));
    }
    return Promise.all([window.loadManifest(), readQuizMap(context)]).then(([files, quizzes]) => {
      const list = Array.isArray(files) ? files : [];
      const counts = {};
      TYPES.forEach(type => {
        counts[type] = list.filter(path => matches(path, type, context)).length;
      });
      // Exam material may also be stored in the exercises tree; the same
      // matching rules used by the public library determine its visibility.
      counts.examens = list.filter(path => matches(path, 'examens', context)).length;
      return Object.freeze({
        profileKey: [context.id, context.level, context.track, context.language].join('|'),
        level: context.level,
        track: context.track,
        language: context.language,
        counts: Object.freeze(counts),
        quizzes: quizzes.length,
        total: Object.values(counts).reduce((sum, value) => sum + value, 0) + quizzes.length,
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
    const key = [context.id, context.level, context.track, context.language].join('|');
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
    const key = [context.id, context.level, context.track, context.language].join('|');
    return snapshot.profileKey === key ? snapshot : null;
  }

  function getNextStep(stats) {
    const data = getSnapshot();
    const s = stats || {};
    if (!data) return null;
    if (!data.counts.cours) return { key: 'cours', href: '#cours', available: false };
    if (!Number(s.lessonsViewed)) return { key: 'cours', href: '#cours', available: true };
    if (Number(s.completedLessons) < Number(s.lessonsViewed)) return { key: 'continue', href: '#cours', available: true };
    if (data.counts.exercices && !Number(s.exercisesDone)) return { key: 'exercices', href: '#exercices', available: true };
    if (data.quizzes && !Number(s.testsTaken)) return { key: 'quiz', href: '#quiz', available: true };
    if (Number(s.testsTaken) && Number(s.averageScore) < 70 && data.quizzes) return { key: 'quiz-review', href: '#quiz', available: true };
    if (data.counts.examens) return { key: 'examens', href: '#examens', available: true };
    if (data.quizzes) return { key: 'quiz', href: '#quiz', available: true };
    if (data.counts.exercices) return { key: 'exercices', href: '#exercices', available: true };
    return { key: 'cours', href: '#cours', available: true };
  }

  window.StudentLearningJourney = Object.freeze({
    refresh,
    getSnapshot,
    getNextStep,
    getProfile: currentProfile
  });

  document.addEventListener('gosvt:auth-changed', refresh);
  document.addEventListener('gosvt:journey-refresh', refresh);
  document.addEventListener('click', event => {
    if (event.target.closest && event.target.closest('.lang-switcher')) {
      snapshot = null;
      refresh();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})();
