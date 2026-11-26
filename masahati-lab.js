/* مساحتي — المختبر الرقمي والأطلس المصوّر · Go SVT Maroc
 * يُستدعى من masahati.js عبر MasahatiLab.render(el, 'exp' | 'atlas', ctx)
 */
(function () {
'use strict';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const g = (x, m, s) => Math.exp(-Math.pow((x - m) / s, 2));

/* ───────── مكوّنات مشتركة ───────── */
function slider(id, label, min, max, step, val, unit) {
  return `<div class="mh-ctl"><label for="${id}">${label}<output id="${id}-o">${val}${unit || ''}</output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" data-unit="${unit || ''}"></div>`;
}
function plot(o) {
  const w = 320, h = 190, L = 38, B = 28, R = 10, Tp = 10, pw = w - L - R, ph = h - B - Tp;
  const X = x => L + x / o.xmax * pw, Y = y => Tp + ph - y / o.ymax * ph;
  let s = `<svg viewBox="0 0 ${w} ${h}" class="mh-chart" role="img" aria-label="${o.label || ''}"><rect x="${L}" y="${Tp}" width="${pw}" height="${ph}" fill="none" stroke="var(--mh-line)"/>`;
  for (let i = 1; i < 4; i++) s += `<line x1="${L}" x2="${L + pw}" y1="${Tp + ph * i / 4}" y2="${Tp + ph * i / 4}" stroke="var(--mh-line)" stroke-dasharray="3"/>`;
  [0, .5, 1].forEach(f => { s += `<text x="${X(o.xmax * f)}" y="${h - 12}" font-size="10" text-anchor="middle" fill="var(--mh-soft)">${Math.round(o.xmax * f * 10) / 10}</text><text x="${L - 5}" y="${Y(o.ymax * f) + 3}" font-size="10" text-anchor="end" fill="var(--mh-soft)">${Math.round(o.ymax * f)}</text>`; });
  s += `<text x="${L + pw / 2}" y="${h - 1}" font-size="10" text-anchor="middle" fill="var(--mh-ink)" font-weight="700">${o.xl}</text><text transform="translate(9 ${Tp + ph / 2}) rotate(-90)" font-size="10" text-anchor="middle" fill="var(--mh-ink)" font-weight="700">${o.yl}</text>`;
  if (o.curve) s += `<polyline fill="none" stroke="var(--mh-brand)" stroke-width="2.5" stroke-linejoin="round" points="${o.curve.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" opacity="${o.curveOp || 1}"/>`;
  (o.pts || []).forEach(p => { s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" fill="var(--mh-gold)" stroke="#fff" stroke-width="1.5"/>`; });
  if (o.cur) s += `<line x1="${X(o.cur[0])}" x2="${X(o.cur[0])}" y1="${Tp}" y2="${Tp + ph}" stroke="var(--mh-red)" stroke-dasharray="4"/><circle cx="${X(o.cur[0])}" cy="${Y(o.cur[1])}" r="6" fill="var(--mh-red)"/>`;
  return s + '</svg>';
}
function table(head, rows) { return `<table class="mh-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" style="color:var(--mh-soft)">—</td></tr>`}</tbody></table>`; }
function mcq(c, q, opts, ok, expl) {
  return `<div class="mh-mcq" data-ok="${ok}"><p style="font-weight:800;margin-bottom:.5rem">🧠 ${q}</p><div class="mh-opts">${opts.map((o, i) => `<button type="button" class="mh-opt" data-mq="${i}"><kbd>${i + 1}</kbd><span>${o}</span></button>`).join('')}</div><div class="mh-expl" hidden>${expl}</div></div>`;
}
function bindMcq(root, c, id) {
  let done = false;
  root.querySelectorAll('.mh-mcq').forEach(box => box.addEventListener('click', e => {
    const b = e.target.closest('[data-mq]'); if (!b || box.dataset.locked) return;
    const ok = +box.dataset.ok, i = +b.dataset.mq;
    b.classList.add(i === ok ? 'ok' : 'no');
    if (i !== ok) { box.querySelector(`[data-mq="${ok}"]`).classList.add('ok'); } else if (!done) { done = true; c.complete(id); }
    box.dataset.locked = 1; box.querySelector('.mh-expl').hidden = false;
  }));
}
function bindSliders(root, fn) {
  root.querySelectorAll('input[type=range]').forEach(i => i.addEventListener('input', () => { const o = root.querySelector('#' + i.id + '-o'); if (o) o.textContent = i.value + (i.dataset.unit || ''); fn(); }));
}
const shell = (c, stage, panel) => `<div class="mh-lab"><div style="display:grid;gap:.8rem;align-content:start"><div class="mh-stage">${stage}</div></div><div style="display:grid;gap:.8rem;align-content:start">${panel}</div></div>`;

/* ───────── 1) التناضح ───────── */
function osmosis(root, c) {
  const T = c.T; let plant = false; const rec = [];
  const vol = (conc) => plant ? clamp(100 + (0.9 - conc) / 0.9 * 12, 60, 112) : clamp(100 + (0.9 - conc) / 0.9 * 55, 38, 170);
  const draw = () => {
    const conc = +root.querySelector('#os-c').value / 100, v = vol(conc), r = 55 * Math.sqrt(v / 100);
    const bursts = !plant && v > 150, tint = clamp(conc / 2, 0, 1);
    const inflow = conc < 0.9 ? 'in' : conc > 0.9 ? 'out' : 'eq';
    const arrows = inflow === 'eq' ? '' : [0, 1, 2, 3].map(k => { const a = k * Math.PI / 2 + .6, x = 200 + Math.cos(a) * (r + 45), y = 150 + Math.sin(a) * (r + 45), dx = Math.cos(a) * 26 * (inflow === 'in' ? -1 : 1), dy = Math.sin(a) * 26 * (inflow === 'in' ? -1 : 1); return `<line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y + dy}" stroke="#2f7fd1" stroke-width="4" marker-end="url(#ah)"/>`; }).join('');
    const cell = plant
      ? `<rect x="${200 - 60}" y="${150 - 60}" width="120" height="120" rx="10" fill="none" stroke="#6a9a3a" stroke-width="7"/><rect x="${200 - r * .98}" y="${150 - r * .98}" width="${r * 1.96}" height="${r * 1.96}" rx="${v < 98 ? 26 : 8}" fill="#9ed67a" stroke="#4a8a2a" stroke-width="3"/><ellipse cx="200" cy="150" rx="${r * .5}" ry="${r * .5}" fill="#bfeaa3" opacity=".8"/>`
      : bursts ? `<g fill="#f2a0a0" stroke="#c44" stroke-width="2"><circle cx="150" cy="130" r="16"/><circle cx="240" cy="165" r="20"/><circle cx="190" cy="190" r="12"/><circle cx="225" cy="105" r="10"/></g><text x="200" y="152" text-anchor="middle" font-size="22">💥</text>`
      : `<path d="${v < 85 ? crenated(200, 150, r) : `M${200 - r} 150a${r} ${r * .85} 0 1 0 ${r * 2} 0a${r} ${r * .85} 0 1 0 ${-r * 2} 0z`}" fill="#f6b3a8" stroke="#c9574a" stroke-width="3"/><circle cx="200" cy="150" r="${r * .3}" fill="#c9574a" opacity=".6"/>`;
    root.querySelector('#os-svg').innerHTML = `<svg viewBox="0 0 400 300"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#2f7fd1"/></marker></defs><rect x="20" y="30" width="360" height="250" rx="22" fill="#4aa3df" opacity="${.18 + tint * .35}" stroke="#4aa3df" stroke-width="3"/><g fill="#fff" opacity="${.35 + tint * .4}">${[...Array(Math.round(conc * 25))].map((_, i) => `<circle cx="${40 + (i * 53) % 320}" cy="${50 + (i * 37) % 70 + (i % 3) * 130}" r="2.6"/>`).join('')}</g>${cell}${arrows}<text x="200" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="var(--mh-ink)">NaCl ${conc.toFixed(2)} %</text></svg>`;
    const msg = plant ? (conc < .85 ? T('خلية منتفخة (turgescente): الجدار يمنع الانفجار', 'Cellule turgescente : la paroi empêche l’éclatement') : conc > .95 ? T('انكماش الغشاء الهيولي: بلازموليز', 'Plasmolyse : la membrane se détache de la paroi') : T('توازن: لا تغيّر في الحجم', 'Équilibre : volume stable'))
      : (bursts ? T('انفجار الخلية (hémolyse)!', 'Éclatement de la cellule (hémolyse) !') : conc < .85 ? T('الخلية تنتفخ: ماء يدخل', 'La cellule gonfle : l’eau entre') : conc > .95 ? T('الخلية تتجعّد (crénelée): ماء يخرج', 'Cellule crénelée : l’eau sort') : T('وسط متساوي التوتر: توازن', 'Milieu isotonique : équilibre'));
    root.querySelector('#os-msg').innerHTML = `<b>${msg}</b><br><small>${T('الحجم النسبي', 'Volume relatif')}: ${Math.round(v)}%</small>`;
    root.querySelector('#os-tab').innerHTML = table([T('التركيز %', 'Conc. %'), T('الحجم %', 'Vol. %')], rec.map(r => [r[0].toFixed(2), Math.round(r[1])]));
    root.querySelector('#os-plot').innerHTML = plot({ xmax: 2, ymax: 180, xl: 'NaCl %', yl: T('الحجم %', 'Vol. %'), pts: rec, cur: [conc, v], label: 'osmosis' });
  };
  root.innerHTML = shell(c, `<div id="os-svg"></div>`,
    `<div class="mh-card"><div class="mh-seg" role="group"><button data-t="a" aria-pressed="true">${T('خلية حيوانية (كريّة دم)', 'Cellule animale (hématie)')}</button><button data-t="p" aria-pressed="false">${T('خلية نباتية', 'Cellule végétale')}</button></div><div style="margin-top:.9rem">${slider('os-c', T('تركيز NaCl في الوسط الخارجي', 'Concentration en NaCl du milieu'), 0, 200, 5, 90, '')}</div><p id="os-msg" class="mh-info"></p><button class="mh-btn p" id="os-rec" style="margin-top:.7rem">📌 ${T('سجّل القياس', 'Enregistrer la mesure')}</button></div>
    <div class="mh-card"><div id="os-plot"></div><div id="os-tab" style="margin-top:.5rem"></div></div>
    <div class="mh-card">${mcq(c, T('عند وضع كريّة دم حمراء في ماء مقطّر (0%)، ماذا يحدث؟', 'Que se passe-t-il pour une hématie placée dans l’eau distillée ?'), [T('تتجعّد لخروج الماء', 'Elle se crénelle (l’eau sort)'), T('تنتفخ وقد تنفجر لدخول الماء', 'Elle gonfle et peut éclater (l’eau entre)'), T('لا يتغيّر شيء', 'Rien ne change')], 1, T('الوسط ناقص التوتر (hypotonique): الماء ينتقل نحو الوسط الأغنى بالمذاب أي داخل الخلية، ولا جدار يحمي الخلية الحيوانية.', 'Milieu hypotonique : l’eau migre vers le compartiment le plus concentré (la cellule) ; aucune paroi ne la protège.'))}</div>`);
  root.querySelector('#os-c').addEventListener('input', draw);
  bindSliders(root, () => {});
  root.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { plant = b.dataset.t === 'p'; root.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x === b)); rec.length = 0; draw(); }));
  root.querySelector('#os-rec').addEventListener('click', () => { const cc = +root.querySelector('#os-c').value / 100; if (!rec.some(r => r[0] === cc)) rec.push([cc, vol(cc)]); rec.sort((a, b) => a[0] - b[0]); draw(); });
  bindMcq(root, c, 'osmosis'); draw();
}
function crenated(cx, cy, r) { let d = ''; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = r * (i % 2 ? .78 : 1.05); d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr * .85).toFixed(1); } return d + 'Z'; }

