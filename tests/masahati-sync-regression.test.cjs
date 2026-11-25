
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function harness({readResult={data:null,error:null},writeResult={error:null}}={}) {
  const source = fs.readFileSync(require('node:path').join(__dirname,'..','masahati.js'),'utf8');
  const start = source.indexOf('let _ps = null, _psPid = null, _saveT = null;');
  const end = source.indexOf('\nfunction bump(kind)', start);
  assert(start >= 0 && end > start);
  let currentPid='profile-1', currentUid='user-1', timerId=0, timers=new Map(), reads=0, writes=[], filters=[];
  const storage = new Map();
  const localStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
  const client = {from(table) {
    assert.equal(table,'student_platform_state');
    return {
      select(){return this;}, eq(column,value){filters.push([column,value]);return this;},
      async maybeSingle(){reads++;return typeof readResult==='function'?readResult(reads):readResult;},
      async upsert(row){writes.push(row);return typeof writeResult==='function'?writeResult(row):writeResult;}
    };
  }};
  const ctx = {
    window:{supabaseClient:client},
    localStorage,
    TextEncoder,
    console:{warn(){}},
    Date,
    JSON,
    Object,
    Map,
    Set,
    Promise,
    unescape,
    encodeURIComponent,
    setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},
    clearTimeout(id){timers.delete(id);},
    pid:()=>currentPid,
    today:()=>20261125,
    SA:()=>({isLoggedIn:()=>!!currentUid,getUser:()=>({id:currentUid})}),
    S:{busy:false},
    mountAgain(){},
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start,end)+`
    globalThis.__api={savePS,pushRemote,pullRemote,PS,hydrated:()=>Array.from(_hydratedUsers)};
  `,ctx);
  return {ctx,api:ctx.__api,storage,timers,writes,filters,reads:()=>reads,
    switchTo:(p,u)=>{currentPid=p;currentUid=u;},
    fire:async()=>{const entries=[...timers.entries()];timers.clear();for(const [,fn] of entries)await fn();}
  };
}

test('pending save from previous account is discarded after account switch', async()=>{
  const h=harness();
  h.api.savePS();
  h.switchTo('profile-2','user-2');
  await h.fire();
  assert.equal(h.writes.length,0);
});

test('failed remote read is not marked hydrated and can be retried',async()=>{
  const h=harness({readResult:()=>({data:null,error:{message:'temporary failure'}})});
  assert.equal(await h.api.pullRemote(),false);
  assert.deepEqual(Array.from(h.api.hydrated()),[]);
  assert.equal(await h.api.pullRemote(),false);
  assert.equal(h.reads(),2);
});

test('Supabase upsert errors are detected and reported as failure',async()=>{
  const h=harness({readResult:{data:{state:{u:0}},error:null},writeResult:{error:{message:'RLS denied'}}});
  assert.equal(await h.api.pullRemote(),true);
  // Explicitly exercise the writer after hydration.
  const ok=await h.api.pushRemote({u:Date.now(),cards:{x:1}},'user-1','profile-1');
  assert.equal(ok,false);
});

test('successful empty read hydrates and seeds local state only after the read',async()=>{
  const h=harness({readResult:{data:null,error:null}});
  assert.equal(await h.api.pullRemote(),true);
  assert.deepEqual(Array.from(h.api.hydrated()),[JSON.stringify(['user-1','profile-1'])]);
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].student_id,'user-1');
  assert.equal(h.writes[0].profile_id,'profile-1');
  assert.deepEqual(h.filters.slice(-2),[['student_id','user-1'],['profile_id','profile-1']]);
});

test('local edits made while the cloud read is pending are preserved and uploaded', async()=>{
  let release;
  const pendingRead = new Promise(resolve=>{release=resolve;});
  const h=harness({readResult:()=>pendingRead});
  const pull=h.api.pullRemote();
  // Simulate a learner editing the local platform before the first cloud read returns.
  h.api.PS().cards.localEdit={answer:'kept'};
  h.api.PS().u=Date.now()+1000;
  release({data:null,error:null});
  assert.equal(await pull,true);
  assert.equal(h.writes.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].state.cards.localEdit)),{answer:'kept'});
});

test('oversized state is rejected before a cloud upsert', async()=>{
  const h=harness({readResult:{data:{state:{u:0}},error:null}});
  assert.equal(await h.api.pullRemote(),true);
  h.writes.length=0;
  const ok=await h.api.pushRemote({u:Date.now(),payload:'x'.repeat(1024*1024+10)},'user-1','profile-1');
  assert.equal(ok,false);
  assert.equal(h.writes.length,0);
});


test('cloud state is isolated by profile even when profiles share one auth UID', async()=>{
  const h=harness({readResult:{data:null,error:null}});
  assert.equal(await h.api.pullRemote(),true);
  assert.equal(h.reads(),1);
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].profile_id,'profile-1');

  h.switchTo('profile-2','user-1');
  assert.equal(await h.api.pullRemote(),true);
  assert.equal(h.reads(),2,'a second profile must perform its own cloud read');
  assert.equal(h.writes.length,2,'a second profile must seed a separate cloud row');
  assert.equal(h.writes[1].student_id,'user-1');
  assert.equal(h.writes[1].profile_id,'profile-2');
  assert.deepEqual(Array.from(h.api.hydrated()).sort(),[
    JSON.stringify(['user-1','profile-1']),
    JSON.stringify(['user-1','profile-2'])
  ].sort());
});