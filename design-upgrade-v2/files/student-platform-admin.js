/* Authenticated editorial management. Admin status is verified in SQL as well as in this interface. */
(function () {
  'use strict';
  const client=window.supabaseClient,D=window.GoSVTPlatformDomain;
  const root=document.getElementById('platform-admin-root');
  if(!client||!D||!root)return;
  const E=D.esc;
  let adminId=null,generation=0,resources=[],assessments=[],attempts=[],attemptCount=0,resourceLimit=25,assessmentLimit=25;
  let filterLevel='all',filterStatus='all',search='',editor=null,ready=false,saving=false,loadSequence=0;
  const button=(text,action,attrs='')=>'<button type="button" data-pl-action="'+action+'" '+attrs+'>'+text+'</button>';
  function message(text,bad){const el=root.querySelector('[data-pl-message]');if(el){el.textContent=text;el.className='pl-message'+(bad?' bad':'');}}
  async function read(request,version=generation){const response=await request;if(version!==generation||!adminId)throw new Error('تغيرت الجلسة.');if(response.error)throw response.error;return response;}
  async function all(make,version){const values=[];let start=0;for(;;){const {data}=await read(make().range(start,start+199),version);values.push(...data||[]);if((data||[]).length<200)return values;start+=data.length;}}
  async function boot(){
    const version=++generation;
    const {data,error}=await client.auth.getUser();if(error||!data.user||version!==generation)return;
    const profile=await client.from('profiles').select('role').eq('id',data.user.id).maybeSingle();
    if(version!==generation||profile.error||profile.data?.role!=='admin')return;
    adminId=data.user.id;
    await load();
  }
  async function load(){
    if(!adminId)return;const version=generation,sequence=++loadSequence;
    if(!root.querySelector('.pl-platform'))shell();message('جارٍ تحميل بيانات المنصة…');
    const results=await Promise.allSettled([
      all(()=>client.from('learning_resources').select('*').order('updated_at',{ascending:false}).order('id',{ascending:false}),version),
      all(()=>client.from('learning_assessments').select('*').order('updated_at',{ascending:false}).order('id',{ascending:false}),version),
      read(client.from('learning_attempts').select('id,student_id,assessment_id,title_snapshot,started_at,submitted_at,score,max_score',{count:'exact'}).not('submitted_at','is',null).order('started_at',{ascending:false}).order('id',{ascending:false}).range(0,19),version)
    ]);
    if(version!==generation||sequence!==loadSequence)return;
    ready=results[0].status==='fulfilled'&&results[1].status==='fulfilled';
    resources=results[0].status==='fulfilled'?results[0].value:[];
    assessments=results[1].status==='fulfilled'?results[1].value:[];
    attempts=results[2].status==='fulfilled'?results[2].value.data||[]:[];
    attemptCount=results[2].status==='fulfilled'?results[2].value.count:null;
    root.querySelectorAll('[data-pl-create]').forEach(el=>el.disabled=!ready);
    message(results.some(x=>x.status==='rejected')?'بعض خدمات المنصة غير متاحة. راجع ترحيل 20261125000400 الخاص بالمشروع الرئيسي والصلاحيات؛ لم نعرض نجاحًا وهميًا.':'البيانات الحالية محمّلة. الموارد والاختبارات لا تظهر للتلميذ إلا بعد نشرها لمسلكه.',!ready);
    renderLists();
  }
  function shell(){
    root.innerHTML='<div class="pl-platform"><header class="pl-heading"><div><span class="pl-kicker">GO SVT · LEARNING MANAGEMENT</span><h2>إدارة منصة التعلّم</h2><p>انشر موارد مناسبة للمستوى، أنشئ اختبارات بتصحيح خادمي، وتابع النتائج الفعلية.</p></div>'+button('تحديث البيانات','refresh')+'</header><div data-pl-message class="pl-message" role="status"></div><div class="pl-stats" data-pl-stats></div><div class="pl-toolbar"><label>المستوى<select data-pl-level><option value="all">كل المستويات</option>'+Object.keys(D.TRACKS).map(k=>'<option value="'+k+'">'+D.LEVEL_LABELS[k]+'</option>').join('')+'</select></label><label>الحالة<select data-pl-status><option value="all">الكل</option><option value="published">منشور</option><option value="draft">مسودة / مؤرشف</option></select></label><label class="pl-search">البحث<input type="search" data-pl-search placeholder="عنوان المورد أو الاختبار…"></label></div><div class="pl-grid"><section class="pl-card"><div class="pl-section-head"><div><h3>موارد وروابط معتمدة إضافية</h3><p>المستودع العام يُفهرس تلقائيًا. هذه إدارة الإضافات التحريرية وتصنيفها.</p></div>'+button('＋ مورد','new-resource','data-pl-create')+'</div><div data-pl-resources></div><div data-pl-resource-more></div></section><section class="pl-card"><div class="pl-section-head"><div><h3>الاختبارات المُدارة</h3><p>المفاتيح لا تُرسل قبل التصحيح؛ الأجل والنتيجة يحددهما الخادم.</p></div>'+button('＋ اختبار','new-assessment','data-pl-create')+'</div><div data-pl-assessments></div><div data-pl-assessment-more></div></section></div><section class="pl-card" data-pl-editor hidden></section><section class="pl-card"><div class="pl-section-head"><div><h3>المحاولات الخادمية المكتملة</h3><p data-pl-attempt-count>لا تتضمن هذه القائمة نتائج التدريب المحلي غير الخادمي.</p></div>'+button('تصدير المحاولات المعروضة','export')+'</div><div class="pl-table-wrap" data-pl-history></div><div data-pl-history-more></div></section><p class="pl-footnote">النشر قرار تحريري مسؤول. هذه الأدوات ليست نظام مراقبة امتحانات أو شهادات رسمية. الحسابات غير الإدارية لا تستطيع كتابة بنوك الأسئلة أو النتائج.</p></div>';
    root.onclick=click;root.onchange=change;root.oninput=input;
  }
  function visible(list){return list.filter(r=>(filterLevel==='all'||r.study_level===filterLevel)&&(filterStatus==='all'||r.is_published===(filterStatus==='published'))&&D.normalize(r.title+' '+r.description).includes(D.normalize(search)));}
  function renderLists(){
    if(!adminId||!root.querySelector('.pl-platform'))return;
    root.querySelector('[data-pl-stats]').innerHTML=[['موارد إضافية منشورة',ready?resources.filter(x=>x.is_published).length:'—'],['الاختبارات المنشورة',ready?assessments.filter(x=>x.is_published).length:'—'],['مسودات الاختبارات',ready?assessments.filter(x=>!x.is_published).length:'—'],['محاولات خادمية مكتملة',attemptCount??'—']].map(([label,value])=>'<article><small>'+label+'</small><b>'+value+'</b></article>').join('');
    for(const [kind,list,limit] of [['resources',resources,resourceLimit],['assessments',assessments,assessmentLimit]]){
      const filtered=visible(list);
      root.querySelector('[data-pl-'+kind+']').innerHTML=filtered.length?filtered.slice(0,limit).map(r=>'<article class="pl-item"><div><span class="pl-badge '+(r.is_published?'published':'')+'">'+(r.is_published?'منشور':'مسودة / مؤرشف')+'</span><h4>'+E(r.title)+'</h4><p>'+E(D.LEVEL_LABELS[r.study_level])+' · '+r.study_tracks.map(t=>E(D.TRACK_LABELS[t]||t)).join(' / ')+(kind==='assessments'?' · '+r.question_count+' أسئلة · '+r.duration_minutes+' دقيقة':'')+'</p></div>'+button('تعديل',kind==='assessments'?'edit-assessment':'edit-resource','data-id="'+E(r.id)+'"')+'</article>').join(''):'<div class="pl-empty">لا توجد نتائج مطابقة، أو لم تُهيأ الخدمة بعد.</div>';
      root.querySelector('[data-pl-'+(kind==='resources'?'resource':'assessment')+'-more]').innerHTML=filtered.length>limit?button('عرض المزيد ('+Math.min(limit,filtered.length)+' / '+filtered.length+')',kind==='resources'?'more-resources':'more-assessments'):'';
    }
    root.querySelector('[data-pl-attempt-count]').textContent='معروض '+attempts.length+' من '+(attemptCount??'عدد غير متاح')+' محاولة خادمية. التدريب المحلي منفصل.';
    root.querySelector('[data-pl-history]').innerHTML=attempts.length?'<table><thead><tr><th>الاختبار</th><th>معرّف الحساب</th><th>النتيجة</th><th>التاريخ</th></tr></thead><tbody>'+attempts.map(r=>'<tr><td>'+E(r.title_snapshot)+'</td><td><code>'+E(r.student_id.slice(0,8))+'</code></td><td>'+r.score+' / '+r.max_score+' · '+Math.round(r.score/r.max_score*100)+'%</td><td>'+E(new Date(r.submitted_at).toLocaleString('ar-MA'))+'</td></tr>').join('')+'</tbody></table>':'<div class="pl-empty">لا توجد محاولات مكتملة محمّلة.</div>';
    root.querySelector('[data-pl-history-more]').innerHTML=attemptCount!=null&&attempts.length<attemptCount?button('تحميل محاولات إضافية','more-history'):'';
  }
  function trackFields(level,selected){return '<fieldset class="pl-tracks"><legend>المسالك المستهدفة</legend>'+D.TRACKS[level].map(t=>'<label><input type="checkbox" name="tracks" value="'+t+'" '+(selected.includes(t)?'checked':'')+'>'+E(D.TRACK_LABELS[t])+'</label>').join('')+'</fieldset>';}
  function openEditor(kind,item,questions){
    const version=generation,owner=adminId;editor={kind,item,version,owner};
    const level=item?.study_level||'2BAC';const tracks=item?.study_tracks||[D.TRACKS[level][0]];
    const target=root.querySelector('[data-pl-editor]');target.hidden=false;
    const json=questions?{titre:item.title,questions:questions.map(q=>({question:q.prompt,choix:q.options,reponse:q.answer+1,explication:q.explanation,points:q.points}))}:null;
    target.innerHTML='<div class="pl-section-head"><div><h3>'+ (kind==='assessment'?'محرر الاختبار وبنك الأسئلة':'محرر المورد')+'</h3><p>الحفظ لا يعني النشر؛ اختر المسلك والحالة بدقة.</p></div>'+button('إغلاق المحرر','close-editor')+'</div><form id="pl-editor-form"><div class="pl-form-grid"><label>العنوان<input name="title" maxlength="180" minlength="3" required value="'+E(item?.title||'')+'"></label><label>المستوى<select name="level" data-pl-editor-level>'+Object.keys(D.TRACKS).map(k=>'<option value="'+k+'" '+(k===level?'selected':'')+'>'+D.LEVEL_LABELS[k]+'</option>').join('')+'</select></label></div><div data-pl-tracks>'+trackFields(level,tracks)+'</div><label>الوصف<textarea name="description" maxlength="2000" rows="2">'+E(item?.description||'')+'</textarea></label>'+(kind==='assessment'?'<label>مدة الاختبار بالدقائق<input type="number" name="duration" min="5" max="180" step="1" value="'+(item?.duration_minutes||15)+'" required></label><div class="pl-import"><label>استيراد بنك JSON<input type="file" accept="application/json,.json" data-pl-file></label>'+button('إدراج قالب مثال','template')+'</div><label>بنك الأسئلة — reponse يبدأ من 1 في صيغة المستودع<textarea class="pl-json" name="questions" spellcheck="false" required placeholder="{ &quot;questions&quot;: [...] }">'+E(JSON.stringify(json||{questions:[]},null,2))+'</textarea></label><div class="pl-editor-actions">'+button('تحقق ومعاينة الأسئلة','validate')+'<small>3–60 سؤالًا. كل سؤال يحتاج خيارات وإجابة صحيحة وتفسيرًا.</small></div><div data-pl-question-preview></div><label class="pl-checkbox"><input type="checkbox" name="reviewed">راجعت صحة الأسئلة والتصحيح وملاءمتها للمستوى والمسلك.</label>':'<div class="pl-form-grid"><label>نوع المورد<select name="kind">'+['cours','exercices','fiches','resumes','examens','link'].map(k=>'<option value="'+k+'" '+(item?.resource_kind===k?'selected':'')+'>'+D.TYPE_LABELS[k]+'</option>').join('')+'</select></label><label>لغة المحتوى<select name="language"><option value="arabe" '+(item?.language!=='francais'?'selected':'')+'>العربية</option><option value="francais" '+(item?.language==='francais'?'selected':'')+'>Français</option></select></label></div><label>رابط دائم أو مسار ملف من الموقع<input name="url" maxlength="2048" required value="'+E(item?.source_url||'')+'" placeholder="/cours/.../document.pdf" dir="ltr"></label><p class="pl-help">استخدم رابطًا دائمًا، لا رابطًا موقّعًا أو يتضمن مفاتيح خاصة. إخفاء هذا السجل لا يحذف الملف العام من المستودع.</p><label>ترتيب الظهور<input name="position" type="number" min="0" max="9999" value="'+(item?.position||0)+'"></label>')+'<label class="pl-checkbox"><input type="checkbox" name="published" '+(item?.is_published?'checked':'')+'>منشور للمسالك المحددة</label><p data-pl-save-status class="pl-message" role="status"></p><button class="pl-primary" type="submit">حفظ '+(kind==='assessment'?'الاختبار':'المورد')+'</button></form>';
    target.querySelector('form').onsubmit=save;
    target.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function validateBank(allowDraft=false){
    const form=root.querySelector('#pl-editor-form');const raw=JSON.parse(form.elements.questions.value);
    const bank=Array.isArray(raw)?{questions:raw}:raw;
    if(allowDraft&&Array.isArray(bank.questions)&&bank.questions.length===0){root.querySelector('[data-pl-question-preview]').innerHTML='<div class="pl-message">مسودة بلا أسئلة. أضف ثلاثة أسئلة صالحة على الأقل قبل النشر.</div>';return [];}
    const quiz=D.normalizeQuiz(bank);
    if(!allowDraft&&quiz.questions.length<3)throw new Error('أضف ثلاثة أسئلة على الأقل قبل النشر.');
    if(quiz.questions.some(q=>q.explanation.trim().length<5))throw new Error('أضف تفسيرًا مفيدًا لكل إجابة صحيحة.');
    root.querySelector('[data-pl-question-preview]').innerHTML='<div class="pl-message">بنك صالح بنيويًا: '+quiz.questions.length+' أسئلة. هذا لا يعوض المراجعة العلمية البشرية.</div>'+quiz.questions.map((q,i)=>'<details class="pl-question"><summary>'+ (i+1)+'. '+E(q.prompt)+'</summary><ol>'+q.options.map((x,j)=>'<li class="'+(j===q.answer?'correct':'')+'">'+E(x)+(j===q.answer?' ✓':'')+'</li>').join('')+'</ol><p>'+E(q.explanation)+'</p></details>').join('');
    return quiz.questions;
  }
  async function save(event){
    event.preventDefault();const context=editor;if(!context||context.version!==generation||context.owner!==adminId)return;
    const form=event.currentTarget,values=new FormData(form),button=form.querySelector('[type=submit]'),status=form.querySelector('[data-pl-save-status]');
    if(saving)return;
    saving=true;
    const fields=[...form.querySelectorAll('input,select,textarea,button')];fields.forEach(field=>field.disabled=true);
    try{
      const level=String(values.get('level')),tracks=values.getAll('tracks');
      if(!tracks.length||tracks.some(x=>!D.TRACKS[level]?.includes(x)))throw new Error('اختر مسلكًا واحدًا على الأقل يوافق المستوى.');
      const doc={title:String(values.get('title')).trim(),description:String(values.get('description')||''),study_level:level,study_tracks:tracks,is_published:values.get('published')==='on'};
      let rpc,params;
      if(context.kind==='assessment'){
        if(doc.is_published&&values.get('reviewed')!=='on')throw new Error('أكّد المراجعة التحريرية قبل النشر.');
        doc.questions=validateBank(!doc.is_published);doc.duration_minutes=Number(values.get('duration'));doc.reviewed=values.get('reviewed')==='on';
        rpc='gosvt_platform_save_assessment';params={p_id:context.item?.id||null,p_document:doc,p_expected_revision:context.item?.revision||null,p_expected_user:context.owner};
      }else{
        doc.source_url=String(values.get('url')).trim();if(!D.safeUrl(doc.source_url,location.origin))throw new Error('الرابط غير صالح.');
        doc.resource_kind=values.get('kind');doc.language=values.get('language');doc.position=Number(values.get('position'));doc.expected_updated_at=context.item?.updated_at||null;
        rpc='gosvt_platform_save_resource';params={p_id:context.item?.id||null,p_document:doc,p_expected_user:context.owner};
      }
      const response=await client.rpc(rpc,params);if(context.version!==generation)return;if(response.error)throw response.error;
      status.textContent=doc.is_published?'حُفظ ونُشر للمسالك المحددة.':'حُفظ كمسودة/مؤرشف. لم يُنشر للتلاميذ.';
      editor=null;root.querySelector('[data-pl-editor]').hidden=true;await load();
    }catch(error){if(context.version===generation){status.textContent=String(error.message||error).includes('updated_elsewhere')?'عُدّل السجل في جلسة أخرى. أعد تحميله بدل استبدال التعديلات.':error.message||'تعذر الحفظ.';status.className='pl-message bad';}}
    finally{if(context.version===generation)saving=false;fields.forEach(field=>{if(field.isConnected)field.disabled=false;});}
  }
  async function click(event){
    const el=event.target.closest('[data-pl-action]');if(!el||!adminId)return;const action=el.dataset.plAction;
    if(saving){message('جارٍ الحفظ؛ انتظر تأكيد النتيجة قبل الانتقال إلى محرر آخر.');return;}
    try{
      if(action==='refresh'){if(editor&&!confirm('سيُغلق المحرر. هل تريد تحديث البيانات؟'))return;editor=null;root.querySelector('[data-pl-editor]').hidden=true;await load();}
      if(action==='new-resource'&&ready)openEditor('resource');
      if(action==='new-assessment'&&ready)openEditor('assessment');
      if(action==='edit-resource'){const row=resources.find(x=>x.id===el.dataset.id);if(row)openEditor('resource',row);}
      if(action==='edit-assessment'){const row=assessments.find(x=>x.id===el.dataset.id);if(row){const version=generation;const {data}=await read(client.from('learning_questions').select('prompt,options,answer,explanation,points').eq('assessment_id',row.id).order('position'),version);if(version===generation)openEditor('assessment',row,data);}}
      if(action==='close-editor'){if(confirm('إغلاق المحرر؟ لن تحفظ التعديلات غير المرسلة.')){editor=null;root.querySelector('[data-pl-editor]').hidden=true;}}
      if(action==='validate')validateBank();
      if(action==='template'){
        const field=root.querySelector('[name=questions]');if(field.value&&!confirm('استبدال محتوى المحرر بقالب المثال؟'))return;
        const response=await fetch('assets/student-platform/scientific-skills.json');const bank=await response.json();
        if(editor?.version===generation&&field.isConnected){field.value=JSON.stringify({...bank,questions:bank.questions.slice(0,3)},null,2);validateBank();}
      }
      if(action==='more-resources'){resourceLimit+=25;renderLists();}
      if(action==='more-assessments'){assessmentLimit+=25;renderLists();}
      if(action==='more-history'){const start=attempts.length;const {data,count}=await read(client.from('learning_attempts').select('id,student_id,assessment_id,title_snapshot,started_at,submitted_at,score,max_score',{count:'exact'}).not('submitted_at','is',null).order('started_at',{ascending:false}).order('id',{ascending:false}).range(start,start+19));attempts.push(...data||[]);attemptCount=count;renderLists();}
      if(action==='export'){
        if(!attempts.length){message('لا توجد محاولات محمّلة للتصدير.');return;}
        const cell=value=>{let text=String(value??'');if(/^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
        const rows=[['الاختبار','معرف الحساب','النقطة','النقطة القصوى','تاريخ الإنهاء'],...attempts.map(x=>[x.title_snapshot,x.student_id,x.score,x.max_score,x.submitted_at])];
        const url=URL.createObjectURL(new Blob([String.fromCodePoint(0xfeff)+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='gosvt-assessment-results-visible.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('تم تصدير '+attempts.length+' محاولة محمّلة من '+attemptCount+'.');
      }
    }catch(error){message(error.message||'تعذر تنفيذ العملية.',true);}
  }
  async function change(event){
    if(event.target.matches('[data-pl-level]')){filterLevel=event.target.value;resourceLimit=assessmentLimit=25;renderLists();}
    if(event.target.matches('[data-pl-status]')){filterStatus=event.target.value;resourceLimit=assessmentLimit=25;renderLists();}
    if(event.target.matches('[data-pl-editor-level]'))root.querySelector('[data-pl-tracks]').innerHTML=trackFields(event.target.value,[]);
    if(event.target.matches('[data-pl-file]')){
      const file=event.target.files[0];if(!file)return;const version=generation;
      try{if(file.size>600000)throw new Error('ملف الأسئلة أكبر من 600KB.');const parsed=JSON.parse(await file.text());if(version!==generation||!editor)return;root.querySelector('[name=questions]').value=JSON.stringify(parsed,null,2);validateBank();}catch(error){message(error.message,true);}
    }
  }
  function input(event){if(event.target.matches('[data-pl-search]')){search=event.target.value;resourceLimit=assessmentLimit=25;renderLists();}}
  document.addEventListener('gosvt:admin-session',event=>{
    if(!event.detail?.userId){generation++;adminId=null;resources=[];assessments=[];attempts=[];editor=null;ready=false;saving=false;root.replaceChildren();}
    else if(event.detail.userId!==adminId)boot().catch(error=>message(error.message,true));
  });
  boot().catch(error=>message(error.message||'تعذر فتح الإدارة.',true));
})();
