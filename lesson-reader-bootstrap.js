(function(){
'use strict';
var status=document.getElementById('lesson-status');
function show(message){if(status){status.hidden=false;status.textContent=message;}}
function loadScript(src,label,timeout){
 return new Promise(function(resolve,reject){
  var script=document.createElement('script'),done=false,timer;
  function finish(error){if(done)return;done=true;clearTimeout(timer);script.onload=script.onerror=null;if(error)reject(error);else resolve();}
  script.src=src;script.async=true;
  script.onload=function(){finish();};
  script.onerror=function(){finish(new Error('تعذر تحميل '+label+'.'));};
  timer=setTimeout(function(){finish(new Error('انتهت مهلة تحميل '+label+'.'));},timeout||12000);
  document.head.appendChild(script);
 });
}
show('جارٍ تشغيل عارض الدرس وتحميل مكتبة الاتصال…');
loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','مكتبة Supabase',12000)
 .then(function(){show('تم تحميل مكتبة الاتصال. جارٍ إعداد الحساب…');return loadScript('supabase-config.js?v=reader8','إعداد الاتصال',10000);})
 .then(function(){show('تم إعداد الاتصال. جارٍ تشغيل عارض الدرس…');return loadScript('lesson-reader.js?v=9','ملف عارض الدرس',10000);})
 .catch(function(error){console.error('[GoSVT reader loader]',error);show((error&&error.message?error.message:'تعذر تشغيل عارض الدرس')+' يرجى إعادة تحميل الصفحة. إذا تكرر الخطأ أرسل هذه الرسالة للإدارة.');});
})();