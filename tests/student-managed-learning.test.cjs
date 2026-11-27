const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'student-managed-learning.js'),'utf8');

test('student page loads the managed-learning client without replacing existing modules',()=>{
 assert.match(html,/student-managed-learning\.js/);
 assert.match(html,/student-space\.js/);
 assert.match(html,/student-account\.js/);
});

test('learner client requires a verified student account and matching Supabase user',()=>{
 assert.match(script,/role/);
 assert.match(script,/auth\(\)/);
 assert.match(script,/c\.auth\.getUser\(\)/);
 assert.match(script,/p_expected_student/);
});

test('learner reads only published resources and assessments through RLS',()=>{
 assert.match(script,/from\('learning_resources'\)\.select/);
 assert.match(script,/from\('learning_assessments'\)\.select/);
 assert.match(script,/eq\('is_published',true\)/);
 assert.doesNotMatch(script,/from\('learning_questions'\)/);
});

test('assessment lifecycle uses server RPCs and does not select answer keys',()=>{
 assert.match(script,/gosvt_platform_start_assessment/);
 assert.match(script,/gosvt_platform_save_answers/);
 assert.match(script,/gosvt_platform_submit_assessment/);
 assert.doesNotMatch(script,/question_snapshot/);
 assert.doesNotMatch(script,/select\([^)]*answer/);
});

test('answers are sequenced and final grading is accepted only from server response',()=>{
 assert.match(script,/sequence/);
 assert.match(script,/server_graded!==true/);
 assert.match(script,/Array\.isArray\(d\.feedback\)/);
});

test('student panel is added to the existing dashboard and remains optional',()=>{
 assert.match(script,/student-space-content/);
 assert.match(script,/gosvt-managed-learning/);
 assert.match(script,/MutationObserver/);
});
