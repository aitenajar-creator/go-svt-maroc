const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { source, between, browser } = require('./helpers.cjs');

const teacherA = '10000000-0000-0000-0000-000000000001';
const teacherB = '10000000-0000-0000-0000-000000000002';
const admin = '10000000-0000-0000-0000-000000000003';

test('profile tag fields accept Arabic separators, trim whitespace, deduplicate and enforce bounds', () => {
  const b = browser();
  b.run(between(source('teacher-community.js'), '  function profileTags(', '  async function handleProfileSave'));
  const tags = Array.from(b.context.profileTags('التجريب، التقويم; التقييم\nالتجريب،  التقنية  ', 3, 20));
  assert.deepEqual(tags, ['التجريب', 'التقويم', 'التقييم']);
  assert.deepEqual(Array.from(b.context.profileTags(' one, TWO, one ', 10, 2)), ['on', 'TW']);
});

async function setActor(db, id, role = 'authenticated') {
  await db.exec('reset role;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  await db.exec(`set role ${role};`);
}

test('teacher-community profile migration applies and enforces self-service boundaries', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.teacher_community_admins (user_id uuid primary key);
      insert into public.teacher_community_admins values ('${admin}');
      create function public.gosvt_teacher_community_is_admin() returns boolean
        language sql stable security definer set search_path=public as $$
          select exists(select 1 from public.teacher_community_admins where user_id=auth.uid())
        $$;
      create table public.teacher_community_members (
        user_id uuid primary key,
        display_name text not null check(char_length(trim(display_name)) between 2 and 100),
        professional_title text not null default '',
        school_name text not null default '',
        status text not null default 'pending' check(status in ('pending','approved','suspended')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      insert into public.teacher_community_members(user_id,display_name,status) values
        ('${teacherA}','Teacher A','approved'),
        ('${teacherB}','Teacher B','pending');
      alter table public.teacher_community_members enable row level security;
      create policy teacher_community_member_read_self_or_admin on public.teacher_community_members
        for select to authenticated using(user_id=(select auth.uid()) or public.gosvt_teacher_community_is_admin());
      create policy teacher_community_member_register_self on public.teacher_community_members
        for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
      create policy teacher_community_member_update_admin on public.teacher_community_members
        for update to authenticated using(public.gosvt_teacher_community_is_admin())
        with check(public.gosvt_teacher_community_is_admin());
      grant select,insert,update on public.teacher_community_members to authenticated;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      grant execute on function public.gosvt_teacher_community_is_admin() to authenticated;
    `);
    await db.exec(source('supabase/migrations/20261127000100_teacher_community_professional_profiles.sql'));

    await test('approved member can update own professional fields', async () => {
      await setActor(db, teacherA);
      await db.query(`update public.teacher_community_members set
        display_name='Teacher A Updated', bio='SVT educator', city='Casablanca', region='Casablanca-Settat',
        teaching_levels=array['tc','2bac'], streams=array['svt','experimental'],
        interests=array['TP','Pédagogie'], skills=array['Microscopie']
        where user_id=$1`, [teacherA]);
      const row = (await db.query('select display_name,bio,city,teaching_levels,streams,interests,skills from public.teacher_community_members where user_id=$1', [teacherA])).rows[0];
      assert.equal(row.display_name, 'Teacher A Updated');
      assert.equal(row.bio, 'SVT educator');
      assert.deepEqual(row.teaching_levels, ['tc', '2bac']);
      assert.deepEqual(row.streams, ['svt', 'experimental']);
      assert.deepEqual(row.skills, ['Microscopie']);
    });

    await test('member cannot approve themselves or alter ownership/timestamps', async () => {
      await setActor(db, teacherA);
      await assert.rejects(
        db.query("update public.teacher_community_members set status='suspended' where user_id=$1", [teacherA]),
        /teacher_community_membership_fields_are_admin_only/
      );
      await assert.rejects(
        db.query('update public.teacher_community_members set user_id=$2 where user_id=$1', [teacherA, teacherB]),
        /teacher_community_membership_fields_are_admin_only/
      );
      await assert.rejects(
        db.query("update public.teacher_community_members set created_at='2000-01-01' where user_id=$1", [teacherA]),
        /teacher_community_membership_fields_are_admin_only/
      );
    });

    await test('member cannot read or update another member row', async () => {
      await setActor(db, teacherA);
      const visible = await db.query('select user_id from public.teacher_community_members order by user_id');
      assert.deepEqual(visible.rows.map(row => row.user_id), [teacherA]);
      await db.query("update public.teacher_community_members set bio='not allowed' where user_id=$1", [teacherB]);
      await setActor(db, teacherB);
      assert.equal((await db.query('select bio from public.teacher_community_members where user_id=$1', [teacherB])).rows[0].bio, '');
    });

    await test('pending members can edit their profile without changing pending status', async () => {
      await setActor(db, teacherB);
      await db.query("update public.teacher_community_members set city='Rabat', bio='Teacher' where user_id=$1", [teacherB]);
      const row = (await db.query('select city,status from public.teacher_community_members where user_id=$1', [teacherB])).rows[0];
      assert.equal(row.city, 'Rabat');
      assert.equal(row.status, 'pending');
    });

    await test('only an administrator can change membership status', async () => {
      await setActor(db, admin);
      await db.query("update public.teacher_community_members set status='approved' where user_id=$1", [teacherB]);
      assert.equal((await db.query('select status from public.teacher_community_members where user_id=$1', [teacherB])).rows[0].status, 'approved');
    });

    await test('administrator can create their own approved profile when no membership row exists', async () => {
      await setActor(db, admin);
      await db.query("insert into public.teacher_community_members(user_id,display_name,status) values($1,'Community Admin','approved')", [admin]);
      await db.query("update public.teacher_community_members set bio='Platform moderator' where user_id=$1", [admin]);
      const row = (await db.query('select status,bio from public.teacher_community_members where user_id=$1', [admin])).rows[0];
      assert.equal(row.status, 'approved');
      assert.equal(row.bio, 'Platform moderator');
    });

    await test('profile field constraints reject unsupported curriculum values and oversized arrays', async () => {
      await setActor(db, teacherA);
      await assert.rejects(
        db.query("update public.teacher_community_members set teaching_levels=array['doctorate'] where user_id=$1", [teacherA]),
        /teacher_community_member_teaching_levels_valid/
      );
      await assert.rejects(
        db.query("update public.teacher_community_members set streams=array['svt','physics','math','other','experimental','extra'] where user_id=$1", [teacherA]),
        /teacher_community_member_streams_valid/
      );
      await assert.rejects(
        db.query("update public.teacher_community_members set bio=repeat('x',1201) where user_id=$1", [teacherA]),
        /teacher_community_member_bio_length/
      );
    });

    await test('anonymous clients cannot read community profiles', async () => {
      await setActor(db, null, 'anon');
      await assert.rejects(db.query('select * from public.teacher_community_members'), /permission denied/);
    });
  } finally {
    await db.close();
  }
});
