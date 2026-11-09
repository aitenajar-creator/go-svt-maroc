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
