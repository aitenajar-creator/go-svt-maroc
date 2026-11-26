const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {root}=require('../helpers.cjs');
const fixture=require('./auth-fixture.cjs');
const origin='http://127.0.0.1:8765';
async function localOnly(page,options){
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){if(options&&url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase-js'))return route.fulfill({contentType:'application/javascript',body:''});return route.abort();}
    if(options&&url.pathname==='/supabase-config.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'supabase-config.js'),'utf8')});
    return route.continue();
  });
  if(options)await page.addInitScript({content:'('+fixture.toString()+')('+JSON.stringify(options)+');'});
  page.on('dialog',dialog=>dialog.accept());
}
async function preview(page,track='2BACSVT'){
  await localOnly(page);await page.goto('/student-preview.html?track='+track);
  await expect(page.locator('.sp-hero')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}
const nav=(page,id)=>page.locator('.sp-nav [data-sp-route="'+id+'"]');

test('the real catalog is personalized and the preview is clearly labeled',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await preview(page,'TCS');
  await expect(page.locator('.sp-preview-bar')).toContainText('لا اتصال ببيانات الإنتاج');
  await expect(page.locator('.sp-level-chip')).toContainText('الجذع المشترك');
  await nav(page,'exams').click();await expect(page.locator('#sp-main')).toContainText('لا توجد مواضيع مؤرشفة');
  await nav(page,'library').click();await expect(page.locator('.sp-course-card').first()).toBeVisible();
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'student-platform-catalog.json'),'utf8')).resources;
  const ids=await page.locator('.sp-course-card [data-sp-action="open"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.id));
  expect(ids.length).toBeGreaterThan(0);expect(ids.every(id=>catalog.some(r=>r.id===id&&r.level==='TC'&&r.tracks.includes('TCS')))).toBeTruthy();
  expect(errors).toEqual([]);
});

test('planning and notes persist locally and do not move to another preview profile',async({page})=>{
  await preview(page);
  await page.locator('[data-sp-action="suggest-plan"]').first().click();await nav(page,'planner').click();
  await expect(page.locator('.sp-task-row')).toHaveCount(3);
  await page.locator('.sp-check').first().click();await expect(page.locator('.sp-check[aria-checked="true"]')).toHaveCount(1);
  await nav(page,'notes').click();await page.locator('.sp-page-heading [data-sp-action="note"]').click();
  await page.locator('#sp-record-title').fill('فكرة محفوظة');await page.locator('#sp-record-body').fill('التركيب الضوئي نموذج نفهم به علاقة المتغيرات.');
  await page.locator('#sp-record-form [type=submit]').click();await expect(page.locator('.sp-note-card')).toHaveCount(1);
  await page.reload();await expect(page.locator('.sp-note-card')).toHaveCount(1);
  await page.locator('#sp-preview-track').selectOption('TCS');await expect(page.locator('.sp-level-chip')).toContainText('الجذع المشترك');
  await nav(page,'notes').click();await expect(page.locator('.sp-note-card')).toHaveCount(0);
});

test('virtual experiments calculate real model outputs and export recorded trials only',async({page})=>{
  await preview(page);await nav(page,'labs').click();await page.locator('[data-sp-action="lab"][data-id="genetics"]').click();
  await expect(page.locator('.sp-punnett div')).toHaveCount(4);await expect(page.locator('.sp-lab-display')).toContainText('25%');
  await page.locator('[data-lab-record]').click();await page.locator('#sp-lab-mother').selectOption('AA');await page.locator('[data-lab-record]').click();
  await page.locator('#sp-lab-father').selectOption('aa');await page.locator('[data-lab-record]').click();
  await expect(page.locator('[data-lab-table] tbody tr')).toHaveCount(3);
  await expect(page.locator('.sp-lab-display')).toContainText('صفة سائدة: 100%');
  const download=page.waitForEvent('download');await page.locator('[data-lab-export]').click();expect((await download).suggestedFilename()).toBe('gosvt-genetics-trials.csv');
});

test('practice preserves its deadline on reload and grades the actual bank correctly',async({page})=>{
  await preview(page);await nav(page,'quizzes').click();
  await page.locator('[data-sp-action="practice"][data-id$="plateforme-energie.json"]').click();await expect(page.locator('.sp-option').first()).toBeVisible();
  const deadline=await page.evaluate(()=>JSON.parse(localStorage.getItem('gosvt-platform-v1:'+StudentAccount.getUser().id)).activeExam.deadline);
  await page.locator('[data-sp-close]').click();await page.reload();await page.locator('[data-sp-action="resume"]').click();
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('gosvt-platform-v1:'+StudentAccount.getUser().id)).activeExam.deadline);expect(restored).toBe(deadline);
  const bank=JSON.parse(fs.readFileSync(path.join(root,'quiz/arabe/2BAC/2BACSVT/plateforme-energie.json'),'utf8'));
  for(let i=0;i<bank.questions.length;i++){await page.locator('input[name="sp-answer"][value="'+(bank.questions[i].reponse-1)+'"]').check();if(i<bank.questions.length-1)await page.locator('[data-exam-next]').click();}
  await page.locator('[data-exam-finish]').click();await expect(page.locator('.sp-score-circle')).toContainText('100%');
  await expect(page.locator('.sp-dialog-header')).toContainText('ليست شهادة');
  await page.locator('[data-result-close]').click();await expect(nav(page,'learning')).toHaveAttribute('aria-current','page');
});

