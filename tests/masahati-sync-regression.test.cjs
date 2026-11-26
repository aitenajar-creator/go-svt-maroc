
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function harness({readResult={data:null,error:null},writeResult={error:null},sharedState=null}={}) {
  const source = fs.readFileSync(require('node:path').join(__dirname,'..','masahati.js'),'utf8');
  const start = source.indexOf('let _ps = null, _psPid = null, _saveT = null;');
  const end = source.indexOf('\nfunction bump(kind)', start);
  assert(start >= 0 && end > start);
  let currentPid='profile-1', currentUid='user-1', timerId=0, timers=new Map(), reads=0, writes=[], filters=[];
  const storage = new Map();
  let serverState=readResult&&readResult.data&&readResult.data.state?readResult.data.state:null;
  const localStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
  const merge=(left,right)=>{
    const out=Object.assign({},left||{});
    for(const [key,value] of Object.entries(right||{})) out[key]=value&&typeof value==='object'&&!Array.isArray(value)&&out[key]&&typeof out[key]==='object'&&!Array.isArray(out[key])?merge(out[key],value):value;
    return out;
  };
  const client = {
    async rpc(name,args){
      assert.equal(name,'gosvt_merge_student_platform_state');
      if(typeof writeResult==='function'){const result=writeResult(args);if(result&&result.error)return result;}
      else if(writeResult&&writeResult.error)return writeResult;
      const base=sharedState ? (sharedState.state||{}) : (serverState||{});
      const merged=merge(base,args.p_state);
      if(sharedState) sharedState.state=merged; else serverState=merged;
      writes.push({student_id:args.p_student_id,profile_id:args.p_profile_id,state:args.p_state});
      return {data:merged,error:null};
    },
    from(table) {
      assert.equal(table,'student_platform_state');
      return {
        select(){return this;}, eq(column,value){filters.push([column,value]);return this;},
        async maybeSingle(){reads++;return typeof readResult==='function'?readResult(reads):readResult;},
        async upsert(row){writes.push(row);return typeof writeResult==='function'?writeResult(row):writeResult;}
      };
    }
  };
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
    cloudPid:()=>currentUid ? 'account-default' : currentPid,
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

test('Supabase atomic merge RPC errors are detected and reported as failure',async()=>{
  const h=harness({readResult:{data:{state:{u:0}},error:null},writeResult:{error:{message:'RLS denied'}}});
  assert.equal(await h.api.pullRemote(),true);
  // Explicitly exercise the writer after hydration.
  const ok=await h.api.pushRemote({u:Date.now(),cards:{x:1}},'user-1','profile-1','account-default');
  assert.equal(ok,false);
});

test('successful empty read hydrates and seeds local state only after the read',async()=>{
  const h=harness({readResult:{data:null,error:null}});
  assert.equal(await h.api.pullRemote(),true);
  assert.deepEqual(Array.from(h.api.hydrated()),[JSON.stringify(['user-1','account-default','profile-1'])]);
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].student_id,'user-1');
  assert.equal(h.writes[0].profile_id,'account-default');
  assert.deepEqual(h.filters.slice(-2),[['student_id','user-1'],['profile_id','account-default']]);
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
  const ok=await h.api.pushRemote({u:Date.now(),payload:'x'.repeat(1024*1024+10)},'user-1','profile-1','account-default');
  assert.equal(ok,false);
  assert.equal(h.writes.length,0);
});


test('independent device edits are merged instead of replacing each other',async()=>{
  const shared={state:{u:1,cards:{},lab:{}}};
  const read=()=>({data:{state:shared.state},error:null});
  const first=harness({readResult:read,sharedState:shared});
  const second=harness({readResult:read,sharedState:shared});
  assert.equal(await first.api.pullRemote(),true);
  assert.equal(await second.api.pullRemote(),true);
  first.api.PS().cards.deckA={seen:true};
  first.api.PS().u=Date.now()+1;
  second.api.PS().lab.experimentB={done:true};
  second.api.PS().u=Date.now()+2;
  assert.equal(await first.api.pushRemote(JSON.parse(JSON.stringify(first.api.PS())),'user-1','profile-1','account-default'),true);
  assert.equal(await second.api.pushRemote(JSON.parse(JSON.stringify(second.api.PS())),'user-1','profile-1','account-default'),true);
  assert.deepEqual(JSON.parse(JSON.stringify(shared.state.cards)),{deckA:{seen:true}});
  assert.deepEqual(JSON.parse(JSON.stringify(shared.state.lab)),{experimentB:{done:true}});
});

test('same authenticated account restores one stable cloud profile across independent browsers', async()=>{
  const first = harness({readResult:{data:null,error:null}});
  first.api.PS().cards.savedAcrossDevices = {answer:'preserved'};
  first.api.PS().u = 100;
  assert.equal(await first.api.pullRemote(),true);
  assert.equal(first.writes.length,1);
  assert.equal(first.writes[0].student_id,'user-1');
  assert.equal(first.writes[0].profile_id,'account-default');

  const second = harness({readResult:{data:{state:first.writes[0].state},error:null}});
  second.switchTo('different-local-profile-id','user-1');
  assert.equal(await second.api.pullRemote(),true);
  assert.equal(second.reads(),1,'a fresh browser must read the account-level cloud row');
  assert.equal(second.api.PS().cards.savedAcrossDevices.answer,'preserved');
  assert.equal(second.writes.length,0,'a restored remote state must not be overwritten by an empty local cache');
  assert.equal(second.filters.slice(-2)[1][1],'account-default');
});