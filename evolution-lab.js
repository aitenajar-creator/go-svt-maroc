/* Go SVT Maroc — Evolution Lab, bilingual classroom simulation */
(() => {
'use strict';
const rootId='gs-evolution-lab';
const tr={
 ar:{title:'مختبر التطور',subtitle:'استكشف كيف تتغير الصفات عبر الأجيال: الانتقاء الطبيعي والانحراف الوراثي.',open:'🧬 افتح مختبر التطور',close:'إخفاء المختبر',selection:'الانتقاء الطبيعي',drift:'الانحراف الوراثي',habitat:'البيئة',light:'بيئة فاتحة',dark:'بيئة داكنة',pressure:'ضغط الافتراس',pop:'حجم الجماعة',generations:'عدد الأجيال',start:'▶ تشغيل',pause:'⏸ إيقاف',step:'جيل واحد',reset:'↺ إعادة ضبط',generation:'الجيل',lightTrait:'صفة فاتحة',darkTrait:'صفة داكنة',chart:'تغير تواتر الصفة الداكنة',explainSelection:'في هذا النموذج المبسط، يزيد احتمال البقاء للصفة الأكثر تمويهًا مع البيئة. لا يغير الفرد صفته؛ تتغير نسب الصفات في الجماعة عبر الأجيال.',explainDrift:'في الانحراف الوراثي، تتغير تواترات الصفات بسبب أخذ عينة عشوائية من الجماعة في كل جيل. أثر الصدفة يكون أوضح عادة في الجماعات الصغيرة. محاكاة تعليمية وليست توقعًا.',status:'نموذج افتراضي مبسط؛ النتائج تتغير مع العشوائية.',sample:'نسبة الصفة الداكنة',result:'ماذا نلاحظ؟'},
 fr:{title:'Laboratoire de l’évolution',subtitle:'Explorez l’évolution des caractères : sélection naturelle et dérive génétique.',open:'🧬 Ouvrir le laboratoire',close:'Masquer le laboratoire',selection:'Sélection naturelle',drift:'Dérive génétique',habitat:'Environnement',light:'Milieu clair',dark:'Milieu sombre',pressure:'Pression de prédation',pop:'Taille de population',generations:'Nombre de générations',start:'▶ Démarrer',pause:'⏸ Pause',step:'Une génération',reset:'↺ Réinitialiser',generation:'Génération',lightTrait:'Caractère clair',darkTrait:'Caractère sombre',chart:'Évolution du caractère sombre',explainSelection:'Dans ce modèle simplifié, la probabilité de survie est plus élevée pour le caractère le mieux camouflé. Les individus ne changent pas de caractère : les fréquences changent au fil des générations.',explainDrift:'En dérive génétique, les fréquences changent par échantillonnage aléatoire de la population à chaque génération. L’effet du hasard est généralement plus marqué dans les petites populations. Simulation pédagogique.',status:'Modèle virtuel simplifié ; les résultats varient selon le hasard.',sample:'Proportion du caractère sombre',result:'Observation'}
};
let lang='ar',mode='selection',timer=null,gen=0,pop=100,limit=30,pressure=.35,dark=50,habitat='dark',history=[50];
const $=id=>document.getElementById(id),t=k=>tr[lang][k]||k;
function render(){const host=$(rootId);if(!host)return;
host.innerHTML=`<div class="evo-shell" dir="${lang==='ar'?'rtl':'ltr'}"><header class="evo-header"><div><span class="evo-kicker">🧬</span><h2>${t('title')}</h2><p>${t('subtitle')}</p></div><button type="button" class="evo-close" id="evo-close">${t('close')}</button></header>
<div class="evo-mode-tabs" role="tablist"><button type="button" data-mode="selection" class="${mode==='selection'?'active':''}">${t('selection')}</button><button type="button" data-mode="drift" class="${mode==='drift'?'active':''}">${t('drift')}</button></div>
<div class="evo-controls"><label class="evo-field" id="evo-habitat-field"><span>${t('habitat')}</span><select id="evo-habitat"><option value="light">${t('light')}</option><option value="dark">${t('dark')}</option></select></label>
<label class="evo-field" id="evo-pressure-field"><span>${t('pressure')} <b id="evo-pressure-value">${Math.round(pressure*100)}%</b></span><input id="evo-pressure" type="range" min="0" max="100" value="${pressure*100}"></label>
<label class="evo-field"><span>${t('pop')} <b id="evo-pop-value">${pop}</b></span><input id="evo-pop" type="range" min="20" max="300" step="10" value="${pop}"></label>
<label class="evo-field"><span>${t('generations')} <b id="evo-limit-value">${limit}</b></span><input id="evo-limit" type="range" min="5" max="100" step="5" value="${limit}"></label></div>
<div class="evo-action-row"><button class="evo-action primary" id="evo-run">${t('start')}</button><button class="evo-action" id="evo-step">${t('step')}</button><button class="evo-action" id="evo-reset">${t('reset')}</button></div>
<div class="evo-results"><div class="evo-stat"><span>${t('generation')}</span><strong id="evo-generation">${gen}</strong></div><div class="evo-stat"><span>${t('sample')}</span><strong id="evo-dark-stat">${dark}%</strong></div><div class="evo-stat"><span>${t('lightTrait')}</span><strong id="evo-light-stat">${100-dark}%</strong></div></div>
<div class="evo-chart-wrap"><h3>${t('chart')}</h3><svg id="evo-chart" viewBox="0 0 600 240" role="img" aria-label="${t('chart')}"></svg><div class="evo-legend"><span><i></i>${t('darkTrait')}</span></div></div>
<div class="evo-explanation"><h3>${t('result')}</h3><p>${mode==='selection'?t('explainSelection'):t('explainDrift')}</p><p class="evo-note">${t('status')}</p></div></div>`;
$('evo-habitat').value=habitat;
$('evo-habitat-field').hidden=mode==='drift';$('evo-pressure-field').hidden=mode==='drift';
$('evo-close').addEventListener('click',()=>{stop();host.hidden=true;const b=$('evo-open');if(b)b.focus();});
host.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{stop();mode=b.dataset.mode;render();}));
$('evo-pressure').addEventListener('input',e=>{pressure=Number(e.target.value)/100;$('evo-pressure-value').textContent=e.target.value+'%';});
$('evo-pop').addEventListener('input',e=>{pop=Number(e.target.value);$('evo-pop-value').textContent=pop;});
$('evo-limit').addEventListener('input',e=>{limit=Number(e.target.value);$('evo-limit-value').textContent=limit;});
$('evo-habitat').addEventListener('change',e=>habitat=e.target.value);
$('evo-run').addEventListener('click',()=>timer?stop():start());$('evo-step').addEventListener('click',()=>{stop();step();});$('evo-reset').addEventListener('click',reset);updateChart();}
function sampleBinomial(n,p){let k=0;for(let i=0;i<n;i++)if(Math.random()<p)k++;return k;}
function step(){if(gen>=limit){stop();return;}
let darkP=dark/100;
if(mode==='selection'){const darkSurvival=habitat==='dark'?1-pressure*.12:1-pressure*.72;const lightSurvival=habitat==='light'?1-pressure*.12:1-pressure*.72;const d=darkP*darkSurvival,l=(1-darkP)*lightSurvival;darkP=(d+l)>0?d/(d+l):darkP;}
dark=Math.round(sampleBinomial(pop,darkP)/pop*100);gen++;history.push(dark);update();if(gen>=limit)stop();}
function update(){$('evo-generation').textContent=gen;$('evo-dark-stat').textContent=dark+'%';$('evo-light-stat').textContent=(100-dark)+'%';updateChart();}
function updateChart(){const svg=$('evo-chart');if(!svg)return;const scaleX=i=>35+(i/Math.max(limit,1))*530,scaleY=v=>210-v/100*175;const points=history.map((v,i)=>scaleX(i)+','+scaleY(v)).join(' ');svg.innerHTML='<line x1="35" y1="35" x2="35" y2="210" stroke="currentColor" opacity=".25"/><line x1="35" y1="210" x2="565" y2="210" stroke="currentColor" opacity=".25"/><line x1="35" y1="122" x2="565" y2="122" stroke="currentColor" opacity=".12"/><text x="8" y="40" font-size="12" fill="currentColor">100%</text><text x="12" y="215" font-size="12" fill="currentColor">0%</text><polyline points="'+points+'" fill="none" stroke="#268653" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+history.map((v,i)=>'<circle cx="'+scaleX(i)+'" cy="'+scaleY(v)+'" r="3.5" fill="#268653"/>').join('');}
function start(){if(gen>=limit)reset();const b=$('evo-run');if(b)b.textContent=t('pause');timer=setInterval(step,850);}
function stop(){if(timer){clearInterval(timer);timer=null;}const b=$('evo-run');if(b)b.textContent=t('start');}
function reset(){stop();gen=0;dark=50;history=[50];update();}
function langUpdate(){const n=document.documentElement.lang==='fr'?'fr':'ar';if(n!==lang){lang=n;if($(rootId)&&!$(rootId).hidden)render();}}
function init(){const host=$(rootId),btn=$('evo-open');if(!host||!btn)return;btn.addEventListener('click',()=>{host.hidden=!host.hidden;if(!host.hidden){render();host.scrollIntoView({behavior:'smooth',block:'start'});}});new MutationObserver(langUpdate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();