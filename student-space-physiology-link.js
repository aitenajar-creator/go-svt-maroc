/* Adds a dedicated physiology learning route to the existing student category hub.
   This is additive only and does not touch student records or authentication. */
(() => {
  'use strict';
  const cards = [
    { id: 'gs-physiology-lab-card', href: 'student-physiology-lab.html', icon: '🫁',
      ar: ['مختبر وظائف الأعضاء', 'مسارات تفاعلية لفهم الجهازين الهضمي والتنفسي', 'افتح المختبر ←'],
      fr: ['Physiologie interactive', 'Parcours guidés des appareils digestif et respiratoire', 'Ouvrir le laboratoire ←'] },
    { id: 'gs-molecular-lab-card', href: 'student-molecular-lab.html', icon: '🧬',
      ar: ['مختبر الخلية والوراثة 3D', 'استكشف الخلايا النباتية والحيوانية وبنية ADN ثلاثية الأبعاد', 'اكتشف المختبر ←'],
      fr: ['Laboratoire cellule & ADN 3D', 'Explorez les cellules végétales, animales et la structure de l’ADN', 'Explorer le laboratoire ←'] }
  ];
  function addCard() {
    const grids = document.querySelectorAll('#student-space-content .gs-student-category-grid');
    grids.forEach(grid => {
      cards.forEach(config => {
        let link = grid.querySelector('#' + config.id);
        const isNew = !link;
        if (!link) link = document.createElement('a');
        link.id = config.id;
        link.className = 'gs-student-category-card';
        link.href = config.href;
        const icon = document.createElement('span');
        icon.className = 'gs-student-category-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = config.icon;
        const lang = document.documentElement.lang === 'fr' ? 'fr' : 'ar';
        const content = config[lang];
        const title = document.createElement('strong');
        title.textContent = content[0];
        const description = document.createElement('small');
        description.textContent = content[1];
        const action = document.createElement('span');
        action.className = 'gs-student-category-link';
        action.textContent = content[2];
        if (isNew) {
          link.append(icon, title, description, action);
          grid.append(link);
        } else {
          link.querySelector('.gs-student-category-icon').textContent = config.icon;
          link.querySelector('strong').textContent = content[0];
          link.querySelector('small').textContent = content[1];
          link.querySelector('.gs-student-category-link').textContent = content[2];
        }
      });
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