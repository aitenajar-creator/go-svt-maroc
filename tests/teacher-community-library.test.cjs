const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { source, between, browser, node, query } = require('./helpers.cjs');

const memberA = '20000000-0000-0000-0000-000000000001';
const memberB = '20000000-0000-0000-0000-000000000002';
const adminId = '20000000-0000-0000-0000-000000000003';
const publicResource = '30000000-0000-0000-0000-000000000001';
const privateResource = '30000000-0000-0000-0000-000000000002';
const hiddenResource = '30000000-0000-0000-0000-000000000003';

async function setActor(db, id, role = 'authenticated') {
  await db.exec('reset role;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  await db.exec(`set role ${role};`);
}

test('community resource facets and favorites migration enforce constraints, visibility and ownership', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('${memberA}'),('${memberB}'),('${adminId}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.teacher_community_admins(user_id uuid primary key references auth.users(id));
      insert into public.teacher_community_admins values ('${adminId}');
      create table public.teacher_community_members(
        user_id uuid primary key references auth.users(id), display_name text not null,
        professional_title text not null default '', school_name text not null default '',
        status text not null default 'pending' check(status in ('pending','approved','suspended')),
        created_at timestamptz not null default now(), updated_at timestamptz not null default now()
      );
      insert into public.teacher_community_members(user_id,display_name,status) values
        ('${memberA}','Teacher A','approved'),('${memberB}','Teacher B','approved');
      create function public.gosvt_teacher_community_is_admin() returns boolean
        language sql stable security definer set search_path=public as $$
          select exists(select 1 from public.teacher_community_admins where user_id=auth.uid())
        $$;
      create function public.gosvt_teacher_community_is_approved_member() returns boolean
        language sql stable security definer set search_path=public as $$
          select exists(select 1 from public.teacher_community_members where user_id=auth.uid() and status='approved')
        $$;
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
      grant execute on function public.gosvt_teacher_community_is_approved_member() to authenticated;

      create table public.teacher_community_resources(
        id uuid primary key, owner_id uuid not null references auth.users(id),
        title text not null, status text not null, is_shared boolean not null,
        created_at timestamptz not null default now()
      );
      insert into public.teacher_community_resources(id,owner_id,title,status,is_shared) values
        ('${publicResource}','${memberB}','Shared SVT resource','published',true),
        ('${privateResource}','${memberB}','Private SVT resource','published',false),
        ('${hiddenResource}','${memberB}','Hidden SVT resource','hidden',true);
      alter table public.teacher_community_resources enable row level security;
      create policy teacher_community_resource_read on public.teacher_community_resources
        for select to authenticated using(
          owner_id=(select auth.uid()) or public.gosvt_teacher_community_is_admin() or
          (is_shared=true and status='published' and public.gosvt_teacher_community_is_approved_member())
        );
      grant select,update on public.teacher_community_resources to authenticated;
    `);
    await db.exec(source('supabase/migrations/20261127000100_teacher_community_professional_profiles.sql'));
    await db.exec(source('supabase/migrations/20261127000300_teacher_community_resource_metadata_and_favorites.sql'));

    await test('legacy resources remain valid and new facets accept Moroccan curriculum keys', async () => {
      const legacy = (await db.query('select school_level,school_stream,language,school_year from public.teacher_community_resources where id=$1', [publicResource])).rows[0];
      assert.deepEqual(legacy, {school_level:null, school_stream:null, language:null, school_year:null});
      await db.query(`update public.teacher_community_resources set
        school_level='2bac', school_stream='svt', language='fr', chapter='Génétique',
        theme='Hérédité humaine', school_year='2026-2027' where id=$1`, [publicResource]);
      const row = (await db.query('select school_level,school_stream,language,chapter,theme,school_year from public.teacher_community_resources where id=$1', [publicResource])).rows[0];
      assert.deepEqual(row, {school_level:'2bac',school_stream:'svt',language:'fr',chapter:'Génétique',theme:'Hérédité humaine',school_year:'2026-2027'});
    });

    await test('resource facet constraints reject invalid level, language and school year', async () => {
      await assert.rejects(db.query("update public.teacher_community_resources set school_level='doctorate' where id=$1", [publicResource]), /teacher_community_resource_school_level_valid/);
      await assert.rejects(db.query("update public.teacher_community_resources set language='es' where id=$1", [publicResource]), /teacher_community_resource_language_valid/);
      await assert.rejects(db.query("update public.teacher_community_resources set school_year='2026/27' where id=$1", [publicResource]), /teacher_community_resource_school_year_valid/);
      await assert.rejects(db.query("update public.teacher_community_resources set theme=repeat('x',121) where id=$1", [publicResource]), /teacher_community_resource_theme_length/);
    });

    await test('approved member can bookmark a visible shared resource and retrieve only own bookmarks', async () => {
      await setActor(db, memberA);
      await db.query('insert into public.teacher_community_resource_favorites(user_id,resource_id) values($1,$2)', [memberA, publicResource]);
      const rows = await db.query('select resource_id from public.teacher_community_resource_favorites');
      assert.deepEqual(rows.rows.map(row => row.resource_id), [publicResource]);
      await setActor(db, memberB);
      assert.equal((await db.query('select * from public.teacher_community_resource_favorites')).rows.length, 0);
    });

    await test('members cannot bookmark private/hidden resources or write a bookmark for another user', async () => {
      await setActor(db, memberA);
      await assert.rejects(db.query('insert into public.teacher_community_resource_favorites(user_id,resource_id) values($1,$2)', [memberA, privateResource]), /row-level security/);
      await assert.rejects(db.query('insert into public.teacher_community_resource_favorites(user_id,resource_id) values($1,$2)', [memberA, hiddenResource]), /row-level security/);
      await assert.rejects(db.query('insert into public.teacher_community_resource_favorites(user_id,resource_id) values($1,$2)', [memberB, publicResource]), /row-level security/);
    });

    await test('favorite removal is owner-scoped; anonymous access and client updates are denied', async () => {
      await setActor(db, memberA);
      await db.query('delete from public.teacher_community_resource_favorites where resource_id=$1', [publicResource]);
      assert.equal((await db.query('select * from public.teacher_community_resource_favorites')).rows.length, 0);
      await assert.rejects(db.query("update public.teacher_community_resource_favorites set created_at=now() where resource_id=$1", [publicResource]), /permission denied/);
      await setActor(db, null, 'anon');
      await assert.rejects(db.query('select * from public.teacher_community_resource_favorites'), /permission denied/);
    });
  } finally {
    await db.close();
  }
});

test('teacher community UI writes, searches and renders pedagogical facets and private favorites', () => {
  const html = source('teacher-community.html');
  const js = source('teacher-community.js');
  for (const id of ['tc-level','tc-stream','tc-language','tc-school-year-filter','tc-favorites-grid','tc-favorites-more',
    'tc-file-level','tc-file-stream','tc-file-language','tc-file-school-year','tc-file-chapter','tc-file-theme',
    'tc-edit-level','tc-edit-stream','tc-edit-language','tc-edit-school-year','tc-edit-chapter','tc-edit-theme']) {
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  for (const field of ['school_level','school_stream','language','school_year','chapter','theme']) {
    assert(js.includes(field),`JavaScript must process ${field}`);
  }
  assert.match(js,/async function loadFavorites/);
  assert.match(js,/async function toggleFavorite/);
  assert.match(js,/await loadFavoriteIds\(page\.map\(resource => resource\.id\),session\)/);
  assert.match(js,/query = query\.eq\('school_level',level\)/);
  assert.match(js,/query = query\.eq\('school_stream',stream\)/);
  assert.match(js,/query = query\.eq\('language',language\)/);
  assert.match(js,/query = query\.eq\('school_year',schoolYear\)/);
  assert.match(js,/\.eq\('user_id',user\.id\)/);
  assert.match(js,/resourceMetadataLabel\(r\)/);
  assert.match(js,/fillResourceMetadata\('edit',r\)/);
});

test('resource metadata form values are normalized and reject malformed school years', () => {
  const b = browser();
  b.context.$ = id => { if (!b.nodes.has(id)) b.nodes.set(id,node()); return b.nodes.get(id); };
  for (const [id,value] of Object.entries({
    'tc-file-school-year':'2026-2027','tc-file-level':'2bac','tc-file-stream':'svt',
    'tc-file-language':'ar','tc-file-chapter':'الوراثة','tc-file-theme':'المعلومة الوراثية'
  })) b.context.$(id).value = value;
  b.run(between(source('teacher-community.js'),'  function resourceMetadata(prefix)','  function fillResourceMetadata'));
  assert.deepEqual(JSON.parse(JSON.stringify(b.context.resourceMetadata('file'))),{
    school_level:'2bac',school_stream:'svt',language:'ar',school_year:'2026-2027',chapter:'الوراثة',theme:'المعلومة الوراثية'
  });
  b.context.$('tc-file-school-year').value='2026/27';
  assert.throws(()=>b.context.resourceMetadata('file'),/2026-2027/);
});

test('library query applies the chosen facets and hydrates favorite state without leaking sessions', async () => {
  const resource = {id:'resource-1',owner_id:'other',title:'SVT',description:'',file_name:'lesson.pdf',mime_type:'application/pdf',size_bytes:10,status:'published',is_shared:true,created_at:'2026-01-01'};
  const operations = [];
  let rendered=false;
  const activeUser={id:'teacher-a'};
  const b = browser({
    user:activeUser,member:{status:'approved'},isAdmin:false,resources:[],favoriteResourceIds:new Set(),
    PAGE_SIZE:50,libraryOffset:0,libraryHasMore:false,libraryRequest:0,libraryLoading:false,libraryRefreshPending:false,
    captureCommunitySession:()=>({user:activeUser,generation:1}),communitySessionIsCurrent:s=>!!activeUser&&s.user.id===activeUser.id,
    updateMyStats:async()=>{},renderLibrary:()=>{rendered=true;}, 
    client:{from:table=>query(table==='teacher_community_resources'?{data:[resource],error:null}:{data:[{resource_id:'resource-1'}],error:null},operations)}
  });
  b.context.document.getElementById=id=>b.nodes.get(id)||null;
  b.context.$=id=>{if(!b.nodes.has(id))b.nodes.set(id,node());return b.nodes.get(id);};
  for(const [id,value] of Object.entries({'tc-search':'','tc-category':'','tc-file-type':'','tc-level':'2bac','tc-stream':'svt','tc-language':'fr','tc-school-year-filter':'2026-2027','tc-library-sort':'newest'})) b.context.$(id).value=value;
  b.run(between(source('teacher-community.js'),'  async function loadFavoriteIds(','  function updateLibraryResetVisibility'));
  await b.context.loadLibrary(true);
  for(const [column,value] of [['school_level','2bac'],['school_stream','svt'],['language','fr'],['school_year','2026-2027']]) {
    assert(operations.some(op=>op[0]==='eq'&&op[1]===column&&op[2]===value),`missing database filter ${column}`);
  }
  assert(b.context.favoriteResourceIds.has('resource-1'));
  assert.equal(rendered,true);
});

test('favorite mutations are account-scoped and do not block another account with an in-flight bookmark', async () => {
  const operations=[];
  const activeUser={id:'teacher-b'};
  const b=browser({
    user:activeUser,member:{status:'approved'},isAdmin:false,favoriteResourceIds:new Set(),pendingFavoriteIds:new Set(['teacher-a:resource-1']),
    captureCommunitySession:()=>({user:activeUser,generation:1}),communitySessionIsCurrent:s=>!!activeUser&&s.user.id===activeUser.id,
    updateMyStats:async()=>{},loadFavorites:async()=>{},client:{from:()=>query({data:{resource_id:'resource-1'},error:null},operations)}
  });
  b.context.document.querySelectorAll=()=>[];
  b.context.$=id=>{if(!b.nodes.has(id))b.nodes.set(id,node());return b.nodes.get(id);};
  b.run(between(source('teacher-community.js'),'  function syncFavoriteButtons(resourceId)','  async function loadFavorites'));
  await b.context.toggleFavorite('resource-1');
  assert(b.context.favoriteResourceIds.has('resource-1'));
  assert(operations.some(op=>op[0]==='insert'&&op[1].user_id==='teacher-b'));
  await b.context.toggleFavorite('resource-1');
  assert(!b.context.favoriteResourceIds.has('resource-1'));
  assert(operations.some(op=>op[0]==='delete'));
  assert(operations.some(op=>op[0]==='eq'&&op[1]==='user_id'&&op[2]==='teacher-b'));
});

test('stale favorites loading from a prior account cannot unlock a newer account request', async () => {
  let currentUser={id:'teacher-a'}, generation=1;
  const deferred=[];
  const b=browser({
    user:currentUser,member:{status:'approved'},isAdmin:false,resources:[],favoriteResourceIds:new Set(),
    favoriteOffset:0,favoriteHasMore:false,favoriteLoading:false,favoriteRefreshPending:false,favoriteLoadRequest:0,PAGE_SIZE:50,
    captureCommunitySession:()=>({user:currentUser,generation}),communitySessionIsCurrent:s=>s.generation===generation&&s.user.id===currentUser.id,
    client:{from:()=>{
      let resolve;
      const promise=new Promise(done=>{resolve=done;});
      deferred.push({resolve});
      const q=query({data:[],error:null});
      q.then=(yes,no)=>promise.then(yes,no);
      return q;
    }}
  });
  b.context.$=id=>{if(!b.nodes.has(id))b.nodes.set(id,node());return b.nodes.get(id);};
  b.context.document.querySelectorAll=()=>[];
  b.run(between(source('teacher-community.js'),'  async function loadFavorites(reset = true)','  async function updateMyStats'));
  b.run(between(source('teacher-community.js'),'  function clearCommunityView()','  const PAGE_SIZE'));
  const oldRequest=b.context.loadFavorites(true);
  assert.equal(b.context.favoriteLoading,true);

  currentUser={id:'teacher-b'};generation++;
  b.context.user=currentUser;
  b.context.clearCommunityView();
  const newRequest=b.context.loadFavorites(true);
  assert.equal(deferred.length,2);
  deferred[0].resolve({data:[],error:null});
  await oldRequest;
  assert.equal(b.context.favoriteLoading,true,'the old response must not clear the new request lock');
  deferred[1].resolve({data:[],error:null});
  await newRequest;
  assert.equal(b.context.favoriteLoading,false);
});