/* ───────── 2) التركيب الضوئي ───────── */
function photosynthesis(root, c) {
  const T = c.T, rec = [];
  const rate = (L, C, t) => clamp(150 * (L / (L + 25)) * (C / (C + 20)) * g(t, 30, 15), 0, 100);
  const draw = () => {
    const L = +root.querySelector('#ph-l').value, C = +root.querySelector('#ph-c').value, t = +root.querySelector('#ph-t').value, r = rate(L, C, t), n = Math.round(r / 7);
    const bub = [...Array(n)].map((_, i) => `<circle cx="${178 + (i * 17) % 44}" cy="150" r="${3 + i % 3}" fill="#fff" stroke="#9fd3f0"><animate attributeName="cy" values="170;50" dur="${1.4 + (i % 5) * .35}s" begin="${(i % 6) * .25}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="${1.4 + (i % 5) * .35}s" begin="${(i % 6) * .25}s" repeatCount="indefinite"/></circle>`).join('');
    root.querySelector('#ph-svg').innerHTML = `<svg viewBox="0 0 400 300"><rect x="100" y="40" width="160" height="220" rx="14" fill="#7cc4ea" opacity=".35" stroke="#4aa3df" stroke-width="3"/><path d="M180 255 C176 200 190 160 180 110 M180 200 C150 190 140 170 138 150 M182 170 C215 165 225 145 226 125 M180 135 C158 128 150 112 152 98" stroke="#2f8a3a" stroke-width="5" fill="none" stroke-linecap="round"/>${[[138, 150], [226, 125], [152, 98], [178, 100]].map(p => `<ellipse cx="${p[0]}" cy="${p[1]}" rx="14" ry="7" fill="#49b04f" transform="rotate(-25 ${p[0]} ${p[1]})"/>`).join('')}${bub}<g opacity="${.15 + L / 120}"><circle cx="335" cy="95" r="26" fill="#ffd54a"/>${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${310 - i * 3}" y1="${105 + i * 12}" x2="${268}" y2="${120 + i * 14}" stroke="#ffd54a" stroke-width="3" stroke-linecap="round"/>`).join('')}</g><text x="335" y="150" text-anchor="middle" font-size="12" font-weight="700" fill="var(--mh-ink)">${T('إضاءة', 'Lumière')} ${L}%</text><text x="180" y="30" text-anchor="middle" font-size="13" font-weight="700" fill="var(--mh-ink)">${T('نبات مائي (Élodée)', 'Élodée')}</text><text x="180" y="285" text-anchor="middle" font-size="13" fill="var(--mh-ink)">O₂ ≈ ${Math.round(r)} ${T('فقاعة/دقيقة', 'bulles/min')}</text></svg>`;
    root.querySelector('#ph-tab').innerHTML = table([T('الضوء', 'Lumière'), 'CO₂', '°C', T('الفقاعات/د', 'Bulles/min')], rec.map(x => [x[0], x[1], x[2], Math.round(x[3])]));
    const pts = rec.map(x => [x[0], x[3]]), curve = [...Array(21)].map((_, i) => [i * 5, rate(i * 5, C, t)]);
    root.querySelector('#ph-plot').innerHTML = plot({ xmax: 100, ymax: 100, xl: T('شدة الضوء %', 'Lumière %'), yl: T('معدل التركيب', 'Taux'), pts, curve, curveOp: .35, cur: [L, r], label: 'photosynthesis' });
  };
  root.innerHTML = shell(c, `<div id="ph-svg"></div>`, `<div class="mh-card">${slider('ph-l', T('شدة الضوء', 'Intensité lumineuse'), 0, 100, 5, 50, '%')}${slider('ph-c', T('تركيز CO₂ (NaHCO₃)', 'Concentration en CO₂'), 0, 100, 5, 50, '%')}${slider('ph-t', T('درجة الحرارة', 'Température'), 5, 50, 1, 25, '°C')}<button class="mh-btn p" id="ph-rec">📌 ${T('سجّل القياس', 'Enregistrer')}</button> <button class="mh-btn sm" id="ph-clr">${T('مسح', 'Effacer')}</button></div><div class="mh-card"><div id="ph-plot"></div><div id="ph-tab" style="margin-top:.5rem"></div></div>
    <div class="mh-card">${mcq(c, T('عند رفع شدة الضوء باستمرار مع بقاء CO₂ ثابتًا، ماذا يحدث لمعدل التركيب الضوئي؟', 'Si l’on augmente sans cesse la lumière (CO₂ constant), que devient le taux ?'), [T('يزداد دائمًا بشكل خطي', 'Il augmente toujours linéairement'), T('يزداد ثم يستقر عند مستوى أقصى (عامل محدِّد آخر)', 'Il augmente puis plafonne (autre facteur limitant)'), T('يتناقص مباشرة', 'Il diminue aussitôt')], 1, T('بعد التشبّع الضوئي يصبح عامل آخر (CO₂ أو الحرارة) هو المحدِّد، فيستقر المنحنى.', 'Après saturation lumineuse, un autre facteur (CO₂, température) devient limitant : le plateau.'))}</div>`);
  root.querySelector('#ph-rec').addEventListener('click', () => { const L = +root.querySelector('#ph-l').value, C = +root.querySelector('#ph-c').value, t = +root.querySelector('#ph-t').value; rec.push([L, C, t, rate(L, C, t)]); rec.sort((a, b) => a[0] - b[0]); draw(); });
  root.querySelector('#ph-clr').addEventListener('click', () => { rec.length = 0; draw(); });
  bindSliders(root, draw); bindMcq(root, c, 'photosynthesis'); draw();
}

/* ───────── 3) نشاط الأنزيم ───────── */
function enzyme(root, c) {
  const T = c.T, rec = [];
  const E = { amy: [T('أميلاز اللعاب', 'Amylase salivaire'), 37, 7], pep: [T('بيبسين المعدة', 'Pepsine gastrique'), 37, 2], try: [T('تريبسين البنكرياس', 'Trypsine'), 37, 8] };
  const act = (t, p, e) => 100 * (t <= e[1] ? g(t, e[1], 17) : g(t, e[1], 6)) * g(p, e[2], 1.5);
  const draw = () => {
    const e = E[root.querySelector('#en-e').value], t = +root.querySelector('#en-t').value, p = +root.querySelector('#en-p').value, a = act(t, p, e);
    const w = a < 5 ? T('أنزيم شبه معطَّل', 'Enzyme quasi inactif') : t > 55 ? T('تمسّخ الأنزيم (dénaturation) غير عكوس', 'Dénaturation irréversible') : t < 15 ? T('نشاط بطيء: البرودة تُبطئ الحركة لكن لا تُتلف الأنزيم', 'Activité ralentie : le froid ne détruit pas l’enzyme') : T('نشاط جيّد', 'Bonne activité');
    root.querySelector('#en-msg').innerHTML = `<b>${w}</b><br><small>${T('النشاط النسبي', 'Activité relative')}: ${Math.round(a)}%</small>`;
    root.querySelector('#en-plot').innerHTML = plot({ xmax: 80, ymax: 100, xl: T('درجة الحرارة °C', 'Température °C'), yl: T('النشاط %', 'Activité %'), curve: [...Array(81)].map((_, i) => [i, act(i, p, e)]), pts: rec.filter(r => r[2] === p).map(r => [r[0], r[1]]), cur: [t, a], label: 'enzyme' });
    root.querySelector('#en-tab').innerHTML = table(['°C', 'pH', T('النشاط', 'Act.')], rec.map(r => [r[0], r[2], Math.round(r[1])]));
    // أنابيب الاختبار
    root.querySelector('#en-svg').innerHTML = `<svg viewBox="0 0 400 300"><rect x="90" y="40" width="220" height="30" rx="8" fill="#ffd8b8" opacity=".9"/><text x="200" y="60" text-anchor="middle" font-size="13" font-weight="700" fill="#6a3b10">${esc(e[0])}</text>${[0, 1, 2].map(i => `<g><path d="M${95 + i * 80} 110 v120 a25 25 0 0 0 50 0 v-120z" fill="#eaf6fb" stroke="#4aa3df" stroke-width="3"/><rect x="${98 + i * 80}" y="${230 - (i === 1 ? 80 : 80)}" width="44" height="${70 + 25}" rx="12" fill="${['#d94c4c', '#7a55c9', '#2f9d6a'][i]}" opacity="${i === 0 ? .25 + (100 - a) / 130 : i === 1 ? .3 + a / 150 : .25}"/></g>`).join('')}<text x="120" y="270" text-anchor="middle" font-size="11" fill="var(--mh-ink)">${T('الركيزة', 'Substrat')}</text><text x="200" y="270" text-anchor="middle" font-size="11" fill="var(--mh-ink)">${T('النواتج', 'Produits')}</text><text x="280" y="270" text-anchor="middle" font-size="11" fill="var(--mh-ink)">${T('الأنزيم', 'Enzyme')}</text><text x="200" y="100" text-anchor="middle" font-size="22">${t > 55 ? '🔥' : t < 10 ? '❄️' : '🧪'}</text></svg>`;
  };
  const esc = c.esc;
  root.innerHTML = shell(c, `<div id="en-svg"></div>`, `<div class="mh-card"><div class="mh-ctl"><label for="en-e">${T('اختر الأنزيم', 'Enzyme')}</label><select id="en-e" class="mh-input">${Object.keys(E).map(k => `<option value="${k}">${esc(E[k][0])}</option>`).join('')}</select></div>${slider('en-t', T('درجة الحرارة', 'Température'), 0, 80, 1, 37, '°C')}${slider('en-p', 'pH', 1, 13, .5, 7, '')}<p id="en-msg" class="mh-info"></p><button class="mh-btn p" id="en-rec" style="margin-top:.7rem">📌 ${T('سجّل القياس', 'Enregistrer')}</button> <button class="mh-btn sm" id="en-clr">${T('مسح', 'Effacer')}</button></div><div class="mh-card"><div id="en-plot"></div><div id="en-tab" style="margin-top:.5rem"></div></div>
   <div class="mh-card">${mcq(c, T('ما سبب انعدام نشاط الأنزيم عند 70°C؟', 'Pourquoi l’enzyme est-elle inactive à 70 °C ?'), [T('نفاد الركيزة', 'Plus de substrat'), T('تغيّر البنية الفراغية للأنزيم (تمسّخ) فيفقد موقعه الفعّال', 'Sa structure spatiale change (dénaturation) : le site actif est perdu'), T('انخفاض الحركة الحرارية', 'Baisse de l’agitation thermique')], 1, T('الحرارة المرتفعة تكسر الروابط الضعيفة التي تثبّت البنية الثلاثية فيتشوّه الموقع الفعّال، وهذا التأثير غير عكوس بخلاف البرودة.', 'La chaleur rompt les liaisons faibles qui maintiennent la structure 3D : le site actif est déformé, de façon irréversible (contrairement au froid).'))}</div>`);
  root.querySelector('#en-e').addEventListener('change', () => { rec.length = 0; draw(); });
  root.querySelector('#en-rec').addEventListener('click', () => { const e = E[root.querySelector('#en-e').value], t = +root.querySelector('#en-t').value, p = +root.querySelector('#en-p').value; rec.push([t, act(t, p, e), p]); rec.sort((a, b) => a[0] - b[0]); draw(); });
  root.querySelector('#en-clr').addEventListener('click', () => { rec.length = 0; draw(); });
  bindSliders(root, draw); bindMcq(root, c, 'enzyme'); draw();
}

/* ───────── 4) المساحة الدنيا (علم البيئة) ───────── */
function minarea(root, c) {
  const T = c.T, N = 20, SP = 8; let grid, curve, cols = ['#d94c4c', '#e9a825', '#2f9d6a', '#2f7fd1', '#7a55c9', '#e07bb5', '#8a6a3a', '#3fb8b0'];
  const gen = () => {
    grid = []; const w = [.3, .2, .15, .1, .09, .07, .05, .04];
    for (let i = 0; i < N * N; i++) { let r = Math.random(), s = 0; while (s < SP - 1 && r > w[s]) { r -= w[s]; s++; } grid.push(s); }
    curve = [...Array(N)].map((_, k) => { const s = k + 1, o = (N - s) >> 1, set = new Set(); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set.add(grid[(o + y) * N + o + x]); return [s * s, set.size]; });
  };
  const draw = () => {
    const s = +root.querySelector('#ma-s').value, o = (N - s) >> 1, cell = 14, tot = new Set(grid).size, here = curve[s - 1][1];
    const min = curve.find(p => p[1] >= Math.ceil(tot * .9));
    root.querySelector('#ma-svg').innerHTML = `<svg viewBox="0 0 ${N * cell + 20} ${N * cell + 20}"><g transform="translate(10 10)">${grid.map((v, i) => `<rect x="${(i % N) * cell}" y="${(i / N | 0) * cell}" width="${cell - 1}" height="${cell - 1}" rx="3" fill="${cols[v]}" opacity=".85"/>`).join('')}<rect x="${o * cell - 1}" y="${o * cell - 1}" width="${s * cell + 1}" height="${s * cell + 1}" fill="none" stroke="#fff" stroke-width="4"/><rect x="${o * cell - 1}" y="${o * cell - 1}" width="${s * cell + 1}" height="${s * cell + 1}" fill="none" stroke="#111" stroke-width="2" stroke-dasharray="6 3"/></g></svg>`;
    root.querySelector('#ma-msg').innerHTML = `<b>${T('عدد الأنواع في الإطار', 'Espèces dans le quadrat')}: ${here} / ${tot}</b><br><small>${T('المساحة', 'Surface')}: ${s * s} ${T('وحدة', 'u')}</small>${min ? `<br><small>${T('المساحة الدنيا التقريبية (≥ 90% من الأنواع)', 'Aire minimale approx. (≥ 90 % des espèces)')}: <b>${min[0]}</b></small>` : ''}`;
    root.querySelector('#ma-plot').innerHTML = plot({ xmax: N * N, ymax: SP, xl: T('المساحة المدروسة', 'Surface étudiée'), yl: T('عدد الأنواع', 'Nb d’espèces'), curve, cur: [s * s, here], label: 'species-area' });
  };
  gen();
  root.innerHTML = shell(c, `<div id="ma-svg"></div>`, `<div class="mh-card"><p style="margin-bottom:.6rem">${T('يمثّل الشكل وسطًا طبيعيًا تعيش فيه 8 أنواع (ألوان). كبّر الإطار من المركز وعُدّ الأنواع.', 'Le milieu contient 8 espèces (couleurs). Agrandissez le quadrat depuis le centre et comptez les espèces.')}</p>${slider('ma-s', T('ضلع الإطار (quadrat)', 'Côté du quadrat'), 1, N, 1, 3, '')}<p id="ma-msg" class="mh-info"></p><button class="mh-btn sm" id="ma-new" style="margin-top:.6rem">🔄 ${T('وسط جديد', 'Nouveau milieu')}</button></div><div class="mh-card"><div id="ma-plot"></div></div>
   <div class="mh-card">${mcq(c, T('ما المساحة الدنيا (aire minimale)؟', 'Qu’est-ce que l’aire minimale ?'), [T('أصغر مساحة تضم تقريبًا كل أنواع المجموعة الحيوية', 'La plus petite surface contenant la quasi-totalité des espèces du peuplement'), T('أكبر مساحة يمكن دراستها', 'La plus grande surface étudiable'), T('مساحة الأنواع النادرة فقط', 'La surface des espèces rares uniquement')], 0, T('عندها يتشبّع منحنى (الأنواع–المساحة) ويصبح العيّنة ممثِّلة للوسط.', 'À ce point la courbe espèces-surface sature : l’échantillon est représentatif.'))}</div>`);
  root.querySelector('#ma-new').addEventListener('click', () => { gen(); draw(); });
  bindSliders(root, draw); bindMcq(root, c, 'minarea'); draw();
}

/* ───────── 5) الوراثة (مندل) ───────── */
function genetics(root, c) {
  const T = c.T; let di = false, A = 'Aa', B = 'Aa', A2 = 'Bb', B2 = 'Bb';
  const gam = (g1, g2) => g2 ? [g1[0] + g2[0], g1[0] + g2[1], g1[1] + g2[0], g1[1] + g2[1]] : [g1[0], g1[1]];
  const norm = s => (s[0] === s[0].toLowerCase() && s[1] === s[1].toUpperCase() ? s[1] + s[0] : s);
  const pheno = g => { const r = /[A]/.test(g) ? 'R' : 'r', y = di ? (/[B]/.test(g) ? 'Y' : 'y') : null; return r + (y || ''); };
  const col = p => ({ R: '#e9c46a', r: '#8aa17a', RY: '#f2c94c', Ry: '#6fbf73', rY: '#d9a441', ry: '#4f8f5a' }[p]);
  const label = p => ({ R: T('أملس', 'Lisse'), r: T('مجعّد', 'Ridé'), RY: T('أملس أصفر', 'Lisse jaune'), Ry: T('أملس أخضر', 'Lisse vert'), rY: T('مجعّد أصفر', 'Ridé jaune'), ry: T('مجعّد أخضر', 'Ridé vert') }[p]);
  const draw = () => {
    const g1 = gam(A, di ? A2 : null), g2 = gam(B, di ? B2 : null), n = g1.length, cs = di ? 62 : 110, cnt = {};
    let cells = '';
    g1.forEach((a, i) => g2.forEach((b, j) => { const gt = di ? norm(a[0] + b[0]) + norm(a[1] + b[1]) : norm(a + b), p = pheno(gt); cnt[p] = (cnt[p] || 0) + 1;
      cells += `<g><rect x="${60 + j * cs}" y="${60 + i * cs}" width="${cs - 4}" height="${cs - 4}" rx="12" fill="${col(p)}" opacity=".9"/><text x="${60 + j * cs + cs / 2 - 2}" y="${60 + i * cs + cs / 2 + 4}" text-anchor="middle" font-size="${di ? 13 : 18}" font-weight="800" fill="#1b2b22">${gt}</text></g>`; }));
    const hd = (arr, horiz) => arr.map((t, k) => `<text x="${horiz ? 60 + k * cs + cs / 2 - 2 : 30}" y="${horiz ? 45 : 60 + k * cs + cs / 2 + 4}" text-anchor="middle" font-size="14" font-weight="800" fill="var(--mh-ink)">${t}</text>`).join('');
    const S = 70 + n * cs;
    root.querySelector('#ge-svg').innerHTML = `<svg viewBox="0 0 ${S} ${S}">${hd(g2, true)}${hd(g1, false)}${cells}</svg>`;
    const tot = n * n;
    root.querySelector('#ge-res').innerHTML = `<b>${T('النسب المظهرية', 'Proportions phénotypiques')}</b>` + table([T('المظهر', 'Phénotype'), T('العدد', 'Nb'), '%'], Object.keys(cnt).map(p => [`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${col(p)}"></span> ${label(p)}`, `${cnt[p]}/${tot}`, Math.round(cnt[p] / tot * 100)])) + `<p style="margin-top:.4rem;font-weight:700">${T('النسبة', 'Rapport')}: ${Object.values(cnt).sort((a, b) => b - a).join(' : ')}</p>`;
  };
  const sim = () => {
    const pick = ar => ar[Math.random() * ar.length | 0], g1 = gam(A, di ? A2 : null), g2 = gam(B, di ? B2 : null), cnt = {};
    for (let i = 0; i < 40; i++) { const a = pick(g1), b = pick(g2), gt = di ? norm(a[0] + b[0]) + norm(a[1] + b[1]) : norm(a + b), p = pheno(gt); cnt[p] = (cnt[p] || 0) + 1; }
    root.querySelector('#ge-sim').innerHTML = `<b>${T('عيّنة من 40 فردًا (تُظهر التذبذب العشوائي)', 'Échantillon de 40 descendants (fluctuation d’échantillonnage)')}</b>` + Object.keys(cnt).map(p => `<div class="mh-xp-row" style="margin-top:.4rem"><span>${label(p)}</span><span>${cnt[p]}</span></div><div class="mh-bar"><i style="width:${cnt[p] / 40 * 100}%;background:${col(p)}"></i></div>`).join('');
  };
  const sel = (id, v, lab) => `<div class="mh-ctl"><label for="${id}">${lab}</label><select id="${id}" class="mh-input">${['AA', 'Aa', 'aa'].map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`;
  const ui = () => {
    root.innerHTML = shell(c, `<div id="ge-svg" style="padding:.5rem"></div>`, `<div class="mh-card"><div class="mh-seg"><button data-m="0" aria-pressed="${!di}">${T('هجنة أحادية', 'Monohybridisme')}</button><button data-m="1" aria-pressed="${di}">${T('هجنة ثنائية', 'Dihybridisme')}</button></div><p style="margin:.7rem 0;font-size:.88rem;color:var(--mh-soft)">${T('بذور البازلاء: أملس (A) سائد على مجعّد (a)', 'Pois : lisse (A) dominant sur ridé (a)')}${di ? T('، أصفر (B) سائد على أخضر (b)', ' ; jaune (B) dominant sur vert (b)') : ''}</p>
     ${di ? `<p style="font-weight:700">${T('الأبوان: AaBb × AaBb (جيل F1 المتزاوج مع نفسه)', 'Parents : AaBb × AaBb (F1 × F1)')}</p>` : `<div class="mh-tools">${sel('ge-a', A, T('الأب 1', 'Parent 1'))}${sel('ge-b', B, T('الأب 2', 'Parent 2'))}</div>`}
     <div id="ge-res" style="margin-top:.6rem"></div><button class="mh-btn p" id="ge-sim-b" style="margin-top:.7rem">🎲 ${T('حاكِ 40 مولودًا', 'Simuler 40 descendants')}</button><div id="ge-sim" style="margin-top:.6rem"></div></div>
     <div class="mh-card">${mcq(c, T('عند تزاوج فردين هجينين Aa × Aa، ما نسبة الأفراد ذوي الصفة المتنحية؟', 'Dans Aa × Aa, quelle proportion de descendants est ridée (aa) ?'), ['1/2', '1/4', '3/4'], 1, T('الأمشاج A/a من كل أب → 4 تركيبات: ¼AA ، ½Aa ، ¼aa؛ الصفة المتنحية لا تظهر إلا عند aa أي ¼.', 'Gamètes A/a de chaque parent → ¼ AA, ½ Aa, ¼ aa ; le caractère récessif n’apparaît qu’en aa, soit ¼.'))}</div>`);
    root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { di = b.dataset.m === '1'; ui(); }));
    const a = root.querySelector('#ge-a'), b = root.querySelector('#ge-b');
    if (a) { a.addEventListener('change', () => { A = a.value; draw(); }); b.addEventListener('change', () => { B = b.value; draw(); }); }
    root.querySelector('#ge-sim-b').addEventListener('click', sim);
    bindMcq(root, c, 'genetics'); draw();
  };
  ui();
}

