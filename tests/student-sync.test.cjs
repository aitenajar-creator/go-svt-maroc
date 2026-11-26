const test=require('node:test');
const assert=require('node:assert/strict');
const {browser,source,between,query,flush}=require('./helpers.cjs');

test('remote deletion markers remove cached notes and reject stale hydration',()=>{
  const b=browser();b.load('student-space.js');const s=b.context.StudentSpace;
  const id=s.createProfile('Fixture student');s.switchProfile(id);
  b.context.localStorage.setItem(id+'_gosvt_notes',JSON.stringify([{id:'deleted',title:'Old',body:'Old',updatedAt:1},{id:'kept',title:'Keep',body:'Keep',updatedAt:1}]));
  s.applyCloudDeletions(id,{notes:['deleted'],studyPlan:[]});
  s.mergeCloudCollections(id,[{id:'deleted',title:'Stale',body:'Stale',updatedAt:9}],[]);
  assert.deepEqual(Array.from(s.getProfileData(id).notes,n=>n.id),['kept']);
});

test('an unrelated progress save does not re-upload unchanged notes',async()=>{
  const b=browser();b.load('student-space.js');const c=b.context,s=c.StudentSpace;
  const id=s.createProfile('Fixture student');s.switchProfile(id);
  c.localStorage.setItem(id+'_gosvt_notes',JSON.stringify([{id:'one',title:'Stored',body:'Stored',updatedAt:1}]));
  const uploads=[];
  c.StudentAccount={isLoggedIn:()=>true,isReady:()=>true,activeProfileId:()=>id,getUser:()=>({id:'fixture-user'}),getProfile:()=>({role:'student'})};
  c.GoSVTCloud={syncNotes:async rows=>uploads.push(rows)};
  s.updateProgress('lesson','cours/francais/TC/TCS/fixture.pdf');await flush();
  assert(uploads.every(rows=>rows.length===0));
});

test('first account claims guest favorites without giving them to the next account',()=>{
  const b=browser({renderRevision(){}}),c=b.context;
  c.storage={get:key=>c.localStorage.getItem(key),set:(key,value)=>c.localStorage.setItem(key,value)};
  c.localStorage.setItem('gosvt-favs',JSON.stringify(['/cours/guest.pdf']));
  b.run(source('study.js').slice(0,source('study.js').indexOf('    const byPath ='))+'\n})();');
  c.GoSVTStudyFavorites.activate('one',[]);
  assert.deepEqual(Array.from(c.GoSVTStudyFavorites.get()),['/cours/guest.pdf']);
  c.GoSVTStudyFavorites.activate('two',[]);
  assert.equal(c.GoSVTStudyFavorites.get().length,0);
});

function authFixture(failMethod){
  let handler,refreshes=0;const merged=[],tables=[];
  const person={id:'fixture-user',email:'fixture@example.invalid',user_metadata:{display_name:'Fixture Student',study_level:'TC',study_track:'TCS'}};
  const b=browser(),c=b.context;c.document.readyState='complete';
  c.supabaseClient={auth:{onAuthStateChange:fn=>{handler=fn;},getSession:async()=>({data:{session:{user:person}},error:null})},from:table=>{
    tables.push(table);return query({error:null,data:table==='profiles'?{id:person.id,display_name:'Fixture Student',role:'student'}:{study_level:'2BAC',study_track:'2BACSVT'}});
  }};
  c.StudentSpace={refresh(){refreshes++;},getProfiles:()=>({'fixture-profile':{name:'Fixture Student'}}),createProfile:()=>'fixture-profile',switchProfile(){},
    applyCloudDeletions:()=>merged.push('deletions'),mergeCloudProgress:()=>merged.push('progress'),mergeCloudCollections:()=>merged.push('collections'),mergeCloudQuizAttempts:()=>merged.push('quizzes'),mergeCloudLearningState:()=>merged.push('learning'),
    getProfileData:()=>({progress:{lessons:{},exercises:{},tests:{}},notes:[],studyPlan:[],quizResults:[],goals:[],streak:{current:0,best:0,lastVisit:null}})};
  c.GoSVTCloud={loadProgress:async()=>({lessons:{}}),loadNotes:async()=>[],loadStudyPlan:async()=>[],loadQuizAttempts:async()=>[],loadLearningState:async()=>({goals:[],streak:{}}),loadCollectionDeletions:async()=>({notes:[],studyPlan:[]})};
  if(failMethod)c.GoSVTCloud[failMethod]=async()=>{throw new Error('fixture failure');};
  b.load('student-account.js');
  return {b,c,person,tables,merged,event:(event)=>handler(event,{user:person}),refreshes:()=>refreshes};
}

