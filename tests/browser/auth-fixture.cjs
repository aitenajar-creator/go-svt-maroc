module.exports = function installFixture(options = {}) {
  const person = { id: '00000000-0000-0000-0000-000000000001', email: 'student@example.invalid', user_metadata: { display_name: 'Fixture Student' } };
  const listeners = [];
  const state = window.__authFixture = {
    user: options.signedIn && sessionStorage.getItem('gosvt-fixture-signed-out') !== '1' ? person : null,
    failTable: options.failTable || '',
    pendingRpc: null,
    emit(event) { listeners.forEach(fn => fn(event, this.user ? { user: this.user } : null)); }
  };
  window.GoSVTRuntimeConfig = { supabaseUrl: 'https://fixture.invalid', supabasePublishableKey: 'fixture-public-key' };
  function response(table, single, mutation) {
    if (state.failTable === table) return { data: null, error: { message: 'Fixture unavailable table' } };
    if (mutation) return { data: single ? { id: 'fixture-row' } : [], error: null };
    if (table === 'profiles') return { data: single ? { id: person.id, display_name: 'Fixture Student', role: options.role || 'student' } : [], error: null };
    if (table === 'student_academic_profiles') return { data: { study_level: 'TC', study_track: 'TCS' }, error: null };
    if (table === 'student_quiz_attempts') return { data: [{ attempt_id: 'fixture-attempt', quiz_id: '/quiz/fixture.json', score: 2, total_questions: 2, percentage: 100, mistakes: [], attempted_at: '2026-11-24T10:00:00Z' }], error: null };
    return { data: single ? null : [], error: null, count: 0 };
  }
  const client = {
    auth: {
      onAuthStateChange(fn) { listeners.push(fn); return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => ({ data: { session: state.user ? { user: state.user } : null }, error: null }),
      getUser: async () => ({ data: { user: state.user }, error: null }),
      async signInWithPassword() { sessionStorage.removeItem('gosvt-fixture-signed-out'); state.user = person; state.emit('SIGNED_IN'); return { data: { user: person, session: { user: person } }, error: null }; },
      async signOut() { sessionStorage.setItem('gosvt-fixture-signed-out','1'); state.user = null; state.emit('SIGNED_OUT'); return { error: null }; }
    },
    from(table) {
      let mutation = false;
      const q = {};
      for (const name of ['select','eq','in','is','not','order','range','limit','gte','lt']) q[name] = () => q;
      for (const name of ['insert','upsert','update','delete']) q[name] = () => { mutation = true; return q; };
      q.maybeSingle = q.single = async () => response(table, true, mutation);
      q.then = (resolve, reject) => Promise.resolve(response(table, false, mutation)).then(resolve, reject);
      return q;
    },
    rpc: async (name, args) => {
      if (options.deferRpc === name) return await new Promise(resolve => { state.pendingRpc = { name, args, resolve }; });
      return { data: [], error: null };
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://fixture.invalid/file.pdf' } }) }) }
  };
  window.supabase = { createClient: () => client };
};
