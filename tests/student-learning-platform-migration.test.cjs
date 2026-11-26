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


test('privileged RPCs pin search_path and authenticate the calling account',()=>{
 const definitions=[...migration.matchAll(/create or replace function public\.([a-z0-9_]+)\([\s\S]*?\$\$;/gi)];
 const privileged=definitions.filter(match=>/security definer/i.test(match[0]));
 assert.ok(privileged.length>=5,'expected the platform privileged RPC set');
 for(const fn of privileged){
  assert.match(fn[0],/set search_path\s*=\s*pg_catalog\s*,\s*public/i,fn[1]+' pins search_path');
  assert.match(fn[0],/auth\.uid\(\)/i,fn[1]+' checks authenticated identity');
 }
});

test('student-facing RPCs are callable only by authenticated users and resources cannot be written directly',()=>{
 for(const signature of [
  'gosvt_platform_start_assessment(uuid,uuid)',
  'gosvt_platform_save_answers(uuid,jsonb,integer,uuid)',
  'gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid)'
 ]){
  assert.ok(migration.includes('revoke all on function public.'+signature+' from public,anon'));
  assert.ok(migration.includes('grant execute on function public.'+signature+' to authenticated'));
 }
 assert.ok(migration.includes('revoke insert,update on public.learning_resources from authenticated'));
 assert.ok(migration.includes('revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated'));
 assert.ok(migration.includes('revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated'));
});


test('resource and assessment edits reject stale revisions instead of overwriting newer work',()=>{
 const resourceStart=migration.indexOf('create or replace function public.gosvt_platform_save_resource');
 const resourceBody=migration.slice(resourceStart,migration.indexOf('$$;',resourceStart));
 assert.match(resourceBody,/where id=p_id and updated_at=\(p_document->>'expected_updated_at'\)::timestamptz returning id/);
 assert.match(resourceBody,/raise exception 'resource_updated_elsewhere'/);
 const assessmentStart=migration.indexOf('create or replace function public.gosvt_platform_save_assessment');
 const assessmentBody=migration.slice(assessmentStart,migration.indexOf('$$;',assessmentStart));
 assert.match(assessmentBody,/where id=p_id and revision=p_expected_revision returning id/);
 assert.match(assessmentBody,/revision=revision\+1/);
 assert.match(assessmentBody,/raise exception 'assessment_updated_elsewhere'/);
});

test('attempt grading uses its immutable question snapshot and timeout ignores late client answers',()=>{
 const start=migration.indexOf('create or replace function public.gosvt_platform_start_assessment');
 const startBody=migration.slice(start,migration.indexOf('$$;',start));
 assert.match(startBody,/question_snapshot,deadline_at,max_score/);
 const saveStart=migration.indexOf('create or replace function public.gosvt_platform_save_answers');
 const saveBody=migration.slice(saveStart,migration.indexOf('$$;',saveStart));
 assert.match(saveBody,/gosvt_platform_clean_answers\(attempt\.question_snapshot,p_answers\)/);
 assert.match(saveBody,/attempt\.submitted_at is not null or now\(\)>attempt\.deadline_at/);
 const submitStart=migration.indexOf('create or replace function public.gosvt_platform_submit_assessment');
 const submitBody=migration.slice(submitStart,migration.indexOf('$$;',submitStart));
 assert.match(submitBody,/if now\(\)<=attempt\.deadline_at then/);
 assert.match(submitBody,/clean:=attempt\.answers/);
 assert.match(submitBody,/jsonb_array_elements\(attempt\.question_snapshot\)/);
 assert.match(submitBody,/submitted_at=now\(\)/);
});

test('answer autosave sequence numbers reject stale writes and make retries idempotent',()=>{
 const start=migration.indexOf('create or replace function public.gosvt_platform_save_answers');
 const body=migration.slice(start,migration.indexOf('$$;',start));
 assert.match(body,/p_sequence<=attempt\.last_sequence/);
 assert.match(body,/clean=attempt\.answers/);
 assert.match(body,/answers=clean,last_sequence=p_sequence/);
});
