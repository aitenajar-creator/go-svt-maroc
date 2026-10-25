/* Go SVT Maroc - قائمتي (المفضلة) - ملف مستقل */
(function () {
    var KEY = 'gosvt_favs';
    var T = {
        ar: { add: '☆ حفظ', added: '★ محفوظ', empty: 'لم تحفظ أي ملف بعد. تنقّل إلى الدروس أو الامتحانات واضغط ☆ لحفظه هنا.', open: '📥 فتح', remove: '🗑️ حذف' },
        fr: { add: '☆ Garder', added: '★ Gardé', empty: "Aucun fichier gardé. Parcourez les cours ou examens et cliquez sur ☆.", open: '📥 Ouvrir', remove: '🗑️ Retirer' }
    };
    function lang() { return document.documentElement.getAttribute('lang') === 'fr' ? 'fr' : 'ar'; }
    function all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
    function saveList(a) { localStorage.setItem(KEY, JSON.stringify(a)); }
    function has(url) { return all().some(function (f) { return f.url === url; }); }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function toggle(url, title) {
        var a = all();
        if (has(url)) { a = a.filter(function (f) { return f.url !== url; }); }
        else { a.unshift({ url: url, title: title, added: Date.now() }); }
        saveList(a); refreshCardButtons(); renderList();
    }

    /* أنماط الأزرار */
    var st = document.createElement('style');
    st.textContent = '.fav-btn{margin-top:.75rem;background:#f2f7f2;color:#2c5f2d;border:1px solid rgba(44,95,45,.2);border-radius:8px;padding:.45rem .9rem;font-family:inherit;font-weight:600;cursor:pointer;font-size:.9rem;transition:all .2s}'
        + '.fav-btn:hover{background:#2c5f2d;color:#fff}'
        + '.fav-btn.on{background:#ffc107;color:#333;border-color:#ffc107}'
        + '.fav-remove{background:none;border:none;color:#c0392b;cursor:pointer;font-family:inherit;font-weight:600;margin-top:.5rem;font-size:.85rem}';
    document.head.appendChild(st);

    /* إضافة زر النجمة لكل بطاقة محتوى */
    function refreshCardButtons() {
        document.querySelectorAll('.content-card').forEach(function (card) {
            var link = card.querySelector('a.download-btn') || card.querySelector('a[target="_blank"]');
            if (!link) return;
            var btn = card.querySelector('.fav-btn');
            if (!btn) { btn = document.createElement('button'); btn.className = 'fav-btn'; card.appendChild(btn); }
            var on = has(link.getAttribute('href'));
            btn.dataset.url = link.getAttribute('href');
            var h = card.querySelector('h3');
            btn.dataset.title = h ? h.textContent.trim() : link.getAttribute('href');
            btn.classList.toggle('on', on);
            btn.textContent = on ? T[lang()].added : T[lang()].add;
        });
    }

    var deb;
    new MutationObserver(function () { clearTimeout(deb); deb = setTimeout(refreshCardButtons, 200); })
        .observe(document.body, { childList: true, subtree: true });
    refreshCardButtons(); renderList();

    /* النقرات */
    document.addEventListener('click', function (e) {
        var b = e.target.closest('.fav-btn');
        if (b) { toggle(b.dataset.url, b.dataset.title); return; }
        var r = e.target.closest('.fav-remove');
        if (r) { toggle(r.dataset.url, r.dataset.title); }
    });

    /* عرض قائمتي */
    function renderList() {
        var box = document.getElementById('favorisList');
        if (!box) return;
        var a = all(), t = T[lang()];
        box.innerHTML = a.length
            ? a.map(function (f) {
                return '<div class="content-card"><h3>' + esc(f.title) + '</h3>'
                    + '<a href="' + esc(f.url) + '" target="_blank" rel="noopener" class="download-btn">' + t.open + '</a><br>'
                    + '<button class="fav-remove" data-url="' + esc(f.url) + '">' + t.remove + '</button></div>';
            }).join('')
            : '<p class="no-files">' + t.empty + '</p>';
    }

    /* التنقل إلى الأقسام الجديدة (مستقل عن script.js) */
    function show(id) {
        document.querySelectorAll('.section').forEach(function (s) { s.classList.remove('active'); });
        var sec = document.getElementById(id);
        if (sec) sec.classList.add('active');
        document.querySelectorAll('.main-nav a').forEach(function (l) {
            l.classList.toggle('active', l.getAttribute('href') === '#' + id);
        });
        var nav = document.querySelector('.main-nav'); if (nav) nav.classList.remove('active');
        window.scrollTo(0, 0);
        if (id === 'favoris') renderList();
    }
    document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href="#favoris"],a[href="#notes"],a[href="#quiz"]');
        if (!a) return;
        e.preventDefault(); e.stopPropagation();
        show(a.getAttribute('href').substring(1));
    }, true);

    /* إعادة العرض عند تبديل اللغة */
    var langBtn = document.querySelector('.lang-switcher');
    if (langBtn) langBtn.addEventListener('click', function () {
        setTimeout(function () { refreshCardButtons(); renderList(); }, 80);
    });
})();
