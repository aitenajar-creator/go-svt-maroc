(()=>{'use strict';
const dict={
 nucleus:{ar:['النواة','تحتوي على المادة الوراثية (ADN) وتساهم في تنظيم أنشطة الخلية.','توجد النواة في الخلايا حقيقية النواة.'],fr:['Noyau','Contient le matériel génétique (ADN) et participe au contrôle des activités cellulaires.','Le noyau caractérise les cellules eucaryotes.']},
 vacuole:{ar:['الفجوة','حجرة غشائية تخزن الماء ومواد مذابة، وتساهم في الحفاظ على ضغط الامتلاء في الخلية النباتية.','تكون الفجوة المركزية كبيرة غالباً في الخلية النباتية الناضجة.'],fr:['Vacuole','Compartiment membranaire qui stocke notamment l’eau et contribue à la turgescence de la cellule végétale.','La vacuole centrale est généralement volumineuse dans une cellule végétale mature.']},
 chloroplast:{ar:['البلاستيدة الخضراء','تحتوي على اليخضور وتتم داخلها عملية التركيب الضوئي.','توجد البلاستيدات الخضراء في الخلايا النباتية الخضراء وبعض الطحالب.'],fr:['Chloroplaste','Contient la chlorophylle et constitue le siège de la photosynthèse.','Les chloroplastes se trouvent dans les cellules végétales chlorophylliennes et certaines algues.']},
 mitochondria:{ar:['الميتوكندريا','تساهم في إنتاج الطاقة القابلة للاستعمال من طرف الخلية عبر التنفس الخلوي.','توجد الميتوكندريا في الخلايا النباتية والحيوانية.'],fr:['Mitochondrie','Participe à la production d’énergie utilisable par la cellule grâce à la respiration cellulaire.','Les mitochondries existent dans les cellules végétales et animales.']}
};
let lang='ar',cell='plant',selectedRockProcess=null,selectedEcoLevel='producer',removedSpecies=null,selectedFoodWeb=null,selectedHabitat=null,selectedPressure=null,selectedPollution=null,selectedPollutionAction=null,selectedWaterCycle=null;
const $=id=>document.getElementById(id);
function setLang(next){lang=next;document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-ar][data-fr]').forEach(el=>el.textContent=el.dataset[lang]);$('lab-language').textContent=lang==='ar'?'Français':'العربية';const active=document.querySelector('.gs-cell-type.is-active');if(active)active.textContent=active.dataset[lang];if(cell==='animal'){$('organelle-title').textContent=lang==='ar'?'الخلية الحيوانية':'Cellule animale';$('organelle-description').textContent=lang==='ar'?'تتميز بغياب الجدار الخلوي والبلاستيدات الخضراء، وتكون فجواتها صغيرة عادة.':'Elle ne possède ni paroi cellulosique ni chloroplastes ; ses vacuoles sont généralement petites.';$('organelle-tip').textContent=lang==='ar'?'اختر أحد المكونات المشتركة للتعرف على وظيفته.':'Choisissez une structure commune pour découvrir son rôle.';}else showOrganelle('nucleus');if($('lab-light'))updatePhotosynthesis();if($('gen-parent-one'))updateGenetics();if($('geo-explanation'))setGeology(document.querySelector('.gs-geology-choice.is-active')?.dataset.geology||'horizontal');if(selectedRockProcess)showRockProcess(selectedRockProcess);if($('eco-level-detail'))showEcoLevel(selectedEcoLevel);if($('eco-population-feedback'))updateEcoPopulation();if(removedSpecies)showBalanceResult(removedSpecies);if(selectedFoodWeb)showFoodWeb(selectedFoodWeb);if(selectedHabitat)showHabitat(selectedHabitat);if(selectedPressure)showPressure(selectedPressure);if(selectedPollution)showPollution(selectedPollution);if(selectedPollutionAction)showPollutionAction(selectedPollutionAction);if($('pollution-load'))updatePollutionSimulator();renderWaterManagementQuiz();renderBiodiversityQuiz();renderRelativeDatingQuiz();if(selectedWaterCycle)showWaterCycle(selectedWaterCycle);updateWaterCycleScore();}
function showOrganelle(key){const v=dict[key][lang];$('organelle-title').textContent=v[0];$('organelle-description').textContent=v[1];$('organelle-tip').textContent=v[2];}


function openScientificPhotoPreview(card){
 const imageUrl=card.dataset.realImageUrl;
 const sourceUrl=card.dataset.sourcePageUrl;
 if(!imageUrl||!sourceUrl)return;
 let dialog=document.getElementById('gs-science-photo-dialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='gs-science-photo-dialog';
  dialog.innerHTML='<div class="gs-photo-dialog-shell"><button type="button" class="gs-photo-dialog-close" aria-label="Close">×</button><img class="gs-photo-dialog-image" alt=""><div class="gs-photo-dialog-caption"></div><a class="gs-photo-dialog-source" target="_blank" rel="noopener noreferrer"></a></div>';
  const style=document.createElement('style');
  style.textContent='#gs-science-photo-dialog{width:min(94vw,1200px);max-width:94vw;max-height:92vh;padding:0;border:0;border-radius:18px;background:#fff;color:#183326;box-shadow:0 24px 80px #0007}#gs-science-photo-dialog::backdrop{background:#07170fdd;backdrop-filter:blur(4px)}#gs-science-photo-dialog .gs-photo-dialog-shell{position:relative;display:grid;gap:12px;padding:18px;justify-items:center}#gs-science-photo-dialog .gs-photo-dialog-image{display:block;max-width:100%;max-height:72vh;width:auto;height:auto;object-fit:contain}#gs-science-photo-dialog .gs-photo-dialog-caption{font-size:.85rem;line-height:1.6;text-align:center;color:#496353}#gs-science-photo-dialog .gs-photo-dialog-source{display:inline-flex;padding:9px 14px;border-radius:999px;background:#eaf4ec;color:#17623a;font-weight:700;text-decoration:none}#gs-science-photo-dialog .gs-photo-dialog-close{position:absolute;z-index:1;inset-block-start:8px;inset-inline-end:8px;width:40px;height:40px;border:0;border-radius:50%;background:#173d2b;color:#fff;font-size:28px;cursor:pointer}';
  document.head.appendChild(style);document.body.appendChild(dialog);
  dialog.querySelector('.gs-photo-dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 }
 const image=dialog.querySelector('.gs-photo-dialog-image');
 image.src=imageUrl;image.alt=card.querySelector('img')?.alt||card.getAttribute('aria-label')||'Scientific photograph';
 dialog.querySelector('.gs-photo-dialog-caption').textContent=card.querySelector('.gs-science-media-credit,.lab-photo-credit')?.textContent||'';
 const source=dialog.querySelector('.gs-photo-dialog-source');
 source.href=sourceUrl;source.textContent=document.documentElement.lang==='fr'?'Voir la source et la licence sur Wikimedia Commons':'عرض المصدر والترخيص على ويكيميديا كومنز';
 if(!dialog.open)dialog.showModal();
}

if(!document.documentElement.dataset.gsLabPhotoPreviewBound){
 document.addEventListener('click',event=>{
  const card=event.target.closest('.lab-real-photo[data-real-image-url]');
  if(!card)return;
  event.preventDefault();
  openScientificPhotoPreview(card);
 });
 document.documentElement.dataset.gsLabPhotoPreviewBound='true';
}
async function loadCommonsPhotos(){
 const cards=Array.from(document.querySelectorAll('.lab-real-photo[data-commons-query]'));
 await Promise.all(cards.map(async card=>{
  const frame=card.querySelector('.lab-photo-frame'),credit=card.querySelector('.lab-photo-credit');
  if(!frame)return;
  try{
   const params=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrnamespace:'6',gsrsearch:card.dataset.commonsQuery+' filetype:bitmap',gsrlimit:'5',prop:'imageinfo',iiprop:'url|extmetadata|size|mime',iiurlwidth:'900'});
   const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params.toString(),{headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('Commons request failed');
   const payload=await response.json();
   const candidates=payload&&payload.query&&payload.query.pages?Object.values(payload.query.pages).map(candidate=>({page:candidate,info:candidate&&Array.isArray(candidate.imageinfo)?candidate.imageinfo[0]:null})).filter(item=>item.info&&item.info.thumburl&&item.info.descriptionurl&&/^image\/(jpeg|png|webp|gif|tiff)$/i.test(item.info.mime||'')&&Number(item.info.width)>=320&&Number(item.info.height)>=200).sort((a,b)=>(Number(b.info.width)*Number(b.info.height))-(Number(a.info.width)*Number(a.info.height))):[];
   const selected=candidates[0],page=selected&&selected.page,info=selected&&selected.info;
   if(!info)throw new Error('No suitable raster image (minimum 320×200)');
   const imageUrl=new URL(info.thumburl),pageUrl=new URL(info.descriptionurl);
   if(imageUrl.hostname!=='upload.wikimedia.org'||pageUrl.hostname!=='commons.wikimedia.org')throw new Error('Unexpected image host');
   const meta=info.extmetadata||{};
   const plain=value=>String(value&&(value.value||value)||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
   const author=plain(meta.Artist)||plain(meta.Credit)||(lang==='ar'?'المؤلف غير محدد':'Auteur non indiqué');
   const license=plain(meta.LicenseShortName)||(lang==='ar'?'الترخيص غير محدد':'Licence non indiquée');
   const img=document.createElement('img');img.src=imageUrl.href;img.alt=page.title||'Photographie scientifique';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
   frame.replaceChildren(img);card.dataset.realImageUrl=imageUrl.href;card.dataset.sourcePageUrl=pageUrl.href;card.href='#';card.removeAttribute('target');card.setAttribute('aria-haspopup','dialog');card.setAttribute('aria-label',(page.title||'Photographie scientifique')+' — '+license);
   if(credit)credit.textContent='© '+author+' · '+license;
  }catch(error){
   const note=frame.querySelector('small');
   if(note)note.textContent=lang==='ar'?'تعذر تحميل الصورة؛ افتح بحث ويكيميديا':'Aperçu indisponible ; ouvrir la recherche Wikimedia';
   if(credit)credit.textContent=lang==='ar'?'تعذر تحميل المصدر والترخيص':'Source et licence indisponibles';
   console.warn('[GoSVT Lab] Commons photo unavailable:',error&&error.message);
  }
 }));
}



const geologyTexts={
 horizontal:{ar:'في الطبقات الأفقية غير المشوهة، تكون الطبقات السفلى أقدم من الطبقات العليا وفق مبدأ التراكب، إذا لم يحدث انقلاب أو اضطراب جيولوجي.',fr:'Dans une série horizontale non déformée, les couches inférieures sont plus anciennes que les couches supérieures selon le principe de superposition, en l’absence de renversement ou de perturbation.'},
 fold:{ar:'الطية انثناء في الطبقات الصخرية ناتج عن التشوه، غالباً بفعل قوى الضغط. تُظهر الصورة الميدانية انحناء الطبقات حول محور الطية.',fr:'Un pli est une courbure des couches rocheuses due à la déformation, souvent sous l’effet de contraintes compressives. La photographie de terrain montre les couches qui se courbent autour d’un axe.'},
 fault:{ar:'الفالق كسر تصاحبه إزاحة نسبية للكتل الصخرية. تُظهر الصورة الميدانية انقطاع الطبقات واختلاف موضعها على جانبي مستوى الفالق.',fr:'Une faille est une fracture accompagnée d’un déplacement relatif des blocs rocheux. La photographie de terrain montre la rupture et le décalage des couches de part et d’autre du plan de faille.'}
};
function setGeology(type){
 document.querySelectorAll('[data-geo-photo]').forEach(photo=>{photo.hidden=photo.dataset.geoPhoto!==type;});
 document.querySelectorAll('.gs-geology-choice').forEach(b=>{const active=b.dataset.geology===type;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
 $('geo-explanation').textContent=geologyTexts[type][lang];
}

const alleleGametes=g=>g.split('');
function updateGenetics(){
 const p1=$('gen-parent-one').value,p2=$('gen-parent-two').value;
 const g1=alleleGametes(p1),g2=alleleGametes(p2);
 $('gen-col-one').textContent=g1[0];$('gen-col-two').textContent=g1[1];
 $('gen-row-one').textContent=g2[0];$('gen-row-two').textContent=g2[1];
 const outcomes=[g2[0]+g1[0],g2[0]+g1[1],g2[1]+g1[0],g2[1]+g1[1]].map(g=>g[0]===g[1]?g:g[0].toUpperCase()+g[1].toLowerCase());
 const counts={AA:0,Aa:0,aa:0};
 outcomes.forEach(g=>counts[g]++);
 outcomes.forEach((g,i)=>{const td=$('gen-result-'+i);td.textContent=g;td.classList.toggle('gen-recessive-cell',g==='aa');td.classList.toggle('gen-dominant-cell',g!=='aa');});
 const dominant=(counts.AA+counts.Aa)*25,recessive=counts.aa*25;
 $('gen-dominant').textContent=dominant+'%';$('gen-recessive').textContent=recessive+'%';
 $('gen-ratio').textContent=counts.AA+' AA : '+counts.Aa+' Aa : '+counts.aa+' aa';
 const genotypePercent={AA:counts.AA*25,Aa:counts.Aa*25,aa:counts.aa*25};
 ['AA','Aa','aa'].forEach(g=>{
  $('gen-bar-'+g).style.width=genotypePercent[g]+'%';
  $('gen-percent-'+g).textContent=genotypePercent[g]+'%';
  $('gen-bar-'+g).parentElement.setAttribute('aria-label',g+': '+genotypePercent[g]+'%');
 });
 const fr=lang==='fr';
 const parentLabel=(g)=>g==='AA'?(fr?'homozygote dominant':'متماثل سائد'):g==='aa'?(fr?'homozygote récessif':'متماثل متنحٍ'):(fr?'hétérozygote':'متغاير الزيجوت');
 let explain;
 if(p1==='Aa'&&p2==='Aa') explain=fr?'Chaque parent produit A et a avec la même probabilité. Le croisement donne 25 % AA, 50 % Aa et 25 % aa ; avec dominance complète, le phénotype dominant apparaît dans 75 % des cas.':'ينتج كل أب مشيجين A وa باحتمال متساوٍ. يعطي التزاوج 25% AA و50% Aa و25% aa؛ ومع السيادة التامة يظهر المظهر السائد في 75% من الحالات.';
 else if(p1==='AA'&&p2==='aa'||p1==='aa'&&p2==='AA') explain=fr?'Tous les descendants sont hétérozygotes Aa et expriment le phénotype dominant dans ce modèle.':'جميع الأبناء متغايرو الزيجوت Aa ويظهرون الصفة السائدة في هذا النموذج.';
 else if(p1==='aa'&&p2==='aa') explain=fr?'Tous les descendants sont aa et expriment le phénotype récessif.':'جميع الأبناء aa ويظهرون الصفة المتنحية.';
 else if(p1==='AA'&&p2==='AA') explain=fr?'Tous les descendants sont AA et expriment le phénotype dominant.':'جميع الأبناء AA ويظهرون الصفة السائدة.';
 else explain=fr?'Parent 1 : '+parentLabel(p1)+'. Parent 2 : '+parentLabel(p2)+'. Les proportions sont calculées à partir des quatre combinaisons équiprobables.':'الأب الأول: '+parentLabel(p1)+'، والأب الثاني: '+parentLabel(p2)+'. حُسبت النسب انطلاقاً من التركيبات الأربع متساوية الاحتمال.';
 $('gen-explanation').textContent=explain;
}

function updatePhotosynthesis(){
 const light=Number($('lab-light').value),co2=Number($('lab-co2').value),water=Number($('lab-water').value);
 const rate=Math.min(light,co2,water);
 $('lab-light-value').textContent=light+'%';$('lab-co2-value').textContent=co2+'%';$('lab-water-value').textContent=water+'%';
 const level=rate>=70?(lang==='ar'?'مرتفع':'Élevé'):rate>=35?(lang==='ar'?'متوسط':'Moyen'):(lang==='ar'?'منخفض':'Faible');
 $('lab-photo-glucose').textContent=level;$('lab-photo-oxygen').textContent=level;
 $('lab-photo-rate').textContent=rate+'%';$('lab-photo-meter-fill').style.width=rate+'%';
 $('lab-photo-explanation').textContent=lang==='ar'
  ?(rate===0?'أحد العاملين غير متوفر تقريباً؛ يكون النشاط التمثيلي ضعيفاً جداً في هذا النموذج.':light<=co2&&light<=water?'الإضاءة هي العامل الأقل توفراً؛ زيادتها قد ترفع النشاط ما دامت العوامل الأخرى ملائمة.':co2<=light&&co2<=water?'توفر CO₂ هو العامل الأقل؛ زيادته قد ترفع النشاط ما دامت العوامل الأخرى ملائمة.':water<=light&&water<=co2?'توفر الماء هو العامل الأقل؛ تحسنه قد يرفع النشاط ما دامت العوامل الأخرى ملائمة.':'العوامل الثلاثة متقاربة في هذا النموذج؛ قد تصبح عوامل أخرى محدِّدة للنشاط.')
  :(rate===0?'L’un des facteurs est presque absent : l’activité est très faible dans ce modèle.':light<=co2&&light<=water?'La lumière est le facteur le moins disponible ; l’augmenter peut accroître l’activité si les autres conditions sont favorables.':co2<=light&&co2<=water?'Le CO₂ est le facteur le moins disponible ; l’augmenter peut accroître l’activité si les autres conditions sont favorables.':water<=light&&water<=co2?'L’eau est le facteur le moins disponible ; améliorer sa disponibilité peut accroître l’activité si les autres conditions sont favorables.':'Les trois facteurs sont proches dans ce modèle ; d’autres facteurs peuvent devenir limitants.');
}
$('lab-light').addEventListener('input',updatePhotosynthesis);
$('lab-co2').addEventListener('input',updatePhotosynthesis);
$('lab-water').addEventListener('input',updatePhotosynthesis);

$('lab-language').addEventListener('click',()=>setLang(lang==='ar'?'fr':'ar'));
$('lab-menu').addEventListener('click',()=>{const nav=document.querySelector('.gs-lab-page .main-nav');nav.classList.toggle('active');});
$('lab-zoom').addEventListener('input',e=>{const n=Number(e.target.value);$('lab-zoom-label').textContent='×'+n;$('micro-specimen').style.transform='scale('+Math.max(1,n/100)+')';});
document.querySelectorAll('.gs-organelle-hit').forEach(btn=>btn.addEventListener('click',()=>showOrganelle(btn.dataset.organelle)));
document.querySelectorAll('.gs-cell-type').forEach(btn=>btn.addEventListener('click',()=>{
 cell=btn.dataset.cell;
 document.querySelectorAll('.gs-cell-type').forEach(b=>{b.classList.toggle('is-active',b===btn);b.textContent=b.dataset[lang];});
 document.querySelectorAll('[data-cell-photo]').forEach(photo=>{photo.hidden=photo.dataset.cellPhoto!==cell;});
 document.querySelectorAll('.gs-cell-plant-only').forEach(item=>{item.hidden=cell==='animal';});
 document.querySelectorAll('.gs-organelle-hit').forEach(hit=>{hit.hidden=cell==='animal'&&['chloroplast','vacuole'].includes(hit.dataset.organelle);hit.textContent=({nucleus:lang==='ar'?'النواة':'Noyau',vacuole:lang==='ar'?'الفجوة':'Vacuole',chloroplast:lang==='ar'?'البلاستيدة الخضراء':'Chloroplaste',mitochondria:lang==='ar'?'الميتوكندريا':'Mitochondrie'})[hit.dataset.organelle];});
 if(cell==='animal'){
  $('organelle-title').textContent=lang==='ar'?'الخلية الحيوانية':'Cellule animale';
  $('organelle-description').textContent=lang==='ar'?'تتميز بغياب الجدار الخلوي والبلاستيدات الخضراء، وتكون فجواتها صغيرة عادة.':'Elle ne possède ni paroi cellulosique ni chloroplastes ; ses vacuoles sont généralement petites.';
  $('organelle-tip').textContent=lang==='ar'?'اختر أحد المكونات المشتركة للتعرف على وظيفته.':'Choisissez une structure commune pour découvrir son rôle.';
 }else showOrganelle('nucleus');
}));
document.querySelectorAll('.gs-geology-choice').forEach(btn=>btn.addEventListener('click',()=>setGeology(btn.dataset.geology)));
setGeology('horizontal');
['gen-parent-one','gen-parent-two'].forEach(id=>$(id).addEventListener('change',updateGenetics));
updateGenetics();

const waterManagementQuizState=new Map();
const waterManagementFeedback=[
 {ar:'صحيح! إصلاح التسربات يقلل فقد الماء أثناء التوزيع.',fr:'Exact ! La réparation des fuites réduit les pertes pendant la distribution.'},
 {ar:'صحيح! يجب التأكد من جودة المياه المعالجة واحترام المعايير قبل إعادة استعمالها.',fr:'Exact ! La qualité des eaux traitées et le respect des normes doivent être vérifiés avant leur réutilisation.'},
 {ar:'صحيح! ترشيد الضخ والوقاية من التلوث يساعدان على حماية المياه الجوفية.',fr:'Exact ! La régulation des prélèvements et la prévention de la pollution contribuent à protéger les eaux souterraines.'}
];
function renderWaterManagementQuiz(){
 const score=[...waterManagementQuizState.values()].filter(Boolean).length;
 const scoreEl=$('wm-quiz-score');
 if(scoreEl)scoreEl.textContent=lang==='ar'?'النتيجة: '+score+' / 3':'Score : '+score+' / 3';
 document.querySelectorAll('.gs-wm-question').forEach((card,index)=>{
  const result=waterManagementQuizState.get(index);
  const feedback=card.querySelector('.gs-wm-feedback');
  if(result===undefined){feedback.textContent='';return;}
  feedback.textContent=result
   ?waterManagementFeedback[index][lang]
   :(lang==='ar'?'ليست هذه الإجابة الصحيحة. راجع الخيار المميز بالأخضر واقرأ التفسير.':'Ce n’est pas la bonne réponse. Consultez l’option en vert et lisez l’explication.');
 });
}
document.querySelectorAll('[data-wm-answer]').forEach(button=>button.addEventListener('click',()=>{
 const index=Number(button.dataset.wmAnswer),card=button.closest('.gs-wm-question');
 if(waterManagementQuizState.has(index))return;
 const correct=button.dataset.correct==='true';
 waterManagementQuizState.set(index,correct);
 card.querySelectorAll('[data-wm-answer]').forEach(option=>{
  option.disabled=true;
  if(option.dataset.correct==='true')option.classList.add('is-correct');
  else if(option===button)option.classList.add('is-wrong');
 });
 renderWaterManagementQuiz();
}));
$('wm-quiz-reset')?.addEventListener('click',()=>{
 waterManagementQuizState.clear();
 document.querySelectorAll('.gs-wm-question [data-wm-answer]').forEach(option=>{
  option.disabled=false;option.classList.remove('is-correct','is-wrong');
 });
 renderWaterManagementQuiz();
});

const relativeButtons=document.querySelectorAll('[data-relative-answer]');
relativeButtons.forEach(btn=>btn.addEventListener('click',()=>{
 relativeButtons.forEach(b=>{b.disabled=true;b.classList.toggle('is-correct',b.dataset.relativeAnswer==='intrusion');b.classList.toggle('is-wrong',b===btn&&b.dataset.relativeAnswer!=='intrusion');});
 const correct=btn.dataset.relativeAnswer==='intrusion';
 $('relative-feedback').textContent=lang==='ar'
  ?(correct?'إجابة صحيحة! التداخل الناري أحدث من الطبقات لأنه يخترقها ويقطع استمراريتها.':'ليست الإجابة الصحيحة. تذكّر أن البنية التي تقطع طبقات موجودة تكون أحدث منها.')
  :(correct?'Bonne réponse ! L’intrusion est plus récente que les couches puisqu’elle les recoupe.':'Ce n’est pas la bonne réponse. Une structure qui recoupe des couches déjà présentes est plus récente qu’elles.');
}));


const relativeQuizState=new Map();
const relativeQuizFeedback=[
 {ar:'صحيح! وفق مبدأ التراكب، تكون الطبقات السفلى أقدم من الطبقات العليا في سلسلة غير مشوهة.',fr:'Exact ! Selon le principe de superposition, les couches inférieures sont plus anciennes dans une série non déformée.'},
 {ar:'صحيح! البنية التي تقطع طبقات موجودة تكون أحدث منها وفق مبدأ التقاطع.',fr:'Exact ! Une structure qui recoupe des couches préexistantes est plus récente selon le principe de recoupement.'},
 {ar:'صحيح! العناصر المحتواة، مثل الحصى، أقدم من الصخرة التي تضمها.',fr:'Exact ! Les éléments inclus, comme les galets, sont plus anciens que la roche qui les contient.'}
];
function renderRelativeDatingQuiz(){
 const score=[...relativeQuizState.values()].filter(Boolean).length;
 const scoreNode=$('relative-quiz-score');
 if(scoreNode)scoreNode.textContent=lang==='ar'?'النتيجة: '+score+' / 3':'Score : '+score+' / 3';
 document.querySelectorAll('.gs-relative-question').forEach((card,index)=>{
  const result=relativeQuizState.get(index),feedback=card.querySelector('p');
  if(result===undefined){feedback.textContent='';return;}
  feedback.textContent=result?relativeQuizFeedback[index][lang]:(lang==='ar'?'ليست هذه الإجابة الصحيحة. راجع الخيار المميز بالأخضر واقرأ التفسير.':'Ce n’est pas la bonne réponse. Consultez l’option en vert et lisez l’explication.');
 });
}
document.querySelectorAll('[data-relative-q-answer]').forEach(button=>button.addEventListener('click',()=>{
 const index=Number(button.dataset.relativeQAnswer),card=button.closest('.gs-relative-question');
 if(relativeQuizState.has(index))return;
 relativeQuizState.set(index,button.dataset.correct==='true');
 card.querySelectorAll('[data-relative-q-answer]').forEach(option=>{
  option.disabled=true;
  if(option.dataset.correct==='true')option.classList.add('is-correct');
  else if(option===button)option.classList.add('is-wrong');
 });
 renderRelativeDatingQuiz();
 if(relativeQuizState.size===3){
  const score=[...relativeQuizState.values()].filter(Boolean).length;
  $('relative-quiz-result').textContent=lang==='ar'?'نتيجتك: '+score+' من 3. '+(score===3?'ممتاز!':'راجع المبادئ ثم حاول مرة أخرى.'):'Votre résultat : '+score+' sur 3. '+(score===3?'Excellent !':'Revoyez les principes puis réessayez.');
 }
}));
$('relative-quiz-reset')?.addEventListener('click',()=>{
 relativeQuizState.clear();
 document.querySelectorAll('.gs-relative-question [data-relative-q-answer]').forEach(option=>{
  option.disabled=false;option.classList.remove('is-correct','is-wrong');
 });
 $('relative-quiz-result').textContent=lang==='ar'?'أجب عن الأسئلة الثلاثة لعرض نتيجتك.':'Répondez aux trois questions pour afficher votre résultat.';
 renderRelativeDatingQuiz();
});

const rockDescriptions={
 cooling:{ar:'عندما تبرد الصهارة أو الحمم وتتبلور، تتشكل الصخور النارية. يختلف نسيجها حسب سرعة التبريد ومكانه.',fr:'Lorsque le magma ou la lave refroidit et cristallise, des roches magmatiques se forment. Leur texture dépend notamment de la vitesse et du lieu du refroidissement.'},
 weathering:{ar:'تفكك التجوية الصخور في مكانها، ثم تنقل التعرية الفتات بواسطة الماء أو الرياح أو الجليد، فتتكون رواسب.',fr:'L’altération désagrège les roches sur place, puis l’érosion transporte les débris par l’eau, le vent ou la glace et produit des sédiments.'},
 sedimentation:{ar:'تتراكم الرواسب ثم تتعرض للانضغاط والتلاحم، فتتحول تدريجياً إلى صخور رسوبية.',fr:'Les sédiments s’accumulent, se compactent et se cimentent progressivement pour former des roches sédimentaires.'},
 metamorphism:{ar:'تتغير الصخور بفعل الضغط والحرارة والسوائل دون انصهار كلي، فتتشكل صخور متحولة.',fr:'La pression, la température et les fluides transforment les roches sans fusion complète : des roches métamorphiques se forment.'},
 melting:{ar:'قد تنصهر الصخور عند ظروف حرارية مناسبة، فتنتج صهارة يمكن أن تبرد لاحقاً وتكوّن صخوراً نارية.',fr:'Dans des conditions thermiques suffisantes, les roches peuvent fondre et produire un magma qui pourra ensuite refroidir et former des roches magmatiques.'}
};
function showRockProcess(key){
 const process=rockDescriptions[key];
 if(process)$('rock-process-explanation').textContent=process[lang];
}
document.querySelectorAll('[data-rock-process]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedRockProcess=btn.dataset.rockProcess;
 document.querySelectorAll('[data-rock-process]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showRockProcess(selectedRockProcess);
}));


const ecoTexts={
 producer:{ar:'المنتِجات، مثل النباتات الخضراء، تصنع المادة العضوية بعملية التركيب الضوئي، وتشكل نقطة انطلاق كثير من السلاسل الغذائية.',fr:'Les producteurs, comme les plantes vertes, fabriquent de la matière organique par photosynthèse et constituent le point de départ de nombreuses chaînes alimentaires.'},
 primary:{ar:'المستهلك الأولي يتغذى مباشرة على المنتجات. في هذا المثال تتغذى الجرادة على النبات.',fr:'Le consommateur primaire se nourrit directement des producteurs. Dans cet exemple, le criquet mange la plante.'},
 secondary:{ar:'المستهلك الثانوي يتغذى على المستهلك الأولي. هنا يتغذى الضفدع على الجرادة.',fr:'Le consommateur secondaire se nourrit du consommateur primaire. Ici, la grenouille mange le criquet.'},
 tertiary:{ar:'المستهلك الأعلى يتغذى على مستهلكات أخرى. في هذا المثال تتغذى الأفعى على الضفدع، وقد تتداخل سلاسل متعددة في شبكة غذائية.',fr:'Le consommateur supérieur se nourrit d’autres consommateurs. Dans cet exemple, le serpent mange la grenouille ; plusieurs chaînes peuvent s’entrecroiser en réseau alimentaire.'}
};
function showEcoLevel(key){
 const detail=ecoTexts[key];
 if(detail)$('eco-level-detail').textContent=detail[lang];
}
document.querySelectorAll('[data-eco-level]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedEcoLevel=btn.dataset.ecoLevel;
 document.querySelectorAll('[data-eco-level]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showEcoLevel(selectedEcoLevel);
}));

let ecoQuizScore=0,ecoQuizAnswered=0;
function resetEcoQuiz(){
 ecoQuizScore=0;ecoQuizAnswered=0;
 document.querySelectorAll('.gs-eco-question').forEach(card=>{
  delete card.dataset.answered;
  card.querySelectorAll('button').forEach(button=>{button.disabled=false;button.classList.remove('is-correct','is-wrong');});
  card.querySelector('p').textContent='';
 });
 $('eco-quiz-score').textContent='0 / 3';
 $('eco-quiz-result').textContent=lang==='ar'?'أجب عن الأسئلة الثلاثة لعرض نتيجتك.':'Répondez aux trois questions pour afficher votre résultat.';
}
document.querySelectorAll('.gs-eco-question .gs-eco-answers button').forEach(button=>{
 button.addEventListener('click',()=>{
  const card=button.closest('.gs-eco-question');
  if(card.dataset.answered==='true')return;
  card.dataset.answered='true';ecoQuizAnswered++;
  const correct=button.dataset.correct==='true';
  if(correct)ecoQuizScore++;
  card.querySelectorAll('button').forEach(option=>{
   option.disabled=true;
   if(option.dataset.correct==='true')option.classList.add('is-correct');
   else if(option===button)option.classList.add('is-wrong');
  });
  card.querySelector('p').textContent=correct
   ?(lang==='ar'?'إجابة صحيحة، أحسنت!':'Bonne réponse, bravo !')
   :(lang==='ar'?'ليست الإجابة الصحيحة. راجع الإجابة المميزة بالأخضر.':'Ce n’est pas la bonne réponse. Consultez la réponse en vert.');
  $('eco-quiz-score').textContent=ecoQuizScore+' / 3';
  if(ecoQuizAnswered===3)$('eco-quiz-result').textContent=lang==='ar'
   ?'نتيجتك: '+ecoQuizScore+' من 3. '+(ecoQuizScore===3?'ممتاز!':'راجع السلسلة الغذائية ثم أعد المحاولة.')
   :'Votre résultat : '+ecoQuizScore+' sur 3. '+(ecoQuizScore===3?'Excellent !':'Revoyez la chaîne alimentaire puis réessayez.');
 });
});
$('eco-quiz-reset').addEventListener('click',resetEcoQuiz);


const balanceTexts={
 plants:{ar:'اختفاء النباتات يقلل مصدر الغذاء والطاقة للكائنات العاشبة، وقد يؤدي إلى تراجع الحشرات والعواشب ثم يؤثر في المفترسات التي تعتمد عليها. كما تتأثر حماية التربة.',fr:'La disparition des plantes réduit la source de nourriture et d’énergie des herbivores. Les insectes et autres herbivores peuvent diminuer, puis les prédateurs qui en dépendent ; la protection des sols est aussi affectée.'},
 insects:{ar:'قد يؤدي تراجع الحشرات العاشبة إلى تقليل غذاء الضفادع وبعض الطيور، بينما قد تزداد النباتات التي كانت تتغذى عليها هذه الحشرات.',fr:'La diminution des insectes herbivores peut réduire la nourriture disponible pour les grenouilles et certains oiseaux, tandis que les plantes consommées par ces insectes peuvent augmenter.'},
 frogs:{ar:'قد يؤدي اختفاء الضفادع إلى زيادة بعض الحشرات التي كانت تفترسها، وقد يتراجع غذاء الأفاعي والطيور التي كانت تتغذى عليها.',fr:'La disparition des grenouilles peut favoriser l’augmentation de certains insectes qu’elles consommaient et réduire la nourriture des serpents et des oiseaux qui s’en nourrissaient.'},
 birds:{ar:'قد تتغير أعداد الحشرات والفرائس التي كانت الطيور تتغذى عليها، كما قد تتأثر المفترسات التي تعتمد على بعض الطيور غذاءً لها.',fr:'Les populations d’insectes et de proies consommés par les oiseaux peuvent changer ; les prédateurs qui mangent certains oiseaux peuvent également être affectés.'},
 snakes:{ar:'قد تزداد بعض الفرائس التي كانت الأفاعي تتغذى عليها، وقد تتغير المنافسة على الموارد بين المفترسات الأخرى.',fr:'Certaines proies consommées par les serpents peuvent augmenter et la compétition pour les ressources entre autres prédateurs peut changer.'}
};
const ecoPopulationDefaults={plants:70,herbivores:50,predators:35};
function updateEcoPopulation(){
 const plants=Number($('eco-plants-range').value);
 const herbivores=Number($('eco-herbivores-range').value);
 const predators=Number($('eco-predators-range').value);
 $('eco-plants-value').textContent=plants+'%';
 $('eco-herbivores-value').textContent=herbivores+'%';
 $('eco-predators-value').textContent=predators+'%';
 let ar='توازن تمثيلي: تتوفر الموارد للكائنات في هذا السيناريو.';
 let fr='Équilibre illustratif : les ressources sont disponibles pour les organismes dans ce scénario.';
 if(plants<25){ar='انخفاض الغطاء النباتي: قد يقل الغذاء المتاح للعواشب، ثم تتأثر المفترسات بصورة غير مباشرة.';fr='Faible couverture végétale : la nourriture des herbivores peut diminuer, puis affecter indirectement les prédateurs.';}
 else if(herbivores>plants+15){ar='ضغط كبير على النباتات: قد يتجاوز استهلاك العواشب قدرة الموارد النباتية على التجدد.';fr='Forte pression sur les plantes : la consommation des herbivores peut dépasser le renouvellement des ressources végétales.';}
 else if(predators>herbivores+15){ar='ارتفاع ضغط الافتراس: قد تتعرض جماعات العواشب لضغط أكبر في هذا السيناريو.';fr='Pression de prédation élevée : les populations d’herbivores peuvent subir une pression plus forte dans ce scénario.';}
 else if(herbivores<20){ar='قلة العواشب: قد تقل الموارد الغذائية المتاحة لبعض المفترسات.';fr='Peu d’herbivores : les ressources alimentaires de certains prédateurs peuvent diminuer.';}
 else if(plants>75&&herbivores<35){ar='موارد نباتية وفيرة مقارنة بالعواشب: قد تتراكم الكتلة النباتية إذا استمرت الظروف.';fr='Ressources végétales abondantes par rapport aux herbivores : la biomasse végétale peut s’accumuler si ces conditions persistent.';}
 $('eco-population-feedback').textContent=lang==='ar'?ar:fr;
}
['eco-plants-range','eco-herbivores-range','eco-predators-range'].forEach(id=>$(id).addEventListener('input',updateEcoPopulation));
$('eco-population-reset').addEventListener('click',()=>{
 $('eco-plants-range').value=ecoPopulationDefaults.plants;
 $('eco-herbivores-range').value=ecoPopulationDefaults.herbivores;
 $('eco-predators-range').value=ecoPopulationDefaults.predators;
 updateEcoPopulation();
});
function showBalanceResult(key){
 const t=balanceTexts[key];if(t)$('balance-result').textContent=t[lang];
 document.querySelectorAll('[data-balance-species]').forEach(b=>{b.classList.toggle('is-removed',b.dataset.balanceSpecies===key);b.setAttribute('aria-pressed',b.dataset.balanceSpecies===key?'true':'false');});
}
document.querySelectorAll('[data-balance-species]').forEach(btn=>btn.addEventListener('click',()=>{
 removedSpecies=btn.dataset.balanceSpecies;showBalanceResult(removedSpecies);
}));
$('balance-reset').addEventListener('click',()=>{
 removedSpecies=null;
 document.querySelectorAll('[data-balance-species]').forEach(b=>{b.classList.remove('is-removed');b.setAttribute('aria-pressed','false');});
 $('balance-result').textContent=lang==='ar'?'أُعيد النظام إلى حالته الأصلية. اختر كائناً لمحاكاة اختفائه.':'Le système est réinitialisé. Choisissez une espèce pour simuler sa disparition.';
});


const foodWebTexts={
 plants:{ar:'تُعد النباتات منتجات؛ تصنع مادتها العضوية بالتركيب الضوئي. قد تتغذى عليها الحشرات والأرانب، كما توفر البذور غذاءً لبعض الطيور.',fr:'Les plantes sont des producteurs : elles fabriquent leur matière organique par photosynthèse. Les insectes et les lapins peuvent les consommer ; leurs graines nourrissent aussi certains oiseaux.'},
 seeds:{ar:'تتغذى بعض الطيور والأرانب على البذور، وهي مورد غذائي مهم في هذا النموذج.',fr:'Certains oiseaux et lapins consomment les graines, une ressource alimentaire importante dans ce modèle.'},
 insects:{ar:'تتغذى الحشرات على أجزاء من النباتات. وقد تفترسها الضفادع وبعض الطيور.',fr:'Les insectes consomment des parties des plantes. Ils peuvent être mangés par les grenouilles et certains oiseaux.'},
 rabbits:{ar:'تتغذى الأرانب على النباتات والبذور، وقد تفترسها الأفاعي والجوارح.',fr:'Les lapins mangent des plantes et des graines ; ils peuvent être des proies pour les serpents et les rapaces.'},
 frogs:{ar:'تتغذى الضفادع على بعض الحشرات، وقد تكون غذاءً للأفاعي والجوارح.',fr:'Les grenouilles mangent certains insectes et peuvent être consommées par les serpents et les rapaces.'},
 birds:{ar:'تتغذى بعض الطيور على البذور والحشرات، وقد تفترسها الجوارح.',fr:'Certains oiseaux mangent des graines et des insectes ; ils peuvent être des proies pour les rapaces.'},
 snakes:{ar:'قد تتغذى الأفاعي على الأرانب والضفادع، ويمكن أن تفترسها بعض الجوارح.',fr:'Les serpents peuvent manger des lapins et des grenouilles ; certains rapaces peuvent les capturer.'},
 hawks:{ar:'تُعد الجوارح مستهلكات عليا في هذا النموذج، وتتغذى على كائنات مثل الطيور والأفاعي والأرانب.',fr:'Les rapaces sont des consommateurs supérieurs dans ce modèle. Ils peuvent se nourrir d’oiseaux, de serpents et de lapins.'}
};
function showFoodWeb(key){
 const t=foodWebTexts[key];if(t)$('foodweb-detail').textContent=t[lang];
}
document.querySelectorAll('[data-foodweb]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedFoodWeb=btn.dataset.foodweb;
 document.querySelectorAll('[data-foodweb]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showFoodWeb(selectedFoodWeb);
}));


const habitatTexts={
 forest:{ar:'الغابة وسط يضم أشجاراً وشجيرات وفطريات وطيوراً وحشرات وثدييات، وتتأثر مكوناته بتوفر الماء والضوء ونوعية التربة.',fr:'La forêt abrite des arbres, arbustes, champignons, oiseaux, insectes et mammifères. Ses composantes dépendent notamment de l’eau, de la lumière et du sol.'},
 wetland:{ar:'تتميز المناطق الرطبة بتوفر الماء، وتوفر موائل للطيور والبرمائيات والنباتات المائية واللافقاريات. وهي مهمة لتنقية المياه وتخفيف الفيضانات.',fr:'Les zones humides sont caractérisées par la présence d’eau. Elles accueillent des oiseaux, amphibiens, plantes aquatiques et invertébrés ; elles contribuent aussi à filtrer l’eau et à atténuer les crues.'},
 desert:{ar:'تتميز الأوساط الصحراوية بندرة الماء وتغير درجات الحرارة، وتعيش فيها نباتات وحيوانات متكيفة مع الجفاف مثل بعض الزواحف والحشرات والنباتات المقاومة للعطش.',fr:'Les milieux désertiques connaissent une faible disponibilité en eau et de fortes variations de température. Des plantes, reptiles et insectes adaptés à la sécheresse y vivent.'}
};
const pressureTexts={
 pollution:{ar:'قد يغير التلوث جودة الماء أو الهواء أو التربة، ويسبب تراجع بعض الأنواع الحساسة، كما يمكن أن تنتقل بعض الملوثات عبر الشبكات الغذائية.',fr:'La pollution peut altérer la qualité de l’eau, de l’air ou du sol, réduire certaines espèces sensibles et permettre à des contaminants de circuler dans les réseaux alimentaires.'},
 habitat:{ar:'قد يؤدي تجزؤ الموائل أو تدميرها إلى تقليص المساحة المتاحة للكائنات وعزل جماعاتها، فيصعب عليها الحصول على الغذاء والتكاثر والانتشار.',fr:'La fragmentation ou la destruction des habitats réduit l’espace disponible et isole les populations, rendant plus difficiles l’alimentation, la reproduction et la dispersion.'},
 climate:{ar:'يمكن لتغير الحرارة والتساقطات أن يغير توزيع الأنواع ومواعيد نشاطها وتوفر الماء والغذاء، وقد تضطر بعض الأنواع إلى الانتقال أو تتراجع أعدادها.',fr:'Les changements de température et de précipitations peuvent modifier la répartition des espèces, leurs périodes d’activité et les ressources disponibles. Certaines espèces doivent se déplacer ou peuvent décliner.'}
};
function showHabitat(key){const t=habitatTexts[key];if(t)$('habitat-description').textContent=t[lang];}
function showPressure(key){const t=pressureTexts[key];if(t)$('pressure-description').textContent=t[lang];}
document.querySelectorAll('[data-habitat]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedHabitat=btn.dataset.habitat;
 document.querySelectorAll('[data-habitat]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showHabitat(selectedHabitat);
}));
document.querySelectorAll('[data-pressure]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedPressure=btn.dataset.pressure;
 document.querySelectorAll('[data-pressure]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showPressure(selectedPressure);
}));


const pollutionTexts={
 water:{ar:'من مصادر تلوث الماء تصريف المياه العادمة دون معالجة وتسرب بعض المواد الكيميائية. قد تتأثر الكائنات المائية وجودة الماء، وقد يختل التوازن البيئي.',fr:'Les rejets d’eaux usées non traitées et certaines fuites de produits chimiques peuvent polluer l’eau. Les organismes aquatiques et la qualité de l’eau peuvent être affectés, ainsi que l’équilibre écologique.'},
 soil:{ar:'قد ينتج تلوث التربة عن تراكم النفايات أو الاستخدام غير الملائم لبعض المواد الكيميائية. ويمكن أن تتأثر خصوبة التربة والكائنات التي تعيش فيها وانتقال الملوثات إلى النباتات.',fr:'L’accumulation de déchets et l’usage inadapté de certains produits chimiques peuvent polluer le sol. La fertilité, les organismes du sol et le transfert de contaminants vers les plantes peuvent être affectés.'},
 air:{ar:'تساهم بعض الانبعاثات الناتجة عن النقل والصناعة وحرق الوقود والنفايات في تلوث الهواء، وقد تؤثر في صحة الكائنات والنباتات والأنظمة البيئية.',fr:'Certaines émissions liées aux transports, aux activités industrielles et à la combustion de carburants ou de déchets contribuent à la pollution de l’air et peuvent affecter les organismes et les écosystèmes.'}
};
const pollutionActionTexts={
 waste:{ar:'يساعد فرز النفايات ومعالجتها على تقليل تراكمها في الطبيعة، واسترجاع بعض المواد، والحد من تسرب الملوثات إلى الأوساط البيئية.',fr:'Le tri et le traitement des déchets réduisent leur accumulation dans la nature, permettent de récupérer certaines matières et limitent la dispersion de polluants.'},
 water:{ar:'تساهم معالجة المياه العادمة قبل تصريفها في إزالة جزء من الملوثات وتقليل الضغط على الأنهار والبحيرات والموارد المائية.',fr:'Le traitement des eaux usées avant leur rejet élimine une partie des polluants et réduit la pression sur les rivières, les lacs et les ressources en eau.'},
 plants:{ar:'يساعد الحفاظ على الغطاء النباتي في حماية التربة من الانجراف، وتوفير موائل للكائنات، ودعم استقرار الأنظمة البيئية.',fr:'La protection de la couverture végétale aide à limiter l’érosion des sols, fournit des habitats aux organismes et soutient la stabilité des écosystèmes.'}
};
function showPollution(key){const t=pollutionTexts[key];if(t)$('pollution-impact').textContent=t[lang];}
function showPollutionAction(key){const t=pollutionActionTexts[key];if(t)$('pollution-action-feedback').textContent=t[lang];}
document.querySelectorAll('[data-pollution]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedPollution=btn.dataset.pollution;
 document.querySelectorAll('[data-pollution]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showPollution(selectedPollution);
}));
document.querySelectorAll('[data-pollution-action]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedPollutionAction=btn.dataset.pollutionAction;
 document.querySelectorAll('[data-pollution-action]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showPollutionAction(selectedPollutionAction);
}));


