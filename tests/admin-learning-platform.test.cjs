const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const script=fs.readFileSync(path.join(root,'admin-learning-platform.js'),'utf8');

test('admin dashboard loads a dedicated learning-platform authoring panel',()=>{
 assert.match(html,/data-admin-tab="learning-platform-admin-panel"/);
 assert.match(html,/id="learning-platform-admin-panel"/);
 assert.match(html,/admin-learning-platform\.js/);
 assert.match(html,/إدارة الموارد والاختبارات/);
});

test('authoring tools wait for the existing verified admin-session event and clear on logout',()=>{
 assert.match(script,/gosvt:admin-session/);
 assert.match(script,/client\.auth\.getUser\(\)/);
 assert.match(script,/data\?\.role==='admin'/);
 assert.match(script,/clearSession\(\)/);
});

test('protected resources and assessments are written only through guarded RPCs',()=>{
 assert.match(script,/gosvt_platform_save_resource/);
 assert.match(script,/gosvt_platform_save_assessment/);
 assert.doesNotMatch(script,/from\(['"]learning_(?:resources|assessments|questions)['"]\)\.(?:insert|update|upsert|delete)\(/);
});

test('assessment publication requires explicit review and at least three questions',()=>{
 assert.match(script,/questions\.length<3/);
 assert.match(script,/learning-assessment-reviewed/);
 assert.match(script,/reviewed:\$\('learning-assessment-reviewed'\)\.checked/);
});

test('results view and export do not select or export answer snapshots or keys',()=>{
 assert.match(script,/select\('id,student_id,assessment_id,title_snapshot,started_at,deadline_at,submitted_at,score,max_score'\)/);
 assert.doesNotMatch(script,/question_snapshot/);
});


const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261126000200_student_learning_platform.sql'),'utf8');

test('assessment and resource writes are server-side admin-only operations',()=>{
 for(const [name,signature] of [
  ['gosvt_platform_save_assessment','create or replace function public.gosvt_platform_save_assessment'],
  ['gosvt_platform_save_resource','create or replace function public.gosvt_platform_save_resource']
 ]){
  const start=migration.indexOf(signature);
  assert.notEqual(start,-1,name+' exists');
  const end=migration.indexOf('$$;',start);
  const body=migration.slice(start,end);
  assert.match(body,/security definer/i);
  assert.match(body,/auth\\.uid\\(\\) is distinct from p_expected_user/i);
  assert.match(body,/gosvt_platform_admin\\(\\)/i);
 }
});

test('answer keys are not selectable by students and are removed from started attempts',()=>{
 assert.match(migration,/revoke all on public\\.learning_questions from public, anon, authenticated/i);
 assert.match(migration,/create policy learning_questions_admin_read[\\s\\S]*?gosvt_platform_admin\\(\\)/i);
 assert.match(migration,/jsonb_agg\\(value-'answer'-'explanation'\\)/i);
 assert.match(migration,/revoke all on public\\.learning_attempts from public, anon, authenticated/i);
 assert.match(migration,/grant select\\(id,student_id,assessment_id,title_snapshot,started_at,deadline_at,submitted_at,answers,last_sequence,score,max_score,feedback\\) on public\\.learning_attempts to authenticated/i);
 assert.doesNotMatch(migration,/grant select on public\\.learning_attempts to authenticated/i);
});

test('published assessment data is constrained and student access is audience-scoped',()=>{
 assert.match(migration,/check \\(not is_published or question_count >= 3\\)/i);
 assert.match(migration,/learning_assessments_read[\\s\\S]*?is_published and exists\\(select 1 from public\\.student_academic_profiles/i);
 assert.match(migration,/learning_resources_read[\\s\\S]*?is_published and exists\\(select 1 from public\\.student_academic_profiles/i);
});
