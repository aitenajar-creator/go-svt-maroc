const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {root,source,between,browser,node,query}=require('./helpers.cjs');

test('submission filters and pagination are sent to the database',async()=>{
  const operations=[];
  const b=browser({client:{from:table=>{assert.equal(table,'teacher_assignment_submissions');return query({data:[{id:'old-ungraded'}],count:1,error:null},operations);}}});
  b.run(between(source('teacher-classroom.js'),'  function submissionQuery(','  async function renderTeacherSubmissions'));
  const result=await b.context.submissionQuery(['class-1'],'all','pending').range(0,49);
  assert(operations.some(x=>x[0]==='is'&&x[1]==='reviewed_at'&&x[2]===null));
  assert(operations.some(x=>x[0]==='in'&&x[1]==='teacher_assignments.class_id'));
  assert(!operations.some(x=>x[0]==='limit'));
  assert.equal(result.data[0].id,'old-ungraded');
});

test('reply retries retain the same idempotency token and use one RPC',async()=>{
  const field=node();field.value='A helpful reply';const requests=[];
  const b=browser({busy:false,CSS:{escape:s=>s},currentUser:async()=>({id:'teacher'}),actionSessionIsCurrent:()=>true,tr:(_,fr)=>fr,notice(){},renderThread:async()=>{},client:{rpc:async(name,payload)=>{requests.push({name,payload});return {error:requests.length===1?new Error('Temporary response failure'):null};}}});
  b.context.document.querySelector=()=>field;
  b.run('function actionSessionIsCurrent(){return true;}\n'+between(source('teacher-classroom.js'),'  async function act(button)','  async function refreshPanel'));
  const button={dataset:{action:'reply',id:'question'},isConnected:true};
  await b.context.act(button);await b.context.act(button);
  assert.equal(requests.length,2);assert(requests.every(x=>x.name==='gosvt_send_teacher_reply'));
  assert.equal(requests[0].payload.p_client_message_id,requests[1].payload.p_client_message_id);
});

test('community reset erases administrative lists and hides the admin panel',()=>{
  const b=browser({resources:[{title:'Private fixture'}]}),c=b.context;
  const tabs=['mine','pending','admin'].map(name=>{const tab=node();tab.dataset.panel=name;return tab;});
  c.document.querySelectorAll=()=>tabs;
  c.$=id=>{if(!b.nodes.has(id))b.nodes.set(id,node());return b.nodes.get(id);};
  c.$('tc-admin-members').innerHTML='Private fixture';c.$('tc-admin-panel').hidden=false;
  b.run(between(source('teacher-community.js'),'  function clearCommunityView()','  const PAGE_SIZE'));
  c.clearCommunityView();
  assert.equal(c.$('tc-admin-members').innerHTML,'');assert.equal(c.$('tc-admin-panel').hidden,true);
  assert.equal(c.resources.length,0);
});

test('admin reset clears cached identities, exports and visible lists',()=>{
  const b=browser({currentUser:{id:'admin'},adminSessionGeneration:0,resourceCache:[1],roleRequestCache:[1],accountCache:[1],activityCache:[1],pedagogicalReportRows:[1],dashboard:node(),loginPanel:node()}),c=b.context;
  c.$=id=>{if(!b.nodes.has(id))b.nodes.set(id,node());return b.nodes.get(id);};
  c.$('resource-list').innerHTML='Private fixture';
  b.run(between(source('admin.js'),'  function clearAdminSession()','  let resourceCache'));
  c.clearAdminSession();assert.equal(c.currentUser,null);assert.equal(c.dashboard.hidden,true);
  assert.equal(c.$('resource-list').innerHTML,'');assert.equal(c.accountCache.length,0);assert.equal(c.pedagogicalReportRows,null);
});