function updatePollutionSimulator(){
 const load=$('pollution-load'),response=$('pollution-response');
 if(!load||!response)return;
 const pressure=Number(load.value),effort=Number(response.value);
 const residual=Math.round(pressure*(1-effort/100));
 $('pollution-load-value').textContent=pressure+'%';
 $('pollution-response-value').textContent=effort+'%';
 $('pollution-residual').textContent=residual+'%';
 $('pollution-improvement').textContent=(100-residual)+'%';
 const feedback=$('pollution-sim-feedback');
 if(feedback){
  const messages= residual>=70
   ? {ar:'الضغط المتبقي مرتفع في هذا السيناريو. يمكن أن تساعد الوقاية من المصدر وتقوية المعالجة والمراقبة على تقليله.',fr:'La pression résiduelle est élevée dans ce scénario. La prévention à la source, le renforcement du traitement et le suivi peuvent contribuer à la réduire.'}
   : residual>=35
    ? {ar:'الضغط المتبقي متوسط في هذا السيناريو. الجمع بين تقليل الملوثات ومعالجتها يساعد على تحسين الوضع البيئي.',fr:'La pression résiduelle est modérée dans ce scénario. Réduire les polluants et les traiter ensemble contribue à améliorer la situation environnementale.'}
    : {ar:'الضغط المتبقي منخفض في هذا السيناريو التوضيحي. تظل الوقاية المستمرة والمراقبة ضرورية للحفاظ على البيئة.',fr:'La pression résiduelle est faible dans ce scénario illustratif. La prévention continue et le suivi restent nécessaires pour protéger l’environnement.'};
  feedback.textContent=messages[lang];
 }
}
['pollution-load','pollution-response'].forEach(id=>$(id)?.addEventListener('input',updatePollutionSimulator));
$('pollution-sim-reset')?.addEventListener('click',()=>{
 $('pollution-load').value=60;
 $('pollution-response').value=30;
 updatePollutionSimulator();
});
updatePollutionSimulator();


