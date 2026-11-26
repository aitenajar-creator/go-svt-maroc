const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
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
  assert.ok(body.includes('auth.uid() is distinct from p_expected_user'));
  assert.ok(body.includes('gosvt_platform_admin()'));
 }
});

test('answer keys are not selectable by students and are removed from started attempts',()=>{
 assert.ok(migration.includes('revoke all on public.learning_questions from public, anon, authenticated'));
 assert.ok(migration.includes('create policy learning_questions_admin_read'));
 assert.ok(migration.includes("jsonb_agg(value-'answer'-'explanation')"));
 assert.ok(migration.includes('revoke all on public.learning_attempts from public, anon, authenticated'));
 assert.ok(migration.includes('grant select(id,student_id,assessment_id,title_snapshot,started_at,deadline_at,submitted_at,answers,last_sequence,score,max_score,feedback) on public.learning_attempts to authenticated'));
 assert.ok(!migration.includes('grant select on public.learning_attempts to authenticated'));
});

test('published assessment data is constrained and student access is audience-scoped',()=>{
 assert.ok(migration.includes('check (not is_published or question_count >= 3)'));
 assert.ok(migration.includes('learning_assessments_read'));
 assert.ok(migration.includes('learning_resources_read'));
 assert.ok(migration.includes('is_published and exists(select 1 from public.student_academic_profiles'));
});
