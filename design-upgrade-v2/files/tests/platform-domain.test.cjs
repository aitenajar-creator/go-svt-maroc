const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {root}=require('./helpers.cjs');
const D=require('../student-platform-domain.js');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'student-platform-catalog.json'),'utf8')).resources;

test('student profiles require a valid authoritative level/track pair',()=>{
  assert.equal(D.profile({id:'one',role:'teacher',study_level:'TC',study_track:'TCS'}),null);
  assert.equal(D.profile({id:'one',role:'student',study_level:'TC',study_track:'2BACSVT'}),null);
  assert.equal(D.profile({id:'one',role:'student',study_level:'2BAC',study_track:'2BACSVT'}).track,'2BACSVT');
});
test('each academic profile receives only its own resources plus explicitly shared skills',()=>{
  for(const [level,tracks] of Object.entries(D.TRACKS))for(const track of tracks){
    const p=D.profile({id:'fixture-'+track,role:'student',study_level:level,study_track:track});
    const visible=catalog.filter(r=>D.allowed(r,p));assert(visible.length>0);
    assert(visible.every(r=>r.scope==='shared-skill'||(r.level===level&&r.tracks.includes(track))));
    if(level!=='2BAC')assert(!visible.some(r=>r.type==='examens'));
  }
});
test('the catalog references existing documents rather than made-up resource URLs',()=>{
  const ids=new Set();
  for(const r of catalog){assert(!ids.has(r.id),r.id);ids.add(r.id);assert(fs.existsSync(path.join(root,r.path.replace(/^\//,''))),r.path);}
  assert(catalog.some(r=>r.exam_kind==='subject'&&r.correction_path));
});
test('all published repository training banks have valid, one-based source answers',()=>{
  for(const r of catalog.filter(x=>x.type==='quiz')){
    const raw=JSON.parse(fs.readFileSync(path.join(root,r.path.replace(/^\//,'')),'utf8'));
    const quiz=D.normalizeQuiz(raw);assert.equal(quiz.questions.length,r.questions);
    const answers=Object.fromEntries(quiz.questions.map(q=>[q.id,q.answer]));
    assert.equal(D.grade(quiz.questions,answers).percentage,100);
  }
});
test('practice grading treats missing responses as unanswered, not answer zero',()=>{
  const quiz=D.normalizeQuiz({questions:[{question:'Fixture question',choix:['A','B'],reponse:1,explication:'Fixture explanation'}]});
  assert.equal(quiz.questions[0].answer,0);assert.equal(D.grade(quiz.questions,{}).score,0);assert.equal(D.grade(quiz.questions,{q1:0}).score,1);
  assert.throws(()=>D.normalizeQuiz({questions:[{question:'Invalid index',choix:['A','B'],reponse:0}]}));
});
test('Mendelian crosses calculate all genotype and phenotype proportions correctly',()=>{
  assert.deepEqual(D.cross('Aa','Aa').counts,{AA:25,Aa:50,aa:25});assert.equal(D.cross('AA','aa').counts.Aa,100);
  assert.equal(D.cross('aa','aa').recessive,100);
  for(const a of ['AA','Aa','aa'])for(const b of ['AA','Aa','aa'])assert.equal(Object.values(D.cross(a,b).counts).reduce((s,x)=>s+x,0),100);
});
test('illustrative science models obey their declared boundary conditions',()=>{
  assert.equal(D.photosynthesis(0,600,25),0);assert.equal(D.photosynthesis(100,0,25),0);
  assert(D.photosynthesis(100,600,25)>D.photosynthesis(100,600,50));
  assert(D.soil(100).infiltration>D.soil(0).infiltration);assert(D.soil(100).retention<D.soil(0).retention);
});
test('unsafe link schemes and embedded credentials are not made into resource links',()=>{
  assert.equal(D.safeUrl('javascript:void(0)'), '');assert.equal(D.safeUrl('https://user:password@example.invalid/'), '');
  assert.equal(D.safeUrl('/cours/example.pdf','https://school.invalid'),'https://school.invalid/cours/example.pdf');
});
test('course ordering uses unit/chapter sequence rather than incidental filenames',()=>{
  const lessons=catalog.filter(r=>r.level==='2BAC'&&r.type==='cours'&&r.tracks.includes('2BACSVT')).sort((a,b)=>(a.sequence||9999)-(b.sequence||9999));
  assert(lessons[0].title.includes('تحرير الطاقة'));assert(lessons[1].title.includes('العضلة'));
});