const waterCycleTexts={
 evaporation:{ar:'تسخّن أشعة الشمس المياه السطحية، فيتحول جزء منها إلى بخار ماء يصعد نحو الغلاف الجوي.',fr:'L’énergie solaire réchauffe les eaux de surface. Une partie se transforme en vapeur d’eau qui monte dans l’atmosphère.'},
 transpiration:{ar:'تطلق النباتات بخار الماء إلى الجو عبر أوراقها، وتسمى هذه العملية بالنتح. ويساهم النتح مع التبخر في انتقال الماء إلى الغلاف الجوي.',fr:'Les plantes libèrent de la vapeur d’eau dans l’air par leurs feuilles : c’est la transpiration. Avec l’évaporation, elle contribue au transfert de l’eau vers l’atmosphère.'},
 condensation:{ar:'عندما يبرد الهواء الرطب، يتكاثف بخار الماء حول جسيمات دقيقة، فتتشكل قطرات صغيرة أو بلورات جليدية تكوّن السحب.',fr:'Lorsque l’air humide se refroidit, la vapeur d’eau se condense autour de fines particules et forme de petites gouttelettes ou des cristaux de glace constituant les nuages.'},
 precipitation:{ar:'عندما تكبر قطرات الماء أو بلورات الجليد داخل السحب وتصبح ثقيلة، تسقط على شكل مطر أو ثلج أو برد حسب الظروف الجوية.',fr:'Lorsque les gouttelettes ou les cristaux de glace deviennent suffisamment lourds dans les nuages, ils tombent sous forme de pluie, de neige ou de grêle selon les conditions météorologiques.'},
 infiltration:{ar:'يتسرب جزء من مياه التساقطات داخل التربة، وقد يصل إلى المياه الجوفية، بينما يجري جزء آخر فوق السطح نحو الأودية والأنهار والبحيرات.',fr:'Une partie des précipitations s’infiltre dans le sol et peut alimenter les eaux souterraines. Une autre partie ruisselle vers les oueds, les rivières et les lacs.'},
 collection:{ar:'تتجمع المياه في المحيطات والبحار والأنهار والبحيرات والمياه الجوفية، ثم تواصل الدورة من جديد بفعل الطاقة الشمسية.',fr:'L’eau s’accumule dans les océans, les mers, les rivières, les lacs et les nappes souterraines. Le cycle se poursuit ensuite grâce à l’énergie solaire.'}
};
function showWaterCycle(key){const t=waterCycleTexts[key];if(t)$('watercycle-detail').textContent=t[lang];}
document.querySelectorAll('[data-watercycle]').forEach(btn=>btn.addEventListener('click',()=>{
 selectedWaterCycle=btn.dataset.watercycle;
 document.querySelectorAll('[data-watercycle]').forEach(b=>b.classList.toggle('is-active',b===btn));
 showWaterCycle(selectedWaterCycle);
}));