test('role-request CSV has a real UTF-8 BOM and CRLF records',()=>{
  const block=between(source('admin.js'),"  $('role-requests-export').addEventListener", "  $('role-requests-refresh')");
  const line=block.split('\n').find(line=>line.includes('const csv ='));
  const b=browser({output:[['الاسم','التفاصيل'],['طالب','قال "نعم", اليوم']],cell:value=>'"'+String(value).replace(/"/g,'""')+'"'});
  const csv=b.run(line+'\ncsv');
  assert.equal(csv.charCodeAt(0),0xfeff);assert.equal(csv.split('\r\n').length,2);
  assert(csv.includes('""نعم""'));assert(!csv.includes('\\r\\n'));
});

test('the CI load-order guard checks cache-busted script URLs',()=>{
  const parent=path.join(root,'test-results');fs.mkdirSync(parent,{recursive:true});
  const dir=fs.mkdtempSync(path.join(parent,'order-'));
  try{
    for(const name of ['student-account.js','student-space.js','student-space-continue.js'])fs.writeFileSync(path.join(dir,name),'');
    fs.writeFileSync(path.join(dir,'index.html'),'<script src="student-account.js?v=1"></script><script src="student-space.js?v=2"></script><script src="student-space-continue.js?v=3"></script>');
    const result=spawnSync('python3',['-B',path.join(root,'scripts/check-site.py'),dir],{encoding:'utf8'});
    assert.notEqual(result.status,0);assert((result.stdout+result.stderr).includes('must precede'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('thread responses are discarded when the signed-in account changes during loading',async()=>{
  const host=node();let calls=0;
  const b=browser({
    document:Object.assign({},browser().context.document,{getElementById:id=>id==='gs-cl-thread-question'?host:null}),
    currentUser:async()=>({id:++calls===1?'teacher-a':'teacher-b'}),
    StudentAccount:{getUser:()=>({id:'teacher-b'})},
    client:{from:()=>query({data:[{id:'message',sender_id:'teacher-a',body:'private thread',created_at:'2026-01-01T00:00:00Z'}],error:null})},
    tr:(_,fr)=>fr,esc:value=>String(value)
  });
  b.run(between(source('teacher-classroom.js'),'  async function renderThread(id)','  function profileForNotePermission'));
  await b.context.renderThread('question');
  assert.equal(host.innerHTML,'');
});

test('classroom session guard rejects stale users and detached panels',()=>{
  const panel=node();
  const b=browser({StudentAccount:{isLoggedIn:()=>true,getUser:()=>({id:'account-b'})}});
  b.run(between(source('teacher-classroom.js'),'  function sessionIsCurrent(user,host)','  async function profileFor'));
  assert.equal(b.context.sessionIsCurrent({id:'account-a'},panel),false);
  assert.equal(b.context.sessionIsCurrent({id:'account-b'},panel),true);
  panel.isConnected=false;
  assert.equal(b.context.sessionIsCurrent({id:'account-b'},panel),false);
});

test('teacher pin loading stops when the account disappears during inbox loading',()=>{
  const block=between(source('teacher-classroom.js'),'      const activeTeacher=await currentUser();','      const pinnedIds=');
  const guard=block.indexOf('if(!activeTeacher||!sessionIsCurrent(user,host))return;');
  const query=block.indexOf("client.from('teacher_question_pins')");
  assert(guard>=0&&query>guard,'the active account must be revalidated before querying its pins');
});

test('teacher actions stop before work when the active account changes',()=>{
  const block=between(source('teacher-classroom.js'),'  async function act(button)','  async function refreshPanel');
  const user=block.indexOf('const user=await currentUser()');
  const guard=block.indexOf('if(!actionSessionIsCurrent(user))return;');
  const firstAction=block.indexOf("if(action==='refresh-panel')");
  assert(user>=0&&guard>user&&firstAction>guard,'actions must verify the captured user against the active session before dispatch');
  const pinRead=block.indexOf(".from('teacher_question_pins').select('question_id')");
  const pinGuard=block.indexOf('if(!actionSessionIsCurrent(user))return;',pinRead);
  const pinWrite=block.indexOf(".from('teacher_question_pins').delete()",pinRead);
  assert(pinRead>=0&&pinGuard>pinRead&&pinWrite>pinGuard,'pin changes must revalidate the session after the lookup and before writing');
});

test('classroom mutations verify the session before writes and after responses',()=>{
  const block=between(source('teacher-classroom.js'),'  async function act(button)','  async function refreshPanel');
  for(const marker of [
    "client.from('teacher_student_support_plans').insert(",
    "client.from('teacher_student_notes').insert(",
    "client.from('teacher_student_notes').update(",
    "client.from('teacher_student_notes').delete(",
    "client.from('teacher_assignments').insert(",
    "client.from('teacher_assignment_submissions').insert(",
    "client.from('teacher_assignment_submissions').update(",
    "client.from('teacher_question_pins').delete(",
    "client.from('teacher_question_pins').insert(",
    "client.rpc('gosvt_set_student_academic_profile'",
    "client.rpc('gosvt_join_teacher_class'",
    "client.rpc('gosvt_send_teacher_reply'"
  ]){
    const request=block.indexOf(marker);
    const before=block.lastIndexOf('if(!actionSessionIsCurrent(user))return;',request);
    const after=block.indexOf('if(!actionSessionIsCurrent(user))return;',request);
    assert(request>=0&&before>=0&&after>request,'session must be checked before and after '+marker);
  }
});

test('classroom roster and student reports discard stale account responses',()=>{
  const block=between(source('teacher-classroom.js'),'  async function act(button)','  async function refreshPanel');
  for(const marker of [
    "client.rpc('gosvt_teacher_class_roster'",
    "client.from('teacher_assignments').select('id,title,due_at')",
    "client.from('teacher_assignment_submissions').select('assignment_id,student_id,submitted_at,score')",
    "client.rpc('gosvt_teacher_student_assignment_trend'",
    "client.from('teacher_student_support_plans').select('id,title,actions,success_criteria,due_at,status,created_at')",
    "client.from('teacher_student_notes').select('id,note,note_type,created_at,teacher_id')"
  ]){
    const request=block.indexOf(marker);
    const guard=block.indexOf('if(!actionSessionIsCurrent(user))return;',request);
    assert(request>=0&&guard>request,'the active account must be revalidated after '+marker);
  }
});


test('teacher community requests reject stale account generations',()=>{
  const b=browser({user:{id:'teacher-a'},sessionGeneration:7});
  b.run(between(source('teacher-community.js'),'  function captureCommunitySession()','  function clearCommunityView()'));
  const snapshot=b.context.captureCommunitySession();
  assert.equal(b.context.communitySessionIsCurrent(snapshot),true);
  b.context.sessionGeneration=8;
  assert.equal(b.context.communitySessionIsCurrent(snapshot),false);
  b.context.sessionGeneration=7;
  b.context.user={id:'teacher-b'};
  assert.equal(b.context.communitySessionIsCurrent(snapshot),false);
});


test('teacher community mutations revalidate the account around writes',()=>{
  const community=source('teacher-community.js');
  const cases=[
    ['async function handleEditResource(e)','async function findResource(id)','client.from(\'teacher_community_resources\').update(','updated.error'],
    ['async function safelyDeleteResource(r, session = captureCommunitySession())','async function deleteResource(id)','client.from(\'teacher_community_resources\')','hidden.error'],
    ['async function handleUpload(e)','async function handleAdminAction(e)','client.storage.from(\'teacher-community\').upload(','upload.error'],
    ['async function handleAdminAction(e)','async function inviteFriends()','client.from(\'teacher_community_members\').update(','updated.error']
  ];
  for(const [start,end,requestMarker,responseMarker] of cases){
    const block=between(community,start,end);
    const request=block.indexOf(requestMarker);
    const before=block.lastIndexOf('communitySessionIsCurrent(session)',request);
    const after=block.indexOf('communitySessionIsCurrent(session)',request);
    assert(request>=0&&before>=0&&after>request,'session must be checked around '+requestMarker);
    assert(block.indexOf(responseMarker,request)>=0,'expected response handling after '+requestMarker);
  }
});


test('teacher community preview, download, edit and sharing stop on stale sessions',()=>{
  const community=source('teacher-community.js');
  for(const [start,end,request] of [
    ['async function downloadResource(id)','async function previewResource(id)','createSignedUrl'],
    ['async function previewResource(id)','let editingResourceId','createSignedUrl'],
    ['async function openEditResource(id)','async function handleEditResource(e)','await findResource(id)'],
    ['async function toggleShare(id)','async function loadAdmin(reset = true, only = \'both\')','update({is_shared:']
  ]){
    const block=between(community,'  '+start,'  '+end);
    const requestAt=block.indexOf(request);
    const guardBefore=block.lastIndexOf('communitySessionIsCurrent(session)',requestAt);
    const guardAfter=block.indexOf('communitySessionIsCurrent(session)',requestAt);
    assert(requestAt>=0&&guardBefore>=0&&guardAfter>requestAt,'resource action must validate its session around '+request);
  }
});
