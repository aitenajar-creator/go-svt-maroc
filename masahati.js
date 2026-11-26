/* مساحتي — منصة التلميذ التفاعلية · Go SVT Maroc
 * تعتمد على: StudentAccount (المستوى/المسلك) · StudentSpace (التقدم والنتائج) · content.json · quiz-map.json
 * تُحمَّل بعد student-space.js وتتولى رسم #student-space-content لحساب التلميذ.
 */
(function () {
'use strict';

/* ───────── أدوات عامة ───────── */
const lang = () => document.documentElement.lang === 'fr' ? 'fr' : 'ar';
const T = (ar, fr) => lang() === 'fr' ? (fr || ar) : ar;
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SS = () => window.StudentSpace, SA = () => window.StudentAccount;
const nfc = s => String(s || '').normalize('NFC');
const encPath = p => p.split('/').map(encodeURIComponent).join('/');
const dayNum = t => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4) / 864e5);
const isoDay = n => new Date(n * 864e5).toISOString().slice(0, 10);
const today = () => dayNum(Date.now());
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'c' + (h >>> 0).toString(36); };
const uid = () => (window.crypto && crypto.randomUUID) ? 'profile_' + crypto.randomUUID() : 'profile_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const TRACKS = { TC: ['TCS','TCL'], '1BAC': ['1BACSE','1BACSM','1BACL'], '2BAC': ['2BACSVT','2BACSP','2BACSM'] };
const TRACK_NAMES = {
  TCS: ['الجذع المشترك العلمي','Tronc commun scientifique'], TCL: ['الجذع المشترك الأدبي','Tronc commun lettres'],
  '1BACSE': ['الأولى باك علوم تجريبية','1ère Bac Sc. expérimentales'], '1BACSM': ['الأولى باك علوم رياضية','1ère Bac Sc. mathématiques'], '1BACL': ['الأولى باك آداب','1ère Bac Lettres'],
  '2BACSVT': ['الثانية باك علوم الحياة والأرض','2ème Bac SVT'], '2BACSP': ['الثانية باك علوم فيزيائية','2ème Bac Sc. physiques'], '2BACSM': ['الثانية باك علوم رياضية','2ème Bac Sc. mathématiques']
};
const TRACK_RE = /^(TC[SL]|1BAC(SE|SM|L)|2BAC(SVT|SP|SM))$/;
const ICON = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4A1.5 1.5 0 0 0 19.5 19L14 9V3"/><path d="M7.5 15h9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const FILE_ICON = { pdf: '📕', html: '🌐', htm: '🌐', doc: '📘', docx: '📘', ppt: '📙', pptx: '📙', xls: '📗', xlsx: '📗', jpg: '🖼️', png: '🖼️', mp4: '🎬' };

/* ───────── الحالة ───────── */
const S = { view: 'home', sub: {}, busy: false, sess: null, flash: null, idx: null, quizList: null, quizCache: {}, qmap: null, lv0: null, bdg0: null, learn: { cat: 'cours', lang: 'all', status: 'all', q: '' } };

function account() { const a = SA(); return a && a.isLoggedIn() && a.getProfile ? a.getProfile() : null; }
// Keep the browser-local profile ID for local storage. Authenticated learners use
// one stable cloud profile key so a fresh browser can restore the same account state.
function pid() { try { return SS().getCurrentProfile().id; } catch (e) { return 'default'; } }
function cloudPid() { return cloudUid() ? 'account-default' : pid(); }
function data() { return SS().getProfileData(pid()); }
function levelInfo() {
  const p = account() || {}, ps = PS();
  let level = String(p.study_level || '').toUpperCase(), track = String(p.study_track || '').toUpperCase();
  if (!(TRACKS[level] && TRACKS[level].includes(track))) { level = ps.lv || ''; track = ps.tk || ''; }
  return TRACKS[level] && TRACKS[level].includes(track) ? { level, track } : null;
}

/* حالة المنصة الخاصة (بطاقات المراجعة، التجارب، النشاط) — محلية + مزامنة اختيارية مع Supabase */
let _ps = null, _psPid = null, _saveT = null;
const _hydratedUsers = new Set();
const _pullingUsers = new Map();
const cloudContextKey = (uid, cloudProfileId, localProfileId) => JSON.stringify([uid, cloudProfileId, localProfileId]);
const psKey = () => pid() + '_gosvt_masahati';
function PS() {
  if (_ps && _psPid === pid()) return _ps;
  let o = null; try { o = JSON.parse(localStorage.getItem(psKey())); } catch (e) {}
  _ps = Object.assign({ cards: {}, lab: {}, atlas: {}, act: {}, day: { d: 0 }, done: {}, cardsTotal: 0, goalCards: 10, exam: '', badges: [], u: 0 }, o || {});
  _psPid = pid();
  if (_ps.day.d !== today()) _ps.day = { d: today(), quiz: 0, cards: 0, open: 0, lab: 0 };
  return _ps;
}
function cloudUid() { const a = SA(); return a && a.isLoggedIn() && a.getUser() ? a.getUser().id : null; }
function sameCloudContext(uid, localProfileId, cloudProfileId) {
  return !!uid && cloudUid() === uid && pid() === localProfileId && cloudPid() === cloudProfileId;
}
function savePS() {
  const ps = PS(), localProfileId = pid(), cloudProfileId = cloudPid(), uid = cloudUid();
  ps.u = Date.now();
  try { localStorage.setItem(localProfileId + '_gosvt_masahati', JSON.stringify(ps)); } catch (e) {}
  const snapshot = JSON.parse(JSON.stringify(ps));
  clearTimeout(_saveT);
  _saveT = setTimeout(() => { pushRemote(snapshot, uid, localProfileId, cloudProfileId); }, 2500);
}
function stateBytes(state) {
  const json = JSON.stringify(state);
  return typeof TextEncoder === 'function'
    ? new TextEncoder().encode(json).length
    : unescape(encodeURIComponent(json)).length;
}
async function pushRemote(snapshot, uid, localProfileId, cloudProfileId) {
  if (!snapshot || !sameCloudContext(uid, localProfileId, cloudProfileId)) return false;
  const c = window.supabaseClient;
  if (!c) return false;
  const contextKey = cloudContextKey(uid, cloudProfileId, localProfileId);
  if (!_hydratedUsers.has(contextKey)) {
    await pullRemote();
    if (!_hydratedUsers.has(contextKey) || !sameCloudContext(uid, localProfileId, cloudProfileId)) return false;
  }
  const current = PS();
  const state = current.u > (snapshot.u || 0) ? JSON.parse(JSON.stringify(current)) : snapshot;
  if (stateBytes(state) > 1024 * 1024) {
    console.warn('[Masahati] State exceeds the 1 MiB cloud limit; local copy retained.');
    return false;
  }
  if (!sameCloudContext(uid, localProfileId, cloudProfileId)) return false;
  try {
    // The database RPC locks the account/profile row and recursively merges JSON.
    // This preserves independent edits arriving from another browser during this write.
    const result = await c.rpc('gosvt_merge_student_platform_state', {
      p_student_id: uid, p_profile_id: cloudProfileId, p_state: state
    });
    if (result && result.error) throw result.error;
    const merged = result && result.data;
    if (merged && typeof merged === 'object' && sameCloudContext(uid, localProfileId, cloudProfileId)) {
      const latest = PS();
      if (JSON.stringify(latest) !== JSON.stringify(state)) {
        // A local edit landed while the RPC was in flight; submit it against the
        // newly merged server state rather than replacing the newer local snapshot.
        return pushRemote(latest, uid, localProfileId, cloudProfileId);
      }
      _ps = Object.assign({}, latest, merged);
      _psPid = localProfileId;
      try { localStorage.setItem(localProfileId + '_gosvt_masahati', JSON.stringify(_ps)); } catch (e) {}
    }
    return true;
  } catch (e) {
    console.warn('[Masahati] Cloud save failed; local copy retained.', e && e.message);
    return false;
  }
}
async function pullRemote() {
  const c = window.supabaseClient, uid = cloudUid(), localProfileId = pid(), cloudProfileId = cloudPid();
  if (!c || !uid) return false;
  const contextKey = cloudContextKey(uid, cloudProfileId, localProfileId);
  if (_hydratedUsers.has(contextKey)) return true;
  if (_pullingUsers.has(contextKey)) return _pullingUsers.get(contextKey);
  const task = (async () => {
    const localAtStart = JSON.parse(JSON.stringify(PS()));
    try {
      const result = await c.from('student_platform_state')
        .select('state').eq('student_id', uid).eq('profile_id', cloudProfileId).maybeSingle();
      if (result && result.error) throw result.error;
      if (!sameCloudContext(uid, localProfileId, cloudProfileId)) return false;
      const localNow = PS();
      const changedDuringRead = (localNow.u || 0) > (localAtStart.u || 0);
      const row = result && result.data;
      if (row && row.state && !changedDuringRead) {
        const remote = row.state;
        if ((remote.u || 0) > (localNow.u || 0)) {
          _ps = Object.assign({}, localNow, remote);
          _psPid = localProfileId;
          try { localStorage.setItem(localProfileId + '_gosvt_masahati', JSON.stringify(_ps)); } catch (e) {}
          if (!S.busy) mountAgain();
        }
      }
      _hydratedUsers.add(contextKey);
      const localIsNewer = !row || !row.state || changedDuringRead ||
        (localNow.u || 0) > ((row.state && row.state.u) || 0);
      if (localIsNewer) await pushRemote(localNow, uid, localProfileId, cloudProfileId);
      return true;
    } catch (e) {
      console.warn('[Masahati] Cloud restore failed; local copy retained.', e && e.message);
      return false;
    }
  })();
  _pullingUsers.set(contextKey, task);
  try { return await task; }
  finally { if (_pullingUsers.get(contextKey) === task) _pullingUsers.delete(contextKey); }
}
function bump(kind) {
  const ps = PS(); if (ps.day.d !== today()) ps.day = { d: today(), quiz: 0, cards: 0, open: 0, lab: 0 };
  if (kind) ps.day[kind] = (ps.day[kind] || 0) + 1;
  const k = isoDay(today()); ps.act[k] = (ps.act[k] || 0) + 1;
  const keys = Object.keys(ps.act).sort(); while (keys.length > 120) delete ps.act[keys.shift()];
  savePS(); try { SS().updateStreak(); } catch (e) {}
}