const waterCycleAnswers=new Map();
const waterCycleExplanations=[
 {ar:'صحيح! تسخّن الشمس المياه وتوفر الطاقة اللازمة للتبخر.',fr:'Exact ! Le Soleil chauffe l’eau et fournit l’énergie nécessaire à l’évaporation.'},
 {ar:'صحيح! يؤدي التبريد إلى تكاثف بخار الماء وتكوّن قطرات أو بلورات.',fr:'Exact ! Le refroidissement provoque la condensation de la vapeur en gouttelettes ou cristaux.'},
 {ar:'صحيح! يسمح التسرب بانتقال جزء من مياه السطح إلى داخل التربة.',fr:'Exact ! L’infiltration permet à une partie de l’eau de surface de pénétrer dans le sol.'}
];
function updateWaterCycleScore(){
 const score=[...waterCycleAnswers.values()].filter(Boolean).length;
 $('watercycle-score').textContent=lang==='ar'?'النتيجة: '+score+' / 3':'Score : '+score+' / 3';
}
document.querySelectorAll('[data-water-answer]').forEach(btn=>btn.addEventListener('click',()=>{
 const index=Number(btn.dataset.waterAnswer),question=btn.closest('[data-water-question]');
 if(!question||waterCycleAnswers.has(index))return;
 const correct=btn.dataset.correct==='true';
 waterCycleAnswers.set(index,correct);
 question.querySelectorAll('[data-water-answer]').forEach(option=>{
  option.disabled=true;
  if(option===btn)option.classList.add(correct?'is-correct':'is-incorrect');
  if(option.dataset.correct==='true')option.classList.add('is-answer');
 });
 const feedback=question.querySelector('.gs-watercycle-answer');
 feedback.textContent=correct
  ? waterCycleExplanations[index][lang]
  : (lang==='ar'?'ليست هذه الإجابة الصحيحة. راجع الخيار المميز ثم اقرأ التفسير.':'Ce n’est pas la bonne réponse. Consultez l’option indiquée et l’explication.');
 updateWaterCycleScore();
}));
$('watercycle-retry')?.addEventListener('click',()=>{
 waterCycleAnswers.clear();
 document.querySelectorAll('[data-water-question]').forEach(question=>{
  question.querySelectorAll('[data-water-answer]').forEach(option=>{
   option.disabled=false;option.classList.remove('is-correct','is-incorrect','is-answer');
  });
  question.querySelector('.gs-watercycle-answer').textContent='';
 });
 updateWaterCycleScore();
});


