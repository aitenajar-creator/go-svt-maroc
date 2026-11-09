/* Go SVT Maroc — Supabase public client configuration.
 * Publishable key is intended for browser use. Never put service_role/secret keys here.
 */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://faztvkeyrxvmjzzfuyiu.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qtKVH-L5ewYNd-0je_7YtA_yMOdgrKb';
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[GoSVT] Supabase JS library did not load.');
    window.GoSVTAuthConfigError = 'تعذر تحميل مكتبة الاتصال بـ Supabase.';
    return;
  }
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();

/* Go SVT Cloud Data: progress, notes and study planner */
(function () {
  'use strict';
  const client = window.supabaseClient;
  if (!client) return;

  async function authenticatedStudentId(expectedStudentId) {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    const actualStudentId = data && data.user ? data.user.id : null;
    // A delayed request from a previous account must never read or write for the new account.
    if (expectedStudentId && actualStudentId !== expectedStudentId) return null;
    return actualStudentId;
  }

  function parseNoteRow(row) {
    let value = {};
    try { value = JSON.parse(row.note); } catch (_) { value = { body: row.note }; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = { body: String(row.note || '') };
    return {
      id: String(value.id || row.content_key),
      title: String(value.title || '').slice(0, 120),
      body: String(value.body || '').slice(0, 5000),
      createdAt: Number(value.createdAt) || Date.parse(row.updated_at) || Date.now(),
      updatedAt: Number(value.updatedAt) || Date.parse(row.updated_at) || Date.now()
    };
  }

  function parsePlanRow(row) {
    return {
      id: String(row.item_key),
      title: String(row.title || '').slice(0, 120),
      date: String(row.scheduled_date || ''),
      duration: Math.min(600, Math.max(5, Number(row.duration_minutes) || 30)),
      completed: row.completed === true,
      createdAt: Date.parse(row.created_at) || Date.now(),
      updatedAt: Date.parse(row.updated_at) || Date.parse(row.created_at) || Date.now()
    };
  }

  window.GoSVTCloud = {\n    async loadQuizAttempts(expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId) return null;
      const { data, error } = await client.from('student_quiz_attempts')
        .select('attempt_id,quiz_id,score,total_questions,percentage,mistakes,attempted_at')
        .eq('student_id', studentId)
        .order('attempted_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(row => ({
        attemptId: String(row.attempt_id),
        quizId: String(row.quiz_id),
        score: Number(row.score),
        total: Number(row.total_questions),
        percentage: Number(row.percentage),
        date: Date.parse(row.attempted_at) || Date.now(),
        mistakes: Array.isArray(row.mistakes) ? row.mistakes : []
      }));
    },

    async syncQuizAttempts(attempts, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId || !Array.isArray(attempts) || !attempts.length) return;
      const rows = attempts.filter(a => a && typeof a === 'object' &&
          typeof a.attemptId === 'string' && a.attemptId.length > 0 &&
          typeof a.quizId === 'string' && a.quizId.length > 0 &&
          Number.isInteger(Number(a.score)) && Number.isInteger(Number(a.total)) &&
          Number(a.total) > 0 && Number(a.score) >= 0 && Number(a.score) <= Number(a.total))
        .map(a => ({
          student_id: studentId,
          attempt_id: a.attemptId.slice(0, 200),
          quiz_id: a.quizId.slice(0, 200),
          score: Number(a.score),
          total_questions: Number(a.total),
          percentage: Math.round((Number(a.score) / Number(a.total)) * 100),
          mistakes: (Array.isArray(a.mistakes) ? a.mistakes : []).slice(0, Number(a.total)).map(m => ({
            question: String(m && m.question || '').slice(0, 2000),
            selected: String(m && m.selected || '').slice(0, 1000),
            correct: String(m && m.correct || '').slice(0, 1000),
            quizId: String(a.quizId).slice(0, 200),
            date: Number(m && m.date) || Number(a.date) || Date.now()
          })),
          attempted_at: new Date(Number(a.date) || Date.now()).toISOString()
        }));
      if (!rows.length) return;
      const { error } = await client.from('student_quiz_attempts').upsert(rows, {
        onConflict: 'student_id,attempt_id',
        ignoreDuplicates: true
      });
      if (error) throw error;
    },


    async loadProgress(expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId) return null;
      const { data, error } = await client.from('student_progress')
        .select('content_key, content_type, completed, updated_at')
        .eq('student_id', studentId);
      if (error) throw error;
      const progress = { lessons: {}, exercises: {}, tests: {} };
      const types = { lesson: 'lessons', exercise: 'exercises', unit: 'tests' };
      (data || []).forEach(row => {
        const bucket = types[row.content_type];
        if (!bucket || !row.content_key) return;
        progress[bucket][row.content_key] = {
          id: row.content_key,
          completed: row.completed === true,
          cloudUpdatedAt: row.updated_at || null
        };
      });
      return progress;
    },

    async syncProgress(progress, expectedStudentId) {
      if (!progress || typeof progress !== 'object') return;
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId) return;
      const rows = [];
      const types = { lessons: 'lesson', exercises: 'exercise', tests: 'unit' };
      Object.keys(types).forEach(bucket => {
        const entries = progress[bucket] && typeof progress[bucket] === 'object' ? progress[bucket] : {};
        Object.keys(entries).forEach(key => {
          const item = entries[key] || {};
          rows.push({
            student_id: studentId,
            content_key: String(key).slice(0, 500),
            content_type: types[bucket],
            completed: item.completed === true,
            updated_at: new Date().toISOString()
          });
        });
      });
      if (!rows.length) return;
      const { error } = await client.from('student_progress').upsert(rows, {
        onConflict: 'student_id,content_key,content_type'
      });
      if (error) throw error;
    },

    async loadDailyChallenge(challengeDate, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(String(challengeDate || ''))) return null;
      const { data, error } = await client.from('student_daily_challenges')
        .select('challenge_date,challenge_id,selected_option,is_correct,points,answered_at')
        .eq('student_id', studentId).eq('challenge_date', challengeDate).maybeSingle();
      if (error) throw error;
      return data || null;
    },

    async submitDailyChallenge(payload, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId) throw new Error('يجب تسجيل الدخول أولاً.');
      if (!payload || !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.challenge_date || '')) ||
          !/^svt-daily-\d{4}-\d{2}-\d{2}$/.test(String(payload.challenge_id || '')) ||
          !Number.isInteger(payload.selected_option) || payload.selected_option < 0 || payload.selected_option > 3 ||
          typeof payload.is_correct !== 'boolean' || ![0, 10].includes(payload.points)) {
        throw new Error('بيانات التحدي غير صالحة.');
      }
      const { data, error } = await client.from('student_daily_challenges').insert({
        student_id: studentId,
        challenge_date: payload.challenge_date,
        challenge_id: payload.challenge_id,
        selected_option: payload.selected_option,
        is_correct: payload.is_correct,
        points: payload.points
      }).select('challenge_date,challenge_id,selected_option,is_correct,points,answered_at').single();
      if (error) throw error;
      return data;
    },

    async loadNotes(expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId) return null;
      const { data, error } = await client.from('student_notes')
        .select('content_key,note,updated_at').eq('student_id', studentId);
      if (error) throw error;
      return (data || []).map(parseNoteRow);
    },

    async syncNotes(notes, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId || !Array.isArray(notes) || !notes.length) return;
      const rows = notes.filter(n => n && typeof n === 'object' && n.id)
        .map(n => {
          const payload = {
            id: String(n.id),
            title: String(n.title || '').slice(0, 120),
            body: String(n.body || '').slice(0, 5000),
            createdAt: Number(n.createdAt) || Date.now(),
            updatedAt: Number(n.updatedAt) || Date.now()
          };
          return {
            student_id: studentId,
            content_key: payload.id.slice(0, 500),
            note: JSON.stringify(payload),
            updated_at: new Date(payload.updatedAt).toISOString()
          };
        });
      if (!rows.length) return;
      rows.forEach(row => {
        if (row.note.length > 10000) throw new Error('الملاحظة تتجاوز الحد المسموح للتخزين السحابي.');
      });
      const { error } = await client.from('student_notes').upsert(rows, {
        onConflict: 'student_id,content_key'
      });
      if (error) throw error;
    },

    async deleteNote(noteId, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId || !noteId) return;
      const { error } = await client.from('student_notes').delete()
        .eq('student_id', studentId).eq('content_key', String(noteId));
      if (error) throw error;
    },

    // Favorites are stored as resource paths and isolated by the authenticated Supabase user.
    async loadFavorites(expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId) return null;
      const { data, error } = await client.from('student_favorites')
        .select('content_key').eq('student_id', studentId).eq('content_type', 'resource');
      if (error) throw error;
      return (data || []).map(row => String(row.content_key || '')).filter(Boolean);
    },

    async syncFavorites(paths, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId || !Array.isArray(paths)) return;
      const clean = Array.from(new Set(paths.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim().slice(0, 500))));
      const { data: existing, error: readError } = await client.from('student_favorites')
        .select('content_key').eq('student_id', studentId).eq('content_type', 'resource');
      if (readError) throw readError;
      const keep = new Set(clean);
      const obsolete = (existing || []).map(row => row.content_key).filter(key => !keep.has(key));
      if (obsolete.length) {
        const { error } = await client.from('student_favorites').delete()
          .eq('student_id', studentId).eq('content_type', 'resource').in('content_key', obsolete);
        if (error) throw error;
      }
      if (!clean.length) return;
      const rows = clean.map(contentKey => ({
        student_id: studentId, content_key: contentKey, content_type: 'resource'
      }));
      const { error } = await client.from('student_favorites').upsert(rows, {
        onConflict: 'student_id,content_key,content_type'
      });
      if (error) throw error;
    },

    async loadStudyPlan(expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId) return null;
      const { data, error } = await client.from('student_study_plan')
        .select('item_key,title,scheduled_date,duration_minutes,completed,created_at,updated_at')
        .eq('student_id', studentId);
      if (error) throw error;
      return (data || []).map(parsePlanRow);
    },

    async syncStudyPlan(items, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId || !Array.isArray(items) || !items.length) return;
      const rows = items.filter(item => item && typeof item === 'object' && item.id && item.date)
        .map(item => ({
          student_id: studentId,
          item_key: String(item.id).slice(0, 500),
          title: String(item.title || '').trim().slice(0, 120),
          scheduled_date: String(item.date),
          duration_minutes: Math.min(600, Math.max(5, Number(item.duration) || 30)),
          completed: item.completed === true,
          created_at: new Date(Number(item.createdAt) || Date.now()).toISOString(),
          updated_at: new Date(Number(item.updatedAt) || Date.now()).toISOString()
        }));
      if (!rows.length) return;
      const { error } = await client.from('student_study_plan').upsert(rows, {
        onConflict: 'student_id,item_key'
      });
      if (error) throw error;
    },

    async deleteStudyPlanItem(itemId, expectedStudentId) {
      const studentId = await authenticatedStudentId(expectedStudentId);
      if (!studentId || !itemId) return;
      const { error } = await client.from('student_study_plan').delete()
        .eq('student_id', studentId).eq('item_key', String(itemId));
      if (error) throw error;
    },

  };
})();
