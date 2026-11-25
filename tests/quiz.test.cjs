const test=require('node:test');
const assert=require('node:assert/strict');
const {browser,node,source,flush}=require('./helpers.cjs');

function fixture(){
  let owner='student-one';const pending=new Map(),saved=[];
  const body=node(),modal=node(),title=node();modal.id='gs-quiz-modal';modal.hidden=true;
  const b=browser({SECTION_NAMES:{},isContentFile:()=>true,loadManifest:async()=>[],renderCard:()=>'',loadSection(){},refreshUiTexts(){},getFileTitle:x=>x,escapeHtml:x=>String(x),buildFileUrl:x=>x,t:(_,fr)=>fr,trackEvent(){},requestCounter:0,
    fetch:path=>new Promise(resolve=>pending.set(path,resolve)),
    StudentAccount:{isLoggedIn:()=>!!owner,getUser:()=>owner?{id:owner}:null},
    StudentSpace:{saveQuizResult:(...args)=>{saved.push({owner,args});return [];}}
  }),c=b.context;
  c.storage={get:key=>c.localStorage.getItem(key),set:(key,value)=>c.localStorage.setItem(key,value)};
  b.nodes.set('gs-quiz-modal',modal);modal.querySelector=()=>title;
  c.document.querySelector=()=>body;c.openModal=()=>{modal.hidden=false;};c.closeModal=()=>{modal.hidden=true;};
  const marker='    window.GoSVTQuiz = window.GoSVTQuiz || {};';
  const instrumented=source('learn.js').replace(marker,'    window.quizFixture = {openQuiz, renderResult, state:()=>quizState, setState:value=>quizState=value};\n'+marker);
  b.run(instrumented);
  const resolve=(path,title)=>pending.get(path)({ok:true,json:async()=>({titre:title,questions:[{question:'Fixture question',choix:['Yes','No'],reponse:1}]})});
  return {b,c,body,modal,saved,resolve,setOwner:value=>{owner=value;c.document.dispatchEvent(new c.CustomEvent('gosvt:auth-changed'));}};
}

test('late quiz responses cannot replace a more recent selection',async()=>{
  const f=fixture(),api=f.c.quizFixture;
  const a=api.openQuiz('/quiz/first.json'),b=api.openQuiz('/quiz/second.json');
  f.resolve('/quiz/second.json','Second');await b;
  f.resolve('/quiz/first.json','First');await a;
  assert.equal(api.state().path,'/quiz/second.json');
});

test('closing a loading quiz invalidates its pending response',async()=>{
  const f=fixture(),api=f.c.quizFixture;
  const loading=api.openQuiz('/quiz/first.json');
  f.c.closeModal(f.modal);f.resolve('/quiz/first.json','First');await loading;
  assert.equal(api.state(),null);assert.equal(f.modal.hidden,true);
});

test('identity changes discard the active attempt and scores remain owner-scoped',async()=>{
  const f=fixture(),api=f.c.quizFixture;
  const loading=api.openQuiz('/quiz/first.json');f.resolve('/quiz/first.json','First');await loading;
  const state=api.state();state.score=1;state.index=state.order.length;
  api.renderResult();
  assert.equal(f.saved[0].owner,'student-one');
  assert(f.c.localStorage.getItem('gosvt-quiz:student-one'));
  f.setOwner('student-two');await flush();
  assert.equal(api.state(),null);assert.equal(f.c.localStorage.getItem('gosvt-quiz:student-two'),null);
  assert.equal(f.c.localStorage.getItem('gosvt-quiz'),null);
});