const waterMeasureExplanations={
 leaks:{ar:'إصلاح التسربات يقلل فقد الماء قبل وصوله إلى المستهلك، ويُعد من التدابير المباشرة لتحسين كفاءة شبكة التوزيع.',fr:'La réparation des fuites réduit les pertes avant que l’eau n’arrive aux usagers. C’est une mesure directe pour améliorer l’efficacité du réseau.'},
 irrigation:{ar:'يساعد الري الموضعي، عند تصميمه وصيانته بشكل جيد، على إيصال الماء إلى منطقة الجذور وتقليل الضياع بالتبخر والجريان السطحي.',fr:'Lorsqu’elle est bien conçue et entretenue, l’irrigation localisée apporte l’eau près des racines et peut limiter les pertes par évaporation et ruissellement.'},
 reuse:{ar:'يمكن إعادة استعمال المياه العادمة المعالجة في استعمالات مناسبة، بعد التحقق من جودتها واحترام المعايير الصحية والبيئية.',fr:'Les eaux usées traitées peuvent être réutilisées pour des usages adaptés, après vérification de leur qualité et respect des normes sanitaires et environnementales.'},
 wetlands:{ar:'تحافظ حماية المناطق الرطبة على موائل غنية بالتنوع البيولوجي وتدعم وظائف طبيعية مثل تخزين المياه مؤقتاً وترشيحها.',fr:'La protection des zones humides préserve des habitats riches en biodiversité et soutient des fonctions naturelles comme le stockage temporaire et la filtration de l’eau.'},
 groundwater:{ar:'تتطلب حماية المياه الجوفية مراقبة الضخ لتجنب الاستغلال المفرط، ومنع تسرب الملوثات إلى التربة والطبقات المائية.',fr:'La protection des nappes nécessite de surveiller les prélèvements pour éviter la surexploitation et de prévenir l’infiltration de polluants.'},
 awareness:{ar:'تساعد التوعية على تقليل الاستهلاك غير الضروري وتغيير السلوك اليومي، وتكون أكثر فعالية عندما ترافقها بنية تحتية وصيانة وتدبير جيد.',fr:'La sensibilisation peut réduire les usages évitables et faire évoluer les habitudes. Elle est plus efficace lorsqu’elle s’accompagne d’infrastructures, d’entretien et d’une bonne gestion.'}
};
const recommendedWaterMeasures=new Set(['leaks','irrigation','reuse','wetlands','groundwater','awareness']);
function evaluateWaterMeasures(){
 const selected=[...document.querySelectorAll('[data-water-measure]:checked')].map(x=>x.dataset.waterMeasure);
 const box=$('water-management-feedback');
 if(!selected.length){box.textContent=lang==='ar'?'لم تختر أي تدبير بعد. اختر إجراءً واحداً على الأقل ثم أعد التقييم.':'Aucune mesure sélectionnée. Choisissez au moins une action puis relancez l’évaluation.';return;}
 const names={
 leaks:{ar:'إصلاح التسربات',fr:'Réparer les fuites'},
 irrigation:{ar:'الري الموضعي',fr:'Irrigation localisée'},
 reuse:{ar:'إعادة استعمال المياه المعالجة',fr:'Réutilisation des eaux traitées'},
 wetlands:{ar:'حماية المناطق الرطبة',fr:'Protection des zones humides'},
 groundwater:{ar:'حماية المياه الجوفية',fr:'Protection des nappes'},
 awareness:{ar:'التوعية وترشيد الاستهلاك',fr:'Sensibilisation et économies d’eau'}
 };
 const title=lang==='ar'?'التدابير المختارة: ':'Mesures choisies : ';
 const detail=selected.map(k=>names[k][lang]+'. '+waterMeasureExplanations[k][lang]).join(' ');
 const coverage=selected.length>=4?(lang==='ar'?'اختيارات متنوعة تغطي كفاءة التوزيع والطلب وحماية الأنظمة الطبيعية.':'Vos choix couvrent plusieurs dimensions : efficacité de distribution, demande et protection des milieux naturels.'):(lang==='ar'?'يمكن تعزيز خطتك بدمج تدابير تقنية وسلوكية وبيئية.':'Vous pouvez renforcer votre plan en combinant des mesures techniques, comportementales et écologiques.');
 box.textContent=title+selected.map(k=>names[k][lang]).join('، ')+'. '+detail+' '+coverage;
}
$('water-management-evaluate').addEventListener('click',evaluateWaterMeasures);
$('water-management-reset').addEventListener('click',()=>{
 document.querySelectorAll('[data-water-measure]').forEach(x=>x.checked=false);
 $('water-management-feedback').textContent=lang==='ar'?'حدد التدابير التي تراها مناسبة، ثم اضغط على تقييم اختياراتي.':'Sélectionnez les mesures qui vous semblent adaptées, puis cliquez sur Évaluer mes choix.';
});


