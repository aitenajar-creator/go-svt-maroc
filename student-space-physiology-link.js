/* Adds a dedicated physiology learning route to the existing student category hub.
   This is additive only and does not touch student records or authentication. */
(() => {
  'use strict';
  const cardId = 'gs-physiology-lab-card';
  function addCard() {
    const grids = document.querySelectorAll('#student-space-content .gs-student-category-grid');
    grids.forEach(grid => {
      if (grid.querySelector('#' + cardId)) return;
      const link = document.createElement('a');
      link.id = cardId;
      link.className = 'gs-student-category-card';
      link.href = 'student-physiology-lab.html';
      const icon = document.createElement('span');
      icon.className = 'gs-student-category-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '🫁';
      const title = document.createElement('strong');
      title.textContent = document.documentElement.lang === 'fr' ? 'Physiologie interactive' : 'مختبر وظائف الأعضاء';
      const description = document.createElement('small');
      description.textContent = document.documentElement.lang === 'fr'
        ? 'Parcours guidés des appareils digestif et respiratoire'
        : 'مسارات تفاعلية لفهم الجهازين الهضمي والتنفسي';
      const action = document.createElement('span');
      action.className = 'gs-student-category-link';
      action.textContent = document.documentElement.lang === 'fr' ? 'Ouvrir le laboratoire ←' : 'افتح المختبر ←';
      link.append(icon, title, description, action);
      grid.append(link);
    });
  }
  const start = () => {
    addCard();
    const observer = new MutationObserver(addCard);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', () => queueMicrotask(addCard), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();