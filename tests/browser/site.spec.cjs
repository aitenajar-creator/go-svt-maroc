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

test('login, token refresh and logout use the new learning platform',async({page})=>{
  await isolate(page);
  await page.goto('/index.html#student-space');
  await page.locator('#gs-l-email').fill('student@example.invalid');
  await page.locator('#gs-l-pwd').fill('fixture-password');
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await expect.poll(()=>page.evaluate(()=>window.StudentAccount.getSyncStatus().phase)).toBe('ready');

  // The redesigned platform replaces the old student-space UI after login.
  await expect(page.locator('#student-space-content .gs-learning-platform')).toBeVisible();
  await page.locator('#student-space-content .sp-nav [data-sp-route="notes"]').click();
  await page.locator('#student-space-content [data-sp-action="note"]').first().click();
  const noteForm=page.locator('#student-space-content #sp-record-form');
  await expect(noteForm).toBeVisible();
  await page.locator('#sp-record-title').fill('Unsent draft');
  await page.locator('#sp-record-body').fill('Do not discard this text.');
  await page.evaluate(async()=>{
    window.__authFixture.emit('TOKEN_REFRESHED');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await expect(page.locator('#sp-record-body')).toHaveValue('Do not discard this text.');
  await page.locator('.gs-acc-logout').click();
  await expect(page.locator('#gs-l-email')).toBeVisible();
  await expect(page.locator('#student-space-content .gs-learning-platform')).toHaveCount(0);
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