const tectonicDescriptions={ar:{plates:['الصفائح التكتونية','الغلاف الصخري مقسم إلى صفائح تتحرك ببطء فوق نطاق أكثر ليونة في الوشاح العلوي.'],volcanoes:['البراكين','يرتبط عدد كبير من البراكين بمناطق تقارب الصفائح أو تباعدها، مع وجود براكين داخل الصفائح أيضاً.'],quakes:['الزلازل','تتركز زلازل كثيرة على حدود الصفائح حيث تتراكم الإجهادات وتتحرر على شكل اهتزازات.'],relief:['التضاريس','قد يؤدي تقارب الصفائح إلى تشكل سلاسل جبلية وخنادق محيطية، بينما يرتبط التباعد بتشكل الظهور المحيطية.'],gps:['اتجاه الحركة','تساعد قياسات GPS على تتبع الإزاحة النسبية للصفائح، ويختلف اتجاه الحركة وسرعتها من منطقة إلى أخرى.']},fr:{plates:['Plaques tectoniques','La lithosphère est divisée en plaques qui se déplacent lentement sur une zone plus ductile du manteau supérieur.'],volcanoes:['Volcans','De nombreux volcans sont associés aux zones de convergence ou de divergence, même s’il existe aussi des volcans intraplaques.'],quakes:['Séismes','Beaucoup de séismes se concentrent aux limites des plaques, où les contraintes s’accumulent puis se libèrent.'],relief:['Relief','La convergence peut former des chaînes de montagnes et des fosses océaniques ; la divergence est associée aux dorsales.'],gps:['Sens du mouvement','Les mesures GPS permettent de suivre les déplacements relatifs des plaques. Leur direction et leur vitesse varient selon les régions.']}};

