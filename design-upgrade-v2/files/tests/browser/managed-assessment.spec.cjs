const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {root}=require('../helpers.cjs');
const fixture=require('./auth-fixture.cjs');

test('managed assessment never substitutes a local or malformed grade for server confirmation',async({page})=>{
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:8765'){
      if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase-js'))return route.fulfill({contentType:'application/javascript',body:''});
      return route.abort();
    }
    if(url.pathname==='/supabase-config.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'supabase-config.js'),'utf8')});
    return route.continue();
  });
  await page.addInitScript({content:'('+fixture.toString()+')({signedIn:true});'});
  await page.goto('/index.html#student-space');await expect(page.locator('.sp-hero')).toBeVisible();
  await page.evaluate(()=>{
    const assessmentId='22222222-2222-4222-8222-222222222222',attemptId='44444444-4444-4444-8444-444444444444';
    const questions=Array.from({length:3},(_,i)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0'),prompt:'سؤال تجريبي '+(i+1),options:['اختيار أ','اختيار ب'],points:1}));
    __authFixture.assessments=[{id:assessmentId,title:'اختبار خادمي تجريبي',description:'Browser fixture only',study_level:'TC',study_tracks:['TCS'],duration_minutes:5,question_count:3,is_published:true,revision:1}];
    const old=supabaseClient.rpc;let submissions=0;
    supabaseClient.rpc=async(name,payload)=>{
      if(name==='gosvt_platform_start_assessment')return {data:{id:attemptId,assessment_id:assessmentId,title:'اختبار خادمي تجريبي',questions,answers:{},last_sequence:0,server_time:new Date().toISOString(),deadline_at:new Date(Date.now()+300000).toISOString()},error:null};
      if(name==='gosvt_platform_save_answers')return {data:{accepted:true,last_sequence:payload.p_sequence},error:null};
      if(name==='gosvt_platform_submit_assessment'){
        submissions++;__authFixture.managedSubmissions=submissions;
        if(submissions===1)return {data:null,error:{message:'Temporary fixture failure'}};
        if(submissions===2)return {data:{},error:null};
        const feedback=questions.map(q=>({...q,answer:0,selected:0,correct:true,earned:1,explanation:'شرح تجريبي من استجابة الخادم المعزول.'}));
        const submitted=new Date().toISOString();
        __authFixture.attemptRows=[{id:attemptId,student_id:__authFixture.user.id,assessment_id:assessmentId,title_snapshot:'اختبار خادمي تجريبي',started_at:submitted,submitted_at:submitted,score:3,max_score:3,feedback}];
        return {data:{id:attemptId,title:'اختبار خادمي تجريبي',score:3,maximum:3,percentage:100,feedback,submitted_at:submitted,server_graded:true},error:null};
      }
      return old(name,payload);
    };
  });
  await page.locator('.sp-topbar [data-sp-action="cloud"]').click();await page.locator('.sp-dialog [data-sp-action="refresh"]').click();
  await page.locator('.sp-nav [data-sp-route="quizzes"]').click();await expect(page.locator('[data-sp-action="assessment"]')).toHaveCount(1);
  await page.locator('[data-sp-action="assessment"]').click();await expect(page.locator('.sp-option').first()).toBeVisible();
  for(let i=0;i<3;i++){await page.locator('input[name="sp-answer"][value="0"]').check();if(i<2)await page.locator('[data-exam-next]').click();}
  await page.locator('[data-exam-finish]').click();await expect(page.locator('[data-exam-save]')).toContainText('لم نعرض نجاحًا');await expect(page.locator('.sp-score-summary')).toHaveCount(0);
  await page.locator('[data-exam-finish]').click();await expect(page.locator('[data-exam-save]')).toContainText('نتيجة تصحيح خادمي صالحة');await expect(page.locator('.sp-score-summary')).toHaveCount(0);
  await page.locator('[data-exam-finish]').click();await expect(page.locator('.sp-score-circle')).toContainText('100%');await expect(page.locator('.sp-dialog-header')).toContainText('على الخادم');
  expect(await page.evaluate(()=>__authFixture.managedSubmissions)).toBe(3);
});
