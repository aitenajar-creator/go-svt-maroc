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
 const originalStyles=[...doc.head.querySelectorAll('style')].map(s=>s.outerHTML).join('');
 const html='<!doctype html><html lang="'+(doc.documentElement.lang||'fr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">'+originalStyles+'<style>body{margin:0;padding:clamp(1rem,4vw,3rem);font-family:system-ui,sans-serif;line-height:1.75;color:#25352b}img,svg{max-width:100%;height:auto}table{max-width:100%;border-collapse:collapse;overflow:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>'+doc.body.innerHTML+'</body></html>';
 $('lesson-frame').srcdoc=html;$('lesson-frame-wrap').hidden=false;$('lesson-status').hidden=true;
}
start().catch(e=>say('تعذر تحميل الدرس. يرجى المحاولة لاحقاً.'));
})();