let tectonicScore=0,tectonicAnswered=0;
function resetTectonicChallenge(){
 tectonicScore=0;tectonicAnswered=0;
 document.querySelectorAll('.gs-tectonic-question').forEach(card=>{
  card.querySelectorAll('button').forEach(button=>{button.disabled=false;button.classList.remove('is-correct','is-wrong');});
  card.querySelector('.gs-tectonic-feedback').textContent='';
 });
 $('tectonic-score').textContent='0 / 3';
 $('tectonic-result').textContent=lang==='ar'?'اختر إجابة واحدة في كل سؤال لعرض نتيجتك.':'Choisissez une réponse par question pour obtenir votre résultat.';
}
document.querySelectorAll('.gs-tectonic-question .gs-tectonic-answers button').forEach(button=>{
 button.addEventListener('click',()=>{
  const card=button.closest('.gs-tectonic-question');
  if(card.dataset.answered==='true')return;
  card.dataset.answered='true';tectonicAnswered++;
  const correct=button.dataset.answer==='correct';
  if(correct)tectonicScore++;
  card.querySelectorAll('button').forEach(option=>{
   option.disabled=true;
   if(option.dataset.answer==='correct')option.classList.add('is-correct');
   else if(option===button)option.classList.add('is-wrong');
  });
  card.querySelector('.gs-tectonic-feedback').textContent=correct
   ?(lang==='ar'?'إجابة صحيحة، أحسنت!':'Bonne réponse, bravo !')
   :(lang==='ar'?'ليست الإجابة الصحيحة. راجع الاختيار المميز بالأخضر.':'Ce n’est pas la bonne réponse. Consultez la réponse en vert.');
  $('tectonic-score').textContent=tectonicScore+' / 3';
  if(tectonicAnswered===3)$('tectonic-result').textContent=lang==='ar'
   ?'نتيجتك: '+tectonicScore+' من 3. '+(tectonicScore===3?'ممتاز!':'راجع الشروحات ثم حاول مرة أخرى.')
   :'Votre résultat : '+tectonicScore+' sur 3. '+(tectonicScore===3?'Excellent !':'Relisez les explications puis réessayez.');
 });
});
$('tectonic-reset').addEventListener('click',()=>{
 document.querySelectorAll('.gs-tectonic-question').forEach(card=>delete card.dataset.answered);
 resetTectonicChallenge();
});

