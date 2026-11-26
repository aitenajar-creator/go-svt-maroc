const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {root,source}=require('./helpers.cjs');

test('service-worker release stamping is deterministic and includes assets and worker logic',()=>{
  const parent=path.join(root,'test-results');fs.mkdirSync(parent,{recursive:true});
  const dir=fs.mkdtempSync(path.join(parent,'build-'));
  const build=()=>{
    const result=spawnSync('python3',['-B',path.join(root,'_tools/build_service_worker.py'),dir],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return fs.readFileSync(path.join(dir,'sw.js'),'utf8').match(/const RELEASE = '([^']+)'/)[1];
  };
  try{
    fs.writeFileSync(path.join(dir,'sw.js'),source('sw.js'));
    fs.writeFileSync(path.join(dir,'index.html'),'<script src="app.js?v=1"></script>');
    for(const [name,value] of Object.entries({'app.js':'void 0;','offline.html':'Offline','manifest.webmanifest':'{}','favicon.ico':'fixture-icon'}))fs.writeFileSync(path.join(dir,name),value);
    fs.mkdirSync(path.join(dir,'assets','student-platform'),{recursive:true});
    fs.writeFileSync(path.join(dir,'assets','student-platform','learning-hero.webp'),'webp-fixture');
    fs.writeFileSync(path.join(dir,'assets','student-platform','cairo.woff2'),'font-fixture');
    const initial=build();assert.equal(build(),initial);
    const worker=fs.readFileSync(path.join(dir,'sw.js'),'utf8');
    assert(worker.includes('/assets/student-platform/learning-hero.webp'),'generated shell must precache WebP illustrations');
    assert(worker.includes('/assets/student-platform/cairo.woff2'),'generated shell must precache WOFF2 fonts');
    assert(worker.includes('webmanifest|png|svg|ico|webp|woff2'),'fetch handler must serve cached WebP and WOFF2 assets offline');
    fs.writeFileSync(path.join(dir,'app.js'),'void 1;');const changed=build();assert.notEqual(changed,initial);assert.equal(build(),changed);
    fs.appendFileSync(path.join(dir,'sw.js'),'\n// revised worker logic\n');assert.notEqual(build(),changed);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
