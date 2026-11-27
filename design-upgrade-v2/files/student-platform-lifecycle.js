/* GO SVT Maroc — explicit lifecycle bridge for the candidate student platform.
 * Loaded after student-account.js. Does not change authentication or stored student data.
 */
(function () {
  'use strict';

  let scheduled = false;
  let lastOwner = null;

  function dispose() {
    if (window.GoSVTStudentPlatform && typeof window.GoSVTStudentPlatform.dispose === 'function') {
      window.GoSVTStudentPlatform.dispose();
    }
    lastOwner = null;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // StudentAccount.emit() refreshes the legacy StudentSpace immediately after
    // dispatching auth-changed. Render on the next frame so the new shell wins
    // deterministically, without racing the legacy synchronous refresh.
    const run = function () {
      scheduled = false;
      const account = window.StudentAccount;
      const platform = window.GoSVTStudentPlatform;
      const target = document.getElementById('student-space-content');
      if (!account || !platform || !target || !account.isReady()) return;

      const profile = account.getProfile && account.getProfile();
      if (!profile || !platform.canRender(profile)) {
        if (!account.isLoggedIn || !account.isLoggedIn()) dispose();
        return;
      }

      const owner = String(profile.id) + '|' + String(profile.study_level) + '|' + String(profile.study_track);
      if (lastOwner && lastOwner !== owner) dispose();
      if (platform.render(target)) lastOwner = owner;
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  }

  document.addEventListener('gosvt:auth-changed', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pageshow', schedule);

  const section = document.getElementById('student-space');
  if (section && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(function (records) {
      if (records.some(record => record.attributeName === 'class')) schedule();
    });
    observer.observe(section, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
