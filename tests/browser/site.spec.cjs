const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const installFixture=require('./auth-fixture.cjs');
const root=path.resolve(__dirname,'../..');

async function isolate(page, options={}) {
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:8765'){
      if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase-js'))return route.fulfill({contentType:'application/javascript',body:''});
      return route.abort();
    }
    if(url.pathname==='/supabase-config.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'supabase-config.js'),'utf8')});
    return route.continue();
  });
  await page.addInitScript({content:'('+installFixture.toString()+')('+JSON.stringify(options)+');'});
}

test('the existing standalone audit suite passes in a real browser',async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:8765'?route.continue():route.abort());
  page.on('dialog',dialog=>dialog.type()==='confirm'?dialog.accept():dialog.dismiss());
  await page.goto('/test-runner.html');
  const result=await page.evaluate(()=>window.runAuditTests());
  expect(result.total).toBeGreaterThan(20);
  expect(result.results.filter(item=>!item.passed)).toEqual([]);
});

test('login, token refresh with a draft, and logout use the real student UI',async({page})=>{
  await isolate(page);
  await page.goto('/index.html#student-space');
  await page.locator('#gs-l-email').fill('student@example.invalid');
  await page.locator('#gs-l-pwd').fill('fixture-password');
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await expect.poll(()=>page.evaluate(()=>window.StudentAccount.getSyncStatus().phase)).toBe('ready');

  // Masahati's current navigation is organized as: Mon parcours > Notes.
  await page.locator('#student-space-content .mh-nav button[data-a="go"][data-v="me"]').click();
  await page.locator('#student-space-content button[data-a="msub"][data-s="notes"]').click();
  const noteForm=page.locator('#student-space-content form[data-form="note"]');
  await noteForm.locator('input[name="title"]').fill('Unsent draft');
  await noteForm.locator('textarea[name="body"]').fill('Do not discard this text.');
  await page.evaluate(async()=>{
    window.__authFixture.emit('TOKEN_REFRESHED');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await expect(noteForm.locator('textarea[name="body"]')).toHaveValue('Do not discard this text.');
  await page.locator('.gs-acc-logout').click();
  await expect(page.locator('#gs-l-email')).toBeVisible();
  await expect(page.locator('#student-space-content form[data-form="note"]')).toHaveCount(0);
});

test('partial cloud failure retains quiz history and offers retry',async({page})=>{
  await isolate(page,{signedIn:true,failTable:'student_learning_state'});
  await page.goto('/index.html#student-space');
  await expect.poll(()=>page.evaluate(()=>window.StudentAccount?.getSyncStatus().phase)).toBe('partial');
  const count=await page.evaluate(()=>StudentSpace.getProfileData(StudentAccount.activeProfileId()).quizResults.length);
  expect(count).toBe(1);
  await expect(page.locator('[data-gs-sync-retry]')).toBeVisible();
  await page.evaluate(()=>{window.__authFixture.failTable='';});
  await page.locator('[data-gs-sync-retry]').click();
  await expect.poll(()=>page.evaluate(()=>StudentAccount.getSyncStatus().phase)).toBe('ready');
});


test('site owner can open the new learning authoring tab while a student cannot',async({page})=>{
  await isolate(page,{signedIn:true,role:'admin'});
  await page.goto('/admin.html');
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.locator('[data-admin-tab="learning-platform-admin-panel"]').click();
  await expect(page.locator('#learning-platform-admin-panel')).toBeVisible();
  await expect(page.locator('#learning-resources-list')).toContainText('لا توجد موارد بعد');
  const studentPage=await page.context().newPage();
  await isolate(studentPage,{signedIn:true,role:'student'});
  await studentPage.goto('/admin.html');
  await expect(studentPage.locator('#login-panel')).toBeVisible();
  await expect(studentPage.locator('#dashboard')).toBeHidden();
  await studentPage.close();
});

test('admin logout clears the learning authoring session and disables result export',async({page})=>{
  await isolate(page,{signedIn:true,role:'admin'});
  await page.goto('/admin.html');
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.locator('[data-admin-tab="learning-platform-admin-panel"]').click();
  await page.locator('#learning-resource-title').fill('Private draft must be cleared');
  await expect(page.locator('#learning-results-export')).toBeDisabled();
  await page.locator('#signout-btn').click();
  await expect(page.locator('#dashboard')).toBeHidden();
  await expect(page.locator('#login-panel')).toBeVisible();
  await expect(page.locator('#learning-admin-status')).toContainText('تُحمّل هذه الأدوات بعد التحقق من صلاحية المدير.');
  await expect(page.locator('#learning-resource-title')).toHaveValue('');
  await expect(page.locator('#learning-results-export')).toBeDisabled();
});


test('late resource-save RPC response is ignored after the admin session ends',async({page})=>{
  await isolate(page,{signedIn:true,role:'admin',deferRpc:'gosvt_platform_save_resource'});
  await page.goto('/admin.html');
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.locator('[data-admin-tab="learning-platform-admin-panel"]').click();
  await page.locator('#learning-resource-title').fill('Delayed resource draft');
  await page.locator('#learning-resource-url').fill('/cours/francais/TC/TCS/test.pdf');
  await page.locator('#learning-resource-form button[type="submit"]').click();
  await expect.poll(()=>page.evaluate(()=>!!window.__authFixture.pendingRpc)).toBe(true);
  await page.evaluate(()=>{
    document.dispatchEvent(new CustomEvent('gosvt:admin-session',{detail:{userId:null}}));
    window.__authFixture.pendingRpc.resolve({data:'fixture-resource',error:null});
    window.__authFixture.pendingRpc=null;
  });
  await expect(page.locator('#learning-resource-title')).toHaveValue('');
  await expect(page.locator('#learning-resource-message')).not.toContainText('تم حفظ المورد بنجاح');
});

test('late assessment-save RPC response is ignored after the admin session ends',async({page})=>{
  await isolate(page,{signedIn:true,role:'admin',deferRpc:'gosvt_platform_save_assessment'});
  await page.goto('/admin.html');
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.locator('[data-admin-tab="learning-platform-admin-panel"]').click();
  await page.locator('#learning-assessment-title').fill('Delayed assessment draft');
  await page.locator('#learning-assessment-json').fill(JSON.stringify([
    {prompt:'Question one prompt',options:['Option A','Option B'],answer:0,explanation:'Explanation one',points:1},
    {prompt:'Question two prompt',options:['Option A','Option B'],answer:1,explanation:'Explanation two',points:1},
    {prompt:'Question three prompt',options:['Option A','Option B'],answer:0,explanation:'Explanation three',points:1}
  ]));
  await page.locator('#learning-assessment-form button[data-assessment-publish="false"]').click();
  await expect.poll(()=>page.evaluate(()=>!!window.__authFixture.pendingRpc)).toBe(true);
  await page.evaluate(()=>{
    document.dispatchEvent(new CustomEvent('gosvt:admin-session',{detail:{userId:null}}));
    window.__authFixture.pendingRpc.resolve({data:'fixture-assessment',error:null});
    window.__authFixture.pendingRpc=null;
  });
  await expect(page.locator('#learning-assessment-title')).toHaveValue('');
  await expect(page.locator('#learning-assessment-message')).not.toContainText('تم حفظ الاختبار');
});
