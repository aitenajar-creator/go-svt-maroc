const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {root}=require('../helpers.cjs');
const fixture=require('./auth-fixture.cjs');
const origin='http://127.0.0.1:8765';

async function localOnly(page){
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){
      if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase-js'))return route.fulfill({contentType:'application/javascript',body:''});
      return route.abort();
    }
    if(url.pathname==='/supabase-config.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'supabase-config.js'),'utf8')});
    return route.continue();
  });
  await page.addInitScript({content:'('+fixture.toString()+')({signedIn:true});'});
}

test('switching authenticated users isolates private notes and restores each owner workspace',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await localOnly(page);
  await page.goto('/index.html#student-space');
  await expect(page.locator('.sp-hero')).toBeVisible();
  await expect.poll(()=>page.locator('.gs-learning-platform').getAttribute('data-platform-user')).toBe('00000000-0000-0000-0000-000000000001');

  await page.locator('.sp-page-heading [data-sp-action="note"]').click();
  await page.locator('#sp-record-title').fill('ملاحظة الحساب الأول');
  await page.locator('#sp-record-body').fill('هذه الملاحظة ملك للحساب الأول فقط.');
  await page.locator('#sp-record-form [type=submit]').click();
  await expect(page.locator('.sp-note-card')).toContainText('ملاحظة الحساب الأول');

  await page.evaluate(()=>{
    window.__authFixture.user={id:'00000000-0000-0000-0000-000000000002',email:'second@example.invalid',user_metadata:{display_name:'Second Fixture Student'}};
    window.__authFixture.emit('SIGNED_IN');
  });
  await expect.poll(()=>page.locator('.gs-learning-platform').getAttribute('data-platform-user')).toBe('00000000-0000-0000-0000-000000000002');
  await navNotes(page);
  await expect(page.locator('.sp-note-card')).toHaveCount(0);

  await page.evaluate(()=>{
    window.__authFixture.user={id:'00000000-0000-0000-0000-000000000001',email:'student@example.invalid',user_metadata:{display_name:'Fixture Student'}};
    window.__authFixture.emit('SIGNED_IN');
  });
  await expect.poll(()=>page.locator('.gs-learning-platform').getAttribute('data-platform-user')).toBe('00000000-0000-0000-0000-000000000001');
  await navNotes(page);
  await expect(page.locator('.sp-note-card')).toContainText('ملاحظة الحساب الأول');
  expect(errors).toEqual([]);
});

function navNotes(page){return page.locator('.sp-nav [data-sp-route="notes"]').click();}

test('a signed-in account that changes to a non-student role cannot retain the student platform shell',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await localOnly(page);
  await page.goto('/index.html#student-space');
  await expect(page.locator('.sp-hero')).toBeVisible();
  await expect(page.locator('.gs-learning-platform')).toHaveCount(1);

  await page.evaluate(()=>{
    window.__authFixture.role='teacher';
    window.__authFixture.emit('SIGNED_IN');
  });

  await expect(page.locator('.gs-learning-platform')).toHaveCount(0);
  await expect.poll(()=>document.body.classList.contains('sp-platform-active')).toBe(false);
  expect(errors).toEqual([]);
});
