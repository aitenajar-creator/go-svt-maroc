/* GO SVT Maroc — Student performance analytics (account-scoped, read-only dashboard). */
(function () {
  'use strict';

  const ROOT_ID = 'gs-performance-analytics';
  const TEXT = {
    ar: {
      eyebrow: 'تحليل أدائك الدراسي', title: 'تقدمك بالأرقام',
      subtitle: 'تابع تطور نتائجك وحدد ما يستحق مراجعة إضافية.',
      attempts: 'عدد المحاولات', average: 'المعدل العام', recent: 'معدل آخر 5 محاولات',
      best: 'أفضل نتيجة', chart: 'تطور نتائج الاختبارات', chartHint: 'يعرض الرسم آخر 8 محاولات بترتيبها الزمني.',
      noChart: 'أنجز اختباراً واحداً على الأقل ليظهر تطور نتائجك هنا.',
      trendUp: 'تحسن', trendDown: 'انخفاض', trendFlat: 'مستقر', noTrend: 'تحتاج إلى محاولات أكثر للمقارنة',
      points: 'نقطة مئوية مقارنة بالمحاولات الخمس السابقة',
      focus: 'مجالات تستحق المراجعة', focusHint: 'اقتراحات مبنية على نتائجك والأخطاء المسجلة.',
      review: 'راجع أخطاء هذا الاختبار', noWeak: 'لا توجد حالياً أخطاء متكررة تستدعي اقتراح مراجعة محددة. واصل التدريب!',
      quiz: 'اختبار', errors: 'أخطاء مسجلة', mean: 'متوسط النتائج',
      allGood: 'أداء جيد! حافظ على المراجعة المنتظمة.',
      goQuiz: 'استكشف الاختبارات', empty: 'ستظهر تحليلاتك بعد إنجاز أول اختبار.',
      date: 'المحاولة'
    },
    fr: {
      eyebrow: 'ANALYSE DE VOS RÉSULTATS', title: 'Votre progression en chiffres',
      subtitle: 'Suivez vos résultats et repérez les notions à retravailler.',
      attempts: 'Tentatives', average: 'Moyenne générale', recent: 'Moyenne des 5 dernières',
      best: 'Meilleur score', chart: 'Évolution des résultats', chartHint: 'Les 8 dernières tentatives sont affichées dans l’ordre chronologique.',
      noChart: 'Effectuez au moins un quiz pour afficher votre évolution.',
      trendUp: 'En hausse', trendDown: 'En baisse', trendFlat: 'Stable', noTrend: 'Plus de tentatives sont nécessaires pour comparer',
      points: 'points par rapport aux cinq tentatives précédentes',
      focus: 'Points à retravailler', focusHint: 'Suggestions fondées sur vos résultats et erreurs enregistrées.',
      review: 'Revoir les erreurs de ce quiz', noWeak: 'Aucune difficulté particulière détectée pour le moment. Continuez à vous entraîner !',
      quiz: 'Quiz', errors: 'erreurs enregistrées', mean: 'Moyenne',
      allGood: 'Bon travail ! Gardez un rythme de révision régulier.',
      goQuiz: 'Découvrir les quiz', empty: 'Vos analyses apparaîtront après votre premier quiz.',
      date: 'Tentative'
    }
  };

  function isFrench() { return document.documentElement.lang === 'fr'; }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function getData() {
    if (!window.StudentSpace || !window.StudentAccount ||
        typeof window.StudentAccount.isLoggedIn !== 'function' ||
        !window.StudentAccount.isLoggedIn()) return null;
    const id = typeof window.StudentAccount.activeProfileId === 'function'
      ? window.StudentAccount.activeProfileId() : null;
    if (!id) return null;
    try { return window.StudentSpace.getProfileData(id); } catch (_) { return null; }
  }
  function validAttempts(data) {
    return (Array.isArray(data && data.quizResults) ? data.quizResults : [])
      .filter(a => a && typeof a === 'object' &&
        Number.isFinite(Number(a.percentage)) && Number(a.percentage) >= 0 &&
        Number(a.percentage) <= 100 && Number.isFinite(Number(a.date)))
      .map(a => ({ ...a, percentage: Number(a.percentage), date: Number(a.date) }))
      .sort((a, b) => a.date - b.date);
  }
  function average(items) {
    return items.length ? Math.round(items.reduce((sum, a) => sum + a.percentage, 0) / items.length) : 0;
  }
  function chartMarkup(items, t, fr) {
    if (!items.length) return '<p class="gs-pa-empty">' + t.noChart + '</p>';
    const shown = items.slice(-8);
    const width = 620, height = 190, left = 34, right = 12, top = 14, bottom = 32;
    const plotH = height - top - bottom;
    const gap = 12;
    const barW = Math.min(48, (width - left - right - gap * (shown.length - 1)) / shown.length);
    const totalW = shown.length * barW + (shown.length - 1) * gap;
    const startX = left + Math.max(0, (width - left - right - totalW) / 2);
    let bars = '';
    shown.forEach((a, i) => {
      const value = Math.max(0, Math.min(100, a.percentage));
      const bh = plotH * value / 100;
      const x = startX + i * (barW + gap);
      const y = top + plotH - bh;
      const date = new Date(a.date).toLocaleDateString(fr ? 'fr-MA' : 'ar-MA');
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
        '" height="' + bh.toFixed(1) + '" rx="6" class="gs-pa-bar"><title>' + esc(t.date + ' ' + date + ': ' + value + '%') +
        '</title></rect><text x="' + (x + barW / 2).toFixed(1) + '" y="' + (height - 10) +
        '" text-anchor="middle" class="gs-pa-axis">' + (i + 1) + '</text>';
    });
    const grid = [0, 50, 100].map(v => {
      const y = top + plotH - plotH * v / 100;
      return '<line x1="' + left + '" y1="' + y + '" x2="' + (width - right) +
        '" y2="' + y + '" class="gs-pa-grid"/><text x="25" y="' + (y + 4) +
        '" text-anchor="end" class="gs-pa-axis">' + v + '</text>';
    }).join('');
    return '<div class="gs-pa-chart-wrap"><svg class="gs-pa-chart" viewBox="0 0 ' + width + ' ' + height +
      '" role="img" aria-label="' + esc(t.chart) + '">' + grid + bars + '</svg></div>';
  }
  function buildFocus(data, attempts, t, fr) {
    const groups = new Map();
    attempts.forEach(a => {
      const id = String(a.quizId || '');
      if (!id) return;
      if (!groups.has(id)) groups.set(id, { id, scores: [], errors: 0, lastDate: 0 });
      const g = groups.get(id);
      g.scores.push(a.percentage);
      g.errors += Array.isArray(a.mistakes) ? a.mistakes.length : 0;
      g.lastDate = Math.max(g.lastDate, a.date);
    });
    const weak = Array.from(groups.values())
      .filter(g => g.errors > 0)
      .map(g => ({ ...g, mean: average(g.scores) }))
      .sort((a, b) => a.mean - b.mean || b.errors - a.errors)
      .slice(0, 3);
    if (!weak.length) {
      return '<div class="gs-pa-no-focus"><span>🌿</span><p>' + t.noWeak + '</p><a href="#quiz">' + t.goQuiz + ' ←</a></div>';
    }
    return '<div class="gs-pa-focus-list">' + weak.map((g, i) =>
      '<article class="gs-pa-focus-item"><div class="gs-pa-focus-rank">' + (i + 1) +
      '</div><div class="gs-pa-focus-copy"><strong>' + t.quiz + ' ' + (i + 1) +
      '</strong><span>' + t.mean + ': ' + g.mean + '% · ' + g.errors + ' ' + t.errors +
      '</span></div><button type="button" class="gs-pa-review" data-review-quiz="' + esc(g.id) +
      '">' + t.review + '</button></article>'
    ).join('') + '</div>';
  }
  function render() {
    const dashboard = document.getElementById('panel-dashboard');
    if (!dashboard || !dashboard.classList.contains('active')) return;
    const data = getData();
    if (!data) {
      const old = document.getElementById(ROOT_ID);
      if (old) old.remove();
      return;
    }
    const fr = isFrench(), t = fr ? TEXT.fr : TEXT.ar;
    const attempts = validAttempts(data);
    const allAverage = average(attempts);
    const recentFive = attempts.slice(-5);
    const previousFive = attempts.slice(-10, -5);
    const recentAverage = average(recentFive);
    const delta = recentFive.length === 5 && previousFive.length === 5
      ? recentAverage - average(previousFive) : null;
    const best = attempts.reduce((m, a) => Math.max(m, a.percentage), 0);
    const trend = delta === null ? t.noTrend : delta > 0
      ? t.trendUp + ' +' + delta : delta < 0 ? t.trendDown + ' ' + delta : t.trendFlat;
    const signature = JSON.stringify({
      lang: fr, attempts: attempts.map(a => [a.attemptId, a.percentage, a.date, a.quizId,
        Array.isArray(a.mistakes) ? a.mistakes.length : 0])
    });
    const card = document.createElement('section');
    card.id = ROOT_ID;
    card.className = 'gs-performance-analytics';
    card.dir = fr ? 'ltr' : 'rtl';
    card.dataset.signature = signature;
    if (!attempts.length) {
      card.innerHTML = '<div class="gs-pa-heading"><div><span class="gs-pa-eyebrow">' + t.eyebrow +
        '</span><h3>' + t.title + '</h3><p>' + t.subtitle + '</p></div><span class="gs-pa-icon">📈</span></div>' +
        '<div class="gs-pa-no-focus"><span>🧪</span><p>' + t.empty + '</p><a href="#quiz">' + t.goQuiz + ' ←</a></div>';
    } else {
      const deltaText = delta === null ? t.noTrend : (delta > 0 ? '+' : '') + delta + ' ' + t.points;
      card.innerHTML = '<div class="gs-pa-heading"><div><span class="gs-pa-eyebrow">' + t.eyebrow +
        '</span><h3>' + t.title + '</h3><p>' + t.subtitle + '</p></div><span class="gs-pa-icon">📈</span></div>' +
        '<div class="gs-pa-metrics"><div><span>' + t.attempts + '</span><strong>' + attempts.length +
        '</strong></div><div><span>' + t.average + '</span><strong>' + allAverage + '%</strong></div>' +
        '<div><span>' + t.recent + '</span><strong>' + recentAverage + '%</strong><small>' + esc(trend) +
        '</small></div><div><span>' + t.best + '</span><strong>' + best + '%</strong></div></div>' +
        '<div class="gs-pa-section"><div class="gs-pa-section-head"><h4>' + t.chart +
        '</h4><p>' + t.chartHint + '</p></div>' + chartMarkup(attempts, t, fr) + '</div>' +
        '<div class="gs-pa-section"><div class="gs-pa-section-head"><h4>' + t.focus +
        '</h4><p>' + t.focusHint + '</p></div>' + buildFocus(data, attempts, t, fr) + '</div>';
      const deltaNode = card.querySelector('.gs-pa-metrics small');
      if (deltaNode && delta !== null) deltaNode.classList.add(delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-flat');
    }
    const existing = document.getElementById(ROOT_ID);
    if (existing && existing.dataset.signature === signature) return;
    if (existing) existing.replaceWith(card);
    else {
      const anchor = dashboard.querySelector('.gs-learning-path') || dashboard.querySelector('.gs-daily-challenge');
      if (anchor) anchor.insertAdjacentElement('beforebegin', card);
      else dashboard.appendChild(card);
    }
    card.querySelectorAll('[data-review-quiz]').forEach(button => {
      button.addEventListener('click', function () {
        const latestData = getData();
        if (!latestData || !window.StudentSpace || typeof window.StudentSpace.retryMistakes !== 'function') return;
        const quizId = this.getAttribute('data-review-quiz');
        const stillOwned = validAttempts(latestData).some(a => String(a.quizId) === quizId);
        if (stillOwned) window.StudentSpace.retryMistakes(quizId);
      });
    });
  }


  const style = document.createElement('style');
  style.textContent = `
    .gs-performance-analytics{margin:1.25rem 0;padding:1.25rem;border:1px solid #dce9d8;border-radius:19px;background:linear-gradient(145deg,#f8fbf6,#fff);box-shadow:0 5px 18px rgba(24,57,37,.05);color:#294d36}
    .gs-pa-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}
    .gs-pa-eyebrow{font-size:.7rem;font-weight:800;letter-spacing:.05em;color:#638c5e}
    .gs-pa-heading h3{margin:.25rem 0;color:#244d37;font-size:1.18rem}
    .gs-pa-heading p,.gs-pa-section-head p{margin:.2rem 0;color:#718074;font-size:.84rem;line-height:1.6}
    .gs-pa-icon{display:grid;place-items:center;flex:0 0 46px;width:46px;height:46px;border-radius:14px;background:#eaf4e7;font-size:1.55rem}
    .gs-pa-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.65rem;margin:1rem 0}
    .gs-pa-metrics>div{display:flex;flex-direction:column;gap:.25rem;min-width:0;padding:.85rem;border:1px solid #e4ece1;border-radius:13px;background:#fff}
    .gs-pa-metrics span{color:#718074;font-size:.76rem;line-height:1.5}
    .gs-pa-metrics strong{color:#236b43;font-size:1.55rem;font-variant-numeric:tabular-nums}
    .gs-pa-metrics small{font-size:.72rem;line-height:1.5;color:#788579}
    .gs-pa-metrics small.is-up{color:#267344}.gs-pa-metrics small.is-down{color:#a45b32}
    .gs-pa-section{margin-top:1.2rem;padding:1rem;border:1px solid #e5ece2;border-radius:15px;background:rgba(255,255,255,.75)}
    .gs-pa-section-head h4{margin:0;color:#294d36;font-size:1rem}
    .gs-pa-chart-wrap{width:100%;overflow-x:auto}
    .gs-pa-chart{display:block;width:100%;min-width:300px;max-height:220px}
    .gs-pa-grid{stroke:#e7eee4;stroke-width:1;stroke-dasharray:4 4}
    .gs-pa-axis{fill:#718074;font-size:11px}
    .gs-pa-bar{fill:#69a66a}
    .gs-pa-focus-list{display:grid;gap:.6rem;margin-top:.8rem}
    .gs-pa-focus-item{display:flex;align-items:center;gap:.7rem;padding:.8rem;border:1px solid #e6ede3;border-radius:12px;background:#fff}
    .gs-pa-focus-rank{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;border-radius:10px;background:#edf5e9;color:#32633b;font-weight:800}
    .gs-pa-focus-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:.15rem}
    .gs-pa-focus-copy strong{font-size:.88rem;color:#294d36}
    .gs-pa-focus-copy span{font-size:.75rem;color:#718074;line-height:1.5}
    .gs-pa-review{padding:.55rem .75rem;border:0;border-radius:9px;background:#236b43;color:#fff;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer}
    .gs-pa-review:hover{background:#194e31}
    .gs-pa-no-focus,.gs-pa-empty{display:flex;align-items:center;gap:.8rem;padding:.9rem;border:1px dashed #d9e6d5;border-radius:12px;color:#68796b;line-height:1.7}
    .gs-pa-no-focus>span{font-size:1.45rem}.gs-pa-no-focus p{flex:1;margin:0}
    .gs-pa-no-focus a{color:#236b43;font-weight:700;text-decoration:none;white-space:nowrap}
    html.gs-dark .gs-performance-analytics{background:linear-gradient(145deg,#17251a,#1b261c);border-color:#38543a;color:#dce9dc}
    html.gs-dark .gs-pa-heading h3,html.gs-dark .gs-pa-section-head h4,html.gs-dark .gs-pa-focus-copy strong{color:#dce9dc}
    html.gs-dark .gs-pa-heading p,html.gs-dark .gs-pa-section-head p,html.gs-dark .gs-pa-metrics span,html.gs-dark .gs-pa-focus-copy span,html.gs-dark .gs-pa-no-focus,html.gs-dark .gs-pa-empty{color:#b8c9b8}
    html.gs-dark .gs-pa-metrics>div,html.gs-dark .gs-pa-section,html.gs-dark .gs-pa-focus-item{background:#1d2c20;border-color:#38543a}
    html.gs-dark .gs-pa-metrics strong{color:#9fd89a}
    html.gs-dark .gs-pa-axis{fill:#b8c9b8}.gs-pa-bar{fill:#78b878}
    @media(max-width:650px){.gs-pa-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.gs-pa-focus-item{align-items:flex-start;flex-wrap:wrap}.gs-pa-review{margin-inline-start:2.5rem}}
    @media(max-width:420px){.gs-performance-analytics{padding:.85rem}.gs-pa-section{padding:.75rem}.gs-pa-heading h3{font-size:1.03rem}}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    window.setTimeout(function () { queued = false; render(); }, 100);
  }
  function init() {
    const root = document.getElementById('student-space-content');
    if (!root) return;
    new MutationObserver(schedule).observe(root, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    document.addEventListener('gosvt:auth-changed', schedule);
    document.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('.lang-switcher')) schedule();
    });
    window.addEventListener('storage', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
