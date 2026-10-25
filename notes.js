/* Go SVT Maroc - ملاحظاتي - تُحفظ في متصفح الطالب */
(function () {
    var pad = document.getElementById('notesPad');
    if (!pad) return;
    var KEY = 'gosvt_notes';
    var fr = document.documentElement.getAttribute('lang') === 'fr';
    pad.placeholder = fr ? '✍️ Écrivez vos notes ici...' : '✍️ اكتب ملاحظاتك هنا...';
    pad.value = localStorage.getItem(KEY) || '';

    var t, status = document.getElementById('notesStatus');
    pad.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
            localStorage.setItem(KEY, pad.value);
            if (status) { status.style.opacity = '1'; setTimeout(function () { status.style.opacity = '.55'; }, 1200); }
        }, 400);
    });
})();