test('mobile navigation is usable without overflow or offscreen focus targets',async({page})=>{
  await page.setViewportSize({width:390,height:844});await preview(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await expect(page.locator('.sp-sidebar')).toBeHidden();await page.locator('.sp-mobile-menu').click();
  await expect(page.locator('.sp-sidebar')).toBeVisible();await nav(page,'library').click();
  await expect(page.locator('.sp-sidebar')).toBeHidden();await expect(page.locator('.sp-mobile-menu')).toHaveAttribute('aria-expanded','false');
});

test('the integrated authenticated workspace preserves an unsent draft on token refresh',async({page})=>{
  await localOnly(page,{signedIn:true});await page.goto('/index.html#student-space');
  await expect.poll(()=>page.evaluate(()=>StudentAccount.getSyncStatus().phase)).toBe('ready');
  await expect(page.locator('.sp-hero')).toBeVisible();await nav(page,'notes').click();
  await page.locator('.sp-page-heading [data-sp-action="note"]').click();await page.locator('#sp-record-title').fill('مسودة لا تُفقد');await page.locator('#sp-record-body').fill('نص لم يُرسل بعد.');
  await page.evaluate(async()=>{__authFixture.emit('TOKEN_REFRESHED');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  await expect(page.locator('#sp-record-body')).toHaveValue('نص لم يُرسل بعد.');
});

test('administrators can validate a bank and publish through the authorized RPC contract',async({page})=>{
  await localOnly(page,{signedIn:true,role:'admin'});await page.goto('/admin.html');
  await page.locator('[data-admin-tab="learning-platform-panel"]').click();
  await expect(page.locator('[data-pl-action="new-assessment"]')).toBeEnabled();await page.locator('[data-pl-action="new-assessment"]').click();
  await page.locator('#pl-editor-form [name=title]').fill('اختبار محرر تجريبي');await page.locator('[data-pl-action="template"]').click();
  await expect(page.locator('.pl-question')).toHaveCount(3);await page.locator('#pl-editor-form [name=reviewed]').check();await page.locator('#pl-editor-form [name=published]').check();
  await page.locator('#pl-editor-form [type=submit]').click();await expect(page.locator('[data-pl-assessments]')).toContainText('اختبار محرر تجريبي');
  const request=await page.evaluate(()=>__authFixture.rpcCalls.find(x=>x.name==='gosvt_platform_save_assessment'));
  expect(request.params.p_document.questions).toHaveLength(3);expect(request.params.p_document.reviewed).toBe(true);expect(request.params.p_document.is_published).toBe(true);
  expect(request.params.p_document.questions[0].answer).toBe(1);
});

test('a missing new-platform table is reported as partial while the existing learning library remains usable',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await localOnly(page,{signedIn:true,failTable:'learning_assessments'});
  await page.goto('/index.html#student-space');
  await expect(page.locator('.sp-hero')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.gs-learning-platform')?.dataset.platformUser||'')).toBe('00000000-0000-0000-0000-000000000001');
  await page.locator('[data-sp-action="cloud"]').click();
  await expect(page.locator('.sp-dialog')).toContainText('بعض الخدمات غير متاحة');
  await page.locator('[data-sp-close]').click();
  await nav(page,'library').click();
  await expect(page.locator('.sp-course-card').first()).toBeVisible();
  await expect(errors).toEqual([]);
});


test('missing new-platform tables do not erase legacy progress, notes, or study plans',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await localOnly(page,{signedIn:true,failTable:'learning_assessments'});
  await page.goto('/index.html#student-space');
  await expect(page.locator('.sp-hero')).toBeVisible();
  await page.evaluate(()=>{
    const uid=StudentAccount.activeProfileId();
    StudentSpace.updateProgress('lesson','legacy-unit-compatibility-key',{title:'درس محفوظ من المساحة السابقة'});
    StudentSpace.markLessonComplete('legacy-unit-compatibility-key');
    StudentSpace.saveWorkspaceRecord('note',{title:'ملاحظة قديمة محفوظة',body:'يجب أن تبقى هذه الملاحظة بعد تعذر خدمات المنصة الجديدة.'},uid);
    const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    StudentSpace.saveWorkspaceRecord('task',{title:'مهمة قديمة محفوظة',date:today,done:false},uid);
  });
  await nav(page,'notes').click();
  await expect(page.locator('.sp-note-card')).toContainText('ملاحظة قديمة محفوظة');
  await nav(page,'planner').click();
  await expect(page.locator('.sp-task-row')).toContainText('مهمة قديمة محفوظة');
  await page.reload();
  await expect(page.locator('.sp-hero')).toBeVisible();
  await nav(page,'notes').click();
  await expect(page.locator('.sp-note-card')).toContainText('ملاحظة قديمة محفوظة');
  await nav(page,'planner').click();
  await expect(page.locator('.sp-task-row')).toContainText('مهمة قديمة محفوظة');
  const legacy=await page.evaluate(()=>{
    const d=StudentSpace.getProfileData(StudentAccount.activeProfileId());
    return {completed:d.progress.lessons['legacy-unit-compatibility-key']?.completed,notes:d.notes.some(x=>x.title==='ملاحظة قديمة محفوظة'),tasks:d.studyPlan.some(x=>x.title==='مهمة قديمة محفوظة')};
  });
  expect(legacy).toEqual({completed:true,notes:true,tasks:true});
  expect(errors).toEqual([]);
});


test('signing out removes the authenticated platform shell and restores the legacy sign-in view',async({page})=>{
  await localOnly(page,{signedIn:true});
  await page.goto('/index.html#student-space');
  await expect(page.locator('.sp-hero')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/sp-platform-active/);
  await page.evaluate(()=>StudentAccount.logout());
  await expect.poll(()=>page.evaluate(()=>StudentAccount.isLoggedIn())).toBe(false);
  await expect(page.locator('#student-space-content .gs-learning-platform')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/sp-platform-active/);
  await expect(page.locator('#student-space-content')).toContainText(/تسجيل الدخول|Se connecter/);
});
