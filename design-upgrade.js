/* GO SVT Maroc — homepage design upgrade */
(function () {
 'use strict';
 var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.addEventListener('click',function(e){
  var card=e.target.closest&&e.target.closest('[data-go-level]');if(!card)return;
  e.preventDefault();var lvl=card.getAttribute('data-go-level');
  var nav=document.querySelector('.main-nav a[href="#cours"]');if(nav)nav.click();else location.hash='#cours';
  window.setTimeout(function(){
   var b=document.querySelector('#cours .level-tab-btn[data-level="'+lvl+'"]');if(b)b.click();
   var section=document.getElementById('cours');if(section&&section.scrollIntoView)section.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  },80);
 });
 function countUp(el,to){
  if(reduce||to<2){el.textContent=String(to);return;}
  var start=null,duration=1100;
  function step(now){if(start===null)start=now;var p=Math.min((now-start)/duration,1),ease=1-Math.pow(1-p,3);el.textContent=String(Math.round(to*ease));if(p<1)requestAnimationFrame(step);}
  requestAnimationFrame(step);
 }
 var box=document.getElementById('gs-stats');
 if(box){
  fetch('content.json',{cache:'no-cache'}).then(function(response){if(!response.ok)throw new Error('content index unavailable');return response.json();}).then(function(paths){
   if(!Array.isArray(paths))throw new Error('invalid content index');
   var seen=Object.create(null),counts={cours:0,exercices:0,examens:0,quiz:0};
   paths.forEach(function(path){
    var p=String(path).replace(/^\/+/,'');var top=p.split('/')[0],low=p.toLowerCase();
    if(top==='quiz'&&low.endsWith('.json')){counts.quiz++;return;}
    if(!low.endsWith('.pdf')||!Object.prototype.hasOwnProperty.call(counts,top))return;
    var key=low.split('/').filter(function(part){return !/^chapitre \d+$/.test(part);}).join('/');
    if(seen[key])return;seen[key]=true;counts[top]++;
   });
   if(!counts.cours&&!counts.exercices&&!counts.examens&&!counts.quiz)return;
   box.hidden=false;var started=false;
   function run(){if(started)return;started=true;box.querySelectorAll('[data-stat]').forEach(function(el){countUp(el,counts[el.getAttribute('data-stat')]||0);});}
   if('IntersectionObserver'in window){var io=new IntersectionObserver(function(entries){if(entries[0]&&entries[0].isIntersecting){run();io.disconnect();}},{threshold:.3});io.observe(box);}else run();
  }).catch(function(error){console.warn('GO SVT statistics were not loaded:',error);});
 }
 var elements=document.querySelectorAll('.gs-level-card,.gs-stats-card,.feature-card,.gs-founder-card');
 if(!('IntersectionObserver'in window)||reduce)return;
 var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target);}});},{threshold:.15});
 elements.forEach(function(el,index){el.classList.add('gs-reveal');el.style.setProperty('--d',(index%4)*.08+'s');observer.observe(el);});
})();