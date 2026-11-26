const test=require('node:test');
const assert=require('node:assert/strict');
const {browser,source,query}=require('./helpers.cjs');
const D=require('../student-platform-domain.js');

test('the new library preserves legacy cloud uploads, canonical tracking keys and private favorites',async()=>{
  const p=D.profile({id:'fixture-student',role:'student',study_level:'2BAC',study_track:'2BACSVT',display_name:'Fixture'});
  const privateId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const uploads=[
    {id:'upload-one',title:'درس مرفوع',category:'cours',language:'francais',study_level:'2BAC',study_track:'2BACSVT',file_name:'chapter.pdf',storage_path:'owner/chapter.pdf',size_bytes:100},
    {id:'wrong-track',title:'مورد لمسلك آخر',category:'cours',language:'francais',study_level:'2BAC',study_track:'2BACSM',file_name:'other.pdf',storage_path:'owner/other.pdf',size_bytes:100},
    {id:'wrong-level',title:'مورد لمستوى آخر',category:'cours',language:'arabe',study_level:'TC',study_track:'TCS',file_name:'tc.pdf',storage_path:'owner/tc.pdf',size_bytes:100}
  ];
  const client={auth:{getUser:async()=>({data:{user:{id:p.id}},error:null})},storage:{from:()=>({getPublicUrl:(name,options)=>({data:{publicUrl:'https://storage.example.invalid/'+name+(options?'?download=chapter.pdf':'')}})})},from:table=>query({data:table==='site_content_items'?uploads:table==='student_favorites'?[{content_key:'private-lesson:'+privateId}]:table==='private_student_lessons'?[{id:privateId,title:'درس خاص',study_level:'2BAC',study_track:'2BACSVT',language:'ar'}]:[],count:0,error:null})};
  const b=browser({GoSVTPlatformDomain:D,supabaseClient:client,StudentAccount:{getUser:()=>({id:p.id})},fetch:async()=>({ok:true,json:async()=>({resources:[]})})});
  b.run(source('student-platform-store.js'));const store=b.context.GoSVTPlatformStore.create(p);await store.load();
  const visible=store.state.resources.filter(x=>x.source==='uploaded');assert.equal(visible.length,1);
  assert.equal(visible[0].progress_key,'/cours/francais/2BAC/2BACSVT/__cloud/upload-one/chapter.pdf');
  assert.equal(visible[0].path,'https://storage.example.invalid/owner/chapter.pdf');
  assert(store.state.privateFavorites.has('private-lesson:'+privateId));
  assert.equal(store.state.resources.filter(x=>x.type==='private').length,1);store.dispose();
});
