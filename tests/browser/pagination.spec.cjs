const {test,expect}=require('@playwright/test');
const {source,between}=require('../helpers.cjs');

test('all 151 submissions remain reachable and pending filtering runs before paging',async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:8765'?route.continue():route.abort());
  await page.goto('/offline.html');
  await page.evaluate(()=>{
    document.body.innerHTML='<div id="fixture-submissions"></div>';
    const records=Array.from({length:151},(_,i)=>({id:'submission-'+i,assignment_id:'assignment-1',student_id:'student-fixture',answer:'Answer '+i,score:i?15:null,feedback:'',reviewed_at:i?'2026-11-24T12:00:00Z':null,submitted_at:new Date(Date.parse('2026-11-24T00:00:00Z')+i*1000).toISOString(),teacher_assignments:{id:'assignment-1',title:'Fixture assignment',class_id:'class-1'}}));
    window.fixtureClient={from(table){
      let rows=table==='teacher_assignments'?[{id:'assignment-1',title:'Fixture assignment',class_id:'class-1'}]:records.slice();
      let start=0,end=199;const orders=[];
      const q={select(){return this;},in(){return this;},eq(key,value){rows=rows.filter(row=>row[key]===value);return this;},is(key,value){rows=rows.filter(row=>row[key]===value);return this;},not(key,operator,value){rows=rows.filter(row=>row[key]!==value);return this;},order(key,options={}){orders.push([key,options.ascending!==false]);return this;},range(a,b){start=a;end=b;return this;},then(resolve,reject){
        rows.sort((a,b)=>{for(const [key,asc] of orders){const n=String(a[key]||'').localeCompare(String(b[key]||''));if(n)return n*(asc?1:-1);}return 0;});
        return Promise.resolve({data:rows.slice(start,end+1),count:rows.length,error:null}).then(resolve,reject);
      }};return q;
    }};
  });
  const classroom=source('teacher-classroom.js');
  const code='const client=window.fixtureClient;const tr=(ar,fr)=>fr;const esc=value=>String(value);\n'+
    between(classroom,'  let submissionPageLoader = null;','  async function loadTeacherExtras')+
    between(classroom,'  function applySubmissionFilters(){','  function applyRosterFilters(){');
  await page.addScriptTag({content:code});
  await page.evaluate(()=>renderTeacherSubmissions(document.getElementById('fixture-submissions'),['class-1'],{id:'teacher'}));
  await expect(page.locator('[data-submission-card]')).toHaveCount(50);
  await page.locator('#gs-cl-submission-status').selectOption('pending');
  await expect(page.locator('[data-submission-card]')).toHaveCount(1);
  await expect(page.locator('[data-score-for="submission-0"]')).toBeVisible();
  await page.locator('#gs-cl-submission-status').selectOption('all');
  await expect(page.locator('[data-submission-card]')).toHaveCount(50);
  await page.locator('#gs-cl-submission-more').click();
  await expect(page.locator('[data-submission-card]')).toHaveCount(100);
  await page.locator('#gs-cl-submission-more').click();
  await expect(page.locator('[data-submission-card]')).toHaveCount(150);
  await page.locator('#gs-cl-submission-more').click();
  await expect(page.locator('[data-submission-card]')).toHaveCount(151);
  await expect(page.locator('#gs-cl-submission-more')).toBeHidden();
});
