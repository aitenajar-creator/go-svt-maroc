const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const script=fs.readFileSync(path.join(root,'admin-learning-platform.js'),'utf8');

test('admin dashboard loads a dedicated learning-platform authoring panel',()=>{
 assert.match(html,/data-admin-tab="learning-platform-admin-panel"/);
 assert.match(html,/id="learning-platform-admin-panel"/);
 assert.match(html,/admin-learning-platform\.js/);
 assert.match(html,/إدارة الموارد والاختبارات/);
});

test('authoring tools wait for the existing verified admin-session event and clear on logout',()=>{
 assert.match(script,/gosvt:admin-session/);
 assert.match(script,/client\.auth\.getUser\(\)/);
 assert.match(script,/data\?\.role==='admin'/);
 assert.match(script,/clearSession\(\)/);
});

test('protected resources and assessments are written only through guarded RPCs',()=>{
 assert.match(script,/gosvt_platform_save_resource/);
 assert.match(script,/gosvt_platform_save_assessment/);
 assert.doesNotMatch(script,/from\(['"]learning_(?:resources|assessments|questions)['"]\)\.(?:insert|update|upsert|delete)\(/);
});

test('external learning resources require HTTPS while approved local content paths remain supported',()=>{
 assert.match(script,/u\.protocol==='https:'/);
 assert.doesNotMatch(script,/u\.protocol==='https:'\|\|u\.protocol==='http:'/);
 assert.ok(script.includes("value.startsWith('/')"));
 assert.ok(script.includes('cours|exercices|examens'));
});

test('assessment publication requires explicit review and at least three questions',()=>{
 assert.match(script,/questions\.length<3/);
 assert.match(script,/learning-assessment-reviewed/);
 assert.match(script,/reviewed:\$\('learning-assessment-reviewed'\)\.checked/);
});

test('clearing the admin session disables results export',()=>{
 assert.match(script,/function clearSession\(\)\{[\s\S]*?\$\('learning-results-export'\)\.disabled=true/);
});

test('results view and export do not select or export answer snapshots or keys',()=>{
 assert.match(script,/select\('id,student_id,assessment_id,title_snapshot,started_at,deadline_at,submitted_at,score,max_score'\)/);
 assert.doesNotMatch(script,/question_snapshot/);
});
