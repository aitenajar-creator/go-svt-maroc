(function(){
'use strict';
const $=id=>document.getElementById(id), client=window.supabaseClient;
const say=m=>{$('lesson-status').textContent=m;};
$('back-btn').addEventListener('click',()=>{location.href='index.html#student-space';});
$('print-btn').addEventListener('click',()=>{const f=$('lesson-frame');if(f.contentWindow)f.contentWindow.print();});
async function start(){
 if(!client){say('Service de connexion indisponible.');return;}
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){say('هذا الدرس مخصص للمستخدمين المسجلين. يرجى تسجيل الدخول من مساحة التلميذ.');return;}
 const {data:profile,error:pe}=await client.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(pe||!profile||!['student','admin'].includes(profile.role)){say('ليس لديك إذن لقراءة هذا الدرس.');return;}
 const id=new URLSearchParams(location.search).get('id');
 if(!id){say('لم يتم تحديد الدرس.');return;}
 const {data:lesson,error:le}=await client.from('private_student_lessons').select('id,title,content_html').eq('id',id).maybeSingle();
 if(le||!lesson){say('هذا الدرس غير متاح لحسابك أو لم يعد منشوراً.');return;}
 $('lesson-title').textContent=lesson.title;
 const doc=new DOMParser().parseFromString(lesson.content_html,'text/html');
 doc.querySelectorAll('script,iframe,object,embed,form,base').forEach(n=>n.remove());
 doc.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*javascript:/i.test(a.value)))el.removeAttribute(a.name);});});
 const privateImages=[...doc.querySelectorAll('img[data-private-asset]')];
 for(const img of privateImages){
   const assetPath=img.getAttribute('data-private-asset');
   const {data:asset,error:assetError}=await client.storage.from('private-lesson-assets').createSignedUrl(assetPath,3600);
   if(!assetError&&asset?.signedUrl) img.setAttribute('src',asset.signedUrl);
   else img.replaceWith(doc.createTextNode('تعذر تحميل هذه الوثيقة المصورة حالياً.'));
 }
 const headings=[...doc.body.querySelectorAll('h2,h3')].filter(h=>h.textContent.trim());
 const tocItems=headings.map((h,i)=>{if(!h.id)h.id='lesson-section-'+(i+1);return '<li class="'+(h.tagName.toLowerCase()==='h3'?'sub':'')+'"><a href="#'+h.id+'">'+h.textContent.trim().replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))+'</a></li>';}).join('');
 const toc=tocItems?'<nav class="lesson-toc" aria-label="Sommaire du cours"><strong>Sommaire / فهرس الدرس</strong><ul>'+tocItems+'</ul></nav>':'';
 const originalStyles=[...doc.head.querySelectorAll('style')].map(s=>s.outerHTML).join('');
 const html='<!doctype html><html lang="'+(doc.documentElement.lang||'fr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">'+originalStyles+'<style>body{margin:0;padding:clamp(1rem,4vw,3rem);font-family:system-ui,sans-serif;line-height:1.75;color:#25352b}img,svg{max-width:100%;height:auto}.source-figure{margin:1.5rem 0;padding:1rem;border:1px solid #dce7d9;border-radius:12px;background:#fbfdf9}.source-figure img{display:block;width:100%;max-width:850px;margin:auto}.source-figure figcaption{text-align:center;color:#5c6f60;font-size:.9rem;margin-top:.6rem}.lesson-toc{padding:1rem 1.25rem;margin:0 0 1.5rem;background:#f1f7ee;border:1px solid #d8e6d4;border-radius:12px}.lesson-toc ul{margin:.5rem 0;padding-inline-start:1.25rem}.lesson-toc li.sub{margin-inline-start:1rem;font-size:.94em}.lesson-toc a{color:#27633e;text-decoration:none}.lesson-toc a:hover{text-decoration:underline}table{max-width:100%;border-collapse:collapse;overflow:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{padding:0;font-size:11pt}.lesson-toc{break-inside:avoid}.lesson-toc a{color:#111;text-decoration:none}h2,h3{break-after:avoid}img,figure,table{break-inside:avoid;max-width:100%}}</style></head><body>'+toc+doc.body.innerHTML+'</body></html>';
 $('lesson-frame').srcdoc=html;$('lesson-frame-wrap').hidden=false;$('lesson-status').hidden=true;
}
start().catch(e=>say('تعذر تحميل الدرس. يرجى المحاولة لاحقاً.'));
})();