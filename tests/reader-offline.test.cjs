const test=require('node:test');
const assert=require('node:assert/strict');
const {source,between,browser,node,vm}=require('./helpers.cjs');

test('reader load and resize retain the saved resume position',()=>{
  const b=browser(),c=b.context,handlers={};
  const resume=node(),progress=node(),bar=node();
  const win={document:{documentElement:{scrollHeight:2000,scrollTop:0}},innerHeight:1000,scrollY:0,addEventListener:(name,fn)=>handlers[name]=fn,scrollTo(value){this.lastScroll=value;}};
  Object.assign(c,{$:id=>id==='reading-progress-bar'?bar:null,frame:{contentWindow:win,addEventListener:(name,fn)=>handlers['frame:'+name]=fn},resumeButton:resume,readingProgress:progress,readingKey:'reading-fixture'});
  c.localStorage.setItem(c.readingKey,JSON.stringify({position:400,percent:40}));
  b.run(between(source('lesson-reader.js'),' let savedPosition=0;',' // Load via document.write'));
  handlers['frame:load']();handlers.resize();
  assert.equal(JSON.parse(c.localStorage.getItem(c.readingKey)).position,400);
  assert.equal(resume.hidden,false);resume.handlers.click();assert.equal(win.lastScroll.top,400);
  win.scrollY=600;handlers.scroll();assert.equal(JSON.parse(c.localStorage.getItem(c.readingKey)).position,600);
});

test('objectives save only the current lesson row',async()=>{
  const rows=new Map();
  function fixture(id){
    let change;
    const b=browser({savedObjectives:[],id,user:{id:'student'},lessonSessionIsCurrent:()=>true,status:node(),renderObjectiveProgress(){},list:{querySelectorAll:()=>[{checked:true},{checked:false}],addEventListener:(_,fn)=>change=fn},client:{from:table=>({upsert:async row=>{assert.equal(table,'student_lesson_objectives');rows.set(row.lesson_id,row);return {error:null};}})}});
    b.run(between(source('lesson-reader.js'),'  let objectiveSaveQueue=Promise.resolve();',"  $('lesson-frame-wrap').before(panel);")+'\nglobalThis.waitForSave=()=>objectiveSaveQueue;');
    return async()=>{change();await b.context.waitForSave();};
  }
  const saveA=fixture('lesson-a'),saveB=fixture('lesson-b');
  await saveA();await saveB();assert.equal(rows.size,2);
  assert.deepEqual(Array.from(rows.get('lesson-a').checked_indices),[0]);
});

test('failed completion persistence shows an error instead of success',async()=>{
  const submit=node(),feedback=node();let output='';feedback.insertAdjacentHTML=(_,html)=>output+=html;
  const b=browser({user:{id:'student'},id:'lesson',lessonSessionIsCurrent:()=>true,quiz:{querySelector:selector=>selector==='#gs-checkpoint-submit'?submit:feedback},form:{querySelector:()=>({value:'0'})},bank:[1,2,3].map(n=>({correct:0,why:'Fixture '+n})),client:{from:()=>({upsert:async()=>({error:new Error('Fixture save failure')})})}});
  b.run(between(source('lesson-reader.js')," const submit=quiz.querySelector('#gs-checkpoint-submit');",'\n }\n\n}\nstart()'));
  await submit.handlers.click();assert(output.includes('تعذر حفظ'));
  assert(!output.includes('تم تسجيل إنجاز'));assert.equal(submit.disabled,false);
});


test('completion cleanup does not update controls after the lesson session becomes stale',async()=>{
  const submit=node(),feedback=node();let current=true;
  feedback.insertAdjacentHTML=()=>{};
  const b=browser({user:{id:'student'},id:'lesson',lessonSessionIsCurrent:()=>current,quiz:{querySelector:selector=>selector==='#gs-checkpoint-submit'?submit:feedback},form:{querySelector:()=>({value:'0'})},bank:[1,2,3].map(n=>({correct:0,why:'Fixture '+n})),client:{from:()=>({upsert:async()=>{current=false;return {error:null};}})}});
  b.run(between(source('lesson-reader.js')," const submit=quiz.querySelector('#gs-checkpoint-submit');",'\n }\n\n}\nstart()'));
  await submit.handlers.click();
  assert.equal(submit.disabled,true,'stale completion cleanup must not re-enable the old session control');
});

test('offline fallback prefers fresh runtime assets to initial shell assets',async()=>{
  const handlers={},stores=new Map();
  function cache(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {match:async request=>store.get(typeof request==='string'?request:request.url)?.clone(),put:async(request,response)=>store.set(typeof request==='string'?request:request.url,response.clone())};}
  const context=vm.createContext({URL,Request,Response,caches:{open:async name=>cache(name)},fetch:async()=>new Response('fresh'),self:{location:{origin:'https://fixture.invalid'},addEventListener:(name,fn)=>handlers[name]=fn}});
  vm.runInContext(source('sw.js'),context);
  const shell=vm.runInContext('SHELL_CACHE',context);
  await cache(shell).put('https://fixture.invalid/script.js',new Response('old'));
  async function request(){let value;handlers.fetch({request:new Request('https://fixture.invalid/script.js?v=2'),respondWith:p=>value=p});return(await value).text();}
  assert.equal(await request(),'fresh');context.fetch=async()=>{throw new Error('Offline fixture');};
  assert.equal(await request(),'fresh');
});

test('reader session guard invalidates stale account work but tolerates token refresh',()=>{
  const b=browser();
  let authListener,unsubscribed=false;
  b.context.client={auth:{onAuthStateChange:listener=>{
    authListener=listener;
    return {data:{subscription:{unsubscribe(){unsubscribed=true;}}}};
  }}};
  b.run(between(source('lesson-reader.js'),'function watchLessonSession','let lessonSessionIsCurrent')+'\nglobalThis.watchLessonSession=watchLessonSession;');
  const guard=b.context.watchLessonSession(b.context.client,'student-a');
  assert.equal(guard.isCurrent(),true);
  authListener('TOKEN_REFRESHED',{user:{id:'student-a'}});
  assert.equal(guard.isCurrent(),true);
  authListener('SIGNED_IN',{user:{id:'student-b'}});
  assert.equal(guard.isCurrent(),false);
  authListener('SIGNED_IN',{user:{id:'student-a'}});
  assert.equal(guard.isCurrent(),false);
  guard.unsubscribe();
  assert.equal(unsubscribed,true);
});
