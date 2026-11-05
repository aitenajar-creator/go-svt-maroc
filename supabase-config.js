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

/* Narrow client-side sync to the existing owner-protected student_progress table. */
(function () {
  const client = window.supabaseClient;
  if (!client) return;
  window.GoSVTCloud = {
    async syncProgress(progress) {
      if (!progress || typeof progress !== 'object') return;
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) return;
      const studentId = authData.user.id;
      const rows = [];
      const types = { lessons: 'lesson', exercises: 'exercise', tests: 'unit' };
      Object.keys(types).forEach(bucket => {
        const entries = progress[bucket] && typeof progress[bucket] === 'object' ? progress[bucket] : {};
        Object.keys(entries).forEach(key => {
          const item = entries[key] || {};
          rows.push({ student_id: studentId, content_key: String(key).slice(0, 500), content_type: types[bucket], completed: item.completed === true, updated_at: new Date().toISOString() });
        });
      });
      if (!rows.length) return;
      const { error } = await client.from('student_progress').upsert(rows, { onConflict: 'student_id,content_key,content_type' });
      if (error) console.warn('[GoSVT] Progress cloud sync:', error.message);
    }
  };
})();