/* ───────── 6) تركيب البروتين ───────── */
function protein(root, c) {
  const T = c.T, B = 'TCAG', AA = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  const N3 = { F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gly', '*': 'STOP' };
  const cod = c3 => AA[B.indexOf(c3[0]) * 16 + B.indexOf(c3[1]) * 4 + B.indexOf(c3[2])];
  let seq = 'ATGGCTGAAAAGTTCTGA';
  const comp = s => s.split('').map(x => ({ A: 'T', T: 'A', G: 'C', C: 'G' }[x])).join('');
  const translate = s => { const m = s.replace(/T/g, 'U'), out = []; for (let i = 0; i + 2 < s.length; i += 3) { const a = cod(s.slice(i, i + 3)); out.push(a); if (a === '*') break; } return out; };
  const chips = (str, cls) => str.split('').map(x => `<span class="${x}">${x}</span>`).join('');
  const draw = () => {
    const m = seq.replace(/T/g, 'U'), tpl = comp(seq), prot = translate(seq), cods = []; for (let i = 0; i + 2 < m.length; i += 3) cods.push(m.slice(i, i + 3));
    root.querySelector('#pr-out').innerHTML = `<div class="mh-dna"><b>${T('الشريط المرمِّز (غير المنسوخ) 5′→3′', 'Brin codant 5′→3′')}</b><br>${chips(seq)}</div><div class="mh-dna" style="margin-top:.5rem"><b>${T('الشريط المنسوخ 3′→5′', 'Brin transcrit 3′→5′')}</b><br>${chips(tpl)}</div><div class="mh-dna" style="margin-top:.5rem"><b>${T('ARNm (النسخ)', 'ARNm (transcription)')}</b><br>${chips(m)}</div><div style="margin-top:.5rem"><b>${T('البروتين (الترجمة)', 'Protéine (traduction)')}</b><br><div class="mh-dna">${cods.map(k => { const a = cod(k); return `<span class="aa" title="${k}">${N3[a]}</span>`; }).join(' ')}</div></div>`;
  };
  const mutate = () => {
    const before = translate(seq).join(''), i = Math.random() * seq.length | 0, n = 'ACGT'.replace(seq[i], '')[Math.random() * 3 | 0]; seq = seq.slice(0, i) + n + seq.slice(i + 1); draw();
    const after = translate(seq).join(''), kind = after === before ? T('طفرة صامتة (نفس الحمض الأميني — ترادف الرمز الوراثي)', 'Mutation silencieuse (code dégénéré)') : after.length < before.length ? T('طفرة بلا معنى (رمز توقف مبكر) — بروتين مبتور', 'Mutation non-sens (codon stop précoce)') : T('طفرة خاطئة المعنى: تغيّر حمض أميني', 'Mutation faux-sens : un acide aminé change');
    root.querySelector('#pr-mut').innerHTML = `<p class="mh-info"><b>${T('تغيّرت القاعدة رقم', 'Base modifiée n°')} ${i + 1}</b> → ${n}<br>${kind}</p>`;
  };
  root.innerHTML = shell(c, `<div id="pr-out" style="padding:1rem"></div>`, `<div class="mh-card"><div class="mh-ctl"><label for="pr-in">${T('أدخل تسلسل الشريط المرمِّز (A, T, G, C)', 'Séquence du brin codant (A, T, G, C)')}</label><input id="pr-in" class="mh-input" dir="ltr" value="${seq}" maxlength="45" spellcheck="false" style="font-family:monospace;letter-spacing:2px"></div><div class="mh-tools"><button class="mh-btn p" id="pr-mut-b">🧬 ${T('أحدث طفرة عشوائية', 'Provoquer une mutation')}</button><button class="mh-btn sm" id="pr-rst">${T('تسلسل جديد', 'Nouvelle séquence')}</button></div><div id="pr-mut" style="margin-top:.6rem"></div></div>
   <div class="mh-card">${mcq(c, T('لماذا قد لا تغيّر طفرة نقطية البروتين؟', 'Pourquoi une mutation ponctuelle peut-elle ne pas modifier la protéine ?'), [T('لأن الرمز الوراثي مُتَرادِف: عدة رموز لنفس الحمض الأميني', 'Car le code génétique est dégénéré : plusieurs codons pour un même acide aminé'), T('لأن الـ ARN لا يُترجَم', 'Car l’ARN n’est pas traduit'), T('لأن الطفرات لا تحدث أبدًا', 'Car les mutations n’existent pas')], 0, T('64 رمزًا لـ 20 حمضًا أمينيًا + إشارات توقف، فتكون الكثير من الطفرات في الموضع الثالث صامتة.', '64 codons pour 20 acides aminés + stop : beaucoup de mutations en 3ᵉ position sont silencieuses.'))}</div>`);
  const inp = root.querySelector('#pr-in');
  inp.addEventListener('input', () => { const v = inp.value.toUpperCase().replace(/[^ATGC]/g, ''); inp.value = v; if (v.length >= 3) { seq = v; draw(); root.querySelector('#pr-mut').innerHTML = ''; } });
  root.querySelector('#pr-mut-b').addEventListener('click', mutate);
  root.querySelector('#pr-rst').addEventListener('click', () => { seq = 'ATG' + [...Array(5)].map(() => { let k; do { k = [...Array(3)].map(() => 'ACGT'[Math.random() * 4 | 0]).join(''); } while (cod(k) === '*'); return k; }).join('') + 'TAA'; inp.value = seq; draw(); });
  bindMcq(root, c, 'protein'); draw();
}

const EXPS = [
  { id: 'osmosis', ico: '💧', ar: 'التناضح وحجم الخلية', fr: 'Osmose et volume cellulaire', lv: ['TC', '1BAC'], da: 'غيّر تركيز الوسط وراقب خلية حيوانية ونباتية.', df: 'Faites varier le milieu et observez cellule animale/végétale.', run: osmosis },
  { id: 'photosynthesis', ico: '🌿', ar: 'التركيب الضوئي والعوامل المحدِّدة', fr: 'Photosynthèse et facteurs limitants', lv: ['TC', '1BAC'], da: 'نبات مائي، ضوء، CO₂ وحرارة: ارسم منحنى المعدل.', df: 'Élodée, lumière, CO₂, température : tracez la courbe.', run: photosynthesis },
  { id: 'minarea', ico: '🌲', ar: 'المساحة الدنيا للمجموعة الحيوية', fr: 'Aire minimale d’un peuplement', lv: ['TC'], da: 'كبّر الإطار وارسم منحنى الأنواع–المساحة.', df: 'Agrandissez le quadrat, tracez la courbe espèces-surface.', run: minarea },
  { id: 'enzyme', ico: '⚗️', ar: 'نشاط الأنزيم: الحرارة و pH', fr: 'Activité enzymatique : T° et pH', lv: ['1BAC', '2BAC'], da: 'أنزيمات الهضم: درجة الحرارة المثلى وتمسّخ الأنزيم.', df: 'Enzymes digestives : optimum et dénaturation.', run: enzyme },
  { id: 'protein', ico: '🧬', ar: 'من الـ ADN إلى البروتين', fr: 'De l’ADN à la protéine', lv: ['1BAC', '2BAC'], da: 'نسخ وترجمة تسلسلك الخاص، ثم أحدث طفرة.', df: 'Transcrivez/traduisez votre séquence, puis mutez-la.', run: protein },
  { id: 'genetics', ico: '🫛', ar: 'مندل: جدول التزاوج', fr: 'Mendel : échiquier de croisement', lv: ['1BAC', '2BAC'], da: 'هجنة أحادية وثنائية مع محاكاة عشوائية.', df: 'Mono/dihybridisme avec simulation aléatoire.', run: genetics }
];

/* ───────── الأطلس المصوّر ───────── */
const ATLAS = {
  cell: {
    ar: 'الخلية الحيوانية والنباتية', fr: 'Cellule animale et végétale', ico: '🔬',
    modes: { animal: { ar: 'حيوانية', fr: 'Animale' }, plant: { ar: 'نباتية', fr: 'Végétale' } },
    parts: {
      nucleus: ['النواة', 'Noyau', 'تحتوي الـ ADN وتتحكم في نشاط الخلية.', 'Contient l’ADN et pilote l’activité cellulaire.', 'both'],
      mito: ['الميتوكوندري', 'Mitochondrie', 'موقع التنفس الخلوي وإنتاج ATP.', 'Siège de la respiration cellulaire et de la production d’ATP.', 'both'],
      er: ['الشبكة الهيولية', 'Réticulum endoplasmique', 'تركيب البروتينات والدهون ونقلها.', 'Synthèse et transport de protéines et lipides.', 'both'],
      golgi: ['جهاز كولجي', 'Appareil de Golgi', 'تعديل البروتينات وتغليفها وإفرازها.', 'Modifie, trie et sécrète les protéines.', 'both'],
      membrane: ['الغشاء الهيولي', 'Membrane plasmique', 'حاجز انتقائي النفاذية يتحكم في التبادلات.', 'Barrière à perméabilité sélective.', 'both'],
      lyso: ['الجسيم الحال', 'Lysosome', 'هضم داخل خلوي بإنزيمات حالّة.', 'Digestion intracellulaire par des enzymes.', 'animal'],
      wall: ['الجدار الهيكلي', 'Paroi cellulosique', 'من السليلوز: يدعم الخلية ويمنع انفجارها.', 'En cellulose : soutient et protège de l’éclatement.', 'plant'],
      vacuole: ['الفجوة العصارية', 'Vacuole', 'مخزن الماء والمواد وتحافظ على الضغط الامتلائي.', 'Réserve d’eau et de substances, assure la turgescence.', 'plant'],
      chloro: ['البلاستيدة الخضراء', 'Chloroplaste', 'موقع التركيب الضوئي (اليخضور).', 'Siège de la photosynthèse (chlorophylle).', 'plant']
    },
    svg(mode) {
      const P = mode === 'plant';
      const h = (id, shape, extra = '') => shape.replace('<', `<`).replace('/>', ` class="mh-hot" data-p="${id}" ${extra}/>`);
      return `<svg viewBox="0 0 400 300" role="img" aria-label="cell">${P ? h('wall', '<rect x="20" y="20" width="360" height="260" rx="34" fill="#cfe8b9" stroke="#5c9a35" stroke-width="9"/>') + '<rect x="32" y="32" width="336" height="236" rx="26" fill="#eaf7dc" stroke="#7fbf5a" stroke-width="3" pointer-events="none"/>' : h('membrane', '<ellipse cx="200" cy="150" rx="180" ry="130" fill="#fbe3dc" stroke="#d98a7a" stroke-width="6"/>')}
      ${P ? h('vacuole', '<ellipse cx="150" cy="160" rx="85" ry="70" fill="#bfe3f5" stroke="#5fa8cf" stroke-width="3"/>') : h('lyso', '<circle cx="110" cy="210" r="14" fill="#c98ae0" stroke="#8a4aa6" stroke-width="3"/>') + h('lyso', '<circle cx="300" cy="90" r="11" fill="#c98ae0" stroke="#8a4aa6" stroke-width="3"/>')}
      ${h('nucleus', `<circle cx="${P ? 290 : 215}" cy="${P ? 100 : 130}" r="45" fill="#b9a6e6" stroke="#6b4fc2" stroke-width="3"/>`)}<circle cx="${P ? 290 : 215}" cy="${P ? 100 : 130}" r="14" fill="#6b4fc2" pointer-events="none"/>
      ${h('er', `<path d="M${P ? 250 : 170} ${P ? 160 : 170} q20 -14 40 0 t40 0 t40 0 M${P ? 250 : 170} ${P ? 180 : 190} q20 -14 40 0 t40 0 t40 0" fill="none" stroke="#e08a24" stroke-width="7" stroke-linecap="round"/>`)}
      ${h('golgi', `<path d="M${P ? 300 : 280} ${P ? 215 : 215} q25 -12 50 0 M${P ? 300 : 280} ${P ? 228 : 228} q25 -12 50 0 M${P ? 300 : 280} ${P ? 241 : 241} q25 -12 50 0" fill="none" stroke="#d6a400" stroke-width="7" stroke-linecap="round"/>`)}
      ${h('mito', `<ellipse cx="${P ? 80 : 90}" cy="${P ? 70 : 100}" rx="30" ry="15" fill="#f0a08a" stroke="#c9574a" stroke-width="3" transform="rotate(-20 ${P ? 80 : 90} ${P ? 70 : 100})"/>`)}
      ${P ? h('chloro', '<ellipse cx="90" cy="245" rx="28" ry="15" fill="#5ec26a" stroke="#2f8a3a" stroke-width="3"/>') + h('chloro', '<ellipse cx="335" cy="170" rx="24" ry="13" fill="#5ec26a" stroke="#2f8a3a" stroke-width="3"/>') : ''}</svg>`;
    }
  },
  plates: {
    ar: 'الصفائح التكتونية', fr: 'Tectonique des plaques', ico: '🌋',
    parts: {
      ridge: ['الظهرة المحيطية', 'Dorsale océanique', 'حدّ تباعدي: صعود الصهارة وتكوّن قشرة محيطية جديدة.', 'Limite divergente : remontée de magma, création de croûte océanique.'],
      ocean: ['القشرة المحيطية', 'Lithosphère océanique', 'بازلت وغابرو، كثيفة ورقيقة، تتقادم بالابتعاد عن الظهرة.', 'Basalte et gabbro, dense et mince, plus âgée en s’éloignant de la dorsale.'],
      slab: ['الصفيحة الغاطسة', 'Plaque plongeante', 'تغوص في الأستينوسفير بزاوية، وتُطلق مياهها فتُصهِر الوشاح فوقها.', 'Plonge dans l’asthénosphère et libère de l’eau qui fait fondre le manteau sus-jacent.'],
      trench: ['الخندق', 'Fosse océanique', 'حدّ تقاربي: غوص الصفيحة المحيطية تحت القارية (اندساس).', 'Limite convergente : la plaque océanique plonge (subduction).'],
      volcano: ['البركان الجبلي', 'Volcanisme de subduction', 'انصهار جزئي للوشاح بفعل ماء الصفيحة الغائصة يعطي صهارة أنديزيتية.', 'La déshydratation de la plaque plongeante provoque la fusion partielle : magmas andésitiques.'],
      conti: ['القشرة القارية', 'Croûte continentale', 'غرانيتية، أخف وأسمك، لا تغوص.', 'Granitique, plus légère et épaisse, ne subducte pas.'],
      astheno: ['الأستينوسفير', 'Asthénosphère', 'وشاح لدن يسمح بحركة الصفائح.', 'Manteau ductile permettant le déplacement des plaques.']
    },
    svg() {
      const h = (id, s) => s.replace('/>', ` class="mh-hot" data-p="${id}"/>`);
      const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--mh-ink)" stroke-width="3" marker-end="url(#pa)" pointer-events="none"/>`;
      return `<svg viewBox="0 0 400 300" role="img" aria-label="plates"><defs><marker id="pa" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--mh-ink)"/></marker><linearGradient id="pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3b46b"/><stop offset="1" stop-color="#e2663a"/></linearGradient></defs>
      ${h('astheno', '<rect x="0" y="172" width="400" height="128" fill="url(#pm)"/>')}
      ${h('ocean', '<path d="M0 128 H178 L190 134 L214 174 H0 Z" fill="#4f78b8" stroke="#2c4f87" stroke-width="2"/>')}
      ${h('slab', '<path d="M178 128 L330 240 L312 264 L214 174 L190 134 Z" fill="#37567e" stroke="#1d3556" stroke-width="2"/>')}
      ${h('conti', '<path d="M206 112 H400 V160 H240 L206 124 Z" fill="#8bbf7a" stroke="#4a7d3a" stroke-width="3"/>')}
      <path d="M240 160 H400 V176 H252 Z" fill="#c9a06a" opacity=".75" pointer-events="none"/>
      ${h('trench', '<path d="M172 128 L190 150 L206 124 L200 120 Z" fill="#14294a" stroke="#0b1a33" stroke-width="2"/>')}
      <ellipse cx="318" cy="196" rx="22" ry="14" fill="#e0452a" opacity=".9" pointer-events="none"/><path d="M318 184 C316 150 326 130 330 100" stroke="#e0452a" stroke-width="6" fill="none" stroke-linecap="round" pointer-events="none"/>
      ${h('volcano', '<path d="M300 112 L330 70 L360 112 Z" fill="#a0542c" stroke="#5c2c12" stroke-width="3"/>')}
      ${h('ridge', '<path d="M8 128 Q30 92 52 128 Z" fill="#c24e2f" stroke="#7a2412" stroke-width="3"/>')}
      <ellipse cx="30" cy="150" rx="16" ry="10" fill="#e0452a" opacity=".85" pointer-events="none"/>
      ${arrow(60, 104, 140, 104)}${arrow(24, 104, 10, 104)}${arrow(380, 96, 345, 96)}
      <text x="330" y="60" text-anchor="middle" font-size="20" pointer-events="none">🌋</text></svg>`;
    }
  }
};

/* ───────── العرض ───────── */
function renderExp(el, c) {
  const T = c.T, esc = c.esc, rec = EXPS.filter(e => e.lv.includes(c.level)), oth = EXPS.filter(e => !e.lv.includes(c.level));
  const card = e => `<button class="mh-item" style="text-align:start;cursor:pointer" data-exp="${e.id}"><div class="mh-item-top"><div class="mh-ico" style="background:var(--mh-violet-bg)">${e.ico}</div><div><h4>${T(e.ar, e.fr)}</h4><p style="color:var(--mh-soft);font-size:.82rem">${T(e.da, e.df)}</p><div class="meta">${c.ran(e.id) ? `<span class="mh-pill done">✓ ${T('أُنجزت', 'Faite')} ×${c.ran(e.id).n}</span>` : `<span class="mh-pill new">+30 XP</span>`}</div></div></div></button>`;
  el.innerHTML = `<div class="mh-h"><h3>⭐ ${T('موصى بها لمستواك', 'Recommandées pour vous')}</h3></div><div class="mh-grid">${rec.map(card).join('') || '<p class="mh-empty">—</p>'}</div>${oth.length ? `<details style="margin-top:1rem"><summary style="cursor:pointer;font-weight:800;margin-bottom:.7rem">🧭 ${T('تجارب من مستويات أخرى (للاستكشاف)', 'Autres niveaux (exploration)')}</summary><div class="mh-grid">${oth.map(card).join('')}</div></details>` : ''}`;
  el.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', () => {
    const e = EXPS.find(x => x.id === b.dataset.exp);
    el.innerHTML = `<div class="mh-h"><button class="mh-btn sm" data-back>→ ${T('كل التجارب', 'Toutes les expériences')}</button><h3>${e.ico} ${T(e.ar, e.fr)}</h3></div><div id="mh-exp"></div>`;
    el.querySelector('[data-back]').addEventListener('click', () => renderExp(el, c));
    e.run(el.querySelector('#mh-exp'), c);
  }));
}
function renderAtlas(el, c) {
  const T = c.T, esc = c.esc; let key = 'cell', mode = 'animal', sel = null;
  const paint = () => {
    const A = ATLAS[key], parts = A.parts, vis = Object.keys(parts).filter(k => key !== 'cell' || parts[k][4] === 'both' || parts[k][4] === mode);
    el.innerHTML = `<div class="mh-tabs" style="margin-bottom:.8rem">${Object.keys(ATLAS).map(k => `<button aria-selected="${k === key}" data-k="${k}">${ATLAS[k].ico} ${T(ATLAS[k].ar, ATLAS[k].fr)}</button>`).join('')}</div>
    <div class="mh-lab"><div><div class="mh-stage">${A.svg(mode)}</div>${key === 'cell' ? `<div class="mh-seg" style="margin-top:.7rem">${Object.keys(A.modes).map(m => `<button data-m="${m}" aria-pressed="${m === mode}">${T(A.modes[m].ar, A.modes[m].fr)}</button>`).join('')}</div>` : ''}<p style="margin-top:.6rem;color:var(--mh-soft);font-size:.86rem">👆 ${T('انقر على أي جزء في الرسم لمعرفة اسمه ووظيفته.', 'Cliquez sur une partie pour voir son nom et son rôle.')}</p></div>
    <div><div class="mh-card" id="at-info"><p class="mh-empty">🧭 ${T('اختر جزءًا من الرسم', 'Choisissez une partie')}</p></div><div class="mh-card" style="margin-top:.8rem"><b>${T('الأجزاء', 'Éléments')}</b><div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem">${vis.map(k => `<button class="mh-btn sm" data-pick="${k}">${c.seen(key + ':' + k) ? '✓ ' : ''}${T(parts[k][0], parts[k][1])}</button>`).join('')}</div></div></div></div>`;
    const show = k => { sel = k; c.explore(key + ':' + k); el.querySelectorAll('.mh-hot').forEach(n => n.classList.toggle('on', n.dataset.p === k)); const p = parts[k]; el.querySelector('#at-info').innerHTML = `<h3 style="margin-bottom:.4rem">${T(p[0], p[1])}<br><small style="color:var(--mh-soft);font-weight:600">${T(p[1], p[0])}</small></h3><p>${T(p[2], p[3])}</p>`; };
    el.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { key = b.dataset.k; paint(); }));
    el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; paint(); }));
    el.querySelectorAll('.mh-hot').forEach(n => n.addEventListener('click', () => show(n.dataset.p)));
    el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => show(b.dataset.pick)));
    if (sel && parts[sel] && vis.includes(sel)) show(sel);
  };
  paint();
}

window.MasahatiLab = { render(el, kind, c) { kind === 'atlas' ? renderAtlas(el, c) : renderExp(el, c); } };
})();