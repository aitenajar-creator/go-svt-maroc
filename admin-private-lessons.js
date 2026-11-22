(function(){
'use strict';const c=window.supabaseClient,$=id=>document.getElementById(id);if(!c)return;
async function boot(){const {data:{user}}=await c.auth.getUser();if(!user)return;const {data:p}=await c.from('profiles').select('role').eq('id',user.id).maybeSingle();if(!p||p.role!=='admin')return;const panel=$('private-lessons-panel');if(!panel)return;panel.hidden=false;load();}
let cachedLessons=[];function renderAdminList(){const list=$('private-lessons-list');const q=($('private-admin-search')?.value||'').trim().toLocaleLowerCase();const level=$('private-admin-level')?.value||'',track=$('private-admin-track')?.value||'',state=$('private-admin-state')?.value||'all';const published=cachedLessons.filter(x=>x.is_published).length;const groups={};cachedLessons.forEach(x=>{const k=x.study_level+' · '+x.study_track;groups[k]=(groups[k]||0)+1;});const summary=$('private-lessons-summary');if(summary)summary.innerHTML='<strong>إجمالي الدروس: '+cachedLessons.length+'</strong> · المنشورة: '+published+' · المسودات: '+(cachedLessons.length-published)+'<div class="private-admin-counts">'+Object.keys(groups).sort().map(k=>'<span>'+esc(k)+': '+groups[k]+'</span>').join('')+'</div>';const rows=cachedLessons.filter(x=>(!q||(x.title+' '+x.slug).toLocaleLowerCase().includes(q))&&(!level||x.study_level===level)&&(!track||x.study_track===track)&&(state==='all'||(state==='published')===x.is_published));list.innerHTML=rows.length?rows.map(x=>'<div class="private-admin-item"><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.study_level)+' · '+esc(x.study_track)+' · '+(x.is_published?'منشور للتلاميذ':'مسودة')+'</small></div><div class="private-admin-actions"><a target="_blank" rel="noopener" href="lesson-reader.html?reader=20261122-1&id='+encodeURIComponent(x.id)+'">معاينة</a><button type="button" data-edit="'+x.id+'">تعديل البيانات</button><button type="button" data-toggle="'+x.id+'" data-state="'+x.is_published+'">'+(x.is_published?'إخفاء':'نشر')+'</button></div></div>').join(''):'<p>لا توجد دروس مطابقة للتصفية.</p>';}
async function load(){const list=$('private-lessons-list');list.textContent='جاري تحميل الدروس…';const {data,error}=await c.from('private_student_lessons').select('id,slug,title,description,language,study_level,study_track,is_published,updated_at').order('updated_at',{ascending:false});if(error){list.textContent='تعذر تحميل الدروس: '+error.message;return;}cachedLessons=data||[];const select=$('private-asset-lesson');if(select)select.innerHTML=cachedLessons.map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join('');if(select&&select.value)populatePlacement();renderAdminList();}
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const TRACKS_BY_LEVEL={TC:['TCS','TCL'],'1BAC':['1BACSE','1BACSM','1BACL'],'2BAC':['2BACSVT','2BACSP','2BACSM']};
function syncTrackOptions(){
 const level=$('private-lesson-level'),track=$('private-lesson-track');if(!level||!track)return;
 const allowed=TRACKS_BY_LEVEL[level.value]||[];
 const current=track.value;
 track.innerHTML=allowed.map(v=>'<option value="'+v+'">'+v+'</option>').join('');
 if(allowed.includes(current))track.value=current;
}
['private-admin-search','private-admin-level','private-admin-track','private-admin-state'].forEach(id=>{const el=$(id);if(el)el.addEventListener(id==='private-admin-search'?'input':'change',renderAdminList);});
$('private-lesson-level').addEventListener('change',syncTrackOptions);
syncTrackOptions();
$('private-lesson-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const btn=$('private-lesson-save'),file=$('private-lesson-file').files[0];
 if(!file||!(/\.html?$/i.test(file.name))){$('private-lesson-msg').textContent='اختر ملف HTML صالحاً.';return;}
 btn.disabled=true;
 try{
  const html=await file.text();
  if(html.length>2000000)throw new Error('حجم الدرس أكبر من الحد المسموح (2MB).');
  if(!/<\s*(html|body|main|article|h1|h2)\b/i.test(html))throw new Error('يبدو أن الملف لا يحتوي على بنية HTML لدرس.');
  const slug=$('private-lesson-slug').value.trim().toLowerCase();
  if(!/^[a-z0-9-]{3,100}$/.test(slug))throw new Error('استعمل معرفاً لاتينياً يتكون من أحرف وأرقام وشرطات.');
  const level=$('private-lesson-level').value,track=$('private-lesson-track').value;
  if(!TRACKS_BY_LEVEL[level]||!TRACKS_BY_LEVEL[level].includes(track))throw new Error('الشعبة المختارة لا تتوافق مع المستوى الدراسي.');
  const {data:{user},error:userError}=await c.auth.getUser();if(userError||!user)throw new Error('انتهت جلسة المدير. يرجى تسجيل الدخول مجدداً.');
  const {data:existing,error:checkError}=await c.from('private_student_lessons').select('id').eq('slug',slug).maybeSingle();
  if(checkError)throw checkError;
  if(existing)throw new Error('هذا المعرّف مستخدم من قبل. اختر معرّفاً آخر حتى لا يتم استبدال درس موجود.');
  const row={
   slug,title:$('private-lesson-title').value.trim(),
   description:$('private-lesson-description')?.value.trim()||'',
   study_level:level,study_track:track,
   language:$('private-lesson-language').value,
   content_html:html,is_published:$('private-lesson-publish').checked,
   created_by:user.id
  };
  const {error}=await c.from('private_student_lessons').insert(row);
  if(error)throw error;
  $('private-lesson-msg').textContent=row.is_published?'تم حفظ الدرس ونشره للتلاميذ المسجلين بنجاح.':'تم حفظ الدرس كمسودة خاصة بالمدير.';
  $('private-lesson-form').reset();syncTrackOptions();await load();
 }catch(err){$('private-lesson-msg').textContent=err.message||'تعذر حفظ الدرس.';}
 finally{btn.disabled=false;}
});
$('private-lesson-assets-form').addEventListener('submit',async e=>{e.preventDefault();const btn=$('private-asset-upload'),files=[...$('private-asset-files').files],lessonId=$('private-asset-lesson').value,caption=$('private-asset-caption').value.trim();if(!lessonId||!files.length)return;btn.disabled=true;$('private-asset-message').textContent='جارٍ رفع الصور إلى التخزين الخاص…';const uploaded=[];try{const {data:lesson,error:readError}=await c.from('private_student_lessons').select('slug,content_html').eq('id',lessonId).single();if(readError)throw readError;const figures=[];for(let i=0;i<files.length;i++){const file=files[i];if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)throw new Error('كل صورة يجب أن تكون JPG أو PNG أو WebP وألا يتجاوز حجمها 5MB.');const clean=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').slice(-90)||('figure-'+i+'.webp');const path=lesson.slug+'/'+crypto.randomUUID()+'-'+clean;const {error:upError}=await c.storage.from('private-lesson-assets').upload(path,file,{contentType:file.type,upsert:false});if(upError)throw upError;uploaded.push(path);const alt=caption||file.name.replace(/\.[^.]+$/,'');figures.push('<figure class="source-figure"><img data-private-asset="'+esc(path)+'" alt="'+esc(alt)+'" loading="lazy"><figcaption>'+esc(alt)+'</figcaption></figure>');}let html=lesson.content_html;const parser=new DOMParser(),parsed=parser.parseFromString(html,'text/html'),placement=$('private-asset-placement')?.value||'end';const section=document.createElement('section');section.className='source-documents';const title=document.createElement('h2');title.textContent='Documents et photographies du support original';section.appendChild(title);const figureHolder=document.createElement('div');figureHolder.innerHTML=figures.join('');while(figureHolder.firstChild)section.appendChild(figureHolder.firstChild);if(placement!=='end'){const heading=parsed.body.querySelectorAll('h2,h3')[Number(placement)];if(heading)heading.insertAdjacentElement('afterend',section);else parsed.body.appendChild(section);}else parsed.body.appendChild(section);html='<!doctype html>'+parsed.documentElement.outerHTML;const {error:updateError}=await c.from('private_student_lessons').update({content_html:html}).eq('id',lessonId);if(updateError)throw updateError;$('private-asset-message').textContent='تم رفع الصور وإضافتها إلى الدرس داخل التخزين الخاص.';$('private-lesson-assets-form').reset();await load();}catch(err){if(uploaded.length)await c.storage.from('private-lesson-assets').remove(uploaded);$('private-asset-message').textContent=err.message||'تعذر رفع الصور.';}finally{btn.disabled=false;}});
$('private-lessons-list').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit]');
 if(edit){
  const lesson=cachedLessons.find(x=>x.id===edit.dataset.edit);if(!lesson)return;
  const title=prompt('عنوان الدرس:',lesson.title);if(title===null)return;
  const description=prompt('وصف الدرس:',lesson.description||'');if(description===null)return;
  const slug=prompt('معرّف الدرس اللاتيني:',lesson.slug);if(slug===null)return;
  const level=prompt('المستوى (TC أو 1BAC أو 2BAC):',lesson.study_level);if(level===null)return;
  if(!TRACKS_BY_LEVEL[level]){alert('المستوى غير صالح.');return;}
  const track=prompt('الشعبة المتاحة ('+TRACKS_BY_LEVEL[level].join(' / ')+'):',lesson.study_track);if(track===null)return;
  if(!TRACKS_BY_LEVEL[level].includes(track)){alert('الشعبة لا تتوافق مع المستوى.');return;}
  const language=prompt('اللغة (fr أو ar):',lesson.language||'fr');if(language===null)return;
  if(!/^[a-z0-9-]{3,100}$/.test(slug.trim())){alert('المعرّف يجب أن يتكون من 3 إلى 100 حرف لاتيني صغير أو رقم أو شرطة.');return;}
  if(!title.trim()||!['fr','ar'].includes(language)){alert('تحقق من العنوان واللغة.');return;}
  edit.disabled=true;
  try{
   if(slug.trim()!==lesson.slug){const {data:duplicate,error:dupError}=await c.from('private_student_lessons').select('id').eq('slug',slug.trim()).maybeSingle();if(dupError)throw dupError;if(duplicate&&duplicate.id!==lesson.id)throw new Error('هذا المعرّف مستخدم في درس آخر.');}
   const {error}=await c.from('private_student_lessons').update({title:title.trim(),description:description.trim(),slug:slug.trim(),study_level:level,study_track:track,language}).eq('id',lesson.id);
   if(error)throw error;
   const msg=$('private-lesson-msg');msg.textContent='تم تحديث بيانات الدرس دون تغيير محتواه أو حالة نشره.';await load();
  }catch(err){alert(err.message||'تعذر تحديث بيانات الدرس.');}finally{edit.disabled=false;}
  return;
 }
 const toggle=e.target.closest('[data-toggle]');if(!toggle)return;toggle.disabled=true;
 const {error}=await c.from('private_student_lessons').update({is_published:toggle.dataset.state!=='true'}).eq('id',toggle.dataset.toggle);
 if(error)alert(error.message);await load();
});
const placement=$('private-asset-placement'),lessonSelect=$('private-asset-lesson');async function populatePlacement(){if(!placement||!lessonSelect.value)return;placement.innerHTML='<option value="end">إضافة الصور في نهاية الدرس</option>';const {data}=await c.from('private_student_lessons').select('content_html').eq('id',lessonSelect.value).single();if(!data)return;const d=new DOMParser().parseFromString(data.content_html,'text/html');[...d.body.querySelectorAll('h2,h3')].forEach((h,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent='بعد: '+h.textContent.trim().slice(0,100);placement.appendChild(o);});}lessonSelect.addEventListener('change',populatePlacement);document.addEventListener('click',e=>{if(e.target.id==='private-lessons-refresh')load();});
boot();
})();