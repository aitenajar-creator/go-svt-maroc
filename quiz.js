/* Go SVT Maroc - اختبار تفاعلي - 2BAC SVT */
(function () {
    var box = document.getElementById('quizBox');
    if (!box) return;

    /* ✏️ لإضافة أسئلة: انسخ سطرًا وعدّله. a = رقم الإجابة الصحيحة (يبدأ من 0) */
    var Q = [
        { q: "Quel organite est le siège de la photosynthèse ?", o: ["La mitochondrie", "Le chloroplaste", "Le noyau", "Le ribosome"], a: 1 },
        { q: "Quelle molécule transporte l'oxygène dans le sang ?", o: ["L'hémoglobine", "L'insuline", "Le glycogène", "L'amidon"], a: 0 },
        { q: "Les anticorps sont produits par :", o: ["Les globules rouges", "Les plaquettes", "Les plasmocytes", "Les ostéocytes"], a: 2 },
        { q: "Les lymphocytes T cytotoxiques agissent en :", o: ["Produisant des anticorps", "Détruisant les cellules infectées", "Phagocytant les bactéries", "Libérant l'histamine"], a: 1 },
        { q: "La lithosphère est constituée par :", o: ["La croûte seulement", "Le noyau", "La croûte et le manteau supérieur rigide", "L'asthénosphère"], a: 2 },
        { q: "La division qui réduit de moitié le nombre de chromosomes :", o: ["La mitose", "La méiose", "L'apoptose", "La cytodiérèse"], a: 1 }
    ];

    var st = document.createElement('style');
    st.textContent = '.quiz-q{background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);padding:1.25rem;margin-bottom:1rem;border-right:4px solid #2c5f2d}'
        + '.quiz-q h3{color:#2c5f2d;margin-bottom:.75rem;font-size:1.05rem}'
        + '.quiz-opts{display:flex;flex-wrap:wrap;gap:.5rem}'
        + '.quiz-opt{border:2px solid #2c5f2d;background:#fff;color:#2c5f2d;border-radius:8px;padding:.45rem .9rem;font-family:inherit;font-weight:600;cursor:pointer;font-size:.9rem;transition:all .2s}'
        + '.quiz-opt:hover{background:#2c5f2d;color:#fff}'
        + '.quiz-opt.correct{background:#2c5f2d!important;color:#fff!important;border-color:#2c5f2d!important}'
        + '.quiz-opt.wrong{background:#dc3545!important;color:#fff!important;border-color:#dc3545!important}'
        + '.quiz-done .quiz-opt{pointer-events:none;opacity:.7}'
        + '.quiz-done .quiz-opt.correct{opacity:1}';
    document.head.appendChild(st);

    var score = 0, answered = 0;

    function render() {
        score = 0; answered = 0;
        box.innerHTML = Q.map(function (it, i) {
            return '<div class="quiz-q" data-i="' + i + '"><h3>' + (i + 1) + '. ' + it.q + '</h3><div class="quiz-opts">'
                + it.o.map(function (o, j) { return '<button class="quiz-opt" data-i="' + i + '" data-j="' + j + '">' + o + '</button>'; }).join('')
                + '</div></div>';
        }).join('') + '<div id="quizResult"></div>';
    }

    box.addEventListener('click', function (e) {
        if (e.target.id === 'quizRestart') { render(); return; }
        var b = e.target.closest('.quiz-opt');
        if (!b) return;
        var wrap = box.querySelector('.quiz-q[data-i="' + b.dataset.i + '"]');
        if (!wrap || wrap.classList.contains('quiz-done')) return;
        wrap.classList.add('quiz-done');
        var ok = +b.dataset.j === Q[+b.dataset.i].a;
        if (ok) score++;
        b.classList.add(ok ? 'correct' : 'wrong');
        wrap.querySelectorAll('.quiz-opt')[Q[+b.dataset.i].a].classList.add('correct');
        answered++;
        if (answered === Q.length) {
            var msg = score === Q.length ? '🌟 ممتاز! / Excellent !'
                : score >= Q.length / 2 ? '👍 جيد، واصل المراجعة / Bien, continuez !'
                : '📚 راجع الدروس ثم أعد المحاولة / Révisez puis réessayez !';
            document.getElementById('quizResult').innerHTML =
                '<div class="quiz-q" style="text-align:center"><h3 style="font-size:1.6rem">' + score + ' / ' + Q.length + '</h3><p>' + msg + '</p><button class="quiz-opt" id="quizRestart">🔄 إعادة / Recommencer</button></div>';
        }
    });

    render();
})();
