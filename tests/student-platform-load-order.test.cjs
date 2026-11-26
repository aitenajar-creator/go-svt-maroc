const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {root}=require('./helpers.cjs');

test('student platform scripts load after their prerequisites and before lifecycle activation',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi)]
    .map(match=>({tag:match[0],attrs:match[1]+' '+match[3],src:match[2].split('?')[0]}));
  const index=src=>scripts.findIndex(item=>item.src===src);
  const required=[
    'student-platform-domain.js',
    'student-platform-art.js',
    'student-platform-store.js',
    'student-platform-labs.js',
    'student-platform-exams.js',
    'student-platform.js',
    'student-space-integration.js',
    'supabase-config.js',
    'student-account.js',
    'student-platform-lifecycle.js'
  ];
  for(const src of required)assert.notEqual(index(src),-1,'missing root script: '+src);
  for(const src of required)assert.equal(scripts.filter(item=>item.src===src).length,1,'script must be included exactly once: '+src);
  const ordered=[
    'student-platform-domain.js',
    'student-platform-art.js',
    'student-platform-store.js',
    'student-platform-labs.js',
    'student-platform-exams.js',
    'student-platform.js',
    'student-space-integration.js',
    'supabase-config.js',
    'student-account.js',
    'student-platform-lifecycle.js'
  ];
  for(let i=1;i<ordered.length;i++)assert(index(ordered[i-1])<index(ordered[i]),ordered[i]+' must load after '+ordered[i-1]);
  for(const src of required){
    const item=scripts[index(src)];
    assert(!/\b(async|defer)\b/i.test(item.attrs),src+' must preserve deterministic classic-script ordering');
  }
});
