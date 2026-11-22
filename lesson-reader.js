(function(){
'use strict';
// Mark execution immediately, before any DOM setup can throw.
window.GoSVTLessonReaderBooted=true;
window.addEventListener('error',function(event){
 const status=document.getElementById('lesson-status');
 if(status){status.hidden=false;status.textContent='حدث خطأ أثناء تشغيل عارض الدرس: '+String(event.message||'JavaScript error').slice(0,220);}
 console.error('[GoSVT lesson reader] runtime error:',event.error||event.message);
});
window.addEventListener('unhandledrejection',function(event){
 const status=document.getElementById('lesson-status');
 if(status){status.hidden=false;status.textContent='تعذر إكمال عملية داخل عارض الدرس: '+String(event.reason&&event.reason.message||event.reason||'Promise error').slice(0,220);}
 console.error('[GoSVT lesson reader] unhandled rejection:',event.reason);
});
const $=id=>document.getElementById(id), client=window.supabaseClient;
const say=m=>{$('lesson-status').textContent=m;};
$('back-btn').addEventListener('click',()=>{location.href='index.html#student-space';});
$('print-btn').addEventListener('click',()=>{const f=$('lesson-frame');if(f.contentWindow)f.contentWindow.print();});
function withTimeout(promise,label,ms=15000){
 let timer;
 return Promise.race([
  promise,
  new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' — timeout')),ms);})
 ]).finally(()=>clearTimeout(timer));
}
async function start(){
  if(!client){say(window.GoSVTAuthConfigError||'تعذر تهيئة خدمة تسجيل الدخول. أعد تحميل الصفحة وحاول مجدداً.');return;}
  say('جارٍ التحقق من جلسة تسجيل الدخول…');
  const authResult=await withTimeout(client.auth.getUser(),'auth.getUser',15000);
  const user=authResult&&authResult.data&&authResult.data.user;
  if(authResult.error||!user){say('انتهت جلسة الدخول أو لم يتم تسجيل الدخول. ارجع إلى مساحة التلميذ وسجّل الدخول مجدداً.');return;}
  say('تم التحقق من الحساب. جارٍ التحقق من الصلاحيات…');
  const profileResult=await withTimeout(client.from('profiles').select('role').eq('id',user.id).maybeSingle(),'profiles query',15000);
  const profile=profileResult.data;
  if(profileResult.error||!profile||!['student','admin'].includes(profile.role)){say('ليس لديك إذن لقراءة هذا الدرس.');return;}
  const id=new URLSearchParams(location.search).get('id');
  if(!id){say('لم يتم تحديد الدرس.');return;}
  say('تم التحقق من الصلاحيات. جارٍ تحميل محتوى الدرس…');
  const lessonResult=await withTimeout(client.from('private_student_lessons').select('id,title,content_html').eq('id',id).maybeSingle(),'lesson query',20000);
  const lesson=lessonResult.data;
  if(lessonResult.error||!lesson){say('هذا الدرس غير متاح لحسابك أو لم يعد منشوراً.');return;}
 $('lesson-title').textContent=lesson.title;
 const doc=new DOMParser().parseFromString(lesson.content_html,'text/html');
 doc.querySelectorAll('script,object,embed,form,base').forEach(n=>n.remove());
 // Preserve only trusted original-course PDF previews from this repository's raw GitHub host.
 doc.querySelectorAll('iframe').forEach(function(frame){
  const raw=frame.getAttribute('src')||'';
  let safe=false;
  try{
   const u=new URL(raw,location.href);
   safe=u.hostname==='raw.githubusercontent.com'&&/\.pdf(?:$|[?#])/i.test(u.href);
  }catch(e){}
  if(!safe){frame.remove();return;}
  // No sandbox: browser PDF viewers may fail to render inside sandboxed frames.
  // The iframe source is restricted above to trusted raw GitHub PDF files.
  frame.setAttribute('loading','lazy');
  frame.setAttribute('referrerpolicy','no-referrer');
 });
 doc.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*javascript:/i.test(a.value)))el.removeAttribute(a.name);});});
 // Course files may hide their static body until an initialization script runs. Scripts stay disabled in this reader, so reveal authored content safely.
 doc.querySelectorAll('[hidden], [aria-hidden="true"]').forEach(el=>{el.removeAttribute('hidden');el.removeAttribute('aria-hidden');});
 doc.querySelectorAll('*').forEach(el=>{if(el.style){if(el.style.display==='none')el.style.removeProperty('display');if(el.style.visibility==='hidden')el.style.visibility='visible';if(el.style.opacity==='0')el.style.removeProperty('opacity');}});
 const privateImages=[...doc.querySelectorAll('img[data-private-asset]')];
 for(const img of privateImages){
   const assetPath=img.getAttribute('data-private-asset');
   const {data:asset,error:assetError}=await client.storage.from('private-lesson-assets').createSignedUrl(assetPath,3600);
   if(!assetError&&asset?.signedUrl) img.setAttribute('src',asset.signedUrl);
   else img.replaceWith(doc.createTextNode('تعذر تحميل هذه الوثيقة المصورة حالياً.'));
 }
 const headings=[...doc.body.querySelectorAll('h2,h3')].filter(h=>h.textContent.trim());
 const tocItems=headings.map((h,i)=>{if(!h.id)h.id='lesson-section-'+(i+1);return '<li class="'+(h.tagName.toLowerCase()==='h3'?'sub':'')+'"><a href="#'+encodeURIComponent(h.id)+'" target="_self">'+h.textContent.trim().replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))+'</a></li>';}).join('');
 const toc=tocItems?'<nav class="lesson-toc" aria-label="Sommaire du cours"><strong>Sommaire / فهرس الدرس</strong><ul>'+tocItems+'</ul></nav>':'';
 const originalStyles=[...doc.head.querySelectorAll('style')].map(s=>s.outerHTML).join('');
 const html='<!doctype html><html lang="'+(doc.documentElement.lang||'fr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">'+originalStyles+'<style>body{margin:0;padding:clamp(1rem,4vw,3rem);font-family:system-ui,sans-serif;line-height:1.75;color:#25352b}body *{visibility:visible!important;opacity:1!important}main,article,section,.content,.lesson-content,.course-content,.lesson-body,.course-body,#content,#lesson-content,[hidden]{display:block!important;visibility:visible!important;opacity:1!important;height:auto!important;max-height:none!important;overflow:visible!important}body [style*="display:none"],body [style*="display: none"]{display:block!important}body [style*="visibility:hidden"],body [style*="visibility: hidden"]{visibility:visible!important}body [style*="opacity:0"],body [style*="opacity: 0"]{opacity:1!important}img,svg{max-width:100%;height:auto}.source-figure{margin:1.5rem 0;padding:1rem;border:1px solid #dce7d9;border-radius:12px;background:#fbfdf9}.source-figure img{display:block;width:100%;max-width:850px;margin:auto}.source-figure figcaption{text-align:center;color:#5c6f60;font-size:.9rem;margin-top:.6rem}.lesson-toc{padding:1rem 1.25rem;margin:0 0 1.5rem;background:#f1f7ee;border:1px solid #d8e6d4;border-radius:12px}.lesson-toc ul{margin:.5rem 0;padding-inline-start:1.25rem}.lesson-toc li.sub{margin-inline-start:1rem;font-size:.94em}.lesson-toc a{color:#27633e;text-decoration:none;display:inline-block;pointer-events:auto!important;cursor:pointer!important;position:relative;z-index:2}.lesson-toc a:hover{text-decoration:underline}table{max-width:100%;border-collapse:collapse;overflow:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{padding:0;font-size:11pt}.lesson-toc{break-inside:avoid}.lesson-toc a{color:#111;text-decoration:none}h2,h3{break-after:avoid}img,figure,table{break-inside:avoid;max-width:100%}}</style></head><body>'+toc+doc.body.innerHTML+'</body></html>';

 const objectiveSets=[
 {match:/sortie écologique|sortie ecologique/i,title:"La sortie écologique",items:["Préparer et organiser une observation sur le terrain","Utiliser une méthode d’échantillonnage adaptée","Noter les observations avec le lieu, la date et la méthode"]},
 {match:/flux de la matière|flux de la matiere/i,title:"Flux de matière et d’énergie",items:["Distinguer matière et énergie dans l’écosystème","Expliquer le rôle des producteurs, consommateurs et décomposeurs","Comprendre le recyclage de la matière et les pertes d’énergie"]},
 {match:/équilibres naturels|equilibres naturels/i,title:"Les équilibres naturels",items:["Décrire les interactions entre organismes et milieu","Expliquer comment une perturbation peut modifier l’écosystème","Identifier des mesures de préservation pertinentes"]},
 {match:/adn aux protéines|adn aux proteines/i,title:"De l’ADN aux protéines",items:["Relier la séquence de nucléotides à l’information génétique","Distinguer transcription et traduction","Comprendre le lien entre gène, protéine et phénotype"]}
 ];
 const objectiveSet=objectiveSets.find(o=>o.match.test(lesson.title));
 if(objectiveSet){
  const panel=document.createElement('section');panel.className='gs-learning-objectives';
  panel.innerHTML='<h2>🎯 Objectifs d’apprentissage</h2><p>À la fin de ce cours, je peux :</p><div class="gs-objective-list"></div><p class="gs-objective-progress" role="status">0/'+objectiveSet.items.length+' objectifs cochés</p>';
  const css=document.createElement('style');css.textContent='.gs-learning-objectives{max-width:1100px;margin:1rem auto;padding:1.1rem 1.25rem;border:1px solid #d5e5d2;border-radius:15px;background:#f4faf2;color:#244631}.gs-learning-objectives h2{margin:.1rem 0 .5rem}.gs-objective-list label{display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .25rem;border-bottom:1px solid #e2ece0;cursor:pointer}.gs-objective-list label:last-child{border-bottom:0}.gs-objective-list input{margin-top:.25rem;accent-color:#2b7147}.gs-objective-progress{font-weight:700;margin:.75rem 0 0}';document.head.appendChild(css);
  const list=panel.querySelector('.gs-objective-list');
  const progress=panel.querySelector('.gs-objective-progress');
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Chargement de votre progression…';panel.appendChild(status);
  let savedObjectives={};
  const objectiveKey='private-lesson:'+id;
  function renderObjectiveProgress(){
   const done=list.querySelectorAll('input:checked').length;
   progress.textContent=done+'/'+objectiveSet.items.length+' objectifs cochés'+(done===objectiveSet.items.length?' — Bravo, tous les objectifs sont cochés !':'');
  }
  objectiveSet.items.forEach((item,i)=>{
   const label=document.createElement('label'),cb=document.createElement('input');
   cb.type='checkbox';cb.setAttribute('aria-label','Objectif '+(i+1));cb.disabled=true;
   label.append(cb,document.createTextNode(item));list.appendChild(label);
  });
  (async function(){
   try{
    const result=await client.from('student_learning_state').select('lesson_objectives').eq('student_id',user.id).maybeSingle();
    if(result.error)throw result.error;
    savedObjectives=result.data&&result.data.lesson_objectives&&typeof result.data.lesson_objectives==='object'?result.data.lesson_objectives:{};
    const checks=list.querySelectorAll('input[type="checkbox"]');
    const saved=Array.isArray(savedObjectives[objectiveKey])?savedObjectives[objectiveKey]:[];
    checks.forEach((cb,i)=>{cb.checked=saved.includes(i);cb.disabled=false;});
    renderObjectiveProgress();
    status.textContent='Progression synchronisée avec votre compte.';
   }catch(loadError){
    list.querySelectorAll('input').forEach(cb=>cb.disabled=false);
    status.textContent='Sauvegarde indisponible pour le moment : vos coches restent temporaires.';
    console.warn('Impossible de charger les objectifs du cours',loadError);
   }
  })();
  let objectiveSaveQueue=Promise.resolve();
  let objectiveSaveVersion=0;
  list.addEventListener('change',function(){
   renderObjectiveProgress();
   const checks=Array.from(list.querySelectorAll('input[type="checkbox"]'));
   savedObjectives[objectiveKey]=checks.map((cb,i)=>cb.checked?i:null).filter(i=>i!==null);
   const snapshot=JSON.parse(JSON.stringify(savedObjectives));
   const version=++objectiveSaveVersion;
   status.textContent='Enregistrement…';
   // Serialize writes so rapid checkbox changes cannot finish out of order.
   objectiveSaveQueue=objectiveSaveQueue.catch(()=>{}).then(async()=>{
    const result=await client.from('student_learning_state').upsert({student_id:user.id,lesson_objectives:snapshot,updated_at:new Date().toISOString()},{onConflict:'student_id'});
    if(result.error)throw result.error;
    if(version===objectiveSaveVersion)status.textContent='Progression enregistrée dans votre compte.';
   }).catch(saveError=>{
    if(version===objectiveSaveVersion)status.textContent='Échec de sauvegarde. Vérifiez votre connexion puis réessayez.';
    console.error('Impossible de sauvegarder les objectifs du cours',saveError);
   });
  });
  $('lesson-frame-wrap').before(panel);
 }
 const frame=$('lesson-frame'),resumeButton=$('resume-btn'),readingProgress=$('reading-progress');
 const readingKey='gosvt-private-reading:'+user.id+':'+id;
 const preferenceKey='gosvt-private-reading-preferences:'+user.id;
 // Keep reading comfort preferences on this device for the signed-in student.
 let readingFontSize=18, highContrast=false;
 try{
  const preferences=JSON.parse(localStorage.getItem(preferenceKey)||'null');
  if(preferences&&Number.isFinite(preferences.fontSize))readingFontSize=Math.min(28,Math.max(14,preferences.fontSize));
  if(preferences&&typeof preferences.highContrast==='boolean')highContrast=preferences.highContrast;
 }catch(preferenceStorageError){}
 function saveReadingPreferences(){
  try{localStorage.setItem(preferenceKey,JSON.stringify({fontSize:readingFontSize,highContrast}));}catch(preferenceStorageError){}
 }
 function applyReadingPreferences(){
  try{
   const doc=frame.contentDocument;
   if(!doc||!doc.body)return;
   doc.body.style.fontSize=readingFontSize+'px';
   doc.body.style.lineHeight='1.85';
   doc.body.style.backgroundColor=highContrast?'#101820':'#ffffff';
   doc.body.style.color=highContrast?'#f5f7fa':'#25352b';
   doc.querySelectorAll('a').forEach(a=>{a.style.color=highContrast?'#8ecbff':'';});
   const contrastButton=$('contrast-toggle');
   if(contrastButton)contrastButton.setAttribute('aria-pressed',String(highContrast));
  }catch(preferenceError){console.warn('Reading preferences unavailable',preferenceError);}
 }
 $('font-smaller').addEventListener('click',()=>{readingFontSize=Math.max(14,readingFontSize-1);applyReadingPreferences();saveReadingPreferences();});
 $('font-larger').addEventListener('click',()=>{readingFontSize=Math.min(28,readingFontSize+1);applyReadingPreferences();saveReadingPreferences();});
 $('font-reset').addEventListener('click',()=>{readingFontSize=18;highContrast=false;applyReadingPreferences();saveReadingPreferences();});
 $('contrast-toggle').addEventListener('click',()=>{highContrast=!highContrast;applyReadingPreferences();saveReadingPreferences();});
 let savedPosition=0;
 try{const saved=JSON.parse(localStorage.getItem(readingKey)||'null');if(saved&&Number.isFinite(saved.position))savedPosition=Math.max(0,saved.position);}catch(storageError){}
 function updateReadingUI(percent){
  if(readingProgress){readingProgress.hidden=false;readingProgress.textContent='تقدم القراءة: '+percent+'%';}
  const progressBar=$('reading-progress-bar');
  if(progressBar){progressBar.hidden=false;progressBar.value=percent;progressBar.setAttribute('aria-valuetext',percent+'%');}
  if(resumeButton){resumeButton.hidden=percent<5||percent>=95;resumeButton.textContent='متابعة القراءة ('+percent+'%)';}
 }
 resumeButton.addEventListener('click',()=>{
  try{const win=frame.contentWindow;if(win)win.scrollTo({top:savedPosition,behavior:'smooth'});}catch(e){}
 });
 frame.addEventListener('load',()=>{
  try{
   const win=frame.contentWindow,doc=win.document;
   if(!win||!doc)return;
   const measure=()=>Math.max(0,doc.documentElement.scrollHeight-win.innerHeight);
   const refresh=()=>{
    const max=measure(),position=Math.min(max,Math.max(0,win.scrollY||doc.documentElement.scrollTop||0));
    const percent=max?Math.min(100,Math.round(position/max*100)):0;
    try{localStorage.setItem(readingKey,JSON.stringify({position,percent,updatedAt:Date.now()}));}catch(storageError){}
    savedPosition=position;updateReadingUI(percent);
   };
   if(savedPosition>0)updateReadingUI(Math.min(100,Math.round(savedPosition/Math.max(1,measure())*100)));
   win.addEventListener('scroll',refresh,{passive:true});
   win.addEventListener('resize',refresh);
   refresh();
  }catch(readError){console.warn('Reading position tracking unavailable',readError);}
 });
 // Load via document.write fallback as well as srcdoc: avoids browser edge cases where
 // srcdoc content is not committed to the frame's document.
 frame.addEventListener('load',function(){
  try{
   const frameDoc=frame.contentDocument;
   const textLength=(frameDoc&&frameDoc.body&&frameDoc.body.innerText||'').trim().length;
   if(textLength<80){
    console.warn('[GoSVT reader] srcdoc rendered too little text; retrying via document.write');
    frameDoc.open();frameDoc.write(html);frameDoc.close();
   }
  }catch(frameError){console.error('[GoSVT reader] fallback render error',frameError);}
  applyReadingPreferences();
 },{once:true});
 frame.srcdoc=html;
 $('lesson-frame-wrap').hidden=false;$('lesson-status').hidden=false;
 say('تم تحميل الدرس. إذا لم يظهر المحتوى، أعد المحاولة أو أرسل هذه الرسالة للإدارة.');

 const banks=[
 {match:/flux de la matière|flux de la matiere/i,questions:[
 {q:"Dans une chaîne alimentaire, la matière organique est d’abord produite par…",a:["les producteurs autotrophes","les consommateurs secondaires","les décomposeurs uniquement"],correct:0,why:"Les producteurs (notamment les végétaux chlorophylliens) fabriquent de la matière organique à partir de matière minérale."},
 {q:"Le transfert d’énergie entre niveaux trophiques est…",a:["total et sans pertes","partiel, avec dissipation sous forme de chaleur","indépendant de la respiration"],correct:1,why:"Une partie de l’énergie est utilisée et dissipée à chaque niveau; seule une fraction passe au niveau suivant."},
 {q:"Les décomposeurs contribuent principalement à…",a:["recycler la matière minérale","arrêter les flux d’énergie","produire la lumière"],correct:0,why:"Ils dégradent la matière organique et libèrent des éléments minéraux réutilisables."}]},
 {match:/équilibres naturels|equilibres naturels/i,questions:[
 {q:"Un écosystème est…",a:["un ensemble d’êtres vivants et de leur milieu en interaction","un seul organisme","un milieu sans interactions"],correct:0,why:"L’écosystème comprend la biocénose, le biotope et leurs interactions."},
 {q:"Une perturbation peut…",a:["modifier les relations et la dynamique de l’écosystème","toujours améliorer la biodiversité","ne jamais changer les populations"],correct:0,why:"Les perturbations peuvent modifier les effectifs, les relations trophiques et les conditions du milieu."},
 {q:"Une mesure de préservation pertinente est…",a:["réduire les pollutions et protéger les habitats","supprimer toutes les espèces","ignorer les suivis écologiques"],correct:0,why:"La protection des habitats et la réduction des pressions contribuent au maintien de la biodiversité."}]},
 {match:/sortie écologique|sortie ecologique/i,questions:[
 {q:"Lors d’une sortie écologique, l’échantillonnage sert à…",a:["obtenir des observations selon une méthode définie","garantir de voir toutes les espèces","remplacer toute mesure"],correct:0,why:"Une méthode d’échantillonnage standardisée permet des observations comparables."},
 {q:"Un transect est utile pour…",a:["étudier la répartition le long d’un parcours","mesurer la masse d’un seul animal","modifier volontairement le milieu"],correct:0,why:"Le transect permet d’observer la variation des organismes ou paramètres le long d’un axe."},
 {q:"Pour rendre une observation scientifique exploitable, il faut…",a:["noter le lieu, la date et la méthode","se fier uniquement à la mémoire","ne noter que les résultats attendus"],correct:0,why:"Le contexte et la méthode sont nécessaires pour interpréter et reproduire les observations."}]},
 {match:/adn aux protéines|adn aux proteines/i,questions:[
 {q:"L’information génétique de l’ADN est portée par…",a:["la séquence des nucléotides","la taille de la cellule uniquement","les lipides membranaires"],correct:0,why:"L’ordre des nucléotides constitue l’information génétique."},
 {q:"La transcription permet généralement de…",a:["produire un ARN à partir d’un brin d’ADN matrice","fabriquer directement un lipide","transformer une protéine en ADN"],correct:0,why:"La transcription copie l’information d’un gène en ARN."},
 {q:"La traduction correspond à…",a:["la synthèse d’une chaîne polypeptidique à partir de l’ARNm","la duplication de la membrane","la dégradation du glucose uniquement"],correct:0,why:"Les ribosomes lisent l’ARNm et assemblent les acides aminés."}]}
 ];
 const bank=banks.find(b=>b.match.test(lesson.title))?.questions;
 if(bank){
 const quiz=document.createElement('section');quiz.className='gs-lesson-checkpoint';quiz.innerHTML='<h2>🧠 Vérifie tes acquis / Vérifiez vos acquis</h2><p>Répondez aux trois questions. Le seuil de validation est de 2 réponses correctes sur 3.</p><form id="gs-checkpoint-form"></form><button id="gs-checkpoint-submit" type="button">Corriger mes réponses</button><div id="gs-checkpoint-feedback" role="status"></div>';
 const st=document.createElement('style');st.textContent='.gs-lesson-checkpoint{margin:1rem auto 2rem;max-width:1100px;padding:1.2rem;border-radius:16px;background:#f6fbf5;border:1px solid #d7e8d5;color:#244631}.gs-lesson-checkpoint h2{margin-top:0}.gs-lesson-checkpoint fieldset{border:1px solid #d5e3d3;border-radius:12px;margin:.8rem 0;padding:1rem;background:white}.gs-lesson-checkpoint legend{font-weight:700}.gs-lesson-checkpoint label{display:block;padding:.35rem}.gs-lesson-checkpoint button{padding:.65rem 1rem;border:0;border-radius:9px;background:#24633e;color:white;font-weight:700;cursor:pointer}.gs-lesson-checkpoint .feedback{padding:.75rem;margin:.6rem 0;background:#eef5ec;border-radius:9px}';document.head.appendChild(st);
 const form=quiz.querySelector('form');bank.forEach((q,i)=>{const fs=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=(i+1)+'. '+q.q;fs.appendChild(legend);q.a.forEach((a,j)=>{const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='q'+i;radio.value=String(j);label.append(radio,document.createTextNode(' '+a));fs.appendChild(label);});form.appendChild(fs);});
 $('lesson-frame-wrap').after(quiz);
 quiz.querySelector('#gs-checkpoint-submit').addEventListener('click',async()=>{const feedback=quiz.querySelector('#gs-checkpoint-feedback');let score=0,complete=true;bank.forEach((q,i)=>{const selected=form.querySelector('input[name="q'+i+'"]:checked');if(!selected){complete=false;return;}if(Number(selected.value)===q.correct)score++;});if(!complete){feedback.textContent='يرجى الإجابة عن الأسئلة الثلاثة قبل التصحيح.';return;}feedback.innerHTML='<p><strong>نتيجتك: '+score+'/'+bank.length+'</strong> — '+(score>=2?'أحسنت! يمكنك اعتبار هذا المحور مكتسباً.':'راجع التفسيرات ثم أعد المحاولة.')+'</p>'+bank.map((q,i)=>'<div class="feedback"><strong>'+(i+1)+'. '+q.why+'</strong></div>').join('');if(score>=2){try{await client.from('student_progress').upsert({student_id:user.id,content_key:'private-lesson:'+id,content_type:'lesson',completed:true,updated_at:new Date().toISOString()},{onConflict:'student_id,content_key,content_type'});feedback.insertAdjacentHTML('beforeend','<p>تم تسجيل إنجاز الدرس في حسابك.</p>');}catch(e){}}});
 }

}
start().catch(e=>{console.error('[GoSVT lesson reader] initialization failed:',e);say(e&&String(e.message||e).includes('timeout')?'استغرق الاتصال وقتاً أطول من اللازم. تحقق من الإنترنت ثم أعد تحميل الدرس.':'تعذر تحميل الدرس بسبب خطأ في الاتصال. أعد المحاولة، وإذا تكرر الخطأ تواصل مع الإدارة.');});
})();