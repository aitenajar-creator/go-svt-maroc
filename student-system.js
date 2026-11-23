// student-system.js - نظام الطلاب والتتبع
(() => {
  'use strict';

  const Storage = {
    get(key, defaultValue = null) {
      try {
        const data = localStorage.getItem(`gsvt_${key}`);
        return data ? JSON.parse(data) : defaultValue;
      } catch (e) { return defaultValue; }
    },
    set(key, value) {
      try {
        localStorage.setItem(`gsvt_${key}`, JSON.stringify(value));
        return true;
      } catch (e) { return false; }
    },
    remove(key) { localStorage.removeItem(`gsvt_${key}`); }
  };

  class StudentAuth {
    constructor() {
      this.currentUser = Storage.get('current_user', null);
      this.students = Storage.get('students', []);
    }

    register(name, email, level, password) {
      if (this.students.find(s => s.email === email)) {
        return { success: false, message: 'البريد الإلكتروني مسجل مسبقاً' };
      }
      const student = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        level: level,
        password: btoa(password),
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        progress: {
          completedLabs: [],
          quizScores: {},
          achievements: [],
          studyStreak: 0,
          lastStudyDate: null
        }
      };
      this.students.push(student);
      Storage.set('students', this.students);
      this.currentUser = student;
      Storage.set('current_user', student);
      return { success: true, student };
    }

    login(email, password) {
      const student = this.students.find(
        s => s.email === email.toLowerCase() && s.password === btoa(password)
      );
      if (!student) {
        return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }
      student.lastActive = new Date().toISOString();
      Storage.set('students', this.students);
      this.currentUser = student;
      Storage.set('current_user', student);
      return { success: true, student };
    }

    logout() {
      this.currentUser = null;
      Storage.remove('current_user');
    }

    updateProfile(updates) {
      if (!this.currentUser) return false;
      Object.assign(this.currentUser, updates);
      const index = this.students.findIndex(s => s.id === this.currentUser.id);
      if (index !== -1) {
        this.students[index] = this.currentUser;
        Storage.set('students', this.students);
        Storage.set('current_user', this.currentUser);
      }
      return true;
    }

    isLoggedIn() { return this.currentUser !== null; }
    getCurrentUser() { return this.currentUser; }
  }

  class ProgressTracker {
    constructor(auth) { this.auth = auth; }

    saveLabProgress(labId, score, completed = true) {
      if (!this.auth.isLoggedIn()) return false;
      const student = this.auth.getCurrentUser();
      student.progress.quizScores[labId] = {
        labId, score, completed,
        completedAt: new Date().toISOString(),
        attempts: (student.progress.quizScores[labId]?.attempts || 0) + 1
      };
      if (completed && !student.progress.completedLabs.includes(labId)) {
        student.progress.completedLabs.push(labId);
      }
      this.updateStudyStreak(student);
      this.auth.updateProfile({ progress: student.progress });
      return true;
    }

    updateStudyStreak(student) {
      const today = new Date().toDateString();
      const lastDate = student.progress.lastStudyDate
        ? new Date(student.progress.lastStudyDate).toDateString() : null;
      if (lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate === yesterday.toDateString()) {
          student.progress.studyStreak++;
        } else {
          student.progress.studyStreak = 1;
        }
        student.progress.lastStudyDate = new Date().toISOString();
      }
    }

    getStats() {
      if (!this.auth.isLoggedIn()) return null;
      const student = this.auth.getCurrentUser();
      const p = student.progress;
      const scores = Object.values(p.quizScores).filter(s => s.completed).map(s => s.score);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return {
        completedLabs: p.completedLabs.length,
        totalLabs: 25,
        completionRate: Math.round((p.completedLabs.length / 25) * 100),
        averageScore: avg,
        studyStreak: p.studyStreak,
        achievements: p.achievements.length,
        level: student.level
      };
    }

    isLabCompleted(labId) {
      if (!this.auth.isLoggedIn()) return false;
      return this.auth.getCurrentUser().progress.completedLabs.includes(labId);
    }
  }

  class AchievementSystem {
    constructor(auth, tracker) {
      this.auth = auth;
      this.tracker = tracker;
      this.achievements = [
        { id: 'first_lab', title: { ar: 'أول خطوة', fr: 'Premier pas' }, description: { ar: 'أكمل أول مختبر تفاعلي', fr: 'Compléter le premier laboratoire' }, icon: '🔬', condition: s => s.completedLabs >= 1 },
        { id: 'five_labs', title: { ar: 'مستكشف', fr: 'Explorateur' }, description: { ar: 'أكمل 5 مختبرات', fr: 'Compléter 5 laboratoires' }, icon: '🧪', condition: s => s.completedLabs >= 5 },
        { id: 'perfect_score', title: { ar: 'علامة كاملة', fr: 'Score parfait' }, description: { ar: 'احصل على 100% في أي اختبار', fr: 'Obtenir 100% dans un quiz' }, icon: '🏆', condition: s => s.averageScore === 100 },
        { id: 'streak_7', title: { ar: 'ملتزم', fr: 'Régulier' }, description: { ar: 'ادرس 7 أيام متتالية', fr: 'Étudier 7 jours consécutifs' }, icon: '🔥', condition: s => s.studyStreak >= 7 },
        { id: 'half_way', title: { ar: 'نصف الطريق', fr: 'Mi-chemin' }, description: { ar: 'أكمل نصف المختبرات', fr: 'Compléter la moitié des laboratoires' }, icon: '⭐', condition: s => s.completionRate >= 50 },
        { id: 'master', title: { ar: 'خبير SVT', fr: 'Expert SVT' }, description: { ar: 'أكمل جميع المختبرات', fr: 'Compléter tous les laboratoires' }, icon: '🎓', condition: s => s.completionRate === 100 }
      ];
    }

    checkAchievements() {
      if (!this.auth.isLoggedIn()) return [];
      const student = this.auth.getCurrentUser();
      const stats = this.tracker.getStats();
      const newAchievements = [];
      this.achievements.forEach(a => {
        if (!student.progress.achievements.includes(a.id) && a.condition(stats)) {
          student.progress.achievements.push(a.id);
          newAchievements.push(a);
        }
      });
      if (newAchievements.length > 0) {
        this.auth.updateProfile({ progress: student.progress });
      }
      return newAchievements;
    }

    getAllAchievements() {
      if (!this.auth.isLoggedIn()) return [];
      const student = this.auth.getCurrentUser();
      return this.achievements.map(a => ({
        ...a,
        earned: student.progress.achievements.includes(a.id)
      }));
    }
  }

  class StudentUI {
    constructor(auth, tracker, achievements) {
      this.auth = auth;
      this.tracker = tracker;
      this.achievements = achievements;
    }

    createAuthModal() {
      const modal = document.createElement('div');
      modal.className = 'gsvt-auth-modal';
      modal.innerHTML = `
        <div class="gsvt-auth-container">
          <button class="gsvt-auth-close" aria-label="إغلاق">×</button>
          <div class="gsvt-auth-header">
            <h2>Go SVT Maroc</h2>
            <p>مختبر علوم الحياة والأرض</p>
          </div>
          <div class="gsvt-auth-tabs">
            <button class="gsvt-auth-tab active" data-tab="login">تسجيل الدخول</button>
            <button class="gsvt-auth-tab" data-tab="register">حساب جديد</button>
          </div>
          <form class="gsvt-auth-form" id="gsvt-login-form">
            <div class="gsvt-form-group">
              <label>البريد الإلكتروني</label>
              <input type="email" name="email" required placeholder="example@email.com">
            </div>
            <div class="gsvt-form-group">
              <label>كلمة المرور</label>
              <input type="password" name="password" required placeholder="••••••••">
            </div>
            <button type="submit" class="gsvt-btn-primary">دخول</button>
            <div class="gsvt-auth-message"></div>
          </form>
          <form class="gsvt-auth-form hidden" id="gsvt-register-form">
            <div class="gsvt-form-group">
              <label>الاسم الكامل</label>
              <input type="text" name="name" required placeholder="محمد العلوي">
            </div>
            <div class="gsvt-form-group">
              <label>البريد الإلكتروني</label>
              <input type="email" name="email" required placeholder="example@email.com">
            </div>
            <div class="gsvt-form-group">
              <label>المستوى</label>
              <select name="level" required>
                <option value="">اختر المستوى</option>
                <option value="TC">جذع مشترك</option>
                <option value="1BAC">أولى باكالوريا</option>
                <option value="2BAC">ثانية باكالوريا</option>
              </select>
            </div>
            <div class="gsvt-form-group">
              <label>كلمة المرور</label>
              <input type="password" name="password" required placeholder="••••••••" minlength="6">
            </div>
            <button type="submit" class="gsvt-btn-primary">إنشاء حساب</button>
            <div class="gsvt-auth-message"></div>
          </form>
        </div>`;
      document.body.appendChild(modal);
      this.setupAuthEvents(modal);
      return modal;
    }

    setupAuthEvents(modal) {
      modal.querySelectorAll('.gsvt-auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          modal.querySelectorAll('.gsvt-auth-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const tabName = tab.dataset.tab;
          modal.querySelectorAll('.gsvt-auth-form').forEach(form => {
            form.classList.toggle('hidden', form.id !== `gsvt-${tabName}-form`);
          });
        });
      });
      modal.querySelector('.gsvt-auth-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

      document.getElementById('gsvt-login-form').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const result = this.auth.login(fd.get('email'), fd.get('password'));
        const msg = e.target.querySelector('.gsvt-auth-message');
        if (result.success) {
          msg.textContent = 'تم تسجيل الدخول بنجاح!';
          msg.className = 'gsvt-auth-message success';
          setTimeout(() => { modal.remove(); this.updateUI(); }, 1000);
        } else {
          msg.textContent = result.message;
          msg.className = 'gsvt-auth-message error';
        }
      });

      document.getElementById('gsvt-register-form').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const result = this.auth.register(fd.get('name'), fd.get('email'), fd.get('level'), fd.get('password'));
        const msg = e.target.querySelector('.gsvt-auth-message');
        if (result.success) {
          msg.textContent = 'تم إنشاء الحساب بنجاح!';
          msg.className = 'gsvt-auth-message success';
          setTimeout(() => { modal.remove(); this.updateUI(); }, 1000);
        } else {
          msg.textContent = result.message;
          msg.className = 'gsvt-auth-message error';
        }
      });
    }

    updateUI() {
      if (this.auth.isLoggedIn()) this.showDashboard();
      else this.showLoginButton();
    }

    showLoginButton() {
      let btn = document.getElementById('gsvt-auth-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'gsvt-auth-btn';
        btn.className = 'gsvt-auth-btn';
        btn.textContent = 'تسجيل الدخول';
        const actions = document.querySelector('.header-actions');
        if (actions) actions.appendChild(btn);
        btn.addEventListener('click', () => this.createAuthModal());
      }
    }

    showDashboard() {
      const stats = this.tracker.getStats();
      const achievements = this.achievements.getAllAchievements();
      let dashboard = document.getElementById('gsvt-dashboard');
      if (!dashboard) {
        dashboard = document.createElement('div');
        dashboard.id = 'gsvt-dashboard';
        dashboard.className = 'gsvt-dashboard';
        const main = document.querySelector('main');
        if (main) main.prepend(dashboard);
      }
      dashboard.innerHTML = `
        <div class="gsvt-dashboard-header">
          <h2>مرحباً ${this.auth.getCurrentUser().name}! 👋</h2>
          <button class="gsvt-logout-btn" id="gsvt-logout">تسجيل الخروج</button>
        </div>
        <div class="gsvt-stats-grid">
          <div class="gsvt-stat-card">
            <div class="gsvt-stat-icon">📚</div>
            <div class="gsvt-stat-value">${stats.completedLabs}/${stats.totalLabs}</div>
            <div class="gsvt-stat-label">مختبر مكتمل</div>
          </div>
          <div class="gsvt-stat-card">
            <div class="gsvt-stat-icon">🎯</div>
            <div class="gsvt-stat-value">${stats.averageScore}%</div>
            <div class="gsvt-stat-label">متوسط النتائج</div>
          </div>
          <div class="gsvt-stat-card">
            <div class="gsvt-stat-icon">🔥</div>
            <div class="gsvt-stat-value">${stats.studyStreak}</div>
            <div class="gsvt-stat-label">يوم متتالي</div>
          </div>
          <div class="gsvt-stat-card">
            <div class="gsvt-stat-icon">🏆</div>
            <div class="gsvt-stat-value">${stats.achievements}</div>
            <div class="gsvt-stat-label">إنجاز محقق</div>
          </div>
        </div>
        <div class="gsvt-progress-section">
          <h3>تقدمك في ${stats.level}</h3>
          <div class="gsvt-progress-bar">
            <div class="gsvt-progress-fill" style="width: ${stats.completionRate}%"></div>
          </div>
          <p>${stats.completionRate}% مكتمل</p>
        </div>
        <div class="gsvt-achievements-section">
          <h3>الإنجازات</h3>
          <div class="gsvt-achievements-grid">
            ${achievements.map(a => `
              <div class="gsvt-achievement-card ${a.earned ? 'earned' : 'locked'}">
                <div class="gsvt-achievement-icon">${a.icon}</div>
                <div class="gsvt-achievement-info">
                  <strong>${a.title.ar}</strong>
                  <small>${a.description.ar}</small>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
      document.getElementById('gsvt-logout')?.addEventListener('click', () => {
        this.auth.logout();
        dashboard.remove();
        this.showLoginButton();
      });
    }
  }

  function getCurrentLabId() {
    const url = window.location.pathname;
    if (url.includes('cell')) return 'cell_lab';
    if (url.includes('genetics')) return 'genetics_lab';
    if (url.includes('photosynthesis')) return 'photosynthesis_lab';
    if (url.includes('geology')) return 'geology_lab';
    if (url.includes('ecology')) return 'ecology_lab';
    return 'unknown_lab';
  }

  function showAchievementNotification(newAchievements) {
    newAchievements.forEach(a => {
      const n = document.createElement('div');
      n.className = 'gsvt-achievement-notification';
      n.innerHTML = `
        <div class="gsvt-notification-content">
          <div class="gsvt-notification-icon">${a.icon}</div>
          <div class="gsvt-notification-text">
            <strong>إنجاز جديد!</strong>
            <p>${a.title.ar}</p>
          </div>
        </div>`;
      document.body.appendChild(n);
      setTimeout(() => n.classList.add('show'), 100);
      setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 4000);
    });
  }

  const auth = new StudentAuth();
  const tracker = new ProgressTracker(auth);
  const achievements = new AchievementSystem(auth, tracker);
  const ui = new StudentUI(auth, tracker, achievements);

  if (auth.isLoggedIn()) ui.showDashboard();
  else ui.showLoginButton();

  window.GoSVT = { auth, tracker, achievements, ui };
  // التكامل مع المختبرات
function integrateWithLabs(auth, tracker, achievements) {
  // مراقبة إكمال الاختبارات
  const originalAlert = window.alert;
  window.alert = function(message) {
    if (message.includes('ممتاز') || message.includes('Excellent') || 
        message.includes('نتيجتك') || message.includes('Votre résultat')) {
      const scoreMatch = message.match(/(\d+)\s*(?:\/|sur)\s*(\d+)/);
      if (scoreMatch) {
        const score = Math.round((parseInt(scoreMatch[1]) / parseInt(scoreMatch[2])) * 100);
        const labId = getCurrentLabId();
        tracker.saveLabProgress(labId, score, true);
        const newAchievements = achievements.checkAchievements();
        if (newAchievements.length > 0) {
          showAchievementNotification(newAchievements);
        }
      }
    }
    return originalAlert.apply(this, arguments);
  };
}

integrateWithLabs(auth, tracker, achievements);
})();