test('a failed learning-state read does not discard four successful datasets',async()=>{
  const f=authFixture('loadLearningState');await flush();
  assert.deepEqual(f.merged,['deletions','progress','collections','quizzes']);
  assert.equal(f.c.StudentAccount.getSyncStatus().phase,'partial');
  assert(f.c.StudentAccount.getSyncStatus().failures.includes('learningState'));
});

test('a failed deletion-marker read blocks only deletable collections',async()=>{
  const f=authFixture('loadCollectionDeletions');await flush();
  assert(!f.merged.includes('collections'));
  assert(f.merged.includes('progress'));assert(f.merged.includes('quizzes'));
});

test('a successful retry clears the previous synchronization error',async()=>{
  const f=authFixture('loadLearningState');await flush();
  assert.equal(f.c.StudentAccount.getSyncStatus().phase,'partial');
  f.c.GoSVTCloud.loadLearningState=async()=>({goals:[],streak:{current:0,best:0,lastVisit:null}});
  await f.c.StudentAccount.refreshProfile();await flush();
  assert.equal(f.c.StudentAccount.getSyncStatus().phase,'ready');
  assert.equal(f.c.StudentAccount.getSyncStatus().failures.length,0);
});

test('the account uses the server academic profile, not editable signup metadata',async()=>{
  const f=authFixture();await flush();
  assert(f.tables.includes('student_academic_profiles'));
  assert.equal(f.c.StudentAccount.getProfile().study_level,'2BAC');
  assert.equal(f.c.StudentAccount.getProfile().study_track,'2BACSVT');
});

test('same-account token refresh and repeated sign-in preserve the workspace',async()=>{
  const f=authFixture();await flush();const before=f.refreshes();
  f.event('TOKEN_REFRESHED');f.event('SIGNED_IN');
  await new Promise(resolve=>setTimeout(resolve,0));await flush();
  assert.equal(f.refreshes(),before);
});

test('resource recommendations fall back to the language that has content',async()=>{
  const b=browser({StudentAccount:{isLoggedIn:()=>true,getProfile:()=>({id:'one',role:'student',study_level:'TC',study_track:'TCS'})},loadManifest:async()=>['/cours/francais/TC/TCS/fixture.pdf'],fetch:async()=>({ok:true,json:async()=>[]})});
  b.context.document.getElementById=()=>({querySelector:()=>({dataset:{subject:'arabe'}})});
  b.load('student-learning-journey.js');await b.context.StudentLearningJourney.refresh();
  assert.equal(b.context.StudentLearningJourney.getNextStep({lessonsViewed:0}).subject,'francais');
});

test('Masahati runtime failure preserves the established student dashboard fallback',()=>{
  const code=source('student-space.js');
  const start=code.indexOf('// Optional Masahati experience');
  const fallback=code.indexOf('syncCurrentProfile();',start);
  assert(start>=0,'optional Masahati integration block exists');
  assert(fallback>start,'standard dashboard fallback follows the optional integration');
  const block=code.slice(start,fallback);
  assert.match(block,/try\s*\{/,'Masahati mount is guarded');
  assert.match(block,/window\.Masahati\.mount\(container\)/,'the optional mount is invoked');
  assert.match(block,/catch\s*\(error\)/,'runtime mount failures are caught');
  assert.match(block,/standard student dashboard/,'the fallback behavior is documented');
});