/* ───────── فهرس المحتوى ───────── */
function trackOfSegs(segs) {
  for (const s of segs) { const c = s.replace(/\s+/g, '').toUpperCase(); if (TRACK_RE.test(c)) return c; }
  return '';
}
async function loadIndex() {
  if (S.idx) return S.idx;
  S.idx = (async () => {
    let paths = [];
    try { const r = await fetch('content.json?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) paths = await r.json(); } catch (e) {}
    const items = [];
    (Array.isArray(paths) ? paths : []).forEach(p => {
      const path = nfc(String(p)).replace(/^\/+/, ''), segs = path.split('/'), name = segs[segs.length - 1];
      if (segs.length < 4 || name.startsWith('.') || /^readme/i.test(name)) return;
      let cat = segs[0]; if (cat === 'resumes') cat = 'fiches';
      if (!['cours', 'fiches', 'exercices', 'examens', 'quiz'].includes(cat)) return;
      const ext = (name.split('.').pop() || '').toLowerCase();
      items.push({ path, url: encPath(path), cat, lang: segs[1], level: segs[2], track: trackOfSegs(segs.slice(3, -1)), name, ext, cloud: false });
    });
    const c = window.supabaseClient;
    if (c) {
      try {
        const { data: rows } = await c.from('site_content_items').select('id,category,language,study_level,study_track,file_name,storage_path').order('created_at', { ascending: false });
        (rows || []).forEach(r => {
          const cat = r.category === 'resumes' ? 'fiches' : r.category; if (!['cours', 'fiches', 'exercices', 'examens'].includes(cat)) return;
          const url = c.storage.from('site-content').getPublicUrl(r.storage_path).data.publicUrl;
          items.push({ path: `${cat}/${r.language || 'francais'}/${r.study_level || 'TC'}/${r.study_track || ''}/__cloud/${r.id}/${r.file_name}`, url, cat, lang: r.language || 'francais', level: r.study_level || '', track: r.study_track || '', name: r.file_name, ext: (r.file_name.split('.').pop() || '').toLowerCase(), cloud: true });
        });
      } catch (e) {}
    }
    S.byPath = new Map(items.map(i => [i.path, i]));
    return items;
  })();
  return S.idx;
}
function mine(items, cat) {
  const L = levelInfo(); if (!L) return [];
  return items.filter(i => i.cat === cat && i.level === L.level && (!i.track || i.track === L.track))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
async function loadQmap() {
  if (S.qmap) return S.qmap;
  try { const r = await fetch('quiz-map.json?v=' + Date.now(), { cache: 'no-store' }); const m = r.ok ? await r.json() : {}; S.qmap = {}; Object.keys(m).forEach(k => { S.qmap[nfc(k).replace(/^\/+/, '')] = nfc(m[k]).replace(/^\/+/, ''); }); }
  catch (e) { S.qmap = {}; }
  return S.qmap;
}
const NOISE = /\b(eleves?|cours|exercices?|exos?|resumes?|fiches?|examens?|ait|enajar|aitenajar|francais|arabe|prof|2bac\s?(svt|sp|sm)|1bac\s?(se|sm|l)|tc[sl])\b/gi;
function itemParts(it) {
  const base = it.name.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ');
  let u = '', c = '', rest = base;
  let m = rest.match(/\bU\s*(\d+)\s*C\s*(\d+)\b/i);
  if (m) { u = m[1]; c = m[2]; rest = rest.replace(m[0], ' '); }
  m = rest.match(/\bunit[eé]\s*(\d+)/i); if (m) { u = u || m[1]; rest = rest.replace(m[0], ' '); }
  m = rest.match(/\bchap(?:itre)?\s*(\d+)/i); if (m) { c = c || m[1]; rest = rest.replace(m[0], ' '); }
  rest = rest.replace(NOISE, ' ').replace(/[-–]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (rest) rest = rest.charAt(0).toUpperCase() + rest.slice(1);
  const tag = [u && T('وحدة ' + u, 'U' + u), c && T('درس ' + c, 'Ch.' + c)].filter(Boolean).join(' · ');
  return { title: rest || (tag ? T('الوحدة ' + (u || '') + (c ? ' · الدرس ' + c : ''), 'Unité ' + (u || '') + (c ? ' · Chapitre ' + c : '')) : base), tag };
}
const itemTitle = it => itemParts(it).title;
function status(it) {
  const d = data(), ps = PS(), b = it.cat === 'exercices' ? d.progress.exercises : it.cat === 'examens' ? d.progress.tests : d.progress.lessons;
  const e = b[it.path];
  if (ps.done[it.path] || (e && e.completed)) return 'done';
  return e ? 'seen' : 'new';
}
function openItem(it) {
  if (!it) return;
  if (it.cloud || it.cat === 'fiches') {
    try { SS().updateProgress(it.cat === 'exercices' ? 'exercise' : it.cat === 'examens' ? 'exam' : 'lesson', it.path, { title: itemTitle(it), path: it.path }); } catch (e) {}
    if (it.cloud) { window.open(it.url, '_blank', 'noopener'); bump('open'); return; }
  }
  if (typeof window.openPreview === 'function') window.openPreview('/' + it.path); else window.open(it.url, '_blank', 'noopener');
  bump('open');
}
function markDone(it) {
  const ps = PS(); ps.done[it.path] = Date.now();
  try { if (it.cat !== 'exercices' && it.cat !== 'examens') { SS().updateProgress('lesson', it.path, { title: itemTitle(it), path: it.path }); SS().markLessonComplete(it.path); } } catch (e) {}
  savePS(); bump(); afterAction();
}

/* ───────── الاختبارات ───────── */
function normQuiz(raw, path) {
  const qs = (raw && raw.questions || []).filter(q => q && q.question && Array.isArray(q.choix) && q.choix.length >= 2 && Number.isInteger(q.reponse) && q.reponse >= 1 && q.reponse <= q.choix.length)
    .map(q => ({ q: String(q.question), c: q.choix.map(String), a: q.reponse - 1, e: q.explication ? String(q.explication) : '', src: path }));
  return { path, title: String(raw && (raw.titre || raw.title) || path.split('/').pop().replace(/\.json$/, '')), desc: String(raw && raw.description || ''), qs };
}
async function loadQuiz(path) {
  if (S.quizCache[path]) return S.quizCache[path];
  const r = await fetch(encPath(path), { cache: 'no-cache' }); if (!r.ok) throw new Error('quiz ' + r.status);
  return (S.quizCache[path] = normQuiz(await r.json(), path));
}
async function quizPaths() {
  const L = levelInfo(); if (!L) return [];
  const items = await loadIndex(), map = await loadQmap(), set = new Set();
  items.filter(i => i.cat === 'quiz' && i.ext === 'json' && i.level === L.level && (!i.track || i.track === L.track)).forEach(i => set.add(i.path));
  Object.keys(map).forEach(k => { const segs = map[k].split('/'); if (segs[2] === L.level && (!trackOfSegs(segs.slice(3, -1)) || trackOfSegs(segs.slice(3, -1)) === L.track)) set.add(map[k]); });
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
async function allQuizzes() {
  const ps = await quizPaths();
  return (await Promise.all(ps.map(p => loadQuiz(p).catch(() => null)))).filter(q => q && q.qs.length);
}
function quizStats(path, d) {
  const r = d.quizResults.filter(x => x && (x.quizId === path || '/' + x.quizId === '/' + path));
  return { n: r.length, best: r.reduce((m, x) => Math.max(m, x.percentage || 0), 0), last: r.length ? r[r.length - 1].percentage : null };
}
function startQuiz(quiz, mode, custom) {
  const qs = shuffle(custom || quiz.qs).slice(0, mode === 'exam' ? 20 : 40);
  S.sess = { quiz, mode, qs, i: 0, ans: new Array(qs.length).fill(null), flag: {}, t0: Date.now(), limit: mode === 'exam' ? qs.length * 75 : 0, id: uid(), review: !!custom, done: false };
  S.busy = true; S.view = 'practice'; S.sub.practice = 'quiz'; render();
}
function finishQuiz() {
  const s = S.sess; if (!s || s.done) return;
  clearInterval(S._timer);
  const total = s.qs.length; let score = 0; const wrong = [];
  s.qs.forEach((q, i) => { if (s.ans[i] === q.a) score++; else wrong.push({ q, sel: s.ans[i] }); });
  const pct = Math.round(score / total * 100), xp = 10 + 2 * score + (pct >= 80 ? 10 : 0);
  s.done = true; s.res = { score, total, pct, xp, wrong };
  if (!s.review) {
    try { SS().saveQuizResult(s.quiz.path, score, total, wrong.map(w => ({ question: w.q.q, selected: w.sel == null ? T('بدون إجابة', 'Sans réponse') : w.q.c[w.sel], correct: w.q.c[w.q.a] })), s.id, true); } catch (e) { console.warn(e); }
    bump('quiz');
  }
  const ps = PS();
  s.qs.forEach((q, i) => { const id = hash(q.q), ok = s.ans[i] === q.a, c = ps.cards[id];
    if (!c) ps.cards[id] = { id, q: q.q, c: q.c, a: q.a, e: q.e, src: q.src, box: ok ? 2 : 0, due: today() + (ok ? 3 : 0), n: 0 };
    else if (!ok) { c.box = 0; c.due = today(); } });
  savePS(); afterAction(); render();
}

/* ───────── بطاقات المراجعة المتباعدة (Leitner) ───────── */
const INTERVALS = [0, 1, 3, 7, 16, 35];
const dueCards = () => Object.values(PS().cards).filter(c => c.due <= today()).sort((a, b) => a.box - b.box || a.due - b.due);
function rateCard(id, r) {
  const ps = PS(), c = ps.cards[id]; if (!c) return;
  c.box = r === 1 ? 0 : r === 2 ? Math.max(1, c.box) : r === 3 ? Math.min(5, c.box + 1) : Math.min(5, c.box + 2);
  c.due = today() + (r === 2 ? 1 : INTERVALS[c.box]); c.n++; ps.cardsTotal++;
  bump('cards');
}

/* ───────── نقاط الخبرة والمستويات والشارات ───────── */
function xpTotal(d) {
  const ps = PS(); let x = 0;
  Object.values(d.progress.lessons).forEach(e => { x += e && e.completed ? 25 : 5; });
  Object.values(d.progress.exercises).forEach(() => { x += 5; }); Object.values(d.progress.tests).forEach(() => { x += 5; });
  d.quizResults.forEach(r => { x += 10 + 2 * r.score + (r.percentage >= 80 ? 10 : 0); });
  x += ps.cardsTotal * 2;
  Object.values(ps.lab).forEach(l => { x += 30 + 5 * Math.max(0, (l.n || 1) - 1); });
  x += Object.keys(ps.atlas).length * 3;
  return x;
}
const lvlOf = xp => Math.floor(Math.sqrt(xp / 60)) + 1;
const lvlStart = l => 60 * (l - 1) * (l - 1);
const RANKS = [['مبتدئ', 'Débutant'], ['مستكشف', 'Explorateur'], ['متعلم', 'Apprenti'], ['باحث', 'Chercheur'], ['متمكن', 'Compétent'], ['خبير', 'Expert'], ['عالِم', 'Savant'], ['نابغة', 'Génie']];
const rank = l => T(...RANKS[Math.min(l - 1, RANKS.length - 1)]);
const BADGES = [
  ['first', '🚀', 'الانطلاقة', 'Lancement', 'أنجز أول اختبار', 'Terminez un premier quiz', c => c.d.quizResults.length >= 1],
  ['q5', '🎯', 'مثابر', 'Persévérant', '5 اختبارات', '5 quiz', c => c.d.quizResults.length >= 5],
  ['perfect', '💯', 'العلامة الكاملة', 'Sans faute', '100٪ في اختبار', '100 % à un quiz', c => c.d.quizResults.some(r => r.percentage === 100)],
  ['streak3', '🔥', 'ثلاثة أيام', '3 jours', '3 أيام متتالية', '3 jours d’affilée', c => (c.d.streak.best || 0) >= 3],
  ['streak7', '🌋', 'أسبوع كامل', 'Semaine', '7 أيام متتالية', '7 jours d’affilée', c => (c.d.streak.best || 0) >= 7],
  ['l10', '📚', 'قارئ نهم', 'Lecteur', 'أتمّ 10 دروس', '10 leçons terminées', c => Object.values(c.d.progress.lessons).filter(e => e && e.completed).length >= 10],
  ['c50', '🧠', 'ذاكرة حديدية', 'Mémoire d’acier', 'راجع 50 بطاقة', '50 cartes révisées', c => c.ps.cardsTotal >= 50],
  ['lab3', '🔬', 'عالِم مختبر', 'Rat de labo', 'أنجز 3 تجارب', '3 expériences', c => Object.keys(c.ps.lab).length >= 3],
  ['atlas', '🧭', 'مستكشف الأطلس', 'Explorateur', 'اكتشف 8 أجزاء', '8 éléments d’atlas', c => Object.keys(c.ps.atlas).length >= 8],
  ['exam', '🎓', 'صياد الامتحانات', 'Chasseur d’examens', 'افتح 5 امتحانات', '5 examens ouverts', c => Object.keys(c.d.progress.tests).length >= 5],
  ['lv5', '👑', 'المستوى 5', 'Niveau 5', 'بلوغ المستوى 5', 'Atteindre le niveau 5', c => lvlOf(c.xp) >= 5]
];
function ctx() { const d = data(); return { d, ps: PS(), xp: xpTotal(d) }; }
function afterAction() {
  const c = ctx(), lv = lvlOf(c.xp);
  if (S.lv0 != null && lv > S.lv0) toast('🎉 ' + T(`ترقّيت إلى المستوى ${lv} — ${rank(lv)}`, `Niveau ${lv} atteint — ${rank(lv)}`));
  S.lv0 = lv;
  const have = new Set(c.ps.badges), fresh = BADGES.filter(b => !have.has(b[0]) && b[6](c));
  if (fresh.length) { fresh.forEach(b => c.ps.badges.push(b[0])); savePS(); toast(fresh[0][1] + ' ' + T('شارة جديدة: ', 'Nouveau badge : ') + T(fresh[0][2], fresh[0][3])); }
}
let _toastT; function toast(msg) {
  document.querySelectorAll('.mh-toast').forEach(n => n.remove());
  const n = document.createElement('div'); n.className = 'mh-toast'; n.setAttribute('role', 'status'); n.textContent = msg; document.body.appendChild(n);
  clearTimeout(_toastT); _toastT = setTimeout(() => n.remove(), 3600);
}

/* ───────── رسوم SVG صغيرة ───────── */
function barChart(vals, labels, h = 120) {
  const w = 320, max = Math.max(1, ...vals), bw = w / vals.length;
  return `<svg class="mh-chart" viewBox="0 0 ${w} ${h + 26}" role="img" aria-label="${T('نشاط الأسبوع', 'Activité de la semaine')}">` + vals.map((v, i) => {
    const bh = Math.max(3, v / max * h), x = i * bw + bw * .18;
    return `<rect x="${x}" y="${h - bh}" width="${bw * .64}" height="${bh}" rx="7" fill="${i === vals.length - 1 ? 'var(--mh-gold)' : 'var(--mh-brand)'}" opacity="${v ? 1 : .25}"/><text x="${x + bw * .32}" y="${h + 17}" text-anchor="middle" font-size="11" fill="var(--mh-soft)">${labels[i]}</text>` + (v ? `<text x="${x + bw * .32}" y="${h - bh - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--mh-ink)">${v}</text>` : '');
  }).join('') + '</svg>';
}
function lineChart(vals) {
  if (vals.length < 2) return `<p class="mh-empty">${T('أنجز اختبارين على الأقل لرؤية تطورك.', 'Faites au moins deux quiz pour voir votre courbe.')}</p>`;
  const w = 320, h = 120, st = w / (vals.length - 1), pts = vals.map((v, i) => [i * st, h - v / 100 * h]);
  return `<svg class="mh-chart" viewBox="-8 -8 ${w + 16} ${h + 24}" role="img" aria-label="${T('تطور النتائج', 'Évolution des scores')}"><line x1="0" x2="${w}" y1="${h * .3}" y2="${h * .3}" stroke="var(--mh-line)" stroke-dasharray="4"/><text x="0" y="${h * .3 - 3}" font-size="10" fill="var(--mh-soft)">70%</text><polyline fill="none" stroke="var(--mh-brand)" stroke-width="3" stroke-linejoin="round" points="${pts.map(p => p.join(',')).join(' ')}"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="var(--mh-surface)" stroke="var(--mh-brand)" stroke-width="2.5"><title>${vals[i]}%</title></circle>`).join('') + '</svg>';
}
const ring = (v, inner, cls = '', c) => `<div class="mh-ring ${cls}" style="--v:${v};${c ? '--c:' + c : ''}"><div><span>${inner}</span></div></div>`;

/* ───────── الهيكل العام ───────── */
const NAV = [['home', 'home', 'الرئيسية', 'Accueil'], ['learn', 'book', 'دروسي', 'Cours'], ['practice', 'quiz', 'تدرّب', 'S’entraîner'], ['lab', 'flask', 'المختبر', 'Labo'], ['me', 'user', 'مساري', 'Mon parcours']];
let _root = null;
function mount(container) {
  if (localStorage.getItem('gosvt_legacy_space') === '1') return false;
  const a = account(); if (!a || a.role === 'admin' || a.role === 'teacher') return false;
  _root = container; pullRemote();
  if (container.querySelector('.mh') && S.busy) { updateSide(); return true; }
  render(); return true;
}
function mountAgain() { if (_root) render(); }
function render() {
  const c = _root || document.getElementById('student-space-content'); if (!c) return;
  const L = levelInfo(), a = account() || {};
  c.innerHTML = `<div class="mh" dir="${lang() === 'fr' ? 'ltr' : 'rtl'}"><div class="mh-layout">
    <aside class="mh-side"><nav class="mh-card mh-nav" aria-label="${T('أقسام مساحتي', 'Sections')}">${NAV.map(n => `<button type="button" data-a="go" data-v="${n[0]}" ${S.view === n[0] ? 'aria-current="page"' : ''}>${ic(n[1])}<span>${T(n[2], n[3])}</span>${n[0] === 'practice' ? '<span class="mh-badge-dot" id="mh-due" hidden></span>' : ''}</button>`).join('')}</nav>
      <div class="mh-card side-extra" id="mh-side"></div>
      ${(SA().renderBar && SA().renderBar()) ? `<div class="mh-card side-extra">${SA().renderBar()}</div>` : ''}</aside>
    <main class="mh-main" id="mh-view" aria-live="polite"></main></div></div>`;
  bindRoot(c.querySelector('.mh')); updateSide();
  if (!L) { chooser(); return; }
  const v = $('#mh-view'); v.innerHTML = '<div class="mh-skel"></div><div class="mh-skel"></div>';
  Promise.resolve(VIEWS[S.view] ? VIEWS[S.view]() : VIEWS.home()).then(h => { if (v.isConnected && typeof h === 'string') { v.innerHTML = `<div class="mh-view">${h}</div>`; after(); } }).catch(e => { console.error(e); v.innerHTML = `<div class="mh-card mh-empty"><b>⚠️</b>${T('تعذّر تحميل هذا القسم. حاول مجددًا.', 'Impossible de charger cette section.')}</div>`; });
}
const $ = s => (_root || document).querySelector(s);
function updateSide() {
  const el = $('#mh-side'); if (!el) return;
  const a = account() || {}, L = levelInfo(), c = ctx(), lv = lvlOf(c.xp), a0 = lvlStart(lv), a1 = lvlStart(lv + 1), name = a.display_name || (a.email || '').split('@')[0] || '—';
  if (S.lv0 == null) S.lv0 = lv;
  el.innerHTML = `<div style="display:flex;gap:.7rem;align-items:center"><div class="mh-avatar" style="background:var(--mh-mint);color:var(--mh-brand2);border-color:var(--mh-line)">${esc(name.trim().charAt(0).toUpperCase())}</div><div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(name)}</b><span class="mh-chip">${L ? T(TRACK_NAMES[L.track][0], TRACK_NAMES[L.track][1]) : '—'}</span></div></div>
   <div style="margin-top:.8rem"><div class="mh-xp-row"><span>${T('المستوى', 'Niv.')} ${lv} · ${rank(lv)}</span><span>${c.xp} XP</span></div><div class="mh-bar"><i style="width:${Math.min(100, (c.xp - a0) / (a1 - a0) * 100)}%"></i></div></div>
   <p style="margin-top:.6rem;font-weight:700">🔥 ${c.d.streak.current || 0} ${T('يوم متتالٍ', 'jours d’affilée')}</p>`;
  const due = dueCards().length, b = $('#mh-due'); if (b) { b.hidden = !due; b.textContent = due; }
}
function chooser() {
  const v = $('#mh-view');
  v.innerHTML = `<div class="mh-card"><div class="mh-h"><h3>🎓 ${T('اختر مسارك الدراسي', 'Choisissez votre parcours')}</h3></div><p style="margin-bottom:1rem;color:var(--mh-soft)">${T('لم نجد مستوى ومسلكًا مرتبطين بحسابك. اختر ما يناسبك لتخصيص المنصة.', 'Aucun niveau/filière associé à votre compte. Choisissez pour personnaliser l’espace.')}</p>
  <form data-form="level" class="mh-tools"><select class="mh-input" name="tk" required>${Object.keys(TRACKS).map(l => `<optgroup label="${l}">${TRACKS[l].map(t => `<option value="${l}|${t}">${T(TRACK_NAMES[t][0], TRACK_NAMES[t][1])}</option>`).join('')}</optgroup>`).join('')}</select><button class="mh-btn p">${T('تأكيد', 'Valider')}</button></form></div>`;
}
function go(v) { if (S.sess && !S.sess.done && !confirm(T('سيتم إنهاء الاختبار الحالي دون حفظ. متابعة؟', 'Quitter le quiz sans enregistrer ?'))) return; leaveQuiz(); S.view = v; render(); window.scrollTo({ top: ($('#student-space') || document.body).offsetTop - 70, behavior: 'smooth' }); }
function leaveQuiz() { clearInterval(S._timer); S.sess = null; S.flash = null; S.busy = false; }
const after = () => { const v = $('#mh-view'); if (S.sess && !S.sess.done && S.sess.limit) startTimer(); if (window.MasahatiLab && S.view === 'lab') labMount(); };

/* ───────── الصفحات ───────── */
const VIEWS = {};

VIEWS.home = async function () {
  const items = await loadIndex(), d = data(), ps = PS(), c = ctx(), lv = lvlOf(c.xp), a = account() || {};
  const name = (a.display_name || '').split(' ')[0] || '', h = new Date().getHours();
  const greet = h < 12 ? T('صباح الخير', 'Bonjour') : h < 18 ? T('طاب يومك', 'Bon après-midi') : T('مساء الخير', 'Bonsoir');
  const a0 = lvlStart(lv), a1 = lvlStart(lv + 1), L = levelInfo(), due = dueCards().length;
  const all = []; ['lessons', 'exercises', 'tests'].forEach(k => Object.values(d.progress[k]).forEach(e => e && e.path && all.push(e)));
  const cont = all.filter(e => !e.completed && !ps.done[e.path] && S.byPath.has(e.path)).sort((x, y) => (y.lastViewed || 0) - (x.lastViewed || 0))[0];
  const qs = await allQuizzes();
  const weak = qs.map(q => ({ q, s: quizStats(q.path, d) })).filter(x => x.s.n && x.s.last < 70).sort((x, y) => x.s.last - y.s.last)[0];
  const fresh = qs.find(q => !quizStats(q.path, d).n);
  const dd = ps.day, goal = ps.goalCards || 10;
  const missions = [[dd.open >= 1, '📖', T('افتح درسًا أو تمرينًا', 'Ouvrez une leçon ou un exercice'), 'learn'], [dd.quiz >= 1, '🎯', T('أنجز اختبارًا واحدًا', 'Terminez un quiz'), 'practice'], [dd.cards >= goal || (!due && dd.cards > 0), '🧠', T(`راجع ${goal} بطاقات`, `Révisez ${goal} cartes`), 'practice']];
  const done = missions.filter(m => m[0]).length;
  const days = [...Array(7)].map((_, i) => today() - 6 + i), dl = days.map(n => new Date(n * 864e5).toLocaleDateString(lang() === 'fr' ? 'fr-FR' : 'ar-MA', { weekday: 'narrow', timeZone: 'UTC' }));
  const exam = ps.exam ? Math.ceil((new Date(ps.exam) - Date.now()) / 864e5) : null;
  const cnt = k => mine(items, k).length;
  const rec = weak ? `<div class="mh-item"><div class="mh-item-top"><div class="mh-ico" style="background:var(--mh-red-bg)">🎯</div><div><h4>${T('أعد هذا الاختبار لتقوية نقطة ضعفك', 'Refaites ce quiz pour progresser')}</h4><p style="color:var(--mh-soft);font-size:.86rem">${esc(weak.q.title)} · ${weak.s.last}%</p></div></div><div class="act"><button class="mh-btn p sm" data-a="quiz" data-p="${esc(weak.q.path)}">${T('ابدأ', 'Commencer')}</button></div></div>`
    : fresh ? `<div class="mh-item"><div class="mh-item-top"><div class="mh-ico" style="background:var(--mh-blue-bg)">✨</div><div><h4>${T('اختبار جديد في انتظارك', 'Un nouveau quiz vous attend')}</h4><p style="color:var(--mh-soft);font-size:.86rem">${esc(fresh.title)}</p></div></div><div class="act"><button class="mh-btn p sm" data-a="quiz" data-p="${esc(fresh.path)}">${T('ابدأ', 'Commencer')}</button></div></div>` : '';
  return `<section class="mh-hero"><div class="mh-hero-top"><div class="mh-avatar">${esc((name || '🎓').charAt(0).toUpperCase())}</div><div><h2>${greet}${name ? '، ' + esc(name) : ''} 👋</h2><small>${L ? T(TRACK_NAMES[L.track][0], TRACK_NAMES[L.track][1]) : ''}</small></div></div>
    <div class="mh-stats"><div class="mh-stat"><b>🔥 ${d.streak.current || 0}</b><span>${T('أيام متتالية', 'jours d’affilée')}</span></div><div class="mh-stat"><b>⭐ ${c.xp}</b><span>${T('نقطة خبرة', 'points XP')}</span></div><div class="mh-stat"><b>🎯 ${d.quizResults.length}</b><span>${T('اختبارات', 'quiz')}</span></div><div class="mh-stat"><b>🧠 ${due}</b><span>${T('بطاقات مستحقة', 'cartes à revoir')}</span></div></div>
    <div class="mh-xp"><div class="mh-xp-row"><span>${T('المستوى', 'Niveau')} ${lv} · ${rank(lv)}</span><span>${c.xp - a0} / ${a1 - a0}</span></div><div class="mh-bar"><i style="width:${(c.xp - a0) / (a1 - a0) * 100}%"></i></div></div></section>
  <div class="mh-grid two"><section class="mh-card"><div class="mh-h"><h3>✅ ${T('مهام اليوم', 'Missions du jour')}</h3>${ring(Math.round(done / 3 * 100), done + '/3', 'sm')}</div><div style="display:grid;gap:.5rem">${missions.map(m => `<div class="mh-mission ${m[0] ? 'done' : ''}"><div class="ck">${m[0] ? '✓' : ''}</div><span>${m[1]} ${m[2]}</span>${m[0] ? '' : `<button class="mh-btn sm" style="margin-inline-start:auto" data-a="go" data-v="${m[3]}">${T('هيّا', 'Go')}</button>`}</div>`).join('')}</div></section>
  <section class="mh-card"><div class="mh-h"><h3>📊 ${T('نشاطك هذا الأسبوع', 'Votre semaine')}</h3></div>${barChart(days.map(n => ps.act[isoDay(n)] || 0), dl)}</section></div>
  <div class="mh-grid two">${cont ? `<div class="mh-item"><div class="mh-item-top"><div class="mh-ico">▶️</div><div><h4>${T('تابع من حيث توقفت', 'Reprenez où vous étiez')}</h4><p style="color:var(--mh-soft);font-size:.86rem">${esc(itemTitle(S.byPath.get(cont.path)))}</p></div></div><div class="act"><button class="mh-btn p sm" data-a="open" data-p="${esc(cont.path)}">${T('متابعة', 'Continuer')}</button></div></div>` : ''}${rec}
  ${due ? `<div class="mh-item"><div class="mh-item-top"><div class="mh-ico" style="background:var(--mh-violet-bg)">🧠</div><div><h4>${T(`${due} بطاقة تنتظر المراجعة`, `${due} cartes à réviser`)}</h4><p style="color:var(--mh-soft);font-size:.86rem">${T('المراجعة المتباعدة تثبّت المعلومة في الذاكرة طويلة المدى.', 'La répétition espacée ancre les notions.')}</p></div></div><div class="act"><button class="mh-btn p sm" data-a="srs">${T('ابدأ المراجعة', 'Réviser')}</button></div></div>` : ''}
  ${exam != null && exam >= 0 ? `<div class="mh-item"><div class="mh-item-top"><div class="mh-ico" style="background:var(--mh-gold-bg)">⏳</div><div><h4>${T(`تبقّى ${exam} يومًا على الامتحان`, `J-${exam} avant l’examen`)}</h4><p style="color:var(--mh-soft);font-size:.86rem">${T('نظّم مراجعتك في «مساري ← الخطة».', 'Organisez-vous dans « Mon parcours ».')}</p></div></div></div>` : ''}</div>
  <section class="mh-card"><div class="mh-h"><h3>🧭 ${T('كل ما يخص مستواك', 'Tout pour votre niveau')}</h3></div><div class="mh-grid">${[['cours', '📕', 'الدروس', 'Cours'], ['fiches', '📝', 'الملخصات', 'Résumés'], ['exercices', '✏️', 'التمارين', 'Exercices'], ['examens', '🏛️', 'الامتحانات', 'Examens']].map(k => `<button class="mh-item" style="text-align:start;cursor:pointer" data-a="cat" data-c="${k[0]}"><div class="mh-item-top"><div class="mh-ico">${k[1]}</div><div><h4>${T(k[2], k[3])}</h4><span class="mh-chip">${cnt(k[0])} ${T('ملف', 'fichiers')}</span></div></div></button>`).join('')}<button class="mh-item" style="text-align:start;cursor:pointer" data-a="go" data-v="lab"><div class="mh-item-top"><div class="mh-ico" style="background:var(--mh-violet-bg)">🔬</div><div><h4>${T('المختبر والأطلس', 'Labo & atlas')}</h4><span class="mh-chip">${T('تجارب تفاعلية', 'expériences interactives')}</span></div></div></button></div></section>`;
};

/* — دروسي — */
const CATS = [['cours', '📕', 'الدروس', 'Cours'], ['fiches', '📝', 'الملخصات', 'Résumés'], ['exercices', '✏️', 'التمارين', 'Exercices'], ['examens', '🏛️', 'الامتحانات', 'Examens']];
VIEWS.learn = async function () {
  const items = await loadIndex(), qmap = await loadQmap(), F = S.learn, list = mine(items, F.cat);
  const tabs = `<div class="mh-tabs" role="tablist">${CATS.map(k => `<button role="tab" aria-selected="${F.cat === k[0]}" data-a="cat" data-c="${k[0]}">${k[1]} ${T(k[2], k[3])} <small>(${mine(items, k[0]).length})</small></button>`).join('')}</div>`;
  const doneN = list.filter(i => status(i) === 'done').length;
  let body = '';
  if (!list.length) body = `<div class="mh-card mh-empty"><b>📭</b><p>${T('لا توجد ملفات في هذا القسم لمستواك بعد. سنضيفها قريبًا — في الأثناء جرّب الاختبارات والمختبر.', 'Pas encore de fichiers ici pour votre niveau. Essayez les quiz et le labo.')}</p><p style="margin-top:.8rem"><button class="mh-btn p" data-a="go" data-v="practice">${T('انتقل إلى التدرّب', 'Aller à l’entraînement')}</button></p></div>`;
  else if (F.cat === 'examens') body = examsHtml(list);
  else {
    const q = nfc(F.q).toLowerCase();
    const f = list.filter(i => (F.lang === 'all' || i.lang === F.lang) && (F.status === 'all' || (F.status === 'done') === (status(i) === 'done')) && (!q || (itemTitle(i) + ' ' + i.name).toLowerCase().includes(q)));
    body = `<div class="mh-tools"><input class="mh-input" type="search" id="mh-q" placeholder="${T('ابحث…', 'Rechercher…')}" value="${esc(F.q)}"><select class="mh-input" style="flex:0 1 150px" data-sel="lang"><option value="all">${T('كل اللغات', 'Toutes langues')}</option><option value="francais" ${F.lang === 'francais' ? 'selected' : ''}>Français</option><option value="arabe" ${F.lang === 'arabe' ? 'selected' : ''}>العربية</option></select><select class="mh-input" style="flex:0 1 150px" data-sel="status"><option value="all">${T('الكل', 'Tout')}</option><option value="todo" ${F.status === 'todo' ? 'selected' : ''}>${T('غير مكتمل', 'À faire')}</option><option value="done" ${F.status === 'done' ? 'selected' : ''}>${T('مكتمل', 'Terminé')}</option></select></div>
      <div class="mh-grid" style="margin-top:.8rem">${f.map(i => itemCard(i, qmap)).join('') || `<p class="mh-empty" style="grid-column:1/-1">${T('لا نتائج.', 'Aucun résultat.')}</p>`}</div>`;
  }
  return `<div class="mh-h"><div><h3>📚 ${T('مكتبتي الدراسية', 'Ma bibliothèque')}</h3><p>${T('محتوى مختار حسب مستواك ومسلكك', 'Contenu adapté à votre niveau et filière')}</p></div>${list.length ? `<div style="min-width:190px"><div class="mh-xp-row" style="font-size:.8rem"><span>${T('الإنجاز', 'Progression')}</span><span>${doneN}/${list.length}</span></div><div class="mh-bar g"><i style="width:${doneN / list.length * 100}%"></i></div></div>` : ''}</div>${tabs}${body}`;
};
function itemCard(i, qmap) {
  const st = status(i), hasQuiz = qmap[i.path];
  const pill = st === 'done' ? `<span class="mh-pill done">✓ ${T('مكتمل', 'Terminé')}</span>` : st === 'seen' ? `<span class="mh-pill seen">${T('قيد الدراسة', 'En cours')}</span>` : `<span class="mh-pill new">${T('جديد', 'Nouveau')}</span>`;
  return `<article class="mh-item ${st === 'done' ? 'done' : ''}"><div class="mh-item-top"><div class="mh-ico">${FILE_ICON[i.ext] || '📄'}</div><div><h4>${esc(itemTitle(i))}</h4><div class="meta">${pill}${itemParts(i).tag ? `<span class="mh-pill lg">${esc(itemParts(i).tag)}</span>` : ''}<span class="mh-pill lg">${i.lang === 'arabe' ? 'العربية' : 'FR'}</span></div></div></div>
  <div class="act"><button class="mh-btn p sm" data-a="open" data-p="${esc(i.path)}">${T('فتح', 'Ouvrir')}</button>${st !== 'done' ? `<button class="mh-btn sm" data-a="done" data-p="${esc(i.path)}">✓ ${T('أنهيته', 'Terminé')}</button>` : ''}${hasQuiz ? `<button class="mh-btn sm" data-a="quiz" data-p="${esc(hasQuiz)}">🎯 ${T('اختبر نفسك', 'Quiz')}</button>` : ''}</div></article>`;
}
function examsHtml(list) {
  const years = {}, other = [];
  list.forEach(i => { const m = i.name.match(/(20\d\d|19\d\d)[-_ ]?(normale|rattrapage)?[-_ ]?(sujet|corrige|correction)?/i); if (!m) return other.push(i);
    const y = m[1], ses = /rattrapage/i.test(i.name) ? 'r' : 'n', kind = /corrig|correct/i.test(i.name) || /correction/i.test(i.path) ? 'c' : 's';
    ((years[y] = years[y] || {})[ses + kind] = i); });
  const btn = (i, label) => i ? `<button class="mh-btn sm ${status(i) === 'done' ? '' : ''}" data-a="open" data-p="${esc(i.path)}">${status(i) !== 'new' ? '✓ ' : ''}${label}</button>` : `<span class="mh-chip" style="opacity:.5">—</span>`;
  const rows = Object.keys(years).sort((a, b) => b - a).map(y => `<div class="mh-exam-year"><strong>${y}</strong><div><small style="color:var(--mh-soft)">${T('الدورة العادية', 'Session normale')}</small><div class="mh-exam-cell">${btn(years[y].ns, T('الموضوع', 'Sujet'))}${btn(years[y].nc, T('التصحيح', 'Corrigé'))}</div></div><div><small style="color:var(--mh-soft)">${T('الدورة الاستدراكية', 'Rattrapage')}</small><div class="mh-exam-cell">${btn(years[y].rs, T('الموضوع', 'Sujet'))}${btn(years[y].rc, T('التصحيح', 'Corrigé'))}</div></div></div>`).join('');
  return `<section class="mh-card"><div class="mh-h"><h3>🏛️ ${T('الامتحانات الوطنية مع التصحيح', 'Examens nationaux corrigés')}</h3><p>${T('حاول حلّ الموضوع أولًا ثم قارن بالتصحيح.', 'Essayez le sujet avant de consulter le corrigé.')}</p></div>${rows}</section>` + (other.length ? `<div class="mh-grid" style="margin-top:.8rem">${other.map(i => itemCard(i, {})).join('')}</div>` : '');
}

/* — تدرّب — */
VIEWS.practice = async function () {
  if (S.sess) return quizScreen();
  if (S.flash) return flashScreen();
  const sub = S.sub.practice || 'quizzes', due = dueCards().length;
  const tabs = `<div class="mh-tabs" role="tablist">${[['quizzes', '🎯', 'اختبارات', 'Quiz'], ['srs', '🧠', `بطاقات المراجعة (${due})`, `Cartes (${due})`], ['mistakes', '🧩', 'أخطائي', 'Mes erreurs']].map(k => `<button role="tab" aria-selected="${sub === k[0]}" data-a="psub" data-s="${k[0]}">${k[1]} ${T(k[2], k[3])}</button>`).join('')}</div>`;
  const h = `<div class="mh-h"><div><h3>🎯 ${T('فضاء التدرّب', 'Espace d’entraînement')}</h3><p>${T('اختبارات تفاعلية بتصحيح فوري، نمط امتحان بمؤقّت، ومراجعة ذكية لأخطائك.', 'Quiz corrigés, mode examen chronométré et révision intelligente.')}</p></div></div>${tabs}`;
  if (sub === 'srs') return h + srsHome();
  if (sub === 'mistakes') return h + await mistakesHtml();
  const d = data(), qs = await allQuizzes();
  if (!qs.length) return h + `<div class="mh-card mh-empty"><b>🧪</b>${T('لا توجد اختبارات لمستواك بعد.', 'Pas encore de quiz pour votre niveau.')}</div>`;
  return h + `<div class="mh-grid">${qs.map(q => { const s = quizStats(q.path, d); return `<article class="mh-item"><div class="mh-item-top">${ring(s.best, s.n ? s.best + '%' : '—', 'sm', s.best >= 80 ? 'var(--mh-brand)' : s.best >= 50 ? 'var(--mh-gold)' : 'var(--mh-red)')}<div><h4>${esc(q.title)}</h4><div class="meta"><span class="mh-pill lg">${q.qs.length} ${T('سؤال', 'questions')}</span>${s.n ? `<span class="mh-pill seen">${s.n} ${T('محاولة', 'essais')}</span>` : `<span class="mh-pill new">${T('جديد', 'Nouveau')}</span>`}</div>${q.desc ? `<p style="color:var(--mh-soft);font-size:.8rem;margin-top:.2rem">${esc(q.desc)}</p>` : ''}</div></div><div class="act"><button class="mh-btn p sm" data-a="qstart" data-p="${esc(q.path)}" data-m="practice">📘 ${T('تدريب', 'Entraînement')}</button><button class="mh-btn sm" data-a="qstart" data-p="${esc(q.path)}" data-m="exam">⏱️ ${T('نمط امتحان', 'Mode examen')}</button></div></article>`; }).join('')}</div>`;
};
function quizScreen() {
  const s = S.sess; if (s.done) return resultScreen();
  const q = s.qs[s.i], a = s.ans[s.i], exam = s.mode === 'exam', locked = !exam && a != null;
  const opts = q.c.map((c, j) => { let cls = ''; if (locked) cls = j === q.a ? 'ok' : j === a ? 'no' : ''; else if (a === j) cls = 'sel'; return `<button class="mh-opt ${cls}" data-a="ans" data-j="${j}" ${locked ? 'disabled' : ''}><kbd>${j + 1}</kbd><span>${esc(c)}</span></button>`; }).join('');
  return `<div class="mh-card mh-quiz"><div class="mh-qtop"><button class="mh-btn sm" data-a="qquit">✕</button><div class="mh-bar g"><i style="width:${(s.i + (locked ? 1 : 0)) / s.qs.length * 100}%"></i></div><b>${s.i + 1}/${s.qs.length}</b>${s.limit ? `<span class="mh-timer" id="mh-timer">--:--</span>` : ''}</div>
  <p class="mh-q">${esc(q.q)}</p><div class="mh-opts">${opts}</div>${locked && q.e ? `<div class="mh-expl">💡 ${esc(q.e)}</div>` : ''}
  <div class="mh-qnav"><div>${exam ? `<button class="mh-btn sm" data-a="qprev" ${s.i ? '' : 'disabled'}>→ ${T('السابق', 'Précédent')}</button>` : ''}${exam ? `<button class="mh-btn sm" data-a="qflag">${s.flag[s.i] ? '🚩' : '⚑'} ${T('تعليم', 'Marquer')}</button>` : ''}</div><div>${s.i < s.qs.length - 1 ? `<button class="mh-btn p" data-a="qnext" ${!exam && a == null ? 'disabled' : ''}>${T('التالي', 'Suivant')} ←</button>` : `<button class="mh-btn p" data-a="qfinish" ${!exam && a == null ? 'disabled' : ''}>${T('إنهاء وعرض النتيجة', 'Terminer')} ✓</button>`}</div></div>
  <p style="text-align:center;color:var(--mh-soft);font-size:.78rem;margin-top:.8rem">${T('اختصارات: 1-4 للاختيار · Enter للمتابعة', 'Raccourcis : 1-4 pour choisir · Entrée pour continuer')}</p></div>`;
}
function startTimer() {
  clearInterval(S._timer);
  const tick = () => { const s = S.sess, el = document.getElementById('mh-timer'); if (!s || !el) return clearInterval(S._timer);
    const left = Math.max(0, s.limit - Math.floor((Date.now() - s.t0) / 1000)); el.textContent = String(left / 60 | 0).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); el.classList.toggle('low', left < 60);
    if (!left) { clearInterval(S._timer); toast(T('انتهى الوقت!', 'Temps écoulé !')); finishQuiz(); } };
  tick(); S._timer = setInterval(tick, 1000);
}
function resultScreen() {
  const s = S.sess, r = s.res, msg = r.pct === 100 ? T('أداء مثالي! 🌟', 'Parfait ! 🌟') : r.pct >= 70 ? T('عمل رائع، واصل! 👏', 'Très bien, continuez ! 👏') : r.pct >= 50 ? T('جيد، لكن يمكنك أفضل 💪', 'Bien, mais vous pouvez mieux 💪') : T('لا بأس — راجع الدرس وأعد المحاولة 📚', 'Pas grave — révisez et réessayez 📚');
  return `<div class="mh-card mh-quiz mh-result">${ring(r.pct, `${r.score}/${r.total}<small>${r.pct}%</small>`, '', r.pct >= 70 ? 'var(--mh-brand)' : r.pct >= 50 ? 'var(--mh-gold)' : 'var(--mh-red)')}<h3>${msg}</h3>
  <p><span class="mh-chip">+${s.review ? 0 : r.xp} XP</span> <span class="mh-chip">⏱️ ${Math.round((Date.now() - s.t0) / 60000) || 1} ${T('د', 'min')}</span> <span class="mh-chip">🧠 ${T('أُضيفت الأسئلة لبطاقات المراجعة', 'ajoutées aux cartes')}</span></p>
  <div class="mh-tools" style="justify-content:center"><button class="mh-btn p" data-a="qstart" data-p="${esc(s.quiz.path)}" data-m="${s.mode}">${T('إعادة الاختبار', 'Rejouer')}</button>${r.wrong.length ? `<button class="mh-btn" data-a="qretry">${T('أعد أخطائي فقط', 'Refaire mes erreurs')} (${r.wrong.length})</button>` : ''}<button class="mh-btn" data-a="qquit">${T('رجوع', 'Retour')}</button></div></div>
  <div class="mh-card mh-quiz" style="display:grid;gap:.6rem"><div class="mh-h"><h3>${T('مراجعة الإجابات', 'Correction détaillée')}</h3></div>${s.qs.map((q, i) => { const ok = s.ans[i] === q.a; return `<div class="mh-review-q ${ok ? 'good' : 'bad'}"><b>${ok ? '✅' : '❌'} ${i + 1}. ${esc(q.q)}</b><p style="margin-top:.3rem">${ok ? '' : `<span style="color:var(--mh-red)">${T('إجابتك', 'Votre réponse')}: ${s.ans[i] == null ? '—' : esc(q.c[s.ans[i]])}</span><br>`}<span style="color:var(--mh-brand2)">${T('الصحيح', 'Correct')}: ${esc(q.c[q.a])}</span></p>${q.e ? `<p style="margin-top:.3rem;color:var(--mh-soft);font-size:.88rem">💡 ${esc(q.e)}</p>` : ''}</div>`; }).join('')}</div>`;
}
function srsHome() {
  const ps = PS(), cards = Object.values(ps.cards), due = dueCards(), boxes = [0, 1, 2, 3, 4, 5].map(b => cards.filter(c => c.box === b).length), mx = Math.max(1, ...boxes);
  if (!cards.length) return `<div class="mh-card mh-empty"><b>🧠</b><p>${T('بطاقات المراجعة تُنشأ تلقائيًا من أسئلة الاختبارات التي تنجزها. يمكنك أيضًا إضافة كل أسئلة مستواك الآن.', 'Les cartes sont créées depuis vos quiz. Vous pouvez aussi ajouter toutes les questions de votre niveau.')}</p><p style="margin-top:.8rem"><button class="mh-btn p" data-a="seed">${T('أضف أسئلة مستواي', 'Ajouter les questions')}</button></p></div>`;
  return `<div class="mh-grid two"><section class="mh-card" style="text-align:center">${ring(Math.round(cards.filter(c => c.box >= 3).length / cards.length * 100), `${due.length}<small>${T('مستحقة اليوم', 'à revoir')}</small>`)}<p style="margin:.8rem 0;color:var(--mh-soft)">${T(`إتقان ${cards.filter(c => c.box >= 3).length} من أصل ${cards.length} بطاقة`, `${cards.filter(c => c.box >= 3).length} maîtrisées sur ${cards.length}`)}</p><button class="mh-btn p" data-a="srs" ${due.length ? '' : 'disabled'}>🧠 ${due.length ? T('ابدأ جلسة المراجعة', 'Lancer la révision') : T('أحسنت! لا شيء اليوم', 'Rien à réviser')}</button> <button class="mh-btn" data-a="seed">➕ ${T('أضف المزيد', 'Ajouter')}</button></section>
  <section class="mh-card"><div class="mh-h"><h3>${T('صناديق لايتنر', 'Boîtes de Leitner')}</h3></div><div class="mh-boxes" style="margin-bottom:1.6rem">${boxes.map((n, i) => `<div style="height:${Math.max(8, n / mx * 100)}%"><span>${n}<br>${i + 1}</span></div>`).join('')}</div><p class="mh-info" style="font-size:.86rem">${T('كلما أجبت صحيحًا انتقلت البطاقة لصندوق أعلى وتأخّر ظهورها (1 ← 3 ← 7 ← 16 ← 35 يومًا). الأخطاء تعود للصندوق الأول.', 'Une bonne réponse fait monter la carte (1→3→7→16→35 jours). Une erreur la ramène à la première boîte.')}</p></section></div>`;
}
function flashScreen() {
  const f = S.flash, c = f.q[f.i];
  if (!c) { const n = f.n; S.flash = null; S.busy = false; afterAction(); return `<div class="mh-card mh-result mh-quiz"><b style="font-size:3rem">🎉</b><h3>${T('انتهت الجلسة!', 'Session terminée !')}</h3><p>${T(`راجعت ${n} بطاقة. عُد غدًا لتثبيت المعلومات.`, `${n} cartes révisées. Revenez demain !`)}</p><p><button class="mh-btn p" data-a="qquit">${T('رجوع', 'Retour')}</button></p></div>`; }
  return `<div class="mh-card mh-quiz"><div class="mh-qtop"><button class="mh-btn sm" data-a="qquit">✕</button><div class="mh-bar g"><i style="width:${f.i / f.q.length * 100}%"></i></div><b>${f.i + 1}/${f.q.length}</b></div>
  <div class="mh-flash"><p class="mh-q" style="margin:0">${esc(c.q)}</p>${f.show ? `<div class="mh-opt ok" style="justify-content:center"><span>${esc(c.c[c.a])}</span></div>${c.e ? `<div class="mh-expl" style="text-align:start">💡 ${esc(c.e)}</div>` : ''}` : `<button class="mh-btn p" data-a="reveal">${T('أظهر الإجابة', 'Voir la réponse')}</button>`}</div>
  ${f.show ? `<p style="text-align:center;margin:.8rem 0 .4rem;font-weight:700">${T('كيف كان تذكّرك؟', 'Comment était votre souvenir ?')}</p><div class="mh-rate"><button class="r1" data-a="rate" data-r="1">${T('نسيت', 'Oublié')}</button><button class="r2" data-a="rate" data-r="2">${T('صعب', 'Difficile')}</button><button class="r3" data-a="rate" data-r="3">${T('جيد', 'Bien')}</button><button class="r4" data-a="rate" data-r="4">${T('سهل', 'Facile')}</button></div>` : ''}</div>`;
}
async function mistakesHtml() {
  const d = data(), seen = new Set(), list = [];
  d.mistakes.slice().reverse().forEach(m => { const k = m.question; if (!seen.has(k)) { seen.add(k); list.push(m); } });
  if (!list.length) return `<div class="mh-card mh-empty"><b>🎉</b>${T('لا أخطاء مسجّلة — ممتاز! أنجز اختبارات لتتبّع نقاط ضعفك.', 'Aucune erreur enregistrée — bravo !')}</div>`;
  return `<div class="mh-h" style="margin-top:.8rem"><p>${T(`${list.length} سؤالًا أخطأت فيه`, `${list.length} questions manquées`)}</p><button class="mh-btn p" data-a="mretry">🔁 ${T('اختبر نفسك على أخطائي', 'Refaire mes erreurs')}</button></div><div style="display:grid;gap:.6rem">${list.slice(0, 30).map(m => `<div class="mh-review-q bad"><b>${esc(m.question)}</b><p style="margin-top:.3rem"><span style="color:var(--mh-red)">${T('اخترت', 'Choisi')}: ${esc(m.selected)}</span><br><span style="color:var(--mh-brand2)">${T('الصحيح', 'Correct')}: ${esc(m.correct)}</span></p></div>`).join('')}</div>`;
}

/* — المختبر والأطلس (يُحمَّل من masahati-lab.js) — */
VIEWS.lab = function () {
  const sub = S.sub.lab || 'exp';
  return `<div class="mh-h"><div><h3>🔬 ${T('المختبر الرقمي والأطلس المصوّر', 'Labo numérique & atlas illustré')}</h3><p>${T('جرّب، غيّر المتغيّرات، لاحظ النتائج، ثم أجب عن أسئلة الاستنتاج لتكسب نقاط الخبرة.', 'Manipulez, observez, concluez — et gagnez de l’XP.')}</p></div><a class="mh-btn sm" href="laboratory.html">${T('المختبر الموسّع', 'Labo complet')} ↗</a></div>
  <div class="mh-tabs" role="tablist">${[['exp', '🧪', 'تجارب تفاعلية', 'Expériences'], ['atlas', '🗺️', 'أطلس مصوّر', 'Atlas']].map(k => `<button role="tab" aria-selected="${sub === k[0]}" data-a="lsub" data-s="${k[0]}">${k[1]} ${T(k[2], k[3])}</button>`).join('')}</div><div id="mh-lab-body" style="margin-top:.8rem"><div class="mh-skel"></div></div>`;
};
function labMount() {
  const body = $('#mh-lab-body'); if (!body || !window.MasahatiLab) return;
  const L = levelInfo(), ps = PS();
  window.MasahatiLab.render(body, S.sub.lab || 'exp', {
    T, esc, lang, level: L.level, track: L.track, tracks: TRACK_NAMES,
    ran: id => ps.lab[id], seen: id => !!ps.atlas[id],
    complete: id => { const e = ps.lab[id] = ps.lab[id] || { n: 0 }; const first = !e.n; e.n++; e.t = Date.now(); savePS(); bump('lab'); afterAction(); updateSide(); toast(first ? '🔬 ' + T('+30 نقطة: تجربة منجزة!', '+30 XP : expérience terminée !') : '🔬 +5 XP'); },
    explore: id => { if (!ps.atlas[id]) { ps.atlas[id] = 1; savePS(); afterAction(); updateSide(); } }
  });
}

/* — مساري — */
VIEWS.me = async function () {
  const sub = S.sub.me || 'progress';
  const tabs = `<div class="mh-tabs" role="tablist">${[['progress', '📈', 'تقدّمي', 'Progression'], ['badges', '🏅', 'شاراتي', 'Badges'], ['notes', '🗒️', 'ملاحظاتي', 'Notes'], ['plan', '🗓️', 'خطة المراجعة', 'Planning'], ['settings', '⚙️', 'الإعدادات', 'Réglages']].map(k => `<button role="tab" aria-selected="${sub === k[0]}" data-a="msub" data-s="${k[0]}">${k[1]} ${T(k[2], k[3])}</button>`).join('')}</div>`;
  const d = data(), c = ctx();
  if (sub === 'progress') {
    const items = await loadIndex(), L = levelInfo();
    const bars = CATS.map(k => { const l = mine(items, k[0]), n = l.filter(i => status(i) === 'done').length, s = l.filter(i => status(i) !== 'new').length; return `<div><div class="mh-xp-row"><span>${k[1]} ${T(k[2], k[3])}</span><span>${n} ${T('مكتمل', 'terminés')} · ${s}/${l.length} ${T('مفتوح', 'ouverts')}</span></div><div class="mh-bar g"><i style="width:${l.length ? s / l.length * 100 : 0}%"></i></div></div>`; }).join('');
    const qs = await allQuizzes(), trend = d.quizResults.slice(-10).map(r => r.percentage), avg = d.quizResults.length ? Math.round(d.quizResults.reduce((s, r) => s + r.percentage, 0) / d.quizResults.length) : 0;
    const mastery = qs.map(q => ({ q, s: quizStats(q.path, d) })).filter(x => x.s.n).sort((a, b) => a.s.last - b.s.last);
    return tabs + `<div class="mh-grid two"><section class="mh-card"><div class="mh-h"><h3>${T('تقدّمي في المحتوى', 'Contenu parcouru')}</h3></div><div style="display:grid;gap:.8rem">${bars}</div></section>
    <section class="mh-card"><div class="mh-h"><h3>${T('تطوّر نتائج الاختبارات', 'Évolution des quiz')}</h3><span class="mh-chip">${T('المعدّل', 'Moyenne')} ${avg}%</span></div>${lineChart(trend)}</section></div>
    <section class="mh-card"><div class="mh-h"><h3>🎯 ${T('نقاط القوة والضعف', 'Forces & faiblesses')}</h3></div>${mastery.length ? `<div class="mh-grid">${mastery.map(x => `<div class="mh-mission"><div style="flex:1;min-width:0"><b style="font-size:.9rem">${esc(x.q.title)}</b><div class="mh-bar ${x.s.last >= 70 ? 'g' : ''}" style="margin-top:.3rem"><i style="width:${x.s.last}%;${x.s.last < 70 ? 'background:var(--mh-red)' : ''}"></i></div></div><b>${x.s.last}%</b></div>`).join('')}</div>` : `<p class="mh-empty">${T('ستظهر هنا نتائجك بعد أول اختبار.', 'Vos résultats apparaîtront après le premier quiz.')}</p>`}</section>`;
  }
  if (sub === 'badges') { const have = new Set(c.ps.badges); return tabs + `<div class="mh-badges" style="margin-top:.8rem">${BADGES.map(b => `<div class="mh-bdg ${have.has(b[0]) || b[6](c) ? '' : 'lock'}"><b>${b[1]}</b><strong>${T(b[2], b[3])}</strong><br><small>${T(b[4], b[5])}</small></div>`).join('')}</div>`; }
  if (sub === 'notes') {
    return tabs + `<section class="mh-card" style="margin-top:.8rem"><form data-form="note" style="display:grid;gap:.5rem"><input class="mh-input" name="title" maxlength="120" required placeholder="${T('عنوان الملاحظة', 'Titre')}"><textarea class="mh-input" name="body" rows="3" maxlength="5000" required placeholder="${T('اكتب ملاحظتك أو فكرتك أو سؤالك للأستاذ…', 'Votre note…')}"></textarea><div><button class="mh-btn p">${T('حفظ الملاحظة', 'Enregistrer')}</button></div></form></section>
    <div class="mh-grid" style="margin-top:.8rem">${d.notes.map(n => `<article class="mh-item"><h4>🗒️ ${esc(n.title)}</h4><p style="white-space:pre-wrap;color:var(--mh-soft);font-size:.9rem">${esc(n.body)}</p><div class="act"><small style="color:var(--mh-soft)">${new Date(n.updatedAt || n.createdAt).toLocaleDateString()}</small><button class="mh-btn sm warn" data-a="ndel" data-id="${esc(n.id)}" style="margin-inline-start:auto">🗑️</button></div></article>`).join('') || `<p class="mh-empty" style="grid-column:1/-1"><b>🗒️</b>${T('لا ملاحظات بعد.', 'Aucune note.')}</p>`}</div>`;
  }
  if (sub === 'plan') {
    const plan = d.studyPlan.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return tabs + `<section class="mh-card" style="margin-top:.8rem"><form data-form="plan" class="mh-tools"><input class="mh-input" name="title" maxlength="120" required placeholder="${T('ماذا ستراجع؟ (مثال: الوحدة 1 – التنفس)', 'Que réviser ?')}"><input class="mh-input" style="flex:0 1 160px" type="date" name="date" required value="${isoDay(today())}"><input class="mh-input" style="flex:0 1 110px" type="number" name="duration" min="5" max="600" value="30" aria-label="${T('المدة بالدقائق', 'Minutes')}"><button class="mh-btn p">${T('إضافة', 'Ajouter')}</button></form></section>
    <div style="display:grid;gap:.5rem;margin-top:.8rem">${plan.map(p => `<div class="mh-mission ${p.completed ? 'done' : ''}"><button class="ck" style="cursor:pointer;background:none" data-a="ptog" data-id="${esc(p.id)}" aria-label="toggle">${p.completed ? '✓' : ''}</button><span style="flex:1"><b>${esc(p.title)}</b> <small style="color:var(--mh-soft)">· ${esc(p.date)} · ${p.duration} ${T('د', 'min')}</small></span><button class="mh-btn sm warn" data-a="pdel" data-id="${esc(p.id)}">🗑️</button></div>`).join('') || `<p class="mh-empty"><b>🗓️</b>${T('ابنِ جدول مراجعتك: جلسات قصيرة منتظمة أفضل من ماراثون ليلة الامتحان.', 'Planifiez de courtes sessions régulières.')}</p>`}</div>`;
  }
  const ps = c.ps;
  return tabs + `<section class="mh-card" style="margin-top:.8rem;display:grid;gap:1rem"><div class="mh-ctl"><label for="mh-g">${T('هدف بطاقات المراجعة اليومي', 'Objectif quotidien de cartes')}<output>${ps.goalCards}</output></label><input id="mh-g" type="range" min="5" max="40" step="5" value="${ps.goalCards}" data-set="goalCards"></div>
  <div class="mh-ctl"><label for="mh-e">${T('تاريخ الامتحان الوطني (للعدّ التنازلي)', 'Date de l’examen national')}</label><input class="mh-input" id="mh-e" type="date" value="${esc(ps.exam)}" data-set="exam"></div>
  <div class="mh-tools"><button class="mh-btn" data-a="export">⬇️ ${T('تصدير بياناتي', 'Exporter mes données')}</button><button class="mh-btn warn" data-a="reset">${T('إعادة ضبط بطاقات المراجعة والتجارب', 'Réinitialiser cartes & labo')}</button><button class="mh-btn" data-a="legacy">${T('الواجهة القديمة', 'Ancienne interface')}</button></div>
  <p class="mh-info" style="font-size:.85rem">${T('تتزامن الدروس والاختبارات والملاحظات مع حسابك. بطاقات المراجعة والتجارب تُحفظ على جهازك، وتُزامَن أيضًا إذا فعّل مدير الموقع جدول student_platform_state.', 'Progression, quiz et notes sont synchronisés. Les cartes et expériences sont locales, sauf si la table student_platform_state est activée.')}</p></section>`;
};

/* ───────── الأحداث ───────── */
const ACT = {
  go: e => go(e.dataset.v),
  cat: e => { S.learn.cat = e.dataset.c; S.view = 'learn'; render(); },
  psub: e => { S.sub.practice = e.dataset.s; render(); }, msub: e => { S.sub.me = e.dataset.s; render(); }, lsub: e => { S.sub.lab = e.dataset.s; render(); },
  open: e => openItem(S.byPath.get(e.dataset.p)),
  done: e => { markDone(S.byPath.get(e.dataset.p)); render(); toast('✅ ' + T('أحسنت! سُجّل الإنجاز', 'Bravo ! Enregistré')); },
  quiz: async e => { try { startQuiz(await loadQuiz(e.dataset.p), 'practice'); } catch (x) { toast(T('تعذّر تحميل الاختبار', 'Quiz indisponible')); } },
  qstart: async e => { try { startQuiz(await loadQuiz(e.dataset.p), e.dataset.m); } catch (x) { toast(T('تعذّر تحميل الاختبار', 'Quiz indisponible')); } },
  ans: e => { const s = S.sess; if (!s || s.done) return; const j = +e.dataset.j; if (s.mode === 'practice' && s.ans[s.i] != null) return; s.ans[s.i] = j; render(); },
  qnext: () => { const s = S.sess; if (s.i < s.qs.length - 1) { s.i++; render(); } },
  qprev: () => { const s = S.sess; if (s.i > 0) { s.i--; render(); } },
  qflag: () => { const s = S.sess; s.flag[s.i] = !s.flag[s.i]; render(); },
  qfinish: () => { const s = S.sess; if (s.mode === 'exam') { const left = s.ans.filter(x => x == null).length; if (left && !confirm(T(`بقيت ${left} أسئلة بلا إجابة. إنهاء؟`, `${left} questions sans réponse. Terminer ?`))) return; } finishQuiz(); },
  qquit: () => { if (S.sess && !S.sess.done && !confirm(T('إنهاء الاختبار دون حفظ؟', 'Quitter sans enregistrer ?'))) return; leaveQuiz(); render(); },
  qretry: () => { const s = S.sess; startQuiz(s.quiz, 'practice', s.res.wrong.map(w => w.q)); },
  srs: () => { const q = dueCards().slice(0, 20); if (!q.length) return; S.flash = { q, i: 0, show: false, n: 0 }; S.busy = true; S.view = 'practice'; S.sub.practice = 'srs'; render(); },
  reveal: () => { S.flash.show = true; render(); },
  rate: e => { const f = S.flash, c = f.q[f.i]; rateCard(c.id, +e.dataset.r); if (+e.dataset.r === 1) f.q.push(c); f.n++; f.i++; f.show = false; render(); updateSide(); },
  seed: async () => { const ps = PS(); let n = 0; (await allQuizzes()).forEach(q => q.qs.forEach(x => { const id = hash(x.q); if (!ps.cards[id]) { ps.cards[id] = { id, q: x.q, c: x.c, a: x.a, e: x.e, src: x.src, box: 0, due: today(), n: 0 }; n++; } })); savePS(); toast(T(`أُضيفت ${n} بطاقة`, `${n} cartes ajoutées`)); render(); },
  mretry: async () => {
    const qs = await allQuizzes(), all = qs.flatMap(q => q.qs), seen = new Set(), custom = [];
    data().mistakes.slice().reverse().forEach(m => { if (seen.has(m.question)) return; seen.add(m.question); const f = all.find(x => x.q === m.question); custom.push(f || { q: m.question, c: [m.selected, m.correct].filter((v, i, a) => v && a.indexOf(v) === i), a: 0, e: '', src: m.quizId }); });
    if (custom.length) startQuiz({ path: 'mistakes-review', title: T('مراجعة أخطائي', 'Mes erreurs') }, 'practice', custom.map(x => x.c.length < 2 ? null : x).filter(Boolean).map(x => Object.assign({}, x, { a: x.c.indexOf(x.c[x.a]) })));
  },
  ndel: e => { const d = data(); d.notes = d.notes.filter(n => n.id !== e.dataset.id); SS().saveProfileData(pid(), d); cloudDel('deleteNote', e.dataset.id); render(); },
  ptog: e => { const d = data(), p = d.studyPlan.find(x => x.id === e.dataset.id); if (p) { p.completed = !p.completed; p.updatedAt = Date.now(); SS().saveProfileData(pid(), d); if (p.completed) { bump(); afterAction(); } } render(); },
  pdel: e => { const d = data(); d.studyPlan = d.studyPlan.filter(p => p.id !== e.dataset.id); SS().saveProfileData(pid(), d); cloudDel('deleteStudyPlanItem', e.dataset.id); render(); },
  export: () => { try { const b = new Blob([SS().exportProfileData(pid())], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'gosvt-mes-donnees.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (x) { toast(T('تعذّر التصدير', 'Export impossible')); } },
  reset: () => { if (!confirm(T('سيتم مسح بطاقات المراجعة وسجل التجارب. متابعة؟', 'Effacer cartes et expériences ?'))) return; const ps = PS(); ps.cards = {}; ps.lab = {}; ps.atlas = {}; ps.cardsTotal = 0; savePS(); render(); },
  legacy: () => { if (confirm(T('العودة للواجهة القديمة؟ يمكنك العودة للجديدة بتنظيف بيانات الموقع.', 'Revenir à l’ancienne interface ?'))) { localStorage.setItem('gosvt_legacy_space', '1'); location.reload(); } }
};
function cloudDel(m, id) { const u = cloudUid(); if (u && window.GoSVTCloud && GoSVTCloud[m]) Promise.resolve(GoSVTCloud[m](id, u)).catch(() => {}); }
function bindRoot(root) {
  root.addEventListener('click', ev => { const t = ev.target.closest('[data-a]'); if (!t || !root.contains(t)) return; const f = ACT[t.dataset.a]; if (f) { ev.preventDefault(); f(t); } });
  root.addEventListener('input', ev => {
    const t = ev.target; if (t.id === 'mh-q') { S.learn.q = t.value; clearTimeout(S._qt); S._qt = setTimeout(() => { render(); const q = document.getElementById('mh-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250); }
    if (t.dataset.set) { const ps = PS(); ps[t.dataset.set] = t.type === 'range' ? +t.value : t.value; const o = t.parentNode.querySelector('output'); if (o) o.textContent = t.value; savePS(); }
  });
  root.addEventListener('change', ev => { const t = ev.target; if (t.dataset.sel) { S.learn[t.dataset.sel] = t.value; render(); } });
  root.addEventListener('submit', ev => {
    const f = ev.target.closest('[data-form]'); if (!f) return; ev.preventDefault(); const fd = new FormData(f), d = data(), k = f.dataset.form;
    if (k === 'level') { const [l, tk] = String(fd.get('tk')).split('|'), ps = PS(); ps.lv = l; ps.tk = tk; savePS(); S.idx = null; render(); }
    if (k === 'note') { const now = Date.now(); d.notes.unshift({ id: uid(), title: String(fd.get('title')).trim().slice(0, 120), body: String(fd.get('body')).trim().slice(0, 5000), createdAt: now, updatedAt: now }); SS().saveProfileData(pid(), d); render(); toast('🗒️ ' + T('حُفظت الملاحظة', 'Note enregistrée')); }
    if (k === 'plan') { d.studyPlan.push({ id: uid(), title: String(fd.get('title')).trim().slice(0, 120), date: String(fd.get('date')), duration: Math.min(600, Math.max(5, +fd.get('duration') || 30)), completed: false, createdAt: Date.now(), updatedAt: Date.now() }); SS().saveProfileData(pid(), d); render(); }
  });
}
document.addEventListener('keydown', e => {
  const s = S.sess; if (!s || s.done || !document.querySelector('.mh-quiz') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (/^[1-9]$/.test(e.key) && +e.key <= s.qs[s.i].c.length) { const b = document.querySelector(`.mh-opt:nth-child(${e.key})`); if (b) b.click(); }
  else if (e.key === 'Enter') { const n = document.querySelector('[data-a=qnext]:not([disabled]),[data-a=qfinish]:not([disabled])'); if (n) n.click(); }
});
document.addEventListener('gosvt:progress-updated', () => { if (!S.busy && _root && _root.querySelector('.mh')) updateSide(); });

window.Masahati = { mount, refresh: () => { if (!S.busy) mountAgain(); } };
})();