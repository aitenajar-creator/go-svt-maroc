const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {source}=require('./helpers.cjs');
const student='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
const teacher='00000000-0000-0000-0000-000000000003';
const question='30000000-0000-0000-0000-000000000001';
const first='10000000-0000-0000-0000-000000000001',second='10000000-0000-0000-0000-000000000002';

test('new MAIN migrations run against an isolated PostgreSQL fixture',async t=>{
  const db=new PGlite();
  const as=async id=>{await db.exec('reset role;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated;');};
  const remove=(kind,key,expected=student)=>db.query('select public.gosvt_delete_student_collection_item($1,$2,$3)',[kind,key,expected]);
  const send=(body,token,expected=teacher)=>db.query('select public.gosvt_send_teacher_reply($1,$2,$3,$4) as id',[question,body,token,expected]);
  try{
    await db.exec(source('tests/fixtures/database.sql'));
    for(const file of ['20261116000000_student_learning_state.sql','20261121000100_student_lesson_objectives.sql','20261125000100_student_collection_deletions.sql','20261125000200_per_lesson_objectives.sql','20261125000300_atomic_teacher_question_replies.sql','20261125000400_recreate_student_collection_items.sql','20261125000500_student_platform_state_profile_scope.sql']){
      if(file==='20261125000200_per_lesson_objectives.sql'){
        await db.query('insert into public.student_learning_state(student_id,lesson_objectives) values($1,$2)',[student,JSON.stringify({['private-lesson:'+first]:[0,0,'invalid',999],['private-lesson:'+second]:[1]})]);
      }
      await db.exec(source('supabase/migrations/'+file));
    }
    await t.test('Masahati cloud state isolates profiles and authenticated owners',async()=>{
      await as(student);
      await db.query('insert into public.student_platform_state(student_id,profile_id,state) values($1,$2,$3),($1,$4,$5)',[student,'profile_one',{cards:{a:1}},'profile_two',{lab:{b:2}}]);
      assert.equal((await db.query('select count(*)::int as n from public.student_platform_state')).rows[0].n,2);
      await as(other);
      assert.equal((await db.query('select * from public.student_platform_state')).rows.length,0);
      await assert.rejects(
        db.query('insert into public.student_platform_state(student_id,profile_id,state) values($1,$2,$3)',[student,'profile_other',{}]),
        /row-level security/
      );
      await as(student);
      await assert.rejects(
        db.query('insert into public.student_platform_state(student_id,profile_id,state) values($1,$2,$3)',[student,'',{}]),
        /check constraint/
      );
      await assert.rejects(
        db.query('insert into public.student_platform_state(student_id,profile_id,state) values($1,$2,$3)',[student,'profile_array',[]]),
        /check constraint/
      );
      await db.exec('reset role; set role anon;');
      await assert.rejects(db.query('select * from public.student_platform_state'),/permission denied/);
    });
    await t.test('legacy objective backfill keeps valid indices without altering the old JSON',async()=>{
      const rows=(await db.query('select checked_indices from public.student_lesson_objectives order by lesson_id')).rows;
      assert.deepEqual(rows.map(row=>row.checked_indices),[[0],[1]]);
      const old=(await db.query('select lesson_objectives from public.student_learning_state')).rows[0].lesson_objectives;
      assert(old['private-lesson:'+first].includes('invalid'));
    });
    await t.test('deletion is idempotent and a stale upsert cannot resurrect a note',async()=>{
      await as(student);
      await db.query('insert into public.student_notes(student_id,content_key,note) values ($1,$2,$3)',[student,'note-1','Old note']);
      await remove('notes','note-1');await remove('notes','note-1');
      await db.query('insert into public.student_notes(student_id,content_key,note) values ($1,$2,$3) on conflict(student_id,content_key) do update set note=excluded.note',[student,'note-1','Stale copy']);
      assert.equal((await db.query('select * from public.student_notes')).rows.length,0);
      assert.equal((await db.query('select * from public.student_collection_tombstones')).rows.length,1);
    });
    await t.test('a deletion before first upload blocks a delayed planner upload',async()=>{
      await as(student);await remove('studyPlan','plan-1');
      await db.query('insert into public.student_study_plan(student_id,item_key,title) values($1,$2,$3)',[student,'plan-1','Delayed task']);
      assert.equal((await db.query('select * from public.student_study_plan')).rows.length,0);
    });
    await t.test('a tombstoned note key cannot be reused even with a future client timestamp',async()=>{
      await as(student);
      await remove('notes','note-retired');
      const futureTime=Number((await db.query("select extract(epoch from now() + interval '365 days') * 1000 as ms")).rows[0].ms);
      const attempted={id:'note-retired',title:'Restored backup',body:'must remain deleted',createdAt:futureTime,updatedAt:futureTime};
      const result=await db.query(
        'select public.gosvt_upsert_student_collection_item($1,$2,$3,$4::jsonb) as saved',
        ['notes','note-retired',student,JSON.stringify(attempted)]
      );
      assert.equal(result.rows[0].saved,false);
      assert.equal((await db.query("select * from public.student_notes where content_key='note-retired'")).rows.length,0);
      assert.equal((await db.query("select * from public.student_collection_tombstones where item_key='note-retired'")).rows.length,1);
    });
    await t.test('a tombstoned planner key cannot be reused even with a future client timestamp',async()=>{
      await as(student);
      await remove('studyPlan','plan-retired');
      const futureTime=Number((await db.query("select extract(epoch from now() + interval '365 days') * 1000 as ms")).rows[0].ms);
      const attempted={id:'plan-retired',title:'Restored backup',date:'2026-12-01',duration:30,completed:false,createdAt:futureTime,updatedAt:futureTime};
      const result=await db.query('select public.gosvt_upsert_student_collection_item($1,$2,$3,$4::jsonb) as saved',
        ['studyPlan','plan-retired',student,JSON.stringify(attempted)]);
      assert.equal(result.rows[0].saved,false);
      assert.equal((await db.query("select * from public.student_study_plan where item_key='plan-retired'")).rows.length,0);
      assert.equal((await db.query("select * from public.student_collection_tombstones where item_key='plan-retired'")).rows.length,1);
    });
    await t.test('a genuinely recreated note and planner item use fresh keys after deletion',async()=>{
      await as(student);
      await remove('notes','note-retired');
      await remove('studyPlan','plan-retired');
      const now=Date.now();
      const note={id:'note-recreated',title:'New note',body:'Created again intentionally',createdAt:now,updatedAt:now};
      const plan={id:'plan-recreated',title:'New task',date:'2026-12-01',duration:30,completed:false,createdAt:now,updatedAt:now};
      const noteResult=await db.query(
        'select public.gosvt_upsert_student_collection_item($1,$2,$3,$4::jsonb) as saved',
        ['notes',note.id,student,JSON.stringify(note)]
      );
      const planResult=await db.query(
        'select public.gosvt_upsert_student_collection_item($1,$2,$3,$4::jsonb) as saved',
        ['studyPlan',plan.id,student,JSON.stringify(plan)]
      );
      assert.equal(noteResult.rows[0].saved,true);
      assert.equal(planResult.rows[0].saved,true);
      assert.equal((await db.query("select count(*)::int as n from public.student_notes where content_key='note-recreated'")).rows[0].n,1);
      assert.equal((await db.query("select count(*)::int as n from public.student_study_plan where item_key='plan-recreated'")).rows[0].n,1);
      assert.equal((await db.query("select count(*)::int as n from public.student_collection_tombstones where item_key in ('note-retired','plan-retired')")).rows[0].n,2);
    });
    await t.test('a queued deletion is rejected when the expected identity has changed',async()=>{
      await as(other);await assert.rejects(remove('notes','note-1',student),/session_changed/);
      assert.equal((await db.query('select * from public.student_collection_tombstones')).rows.length,0);
    });
    await t.test('RLS keeps deletion markers and objective rows owner-scoped',async()=>{
      await as(other);
      assert.equal((await db.query('select * from public.student_collection_tombstones')).rows.length,0);
      assert.equal((await db.query('select * from public.student_lesson_objectives')).rows.length,0);
      await assert.rejects(db.query('insert into public.student_lesson_objectives(student_id,lesson_id) values($1,$2)',[student,second]),/row-level security/);
      await assert.rejects(db.query('delete from public.student_collection_tombstones'),/permission denied/);
    });
    await t.test('saving a second lesson preserves the first lesson objectives',async()=>{
      await as(student);
      await db.query('insert into public.student_lesson_objectives(student_id,lesson_id,checked_indices) values($1,$2,$3) on conflict(student_id,lesson_id) do update set checked_indices=excluded.checked_indices',[student,second,[1,2]]);
      const rows=(await db.query('select lesson_id,checked_indices from public.student_lesson_objectives order by lesson_id')).rows;
      assert.deepEqual(rows.map(row=>row.checked_indices),[[0],[1,2]]);
    });

    await t.test('lesson objectives are limited to published lessons and student accounts',async()=>{
      await as(student);
      await db.query('insert into public.student_lesson_objectives(student_id,lesson_id,checked_indices) values($1,$2,$3) on conflict(student_id,lesson_id) do update set checked_indices=excluded.checked_indices',[student,first,[3]]);
      const unpublished='10000000-0000-0000-0000-000000000003';
      await assert.rejects(
        db.query('insert into public.student_lesson_objectives(student_id,lesson_id,checked_indices) values($1,$2,$3)',[student,unpublished,[0]]),
        /row-level security/
      );
      await as(teacher);
      await assert.rejects(
        db.query('insert into public.student_lesson_objectives(student_id,lesson_id,checked_indices) values($1,$2,$3)',[teacher,first,[0]]),
        /row-level security/
      );
    });
    await t.test('reply retries save one message and do not replay an old status',async()=>{
      await as(teacher);
      const a=await send('A helpful reply','fixture-reply-token'),b=await send('A helpful reply','fixture-reply-token');
      assert.equal(a.rows[0].id,b.rows[0].id);
      await db.exec('reset role;');
      assert.equal((await db.query('select count(*)::int as n from public.teacher_question_messages')).rows[0].n,1);
      assert.equal((await db.query('select status from public.teacher_questions')).rows[0].status,'answered');
      await db.query("update public.teacher_questions set status='new'");
      await as(teacher);await send('A helpful reply','fixture-reply-token');await db.exec('reset role;');
      assert.equal((await db.query('select status from public.teacher_questions')).rows[0].status,'new');
    });
    await t.test('a status-update failure rolls back the inserted reply',async()=>{
      await db.exec("reset role; create function fixture_status_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture status failure'; end $$; create trigger fixture_status_failure before update on public.teacher_questions for each row execute function fixture_status_failure();");
      await as(teacher);await assert.rejects(send('Another reply','rollback-token'),/fixture status failure/);
      await db.exec('reset role;');
      assert.equal((await db.query("select count(*)::int as n from public.teacher_question_messages where client_message_id='rollback-token'")).rows[0].n,0);
      await db.exec('drop trigger fixture_status_failure on public.teacher_questions;');
    });
    await t.test('reply RPC checks both the current identity and question authorization',async()=>{
      await as(teacher);await assert.rejects(send('Fixture','stale-session',student),/session_changed/);
      await as(other);await assert.rejects(send('Fixture','unrelated-token',other),/not_authorized/);
    });
    await t.test('anonymous callers do not receive RPC execution rights',async()=>{
      await db.exec('reset role; set role anon;');
      await assert.rejects(send('Fixture','anonymous-token'),/permission denied/);
    });
    await t.test('account deletion cascades without recreating a tombstone for a removed user',async()=>{
      const disposable='00000000-0000-0000-0000-000000000004';
      await db.exec('reset role;');await db.query('insert into auth.users values($1)',[disposable]);
      await db.query("insert into public.profiles(id,role) values($1,'student')",[disposable]);
      await db.query('insert into public.student_notes(student_id,content_key,note) values($1,$2,$3)',[disposable,'live-note','Fixture']);
      await db.query('delete from auth.users where id=$1',[disposable]);
      assert.equal((await db.query('select * from public.student_notes where student_id=$1',[disposable])).rows.length,0);
      assert.equal((await db.query('select * from public.student_collection_tombstones where student_id=$1',[disposable])).rows.length,0);
    });
  }finally{await db.close();}
});
