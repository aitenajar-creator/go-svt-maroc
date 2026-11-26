(function(){
'use strict';
const client=window.supabaseClient;
const $=id=>document.getElementById(id);
const panel=$('learning-platform-admin-panel');
if(!client||!panel)return;
const tracks={TC:['TCS','TCL'],'1BAC':['1BACSE','1BACSM','1BACL'],'2BAC':['2BACSVT','2BACSP','2BACSM']};
let activeUser=null, generation=0, resources=[], assessments=[], results=[];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(id,text,error=false){const el=$(id);if(el){el.textContent=text;el.className='message '+(error?'error':'muted');}}
function setTracks(containerId,level,selected=[]){
 const host=$(containerId);if(!host)return;
 host.innerHTML=(tracks[level]||[]).map(t=>'<label><input type="checkbox" value="'+t+'" '+(selected.includes(t)?'checked':'')+'> '+t+'</label>').join('');
}
function selectedTracks(containerId){return Array.from($(containerId).querySelectorAll('input:checked')).map(x=>x.value);}
function resetResource(){
 $('learning-resource-form').reset();$('learning-resource-id').value='';$('learning-resource-updated').value='';
 $('learning-resource-position').value='0';setTracks('learning-resource-tracks','TC',['TCS','TCL']);
}
function resetAssessment(){
 $('learning-assessment-form').reset();$('learning-assessment-id').value='';$('learning-assessment-revision').value='';
 $('learning-assessment-duration').value='30';$('learning-assessment-json').value='[]';
 setTracks('learning-assessment-tracks','TC',['TCS','TCL']);
}
function clearSession(){
 generation++;activeUser=null;resources=[];assessments=[];results=[];
 ['learning-resources-list','learning-assessments-list','learning-results-list'].forEach(id=>{if($(id))$(id).textContent='سجّل الدخول بحساب المدير لتحميل البيانات.';});
 ['learning-resource-form','learning-assessment-form'].forEach(id=>{if($(id))$(id).reset();});
 msg('learning-admin-status','تم إيقاف أدوات الإدارة ومسح بيانات الجلسة.');
}
async function verifyAdmin(expectedUser){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.id!==expectedUser)return false;
 const {data,error:profileError}=await client.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(profileError)return false;
 return data?.role==='admin';
}
async function boot(userId){
 const version=++generation;activeUser=null;
 try{
  const ok=await verifyAdmin(userId);
  if(version!==generation)return;
  if(!ok){clearSession();msg('learning-admin-status','تم رفض الوصول: يلزم حساب مدير معتمد.',true);return;}
  activeUser=userId;msg('learning-admin-status','تم التحقق من صلاحية المدير. يمكنك إدارة الموارد والاختبارات.');
  await Promise.all([loadResources(version),loadAssessments(version),loadResults(version)]);
 }catch(e){if(version===generation)msg('learning-admin-status','تعذر تهيئة أدوات الإدارة: '+(e.message||e),true);}
}
function current(version){return version===generation&&!!activeUser;}
async function loadResources(version=generation){
 if(!activeUser)return;
 $('learning-resources-list').textContent='جاري تحميل الموارد...';
 const {data,error}=await client.from('learning_resources').select('id,title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at').order('updated_at',{ascending:false}).limit(100);
 if(!current(version))return;
 if(error){$('learning-resources-list').textContent='تعذر تحميل الموارد: '+error.message;return;}
 resources=data||[];
 $('learning-resources-list').innerHTML=resources.map(r=>'<article class="learning-admin-item"><strong>'+esc(r.title)+'</strong><p>'+esc(r.study_level)+' · '+esc((r.study_tracks||[]).join(', '))+' · '+(r.is_published?'منشور':'مسودة')+'</p><small>'+esc(r.resource_kind)+' · '+esc(r.language)+' · '+esc(r.source_url)+'</small><div><button class="quiet-btn" type="button" data-resource-edit="'+r.id+'">تعديل</button></div></article>').join('')||'<p class="muted">لا توجد موارد بعد.</p>';
}
async function loadAssessments(version=generation){
 if(!activeUser)return;
 $('learning-assessments-list').textContent='جاري تحميل الاختبارات...';
 const {data,error}=await client.from('learning_assessments').select('id,title,description,study_level,study_tracks,duration_minutes,question_count,is_published,revision,updated_at').order('updated_at',{ascending:false}).limit(100);
 if(!current(version))return;
 if(error){$('learning-assessments-list').textContent='تعذر تحميل الاختبارات: '+error.message;return;}
 assessments=data||[];
 $('learning-assessments-list').innerHTML=assessments.map(a=>'<article class="learning-admin-item"><strong>'+esc(a.title)+'</strong><p>'+esc(a.study_level)+' · '+esc((a.study_tracks||[]).join(', '))+' · '+a.question_count+' سؤال · '+a.duration_minutes+' دقيقة · '+(a.is_published?'منشور':'مسودة')+'</p><small>المراجعة رقم '+a.revision+'</small><div><button class="quiet-btn" type="button" data-assessment-edit="'+a.id+'">فتح وتعديل</button></div></article>').join('')||'<p class="muted">لا توجد اختبارات بعد.</p>';
}
async function loadResults(version=generation){
 if(!activeUser)return;
 $('learning-results-list').textContent='جاري تحميل النتائج...';
 const {data,error}=await client.from('learning_attempts').select('id,student_id,assessment_id,title_snapshot,started_at,deadline_at,submitted_at,score,max_score').not('submitted_at','is',null).order('submitted_at',{ascending:false}).limit(100);
 if(!current(version))return;
 if(error){$('learning-results-list').textContent='تعذر تحميل النتائج: '+error.message;return;}
 results=data||[];
 $('learning-results-export').disabled=!results.length;
 $('learning-results-list').innerHTML=results.map(r=>'<article class="learning-admin-item"><strong>'+esc(r.title_snapshot)+'</strong><p>التلميذ: '+esc(r.student_id)+' · النتيجة: '+esc(r.score)+' / '+esc(r.max_score)+'</p><small>'+esc(new Date(r.submitted_at).toLocaleString('ar-MA'))+'</small></article>').join('')||'<p class="muted">لا توجد محاولات مكتملة بعد.</p>';
}
function validSourceUrl(value){
 try{if(value.startsWith('/'))return /^\/(cours|exercices|examens|fiches|resumes|lesson-reader\.html)(\/|$)/.test(value);
 const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:';}catch(_){return false;}
}
$('learning-resource-level').addEventListener('change',()=>setTracks('learning-resource-tracks',$('learning-resource-level').value));
$('learning-assessment-level').addEventListener('change',()=>setTracks('learning-assessment-tracks',$('learning-assessment-level').value));
$('learning-resource-reset').addEventListener('click',resetResource);
$('learning-assessment-reset').addEventListener('click',resetAssessment);
$('learning-resources-refresh').addEventListener('click',()=>loadResources());
$('learning-assessments-refresh').addEventListener('click',()=>loadAssessments());
$('learning-results-refresh').addEventListener('click',()=>loadResults());
$('learning-resource-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!activeUser)return;
 const btn=e.submitter||e.currentTarget.querySelector('[type=submit]');btn.disabled=true;
 try{
  const title=$('learning-resource-title').value.trim(),url=$('learning-resource-url').value.trim(),level=$('learning-resource-level').value,selected=selectedTracks('learning-resource-tracks');
  if(title.length<3||title.length>180||$('learning-resource-description').value.trim().length>2000||!validSourceUrl(url)||!selected.length||selected.some(t=>!tracks[level].includes(t)))throw new Error('تحقق من العنوان والرابط والمستوى والشعب المحددة.');
  const id=$('learning-resource-id').value||null;
  const document={title,description:$('learning-resource-description').value.trim(),source_url:url,resource_kind:$('learning-resource-kind').value,study_level:level,study_tracks:selected,language:$('learning-resource-language').value,is_published:$('learning-resource-published').checked,position:Number($('learning-resource-position').value)||0};
  if(id)document.expected_updated_at=$('learning-resource-updated').value;
  const {data,error}=await client.rpc('gosvt_platform_save_resource',{p_id:id,p_document:document,p_expected_user:activeUser});
  if(error)throw error;
  msg('learning-resource-message','تم حفظ المورد بنجاح. المعرّف: '+data);resetResource();await loadResources();
 }catch(err){msg('learning-resource-message','تعذر الحفظ: '+(err.message||String(err)),true);}finally{btn.disabled=false;}
});
$('learning-assessment-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!activeUser)return;
 const publish=e.submitter?.dataset.assessmentPublish==='true',btn=e.submitter;if(btn)btn.disabled=true;
 try{
  let questions;try{questions=JSON.parse($('learning-assessment-json').value);}catch(_){throw new Error('صيغة JSON غير صحيحة.');}
  if(!Array.isArray(questions)||questions.length>60)throw new Error('يجب أن تكون الأسئلة مصفوفة لا تتجاوز 60 سؤالاً.');
  questions.forEach((q,i)=>{
   if(!q||typeof q!=='object'||typeof q.prompt!=='string'||q.prompt.trim().length<5||q.prompt.length>4000||typeof q.explanation!=='string'||q.explanation.trim().length<5||q.explanation.length>3000||!Array.isArray(q.options)||q.options.length<2||q.options.length>6||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>2000)||!Number.isInteger(q.points??1)||(q.points??1)<1||(q.points??1)>5)throw new Error('تحقق من السؤال رقم '+(i+1)+': نص وتفسير واختيارات وإجابة ونقاط صالحة.');
  });
  const title=$('learning-assessment-title').value.trim(),level=$('learning-assessment-level').value,selected=selectedTracks('learning-assessment-tracks'),duration=Number($('learning-assessment-duration').value);
  if(title.length<3||title.length>180||$('learning-assessment-description').value.trim().length>2000||!selected.length||selected.some(t=>!tracks[level].includes(t))||duration<5||duration>180)throw new Error('تحقق من العنوان والمستوى والشعب والمدة.');
  if(publish&&(questions.length<3||!$('learning-assessment-reviewed').checked))throw new Error('يلزم ثلاثة أسئلة على الأقل وتأكيد المراجعة التربوية قبل النشر.');
  const id=$('learning-assessment-id').value||null;
  const document={title,description:$('learning-assessment-description').value.trim(),study_level:level,study_tracks:selected,duration_minutes:duration,questions,is_published:publish,reviewed:$('learning-assessment-reviewed').checked};
  const {data,error}=await client.rpc('gosvt_platform_save_assessment',{p_id:id,p_document:document,p_expected_revision:id?Number($('learning-assessment-revision').value):null,p_expected_user:activeUser});
  if(error)throw error;
  msg('learning-assessment-message',publish?'تم حفظ الاختبار ونشره.':'تم حفظ الاختبار كمسودة.');resetAssessment();await loadAssessments();
 }catch(err){msg('learning-assessment-message','تعذر الحفظ: '+(err.message||String(err)),true);}finally{if(btn)btn.disabled=false;}
});
$('learning-resources-list').addEventListener('click',e=>{
 const b=e.target.closest('[data-resource-edit]');if(!b)return;
 const r=resources.find(x=>x.id===b.dataset.resourceEdit);if(!r)return;
 $('learning-resource-id').value=r.id;$('learning-resource-updated').value=r.updated_at;
 $('learning-resource-title').value=r.title;$('learning-resource-description').value=r.description;$('learning-resource-url').value=r.source_url;
 $('learning-resource-kind').value=r.resource_kind;$('learning-resource-level').value=r.study_level;$('learning-resource-language').value=r.language;
 $('learning-resource-position').value=r.position;$('learning-resource-published').checked=r.is_published;setTracks('learning-resource-tracks',r.study_level,r.study_tracks);
 $('learning-resource-form').scrollIntoView({behavior:'smooth',block:'center'});
});
$('learning-assessments-list').addEventListener('click',async e=>{
 const b=e.target.closest('[data-assessment-edit]');if(!b||!activeUser)return;
 const a=assessments.find(x=>x.id===b.dataset.assessmentEdit);if(!a)return;
 b.disabled=true;
 try{
  const {data:qs,error}=await client.from('learning_questions').select('prompt,options,answer,explanation,points,position').eq('assessment_id',a.id).order('position');
  if(error)throw error;
  $('learning-assessment-id').value=a.id;$('learning-assessment-revision').value=a.revision;
  $('learning-assessment-title').value=a.title;$('learning-assessment-description').value=a.description;$('learning-assessment-level').value=a.study_level;
  $('learning-assessment-duration').value=a.duration_minutes;$('learning-assessment-reviewed').checked=false;
  setTracks('learning-assessment-tracks',a.study_level,a.study_tracks);
  $('learning-assessment-json').value=JSON.stringify((qs||[]).map(({prompt,options,answer,explanation,points})=>({prompt,options,answer,explanation,points})),null,2);
  $('learning-assessment-form').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(err){msg('learning-assessment-message','تعذر فتح الاختبار: '+(err.message||String(err)),true);}finally{b.disabled=false;}
});
$('learning-results-export').addEventListener('click',()=>{
 if(!activeUser||!results.length)return;
 const cols=['title_snapshot','student_id','score','max_score','started_at','submitted_at'];
 const cell=value=>{let text=String(value??'');if(/^[=+@\\-\\t\\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 const csv=[cols.join(','),...results.map(r=>cols.map(k=>cell(r[k])).join(','))].join('\r\n');
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='go-svt-learning-results.csv';a.click();URL.revokeObjectURL(url);
});
document.addEventListener('gosvt:admin-session',event=>{
 const userId=event.detail?.userId;
 if(userId)boot(userId);else clearSession();
});
resetResource();resetAssessment();
})();