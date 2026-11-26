const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {source}=require('./helpers.cjs');
const student='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
const admin='00000000-0000-0000-0000-000000000005';

test('learning platform: authentic grading and academic isolation on an isolated PostgreSQL engine',async t=>{
  const db=new PGlite();
  const as=async id=>{await db.exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
  try{
    await db.exec(source('tests/fixtures/database.sql'));
    await db.exec("create table public.student_academic_profiles(student_id uuid primary key,study_level text,study_track text);alter table public.student_academic_profiles enable row level security;grant select on public.student_academic_profiles to authenticated;create policy academic_self on public.student_academic_profiles for select to authenticated using(student_id=auth.uid())");
    await db.query('insert into public.student_academic_profiles values($1,$2,$3),($4,$5,$6)',[student,'2BAC','2BACSVT',other,'TC','TCS']);
    await db.query('insert into auth.users(id) values($1)',[admin]);await db.query('insert into public.profiles(id,role) values($1,$2)',[admin,'admin']);
    const migration=source('supabase/migrations/20261126000200_student_learning_platform.sql');
    try {
      await db.exec(migration);
    } catch (error) {
      const position=Number(error.position||0);
      const excerpt=position ? migration.slice(Math.max(0,position-180),position+180) : 'SQL position unavailable';
      throw new Error('Student platform migration failed at SQL position '+position+': '+excerpt+'; '+error.message,{cause:error});
    }
    const document={title:'تقييم تعلم تجريبي',description:'Fixture, not production content.',study_level:'2BAC',study_tracks:['2BACSVT'],duration_minutes:5,is_published:true,reviewed:true,questions:Array.from({length:3},(_,i)=>({prompt:'Fixture question number '+i,options:['Correct fixture option','Other fixture option'],answer:0,explanation:'Fixture explanation for isolated tests.',points:1}))};
    let assessment,attempt;
    await t.test('only a verified administrator can create or revise assessments',async()=>{
      await as(student);await assert.rejects(db.query('select public.gosvt_platform_save_assessment(null,$1,null,$2)',[JSON.stringify(document),student]),/not_authorized/);
      await as(admin);assessment=(await db.query('select public.gosvt_platform_save_assessment(null,$1,null,$2) id',[JSON.stringify(document),admin])).rows[0].id;
      await assert.rejects(db.query('select public.gosvt_platform_save_assessment($1,$2,99,$3)',[assessment,JSON.stringify(document),admin]),/updated_elsewhere/);
    });
    await t.test('drafts can be saved empty but publication requires a reviewed complete bank',async()=>{
      await as(admin);
      const draft={...document,is_published:false,reviewed:false,questions:[]};
      const id=(await db.query('select public.gosvt_platform_save_assessment(null,$1,null,$2) id',[JSON.stringify(draft),admin])).rows[0].id;
      assert(id);
      await assert.rejects(db.query('select public.gosvt_platform_save_assessment($1,$2,1,$3)',[id,JSON.stringify({...draft,is_published:true,reviewed:true}),admin]),/3_to_60/);
      await assert.rejects(db.query('select public.gosvt_platform_save_assessment(null,$1,null,$2)',[JSON.stringify({...document,reviewed:false}),admin]),/editorial_review_required/);
      const malformed={...document,questions:document.questions.map((q,i)=>i===0?{...q,options:[{unexpected:'object'},'Other fixture option']}:q)};
      await assert.rejects(db.query('select public.gosvt_platform_save_assessment(null,$1,null,$2)',[JSON.stringify(malformed),admin]),/invalid_question/);
    });
    await t.test('curated resources require admin authority and preserve optimistic edit boundaries',async()=>{
      const resource={title:'Fixture resource',description:'Fixture only',source_url:'/cours/fixture.pdf',resource_kind:'cours',study_level:'2BAC',study_tracks:['2BACSVT'],language:'arabe',is_published:true,position:0};
      await as(student);await assert.rejects(db.query('select public.gosvt_platform_save_resource(null,$1,$2)',[JSON.stringify(resource),student]),/not_authorized/);
      await as(admin);const id=(await db.query('select public.gosvt_platform_save_resource(null,$1,$2) id',[JSON.stringify(resource),admin])).rows[0].id;
      const stamp=(await db.query('select updated_at::text stamp from public.learning_resources where id=$1',[id])).rows[0].stamp;
      await db.query('select public.gosvt_platform_save_resource($1,$2,$3)',[id,JSON.stringify({...resource,title:'Updated fixture',expected_updated_at:stamp}),admin]);
      await assert.rejects(db.query('select public.gosvt_platform_save_resource($1,$2,$3)',[id,JSON.stringify({...resource,expected_updated_at:stamp}),admin]),/updated_elsewhere/);
      await as(other);assert.equal((await db.query('select id from public.learning_resources')).rows.length,0);
      await as(student);assert.equal((await db.query('select id from public.learning_resources')).rows.length,1);
    });
    await t.test('unmatched academic profiles cannot see or start the assessment',async()=>{
      await as(other);assert.equal((await db.query('select id from public.learning_assessments')).rows.length,0);
      await assert.rejects(db.query('select public.gosvt_platform_start_assessment($1,$2)',[assessment,other]),/not_available_for_profile/);
    });
    await t.test('start is resumable and exposes no answer keys or explanations',async()=>{
      await as(student);attempt=(await db.query('select public.gosvt_platform_start_assessment($1,$2) value',[assessment,student])).rows[0].value;
      assert.equal(attempt.questions.length,3);assert(attempt.questions.every(q=>!('answer'in q)&&!('explanation'in q)));
      const again=(await db.query('select public.gosvt_platform_start_assessment($1,$2) value',[assessment,student])).rows[0].value;assert.equal(again.id,attempt.id);
      assert.equal((await db.query('select id,prompt,answer from public.learning_questions')).rows.length,0);
      await assert.rejects(db.query('select question_snapshot from public.learning_attempts'),/permission denied/);
      await assert.rejects(db.query('update public.learning_attempts set score=300'),/permission denied/);
    });
    await t.test('stale autosaves and stale final submissions cannot overwrite newer answers',async()=>{
      const answers={[attempt.questions[0].id]:0};await as(student);
      await db.query('select public.gosvt_platform_save_answers($1,$2,2,$3)',[attempt.id,JSON.stringify(answers),student]);
      const stale=(await db.query('select public.gosvt_platform_save_answers($1,$2,1,$3) value',[attempt.id,JSON.stringify({[attempt.questions[0].id]:1}),student])).rows[0].value;
      assert.equal(stale.accepted,false);
      await assert.rejects(db.query('select public.gosvt_platform_submit_assessment($1,$2,1,$3)',[attempt.id,JSON.stringify(answers),student]),/updated_elsewhere/);
    });
    await t.test('authoring changes do not change the answer snapshot of an ongoing attempt',async()=>{
      await as(admin);const edited={...document,questions:document.questions.map(q=>({...q,answer:1}))};
      await db.query('select public.gosvt_platform_save_assessment($1,$2,1,$3)',[assessment,JSON.stringify(edited),admin]);
      await as(student);const answers=Object.fromEntries(attempt.questions.map(q=>[q.id,0]));
      const grade=(await db.query('select public.gosvt_platform_submit_assessment($1,$2,3,$3) value',[attempt.id,JSON.stringify(answers),student])).rows[0].value;
      assert.equal(grade.score,3);assert.equal(grade.percentage,100);assert.equal(grade.server_graded,true);
      const retry=(await db.query('select public.gosvt_platform_submit_assessment($1,$2,9,$3) value',[attempt.id,'{}',student])).rows[0].value;
      assert.equal(retry.score,3);assert.equal(retry.submitted_at,grade.submitted_at);
    });
    await t.test('expired attempts use saved answers, never a late replacement payload',async()=>{
      await as(student);const next=(await db.query('select public.gosvt_platform_start_assessment($1,$2) value',[assessment,student])).rows[0].value;
      await db.query('select public.gosvt_platform_save_answers($1,$2,1,$3)',[next.id,JSON.stringify({[next.questions[0].id]:1}),student]);
      await db.exec('reset role');await db.query("update public.learning_attempts set deadline_at=now()-interval '1 second' where id=$1",[next.id]);
      await as(student);const late=Object.fromEntries(next.questions.map(q=>[q.id,1]));
      const result=(await db.query('select public.gosvt_platform_submit_assessment($1,$2,2,$3) value',[next.id,JSON.stringify(late),student])).rows[0].value;
      assert.equal(result.score,1);assert.equal(result.maximum,3);
    });
    await t.test('attempt identity and result history stay account-scoped',async()=>{
      await as(other);assert.equal((await db.query('select id,score from public.learning_attempts')).rows.length,0);
      await assert.rejects(db.query('select public.gosvt_platform_submit_assessment($1,$2,9,$3)',[attempt.id,'{}',other]),/attempt_not_found/);
      await assert.rejects(db.query('select public.gosvt_platform_start_assessment($1,$2)',[assessment,student]),/authentication_changed/);
    });
    await t.test('activity is owner-only and duplicate delivery is idempotent',async()=>{
      await as(student);const id='d0000000-0000-0000-0000-000000000001';
      for(let i=0;i<2;i++)await db.query("insert into public.student_learning_events(id,student_id,event_kind,resource_key,payload,occurred_at) values($1,$2,'focus','focus-fixture','{\"seconds\":60}',now()) on conflict(id) do nothing",[id,student]);
      assert.equal((await db.query('select id from public.student_learning_events')).rows.length,1);
      await as(other);assert.equal((await db.query('select id from public.student_learning_events')).rows.length,0);
    });
    await t.test('anonymous access to question banks and grading RPCs is denied',async()=>{
      await db.exec('reset role;set role anon');
      await assert.rejects(db.query('select * from public.learning_questions'),/permission denied/);
      await assert.rejects(db.query('select public.gosvt_platform_start_assessment($1,$2)',[assessment,student]),/permission denied/);
    });
  }finally{await db.close();}
});
