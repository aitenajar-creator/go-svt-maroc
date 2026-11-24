/* GO SVT Maroc — design upgrade : compteurs réels (depuis content.json), cartes de niveau, apparition au défilement */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) Cartes de niveau : ouvre « Cours » puis sélectionne le niveau, avec les gestionnaires existants du site
  document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('[data-go-level]');
    if (!card) return;
    e.preventDefault();
    var lvl = card.getAttribute('data-go-level');
    var nav = document.querySelector('.main-nav a[href="#cours"]');
    if (nav) nav.click(); else location.hash = '#cours';
    setTimeout(function () {
      var b = document.querySelector('#cours .level-tab-btn[data-level="' + lvl + '"]');
      if (b) b.click();
      var s = document.getElementById('cours');
      if (s && s.scrollIntoView) s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, 60);
  });

  // 2) Statistiques réelles : comptées depuis content.json (aucun chiffre inventé)
  function countUp(el, to) {
    if (reduce || to < 2) { el.textContent = to; return; }
    var t0 = null, dur = 1200;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1), k = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * k);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var box = document.getElementById('gs-stats');
  if (box) {
    fetch('content.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (paths) {
      var seen = {}, n = { cours: 0, exercices: 0, examens: 0, quiz: 0 };
      paths.forEach(function (p) {
        p = String(p).replace(/^\//, '');
        var top = p.split('/')[0], low = p.toLowerCase();
        if (top === 'quiz' && low.endsWith('.json')) { n.quiz++; return; }
        if (!low.endsWith('.pdf') || !(top in n)) return;
        var key = low.split('/').filter(function (x) { return !/^chapitre \d+$/.test(x); }).join('/');   // copies « Chapitre N/ » = même fichier
        if (seen[key]) return; seen[key] = 1; n[top]++;
      });
      var total = n.cours + n.exercices + n.examens + n.quiz;
      if (!total) return;
      box.hidden = false;
      var started = false;
      function run() {
        if (started) return; started = true;
        box.querySelectorAll('[data-stat]').forEach(function (el) { countUp(el, n[el.getAttribute('data-stat')] || 0); });
      }
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: .3 });
        io.observe(box);
      } else run();
    }).catch(function () { /* en cas d'échec le bandeau reste masqué */ });
  }

  // 5) État « vide » illustré : remplace le simple texte « لا توجد ملفات حالياً » dans les sections de contenu
  function createFlask() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '3');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    function shape(tag, attrs) {
      var node = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      svg.appendChild(node);
    }
    shape('path', { d: 'M24 6h16M27 6v18L12 50a5 5 0 0 0 4.4 7.5h31.2A5 5 0 0 0 52 50L37 24V6' });
    shape('path', { d: 'M18 40h28', 'stroke-opacity': '.5' });
    shape('circle', { cx: '30', cy: '46', r: '2.2' });
    shape('circle', { cx: '38', cy: '33', r: '2' });
    return svg;
  }
  function enrichEmpty(root) {
    root.querySelectorAll('.no-files:not([data-gs])').forEach(function (p) {
      if (!p.closest('#cours,#exercices,#examens,#fiches,#resumes,#documents,#ressources,#divers')) return;
      p.setAttribute('data-gs', '1');
      var ar = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
      var box = document.createElement('div');
      box.className = 'gs-empty';
      box.appendChild(createFlask());
      var heading = document.createElement('h4');
      heading.textContent = ar ? 'هذا القسم قيد الإعداد' : 'Cette section est en préparation';
      box.appendChild(heading);
      var description = document.createElement('p');
      description.textContent = ar
        ? 'لم نرفع بعد ملفات هذا المستوى أو اللغة. جرّب لغة أو مستوى آخر، أو اختبر معلوماتك، أو أخبرنا بما تحتاجه وسنعطيه الأولوية.'
        : 'Aucun fichier pour ce niveau ou cette langue pour l’instant. Essaie une autre langue ou un autre niveau, teste-toi avec un quiz, ou dis-nous ce dont tu as besoin.';
      box.appendChild(description);
      var actions = document.createElement('div');
      actions.className = 'gs-empty-actions';
      function addAction(href, label) {
        var link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        actions.appendChild(link);
      }
      addAction('#quiz', ar ? '🎯 جرّب اختباراً' : '🎯 Tester un quiz');
      addAction('#contact', ar ? '💬 اطلب هذا المحتوى' : '💬 Demander ce contenu');
      box.appendChild(actions);
      p.replaceWith(box);
    });
  }
  if ('MutationObserver' in window) {
    var main = document.querySelector('main') || document.body;
    var scanQueued = false;
    function scanDynamicContent() {
      if (scanQueued) return;
      scanQueued = true;
      var schedule = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
      schedule(function () {
        scanQueued = false;
        enrichEmpty(main);
        enhanceCards(main);
      });
    }
    new MutationObserver(scanDynamicContent).observe(main, { childList: true, subtree: true });
    enrichEmpty(main); enhanceCards(main);
  }



  // 6) Recherche rapide dans les ressources actuellement affichées
  function initResourceSearch() {
    if (document.getElementById('gs-resource-search')) return;
    var course = document.getElementById('cours');
    if (!course) return;
    var panel = document.createElement('section');
    panel.className = 'gs-resource-search';
    panel.id = 'gs-resource-search';
    panel.setAttribute('aria-label', (document.documentElement.lang || 'ar') === 'ar' ? 'البحث في الموارد' : 'Recherche de ressources');
    var label = document.createElement('label');
    label.className = 'gs-resource-search-label';
    label.setAttribute('for', 'gs-resource-search-input');
    label.textContent = (document.documentElement.lang || 'ar') === 'ar' ? '🔎 ابحث في الموارد' : '🔎 Rechercher dans les ressources';
    var input = document.createElement('input');
    input.id = 'gs-resource-search-input';
    input.type = 'search';
    input.autocomplete = 'off';
    input.placeholder = (document.documentElement.lang || 'ar') === 'ar' ? 'اسم الدرس، الوحدة، الملف، المستوى...' : 'Cours, unité, fichier, niveau…';
    input.setAttribute('aria-describedby', 'gs-resource-search-status');
    var status = document.createElement('p');
    status.id = 'gs-resource-search-status';
    status.className = 'gs-resource-search-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = (document.documentElement.lang || 'ar') === 'ar' ? 'اكتب كلمة للبحث بين الملفات التي تظهر في الصفحة.' : 'Saisis un terme pour filtrer les ressources visibles.';
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'gs-resource-search-clear';
    clear.textContent = (document.documentElement.lang || 'ar') === 'ar' ? 'مسح البحث' : 'Effacer';
    clear.setAttribute('aria-label', clear.textContent);
    panel.append(label,input,clear,status);
    course.before(panel);
    function apply() {
      var term = input.value.trim().toLocaleLowerCase();
      var cards = Array.prototype.slice.call(document.querySelectorAll('.file-resource-card'));
      var shown = 0;
      cards.forEach(function(card) {
        var text = (card.textContent + ' ' + (card.getAttribute('data-resource-path') || '')).toLocaleLowerCase();
        var match = !term || text.indexOf(term) !== -1;
        card.classList.toggle('gs-search-hidden', !match);
        if (match && !card.hidden) shown++;
      });
      document.querySelectorAll('.track-content-group').forEach(function(group) {
        var visible = group.querySelector('.file-resource-card:not([hidden]):not(.gs-search-hidden)');
        group.classList.toggle('gs-search-group-hidden', !!term && !visible);
      });
      if (!term) status.textContent = (document.documentElement.lang || 'ar') === 'ar' ? 'اكتب كلمة للبحث بين الملفات التي تظهر في الصفحة.' : 'Saisis un terme pour filtrer les ressources visibles.';
      else status.textContent = (document.documentElement.lang || 'ar') === 'ar' ? 'النتائج: ' + shown + ' مورد' : 'Résultats : ' + shown + ' ressource(s)';
    }
    input.addEventListener('input', apply);
    clear.addEventListener('click', function() { input.value=''; apply(); input.focus(); });
    panel.addEventListener('keydown', function(e) { if (e.key === 'Escape') { input.value=''; apply(); input.blur(); } });
    window.GoSVTResourceSearch = { refresh: apply, clear: function(){input.value='';apply();} };
  }
  initResourceSearch();

  // 6) Vrais titres de cours sur les cartes : tirés des fichiers quiz liés par quiz-map.json (repli : nom du fichier)
  var qmap = null, qcache = {};
  function loadMap() { return qmap || (qmap = fetch('quiz-map.json').then(function (r) { return r.json(); }).catch(function () { return {}; })); }
  function enhanceCards(root) {
    root.querySelectorAll('.file-resource-card:not([data-gs-t])').forEach(function (card) {
      card.setAttribute('data-gs-t', '1');
      var path = (card.getAttribute('data-resource-path') || '').replace(/^\//, '');
      if (!path) return;
      loadMap().then(function (m) {
        var q = m[path]; if (!q) return;
        return (qcache[q] = qcache[q] || fetch(q).then(function (r) { return r.json(); })).then(function (d) {
          var h = card.querySelector('.file-info-panel > h3');
          if (!d || !d.titre || !h) return;
          h.textContent = d.titre; h.setAttribute('dir', 'auto');
          if (d.description) {
            var k = document.createElement('small'); k.className = 'gs-kicker'; k.setAttribute('dir', 'auto'); k.textContent = d.description; h.before(k);
          }
        });
      }).catch(function () {});
    });
  }

  // 3) Apparition douce au défilement (éléments statiques uniquement)
  var els = document.querySelectorAll('.gs-level-card,.gs-stats-card,.feature-card,.gs-founder-card');
  if (!('IntersectionObserver' in window) || reduce) return;
  var obs = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: .15 });
  els.forEach(function (el, i) { el.classList.add('gs-reveal'); el.style.setProperty('--d', (i % 4) * .08 + 's'); obs.observe(el); });


})();
