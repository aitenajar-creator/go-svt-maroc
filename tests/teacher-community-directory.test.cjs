const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');

const approvedA = '40000000-0000-0000-0000-000000000001';
const approvedB = '40000000-0000-0000-0000-000000000002';
const pending = '40000000-0000-0000-0000-000000000003';
const admin = '40000000-0000-0000-0000-000000000004';

test('teacher directory exposes only opted-in professional fields to approved members and admins', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text);
      insert into auth.users values
        ('${approvedA}','a@example.test'),('${approvedB}','b@example.test'),
        ('${pending}','pending@example.test'),('${admin}','admin@example.test');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.teacher_community_admins(user_id uuid primary key references auth.users(id));
      insert into public.teacher_community_admins values ('${admin}');
      create table public.teacher_community_members(
        user_id uuid primary key references auth.users(id),
        display_name text not null,
        professional_title text not null default '',
        school_name text not null default '',
        status text not null check(status in ('pending','approved','suspended')),
        bio text not null default '',
        city text not null default '',
        region text not null default '',
        teaching_levels text[] not null default '{}',
        streams text[] not null default '{}',
        interests text[] not null default '{}',
        skills text[] not null default '{}',
        is_profile_public boolean not null default false
      );
      insert into public.teacher_community_members
        (user_id,display_name,professional_title,school_name,status,bio,city,region,teaching_levels,streams,interests,skills,is_profile_public)
      values
        ('${approvedA}','Teacher A','SVT teacher','Private School A','approved','Public bio A','City A','Region A',array['2bac'],array['svt'],array['ecology'],array['GIS'],true),
        ('${approvedB}','Teacher B','Biology teacher','Private School B','approved','Private bio B','City B','Region B',array['1bac'],array['experimental'],array['microscopy'],array['lab'],false),
        ('${pending}','Pending Teacher','Teacher','Private School C','pending','Pending bio','City C','Region C',array['tc'],array['other'],array['teaching'],array['planning'],true);
      create function public.gosvt_teacher_community_is_admin() returns boolean
        language sql stable security definer set search_path=public as $$
          select exists(select 1 from public.teacher_community_admins where user_id=auth.uid())
        $$;
      alter table public.teacher_community_members enable row level security;
      create policy teacher_community_member_read_self_or_admin on public.teacher_community_members
        for select to authenticated using(user_id=(select auth.uid()) or public.gosvt_teacher_community_is_admin());
      grant usage on schema auth, public to authenticated;
      grant execute on function auth.uid() to authenticated;
      grant execute on function public.gosvt_teacher_community_is_admin() to authenticated;
      grant select on public.teacher_community_members to authenticated;

      create or replace view public.teacher_community_public_profiles
      with (security_barrier = true)
      as
      select display_name, professional_title, bio, region,
             teaching_levels, streams, interests, skills
      from public.teacher_community_members
      where status='approved' and is_profile_public=true
        and (
          exists (
            select 1 from public.teacher_community_members viewer
            where viewer.user_id=(select auth.uid()) and viewer.status='approved'
          )
          or public.gosvt_teacher_community_is_admin()
        );
      revoke all on public.teacher_community_public_profiles from public, anon;
      grant select on public.teacher_community_public_profiles to authenticated;
    `);

    const columns = (await db.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='teacher_community_public_profiles'
      order by ordinal_position
    `)).rows.map(row => row.column_name);
    assert.deepEqual(columns, [
      'display_name','professional_title','bio','region',
      'teaching_levels','streams','interests','skills'
    ], 'directory projection must never include email, user IDs, school names or city');

    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [approvedA]);
    await db.exec('set role authenticated');
    const memberRows = (await db.query('select display_name from public.teacher_community_public_profiles order by display_name')).rows;
    assert.deepEqual(memberRows.map(row => row.display_name), ['Teacher A'],
      'approved members should see opted-in approved profiles only');

    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [pending]);
    await db.exec('set role authenticated');
    const pendingRows = (await db.query('select display_name from public.teacher_community_public_profiles')).rows;
    assert.equal(pendingRows.length, 0, 'pending members must not see the directory');

    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    await db.exec('set role authenticated');
    const adminRows = (await db.query('select display_name from public.teacher_community_public_profiles order by display_name')).rows;
    assert.deepEqual(adminRows.map(row => row.display_name), ['Teacher A'],
      'administrators may moderate/view the opt-in directory but hidden profiles stay hidden');

    await db.exec('reset role');
    await db.exec('set role anon');
    await assert.rejects(
      db.query('select display_name from public.teacher_community_public_profiles'),
      /permission denied/i,
      'anonymous users must not access the directory'
    );
  } finally {
    await db.close();
  }
});