document.querySelectorAll('.gs-tectonic-toggle').forEach(function(button){button.addEventListener('click',function(){const key=button.dataset.layer,active=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-on',active);const layer=document.querySelector('[data-map-layer="'+key+'"]');if(layer)layer.classList.toggle('is-hidden',!active);const copy=tectonicDescriptions[lang==='fr'?'fr':'ar'][key],box=$('tectonic-info');box.innerHTML='<strong></strong><p></p>';box.querySelector('strong').textContent=copy[0];box.querySelector('p').textContent=copy[1];});});


let cellQuizScore=0,cellQuizAnswered=0;
function resetCellQuiz(){
 cellQuizScore=0;cellQuizAnswered=0;
 document.querySelectorAll('.gs-cell-question').forEach(card=>{
  delete card.dataset.answered;
  card.querySelectorAll('button').forEach(button=>{button.disabled=false;button.classList.remove('is-correct','is-wrong');});
  card.querySelector('p').textContent='';
 });
 $('cell-quiz-score').textContent='0 / 3';
 $('cell-quiz-result').textContent=lang==='ar'?'اختر إجابة واحدة لكل سؤال لعرض نتيجتك.':'Choisissez une réponse par question pour obtenir votre résultat.';
}
document.querySelectorAll('.gs-cell-question .gs-cell-answers button').forEach(button=>{
 button.addEventListener('click',()=>{
  const card=button.closest('.gs-cell-question');
  if(card.dataset.answered==='true')return;
  card.dataset.answered='true';cellQuizAnswered++;
  const correct=button.dataset.correct==='true';
  if(correct)cellQuizScore++;
  card.querySelectorAll('button').forEach(option=>{
   option.disabled=true;
   if(option.dataset.correct==='true')option.classList.add('is-correct');
   else if(option===button)option.classList.add('is-wrong');
  });
  card.querySelector('p').textContent=correct
   ?(lang==='ar'?'إجابة صحيحة، أحسنت!':'Bonne réponse, bravo !')
   :(lang==='ar'?'ليست الإجابة الصحيحة. راجع الإجابة المميزة بالأخضر.':'Ce n’est pas la bonne réponse. Consultez la réponse en vert.');
  $('cell-quiz-score').textContent=cellQuizScore+' / 3';
  if(cellQuizAnswered===3)$('cell-quiz-result').textContent=lang==='ar'
   ?'نتيجتك: '+cellQuizScore+' من 3. '+(cellQuizScore===3?'ممتاز!':'يمكنك مراجعة مكوّنات الخلية ثم إعادة المحاولة.')
   :'Votre résultat : '+cellQuizScore+' sur 3. '+(cellQuizScore===3?'Excellent !':'Revoyez les constituants de la cellule puis réessayez.');
 });
});
$('cell-quiz-reset').addEventListener('click',resetCellQuiz);


const biodiversityQuizState=new Map();
const biodiversityQuizFeedback=[
 {ar:'صحيح! يشمل التنوع البيولوجي تنوع الأنواع والتنوع الوراثي والأنظمة البيئية.',fr:'Exact ! La biodiversité comprend la diversité des espèces, la diversité génétique et celle des écosystèmes.'},
 {ar:'صحيح! توفر المناطق الرطبة موائل مهمة وتؤدي وظائف بيئية متعددة.',fr:'Exact ! Les zones humides offrent des habitats importants et assurent plusieurs fonctions écologiques.'},
 {ar:'صحيح! حماية المواطن الطبيعية والحد من التلوث يدعمان بقاء الأنواع.',fr:'Exact ! La protection des habitats et la réduction de la pollution favorisent la conservation des espèces.'}
];
function renderBiodiversityQuiz(){
 const score=[...biodiversityQuizState.values()].filter(Boolean).length;
 const scoreNode=$('biodiv-quiz-score');
 if(scoreNode)scoreNode.textContent=lang==='ar'?'النتيجة: '+score+' / 3':'Score : '+score+' / 3';
 document.querySelectorAll('.gs-biodiv-question').forEach((card,index)=>{
  const result=biodiversityQuizState.get(index);
  const feedback=card.querySelector('.gs-biodiv-answer-feedback');
  if(result===undefined){feedback.textContent='';return;}
  feedback.textContent=result
   ?biodiversityQuizFeedback[index][lang]
   :(lang==='ar'?'ليست هذه الإجابة الصحيحة. راجع الخيار المميز بالأخضر.':'Ce n’est pas la bonne réponse. Consultez l’option en vert.');
 });
}
document.querySelectorAll('[data-biodiv-answer]').forEach(button=>button.addEventListener('click',()=>{
 const index=Number(button.dataset.biodivAnswer),card=button.closest('.gs-biodiv-question');
 if(biodiversityQuizState.has(index))return;
 biodiversityQuizState.set(index,button.dataset.correct==='true');
 card.querySelectorAll('[data-biodiv-answer]').forEach(option=>{
  option.disabled=true;
  if(option.dataset.correct==='true')option.classList.add('is-correct');
  else if(option===button)option.classList.add('is-wrong');
 });
 renderBiodiversityQuiz();
}));
$('biodiv-quiz-reset').addEventListener('click',()=>{
 biodiversityQuizState.clear();
 document.querySelectorAll('.gs-biodiv-question [data-biodiv-answer]').forEach(option=>{
  option.disabled=false;option.classList.remove('is-correct','is-wrong');
 });
 renderBiodiversityQuiz();
});

loadCommonsPhotos();
})();
