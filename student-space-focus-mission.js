/* GO SVT Maroc — Focus mission: short session timer + learner checklist (session-only, no account data writes). */
(() => {
  'use strict';
  const ID='gs-focus-mission';
  const TXT={
    ar:{eyebrow:'مهمة تعلم قصيرة',title:'15 دقيقة للتقدم خطوة',sub:'اختر مورداً من مسارك، ثم نفّذ المراحل. هذه المهمة اختيارية ولا تحفظ أي بيانات دراسية.',start:'ابدأ',pause:'إيقاف مؤقت',resume:'متابعة',reset:'إعادة',read:'5 دقائق: اقرأ فكرة أو جزءاً من درس',practice:'7 دقائق: طبّق على تمرين أو وثيقة',check:'3 دقائق: لخّص ما فهمته وتحقق من إجابتك',library:'فتح دروس مساري',practiceLink:'فتح التمارين',quiz:'اختبار قصير',lab:'مختبرات SVT',done:'تمت المهمة! أحسنت تنظيم وقتك.',idle:'عند البدء سيظهر الوقت المتبقي.',time:'الوقت المتبقي',finish:'أنهِ المهمة',complete:'اكتملت المهمة',profile:'المهمة مخصصة لمسارك الدراسي'},
    fr:{eyebrow:'MISSION D’APPRENTISSAGE',title:'15 minutes pour avancer',sub:'Choisissez une ressource de votre parcours puis réalisez les étapes. Cette mission est facultative et n’enregistre aucune donnée scolaire.',start:'Démarrer',pause:'Pause',resume:'Reprendre',reset:'Réinitialiser',read:'5 min : lire une notion ou une partie du cours',practice:'7 min : appliquer sur un exercice ou un document',check:'3 min : résumer et vérifier sa réponse',library:'Cours de mon parcours',practiceLink:'Ouvrir les exercices',quiz:'Quiz rapide',lab:'Laboratoires SVT',done:'Mission terminée ! Bravo pour votre organisation.',idle:'Le temps restant s’affichera après démarrage.',time:'Temps restant',finish:'Terminer la mission',complete:'Mission terminée',profile:'Mission adaptée à votre parcours'}
  };
  const TRACKS={TCS:['الجذع المشترك العلمي','Tronc commun scientifique'],TCL:['الجذع المشترك الأدبي','Tronc commun lettres'],'1BACSE':['الأولى باكالوريا علوم تجريبية','1ère Bac sciences expérimentales'],'1BACSM':['الأولى باكالوريا علوم رياضية','1ère Bac sciences mathématiques'],'1BACL':['الأولى باكالوريا آداب','1ère Bac lettres'],'2BACSVT':['الثانية باكالوريا علوم الحياة والأرض','2ème Bac SVT'],'2BACSP':['الثانية باكالوريا علوم فيزيائية','2ème Bac sciences physiques'],'2BACSM':['الثانية باكالوريا علوم رياضية','2ème Bac sciences mathématiques']};
  const language=()=>document.documentElement.lang==='fr'?'fr':'ar';
  function profile(){try{return window.StudentAccount&&StudentAccount.isLoggedIn()?StudentAccount.getProfile():null}catch(_){return null}}
  const escapeText=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let interval=null,seconds=900,running=false,checked=[false,false,false],signature='';
  function render(){
    const panel=document.getElementById('panel-dashboard'),welcome=panel&&panel.querySelector('.gs-student-welcome');
    if(!welcome)return;
    const p=profile();let card=document.getElementById(ID);const previous=card;
    if(!p||['admin','teacher'].includes(String(p.role||'').toLowerCase())){if(card)card.remove();clearInterval(interval);interval=null;return;}
    const lang=language(),t=TXT[lang],track=String(p.study_track||'').toUpperCase(),level=String(p.study_level||'').toUpperCase(),name=TRACKS[track]?TRACKS[track][lang]:track;
    const sig=String(p.id||p.user_id||p.email||'student')+'|'+lang;
    if(card&&card.dataset.signature===sig){update();return;}
    clearInterval(interval);interval=null;running=false;seconds=900;checked=[false,false,false];signature=sig;
    card=document.createElement('section');card.id=ID;card.className='gs-focus-mission';card.dataset.signature=sig;
    card.setAttribute('aria-label',t.title);
    card.innerHTML='<div class="gs-fm-head"><div><span class="gs-fm-eyebrow">'+t.eyebrow+'</span><h3>'+t.title+'</h3><p>'+t.sub+'</p></div><span class="gs-fm-profile">'+escapeText(level)+' · '+escapeText(name)+'</span></div><div class="gs-fm-timer" role="timer" aria-live="polite"><span>'+t.time+'</span><strong data-time>15:00</strong><small data-status>'+t.idle+'</small></div><ol class="gs-fm-steps"><li><label><input type="checkbox" data-step="0"><span>'+t.read+'</span></label></li><li><label><input type="checkbox" data-step="1"><span>'+t.practice+'</span></label></li><li><label><input type="checkbox" data-step="2"><span>'+t.check+'</span></label></li></ol><div class="gs-fm-controls"><button type="button" data-start>'+t.start+'</button><button type="button" data-reset>'+t.reset+'</button></div><div class="gs-fm-links"><a href="#cours">📚 '+t.library+'</a><a href="#exercices">🧩 '+t.practiceLink+'</a><a href="#quiz">⚡ '+t.quiz+'</a><a href="student-physiology-lab.html">🔬 '+t.lab+'</a></div>';
    const controls=card.querySelector('[data-start]'),reset=card.querySelector('[data-reset]');
    controls.addEventListener('click',()=>{if(seconds<=0)return;running=!running;if(running&&!interval)interval=setInterval(tick,1000);if(!running){clearInterval(interval);interval=null;}update();});
    reset.addEventListener('click',()=>{clearInterval(interval);interval=null;running=false;seconds=900;checked=[false,false,false];card.querySelectorAll('[data-step]').forEach(c=>c.checked=false);update();});
    card.querySelectorAll('[data-step]').forEach(input=>input.addEventListener('change',()=>{checked[Number(input.dataset.step)]=input.checked;card.classList.toggle('is-complete',checked.every(Boolean));}));
    if(previous)previous.replaceWith(card);else welcome.insertAdjacentElement('afterend',card);
    update();
  }
  function tick(){if(seconds>0){seconds--;update();}if(seconds<=0){running=false;clearInterval(interval);interval=null;update();}}
  function update(){const card=document.getElementById(ID);if(!card)return;const t=TXT[language()];card.querySelector('[data-time]').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');card.querySelector('[data-start]').textContent=seconds<=0?t.complete:(running?t.pause:t.resume);card.querySelector('[data-start]').disabled=seconds<=0;card.querySelector('[data-status]').textContent=seconds<=0?t.done:(running?(language()==='fr'?'Mission en cours…':'المهمة جارية…'):t.idle);card.querySelector('[data-start]').setAttribute('aria-pressed',running?'true':'false');}
  let debounce;function schedule(){clearTimeout(debounce);debounce=setTimeout(render,120);}
  function init(){const root=document.getElementById('student-space-content');if(!root)return;new MutationObserver(records=>{const relevant=records.some(record=>{const target=record.target.nodeType===1?record.target:record.target.parentElement;if(target&&target.closest('#'+ID))return false;return [...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&node.id!==ID&&!node.closest('#'+ID));});if(relevant)schedule()}).observe(root,{subtree:true,childList:true});document.addEventListener('gosvt:auth-changed',schedule);document.addEventListener('click',e=>{if(e.target.closest('.lang-switcher'))schedule();});window.addEventListener('storage',schedule);render();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
