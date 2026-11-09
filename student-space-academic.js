/* GO SVT Maroc — Personalize the learning path for each signed-in student. */
(function () {
    'use strict';

    const SECTION_IDS = ['cours', 'resumes', 'exercices', 'examens', 'quiz'];
    const TRACKS = {
        TC: ['TCS', 'TCL'],
        '1BAC': ['1BACSE', '1BACSM', '1BACL'],
        '2BAC': ['2BACSVT', '2BACSP', '2BACSM']
    };
    const TEXT = {
        ar: {
            missing: 'لم يتم العثور على المستوى والمسلك الدراسي المرتبطين بحسابك. يرجى التواصل مع إدارة المنصة لتحديث بيانات الحساب.',
            badge: 'مسارك الدراسي',
            level: 'المستوى',
            track: 'المسلك'
        },
        fr: {
            missing: 'Le niveau et la filière associés à votre compte sont introuvables. Veuillez contacter l’administration pour mettre à jour votre profil.',
            badge: 'Votre parcours',
            level: 'Niveau',
            track: 'Filière'
        }
    };

    let applying = false;
    let timer = null;
    let observer = null;
    let lastKey = '';

    function account() {
        if (!window.StudentAccount || !window.StudentAccount.isLoggedIn()) return null;
        return window.StudentAccount.getProfile ? window.StudentAccount.getProfile() : null;
    }

    function academicProfile() {
        const p = account();
        if (!p) return null;
        const level = String(p.study_level || '').toUpperCase();
        const track = String(p.study_track || '').toUpperCase();
        if (!TRACKS[level] || !TRACKS[level].includes(track)) return null;
        return { level, track };
    }

    function language() {
        return document.documentElement.lang === 'fr' ? 'fr' : 'ar';
    }

    function showNotice(message) {
        const root = document.getElementById('student-space-content');
        if (!root) return;
        let notice = root.querySelector('.gs-academic-notice');
        if (!notice) {
            notice = document.createElement('p');
            notice.className = 'gs-academic-notice';
            notice.setAttribute('role', 'status');
            const heading = root.querySelector('.section-title');
            if (heading && heading.parentNode) heading.parentNode.insertBefore(notice, heading.nextSibling);
            else root.prepend(notice);
        }
        notice.textContent = message;
    }

    function updateStudentSpaceBanner(profile) {
        const root = document.getElementById('student-space-content');
        if (!root) return;
        const dashboard = root.querySelector('#panel-dashboard .dashboard-header');
        if (!dashboard) return;
        const academicNames = {
            TCS: ['الجذع المشترك العلمي', 'Tronc commun scientifique'],
            TCL: ['الجذع المشترك الأدبي', 'Tronc commun lettres'],
            '1BACSE': ['الأولى باكالوريا - علوم تجريبية', '1ère Bac - Sciences expérimentales'],
            '1BACSM': ['الأولى باكالوريا - علوم رياضية', '1ère Bac - Sciences mathématiques'],
            '1BACL': ['الأولى باكالوريا - آداب', '1ère Bac - Lettres'],
            '2BACSVT': ['الثانية باكالوريا - علوم الحياة والأرض', '2ème Bac - SVT'],
            '2BACSP': ['الثانية باكالوريا - علوم فيزيائية', '2ème Bac - Sciences physiques'],
            '2BACSM': ['الثانية باكالوريا - علوم رياضية', '2ème Bac - Sciences mathématiques']
        };
        const name = academicNames[profile.track][language() === 'ar' ? 0 : 1];
        let badge = root.querySelector('.gs-academic-profile');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'gs-academic-profile';
            dashboard.insertAdjacentElement('afterend', badge);
        }
        const t = TEXT[language()];
        const markup = '<span>🎓 ' + t.badge + '</span><strong>' + name + '</strong><small>' +
            t.level + ': ' + profile.level + ' · ' + t.track + ': ' + profile.track + '</small>';
        if (badge.innerHTML !== markup) badge.innerHTML = markup;
    }

    function setTrack(section, profile) {
        const bar = section.querySelector('.gs-track-tabs');
        if (!bar) return false;
        const own = bar.querySelector('.gs-track-btn[data-track="' + profile.track + '"]');
        if (!own) return false;
        const active = bar.querySelector('.gs-track-btn.active');
        if (!active || active.dataset.track !== profile.track) {
            applying = true;
            own.click();
            applying = false;
        }
        bar.querySelectorAll('.gs-track-btn').forEach(button => {
            const allowed = button.dataset.track === profile.track;
            button.hidden = !allowed;
            button.setAttribute('aria-hidden', allowed ? 'false' : 'true');
        });
        const label = bar.querySelector('.gs-track-label');
        if (label) label.hidden = true;
        return true;
    }

    function lockSection(section, profile) {
        const levelButton = section.querySelector('.level-tab-btn[data-level="' + profile.level + '"]');
        if (!levelButton) return false;
        const selected = levelButton.classList.contains('active');
        if (!selected) {
            applying = true;
            levelButton.click();
            applying = false;
        }
        section.querySelectorAll('.level-tab-btn').forEach(button => {
            const allowed = button.dataset.level === profile.level;
            button.hidden = !allowed;
            button.setAttribute('aria-hidden', allowed ? 'false' : 'true');
        });
        return setTrack(section, profile);
    }

    function restorePublicNavigation() {
        SECTION_IDS.forEach(id => {
            const section = document.getElementById(id);
            if (!section) return;
            section.querySelectorAll('.level-tab-btn, .gs-track-btn, .gs-track-label').forEach(button => {
                button.hidden = false;
                button.removeAttribute('aria-hidden');
            });
        });
        document.body.classList.remove('gs-academic-locked');
        const root = document.getElementById('student-space-content');
        if (root) {
            const badge = root.querySelector('.gs-academic-profile');
            const notice = root.querySelector('.gs-academic-notice');
            if (badge) badge.remove();
            if (notice) notice.remove();
        }
        lastKey = '';
    }

    function apply() {
        timer = null;
        const p = account();
        if (!p) {
            restorePublicNavigation();
            return;
        }
        const profile = academicProfile();
        if (!profile) {
            showNotice(TEXT[language()].missing);
            return;
        }

        const key = profile.level + ':' + profile.track;
        document.body.classList.add('gs-academic-locked');
        updateStudentSpaceBanner(profile);

        // Re-apply only when the account or selected path changes. A later
        // mutation pass still locks controls created asynchronously by pathways.js.
        SECTION_IDS.forEach(id => {
            const section = document.getElementById(id);
            if (section) lockSection(section, profile);
        });
        lastKey = key;
    }

    function schedule() {
        if (timer !== null) return;
        timer = window.setTimeout(apply, 120);
    }

    document.addEventListener('click', function (event) {
        if (applying || !account()) return;
        const level = event.target.closest && event.target.closest('.level-tab-btn');
        if (level && SECTION_IDS.includes(level.closest('.section')?.id)) {
            const profile = academicProfile();
            if (profile && level.dataset.level !== profile.level) {
                event.preventDefault();
                event.stopImmediatePropagation();
                schedule();
            }
            return;
        }
        const track = event.target.closest && event.target.closest('.gs-track-btn');
        if (track && SECTION_IDS.includes(track.closest('.section')?.id)) {
            const profile = academicProfile();
            if (profile && track.dataset.track !== profile.track) {
                event.preventDefault();
                event.stopImmediatePropagation();
                schedule();
            }
        }
    }, true);

    document.addEventListener('gosvt:auth-changed', schedule);
    document.addEventListener('click', function (event) {
        if (event.target.closest && event.target.closest('.lang-switcher')) schedule();
    });
    window.addEventListener('hashchange', schedule);

    function init() {
        const root = document.getElementById('student-space-content');
        if (root && !observer) {
            observer = new MutationObserver(schedule);
            observer.observe(root, { childList: true, subtree: true });
        }
        SECTION_IDS.forEach(id => {
            const section = document.getElementById(id);
            if (section && !section._gsAcademicObserver) {
                const watch = new MutationObserver(schedule);
                watch.observe(section, { childList: true, subtree: true });
                section._gsAcademicObserver = watch;
            }
        });
        schedule();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
