(()=>{'use strict';
const dict={
 nucleus:{ar:['النواة','تحتوي على المادة الوراثية (ADN) وتساهم في تنظيم أنشطة الخلية.','توجد النواة في الخلايا حقيقية النواة.'],fr:['Noyau','Contient le matériel génétique (ADN) et participe au contrôle des activités cellulaires.','Le noyau caractérise les cellules eucaryotes.']},
 vacuole:{ar:['الفجوة','حجرة غشائية تخزن الماء ومواد مذابة، وتساهم في الحفاظ على ضغط الامتلاء في الخلية النباتية.','تكون الفجوة المركزية كبيرة غالباً في الخلية النباتية الناضجة.'],fr:['Vacuole','Compartiment membranaire qui stocke notamment l’eau et contribue à la turgescence de la cellule végétale.','La vacuole centrale est généralement volumineuse dans une cellule végétale mature.']},
 chloroplast:{ar:['البلاستيدة الخضراء','تحتوي على اليخضور وتتم داخلها عملية التركيب الضوئي.','توجد البلاستيدات الخضراء في الخلايا النباتية الخضراء وبعض الطحالب.'],fr:['Chloroplaste','Contient la chlorophylle et constitue le siège de la photosynthèse.','Les chloroplastes se trouvent dans les cellules végétales chlorophylliennes et certaines algues.']},
 mitochondria:{ar:['الميتوكندريا','تساهم في إنتاج الطاقة القابلة للاستعمال من طرف الخلية عبر التنفس الخلوي.','توجد الميتوكندريا في الخلايا النباتية والحيوانية.'],fr:['Mitochondrie','Participe à la production d’énergie utilisable par la cellule grâce à la respiration cellulaire.','Les mitochondries existent dans les cellules végétales et animales.']}
};
let lang='ar',cell='plant',selectedRockProcess=null,selectedRockMaterial='magma',selectedRockStep='cooling',selectedEcoLevel='producer',removedSpecies=null,selectedFoodWeb=null,selectedHabitat=null,selectedPressure=null,selectedPollution=null,selectedPollutionAction=null,selectedWaterCycle=null;
const $=id=>document.getElementById(id);
function setLang(next){lang=next;document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-ar][data-fr]').forEach(el=>el.textContent=el.dataset[lang]);$('lab-language').textContent=lang==='ar'?'Français':'العربية';const active=document.querySelector('.gs-cell-type.is-active');if(active)active.textContent=active.dataset[lang];if(cell==='animal'){$('organelle-title').textContent=lang==='ar'?'الخلية الحيوانية':'Cellule animale';$('organelle-description').textContent=lang==='ar'?'تتميز بغياب الجدار الخلوي والبلاستيدات الخضراء، وتكون فجواتها صغيرة عادة.':'Elle ne possède ni paroi cellulosique ni chloroplastes ; ses vacuoles sont généralement petites.';$('organelle-tip').textContent=lang==='ar'?'اختر أحد المكونات المشتركة للتعرف على وظيفته.':'Choisissez une structure commune pour découvrir son rôle.';}else showOrganelle('nucleus');if($('lab-light'))updatePhotosynthesis();if($('gen-parent-one'))updateGenetics();if($('geo-explanation'))setGeology(document.querySelector('.gs-geology-choice.is-active')?.dataset.geology||'horizontal');if(selectedRockProcess)showRockProcess(selectedRockProcess);renderRockPath();if($('eco-level-detail'))showEcoLevel(selectedEcoLevel);if($('energy-input'))updateEnergyTransfer();if($('eco-population-feedback'))updateEcoPopulation();if(removedSpecies)showBalanceResult(removedSpecies);if(selectedFoodWeb)showFoodWeb(selectedFoodWeb);if(selectedHabitat)showHabitat(selectedHabitat);if(selectedPressure)showPressure(selectedPressure);if(selectedPollution)showPollution(selectedPollution);if(selectedPollutionAction)showPollutionAction(selectedPollutionAction);if($('pollution-load'))updatePollutionSimulator();if($('water-quality-ph'))updateWaterQualityLab();if($('water-treatment-lab'))renderWaterTreatmentLab();if($('biodiv-sampling'))updateBiodiversitySampling();if($('biodiv-abundance'))updateBiodiversityAbundance();if($('mitosis-lab'))renderMitosis();if($('meiosis-compare-lab'))renderMeiosisCompare();if($('dna-pairing'))renderDnaPairing();if($('food-chain-builder')){foodChainStep=Math.min(foodChainStep,4);renderFoodChain();}if($('water-quality-quiz-result'))updateWaterQualityQuiz();renderWaterManagementQuiz();renderBiodiversityQuiz();renderRelativeDatingQuiz();if(selectedWaterCycle)showWaterCycle(selectedWaterCycle);updateWaterCycleScore();}
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
 const light=Number($('lab-light').value),co2=Number($('lab-co2').value),water=Number($('lab-water').value),temperature=Number($('lab-temperature').value);
 const temperatureScore=Math.max(0,100-Math.abs(temperature-25)*4);
 const factors=[{key:'light',value:light},{key:'co2',value:co2},{key:'water',value:water},{key:'temperature',value:temperatureScore}];
 const rate=Math.min(...factors.map(f=>f.value));
 const limiting=factors.filter(f=>f.value===rate).map(f=>f.key);
 $('lab-light-value').textContent=light+'%';$('lab-co2-value').textContent=co2+'%';$('lab-water-value').textContent=water+'%';
 $('lab-temperature-value').textContent=temperature+'°C';
 const level=rate>=70?(lang==='ar'?'مرتفع':'Élevé'):rate>=35?(lang==='ar'?'متوسط':'Moyen'):(lang==='ar'?'منخفض':'Faible');
 $('lab-photo-glucose').textContent=level;$('lab-photo-oxygen').textContent=level;
 $('lab-photo-rate').textContent=rate+'%';$('lab-photo-meter-fill').style.width=rate+'%';
 const factorNames=lang==='ar'?{light:'الإضاءة',co2:'توفر CO₂',water:'توفر الماء',temperature:'درجة الحرارة'}:{light:'la lumière',co2:'la disponibilité du CO₂',water:'la disponibilité de l’eau',temperature:'la température'};
 const limitingText=limiting.map(key=>factorNames[key]).join(lang==='ar'?' و':' et ');
 $('lab-photo-explanation').textContent=lang==='ar'
  ?(rate===0?'أحد العوامل غير ملائم تقريباً؛ لذلك يكون النشاط التمثيلي ضعيفاً جداً في هذا النموذج.':'العامل المحدِّد حالياً هو '+limitingText+'؛ تحسينه قد يرفع النشاط ما دامت العوامل الأخرى ملائمة.')
  :(rate===0?'L’un des facteurs est presque défavorable : l’activité est très faible dans ce modèle.':'Le facteur limitant actuel est '+limitingText+' ; l’améliorer peut augmenter l’activité si les autres conditions sont favorables.');
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


const rockPathOutcomes={
 'magma|cooling':{title:{ar:'صخور نارية',fr:'Roches magmatiques'},description:{ar:'تبريد الصهارة وتبلورها يؤدي إلى تشكل الصخور النارية. وقد ينتج عن التبريد البطيء بلورات أكبر.',fr:'Le refroidissement et la cristallisation du magma forment des roches magmatiques. Un refroidissement lent peut produire de plus gros cristaux.'}},
 'igneous|weathering':{title:{ar:'رواسب',fr:'Sédiments'},description:{ar:'تؤدي التجوية إلى تفكك الصخر الناري، ثم تنقل التعرية الحبيبات لتصبح رواسب.',fr:'L’altération désagrège la roche magmatique, puis l’érosion transporte les particules qui deviennent des sédiments.'}},
 'sedimentary|weathering':{title:{ar:'رواسب',fr:'Sédiments'},description:{ar:'يمكن أن تتعرض الصخور الرسوبية للتجوية والتعرية، فتنتج رواسب جديدة.',fr:'Les roches sédimentaires peuvent être altérées et érodées, produisant de nouveaux sédiments.'}},
 'metamorphic|weathering':{title:{ar:'رواسب',fr:'Sédiments'},description:{ar:'يمكن أن تتفكك الصخور المتحولة بفعل التجوية، ثم تنقل عوامل التعرية فتاتها.',fr:'Les roches métamorphiques peuvent être désagrégées par l’altération, puis leurs débris sont transportés par l’érosion.'}},
 'sediments|lithification':{title:{ar:'صخور رسوبية',fr:'Roches sédimentaires'},description:{ar:'يتحول تراكم الرواسب إلى صخر رسوبي عبر الانضغاط والتلاحم، خلال أزمنة جيولوجية.',fr:'L’accumulation des sédiments devient une roche sédimentaire par compaction et cimentation au cours des temps géologiques.'}},
 'igneous|metamorphism':{title:{ar:'صخور متحولة',fr:'Roches métamorphiques'},description:{ar:'يمكن أن يتحول الصخر الناري بفعل الضغط والحرارة والسوائل دون انصهار كلي.',fr:'Une roche magmatique peut être transformée par la pression, la température et les fluides sans fusion complète.'}},
 'sedimentary|metamorphism':{title:{ar:'صخور متحولة',fr:'Roches métamorphiques'},description:{ar:'يمكن أن تتحول الصخور الرسوبية بفعل الضغط والحرارة دون انصهار كلي.',fr:'Les roches sédimentaires peuvent devenir métamorphiques sous l’effet de la pression et de la température, sans fusion complète.'}},
 'metamorphic|metamorphism':{title:{ar:'صخور متحولة أكثر',fr:'Roche métamorphique transformée'},description:{ar:'قد يستمر تحول الصخر المتحول أو تتغير معادنه ونسيجه مع تغير ظروف الضغط والحرارة.',fr:'Une roche métamorphique peut subir une transformation supplémentaire de ses minéraux et de sa texture lorsque les conditions changent.'}},
 'igneous|melting':{title:{ar:'صهارة',fr:'Magma'},description:{ar:'عند توفر ظروف الانصهار المناسبة، يمكن أن تنصهر الصخور النارية جزئياً أو كلياً وتنتج صهارة.',fr:'Dans des conditions favorables, les roches magmatiques peuvent fondre partiellement ou totalement et produire du magma.'}},
 'sedimentary|melting':{title:{ar:'صهارة',fr:'Magma'},description:{ar:'قد تنصهر الصخور الرسوبية عند درجات حرارة وظروف مناسبة في الأعماق.',fr:'Les roches sédimentaires peuvent fondre en profondeur lorsque les conditions de température et de pression le permettent.'}},
 'metamorphic|melting':{title:{ar:'صهارة',fr:'Magma'},description:{ar:'قد يؤدي ارتفاع الحرارة بما يكفي إلى انصهار الصخور المتحولة وتكوين الصهارة.',fr:'Une température suffisamment élevée peut provoquer la fusion des roches métamorphiques et former du magma.'}}
};
function renderRockPath(){
 document.querySelectorAll('[data-rock-start]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rockStart===selectedRockMaterial)));
 document.querySelectorAll('[data-rock-step]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rockStep===selectedRockStep)));
 const outcome=rockPathOutcomes[selectedRockMaterial+'|'+selectedRockStep];
 $('rock-path-title').textContent=outcome?outcome.title[lang]:(lang==='ar'?'لا ينتج تحول مباشر بهذه العملية':'Aucune transformation directe avec ce processus');
 $('rock-path-description').textContent=outcome?outcome.description[lang]:(lang==='ar'?'اختر عملية مناسبة للمادة المحددة. تحتاج الرواسب إلى الانضغاط والتلاحم لتكوين صخر رسوبي، بينما يؤدي تبريد الصهارة إلى صخر ناري.':'Choisissez un processus adapté au matériau. Les sédiments nécessitent compaction et cimentation pour former une roche sédimentaire, tandis que le refroidissement du magma forme une roche magmatique.');
}
document.querySelectorAll('[data-rock-start]').forEach(b=>b.addEventListener('click',()=>{selectedRockMaterial=b.dataset.rockStart;renderRockPath();}));
document.querySelectorAll('[data-rock-step]').forEach(b=>b.addEventListener('click',()=>{selectedRockStep=b.dataset.rockStep;renderRockPath();}));

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
const cascadeTexts={
 plants:{ar:['تراجع المنتجين: يقل مصدر المادة العضوية والطاقة.','انخفاض محتمل في العواشب: تتراجع الموارد النباتية المتاحة.','تأثر المستهلكات العليا: يقل الغذاء المتاح لبعض المفترسات.'],fr:['Recul des producteurs : la source de matière organique et d’énergie diminue.','Baisse possible des herbivores : les ressources végétales deviennent moins disponibles.','Effet sur les consommateurs supérieurs : certaines proies deviennent moins abondantes.']},
 insects:{ar:['تراجع بعض المستهلكات الأولية: يقل استهلاك النباتات.','تغير الغطاء النباتي: قد تزداد النباتات التي كانت الحشرات تستهلكها.','تأثر آكلات الحشرات: يقل مورد غذائي للضفادع وبعض الطيور.'],fr:['Recul de certains consommateurs primaires : la consommation des plantes diminue.','Évolution de la végétation : les plantes consommées peuvent devenir plus abondantes.','Effet sur les insectivores : les grenouilles et certains oiseaux perdent une ressource.']},
 frogs:{ar:['تراجع مستهلك ثانوي: تختفي حلقة من افتراس الحشرات.','زيادة محتملة لبعض الحشرات: ينخفض ضغط افتراسها.','تأثر المفترسات: يقل مورد غذائي للأفاعي وبعض الطيور.'],fr:['Recul d’un consommateur secondaire : un lien de prédation sur les insectes disparaît.','Hausse possible de certains insectes : la pression de prédation diminue.','Effet sur les prédateurs : les serpents et certains oiseaux perdent une ressource.']},
 birds:{ar:['تغير جماعات الطيور: تختفي علاقات افتراس واستهلاك متعددة.','تغير الفرائس: قد تتبدل أعداد الحشرات والكائنات التي كانت الطيور تستهلكها.','تأثر الجوارح: قد يقل مورد غذائي لبعض المفترسات.'],fr:['Changement des populations d’oiseaux : plusieurs relations alimentaires disparaissent.','Évolution des proies : les populations d’insectes et d’autres organismes consommés peuvent changer.','Effet sur les rapaces : certaines ressources alimentaires peuvent diminuer.']},
 snakes:{ar:['تراجع مستهلك أعلى: تختفي علاقة افتراس لبعض الفرائس.','زيادة محتملة لبعض الفرائس: ينخفض ضغط الافتراس عليها.','تغير المنافسة: قد تتغير الموارد المتاحة لمفترسات أخرى.'],fr:['Recul d’un consommateur supérieur : une relation de prédation disparaît.','Hausse possible de certaines proies : la pression de prédation diminue.','Évolution de la compétition : les ressources disponibles pour d’autres prédateurs peuvent changer.']}
};
function showBalanceResult(key){
 const t=balanceTexts[key];if(t)$('balance-result').textContent=t[lang];
 const steps=$('balance-cascade-steps');
 steps.replaceChildren();
 const sequence=cascadeTexts[key];
 if(sequence)sequence[lang].forEach((label,index)=>{const item=document.createElement('li');item.textContent=label;item.value=index+1;steps.appendChild(item);});
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

let foodChainStep=0;
const foodChainOrder=['insects','frogs','snakes','hawks'];
const foodChainNames={
 plants:{ar:'🌿 نباتات',fr:'🌿 Plantes'},
 insects:{ar:'🦗 حشرات',fr:'🦗 Insectes'},
 frogs:{ar:'🐸 ضفادع',fr:'🐸 Grenouilles'},
 snakes:{ar:'🐍 أفاعٍ',fr:'🐍 Serpents'},
 hawks:{ar:'🦅 جوارح',fr:'🦅 Rapaces'}
};
const foodChainPrompts=[
 {ar:'ما الكائن الذي يمكن أن يتغذى على النباتات؟',fr:'Quel organisme peut se nourrir des plantes ?'},
 {ar:'ما الكائن الذي يمكن أن يتغذى على الحشرات؟',fr:'Quel organisme peut manger les insectes ?',},
 {ar:'ما الكائن الذي يمكن أن يتغذى على الضفادع؟',fr:'Quel organisme peut manger les grenouilles ?'},
 {ar:'ما الكائن الذي يمكن أن يتغذى على الأفاعي؟',fr:'Quel organisme peut manger les serpents ?'}
];
function renderFoodChain(){
 const path=['plants',...foodChainOrder.slice(0,foodChainStep)].map(key=>foodChainNames[key][lang]).join('  →  ');
 $('food-chain-path').textContent=path;
 $('food-chain-progress').textContent=lang==='ar'?'المرحلة '+Math.min(foodChainStep+1,4)+' من 4':'Étape '+Math.min(foodChainStep+1,4)+' sur 4';
 $('food-chain-progress-bar').style.width=(foodChainStep/4*100)+'%';
 const prompt=$('food-chain-prompt'),feedback=$('food-chain-feedback');
 if(foodChainStep<4){
  prompt.textContent=foodChainPrompts[foodChainStep][lang];
  if(foodChainStep===0||foodChainStep===1||foodChainStep===2||foodChainStep===3){
   // The prompt and answer choices are refreshed together when the language changes.
  }
 }else{
  prompt.textContent=lang==='ar'?'أحسنت! اكتملت السلسلة الغذائية.':'Bravo ! La chaîne alimentaire est complète.';
 }
 document.querySelectorAll('[data-chain-choice]').forEach(button=>{
  const chosen=foodChainOrder.slice(0,foodChainStep).includes(button.dataset.chainChoice);
  button.disabled=chosen;
  button.classList.toggle('is-selected',chosen);
 });
 if(foodChainStep===4){
  feedback.textContent=lang==='ar'?'انتقلت المادة والطاقة من المنتج إلى المستهلكات عبر أربعة مستويات متتالية.':'La matière et l’énergie sont passées du producteur aux consommateurs à travers quatre maillons successifs.';
 }
}
document.querySelectorAll('[data-chain-choice]').forEach(button=>button.addEventListener('click',()=>{
 if(foodChainStep>=4)return;
 const choice=button.dataset.chainChoice;
 if(choice===foodChainOrder[foodChainStep]){
  foodChainStep++;
  $('food-chain-feedback').textContent=lang==='ar'?'إجابة صحيحة! أحسنت، تابع إلى الحلقة التالية.':'Bonne réponse ! Continuez avec le maillon suivant.';
  renderFoodChain();
 }else{
  $('food-chain-feedback').textContent=lang==='ar'?'ليس هذا الاختيار المناسب في هذا المثال. تذكّر أن السهم ينتقل من الغذاء إلى الكائن الذي يستهلكه.':'Ce n’est pas le bon choix dans cet exemple. Rappelez-vous que la flèche va de l’aliment vers l’organisme qui le consomme.';
 }
}));
$('food-chain-reset').addEventListener('click',()=>{
 foodChainStep=0;
 $('food-chain-feedback').textContent=lang==='ar'?'اختر الحلقة التالية لإكمال السلسلة.':'Choisissez le maillon suivant pour continuer.';
 renderFoodChain();
});
renderFoodChain();

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


function updateWaterQualityQuiz(){
 const result=$('water-quality-quiz-result');if(!result)return;
 if(result.dataset.score!==undefined){const score=Number(result.dataset.score);result.textContent=lang==='ar'?'نتيجتك: '+score+'/3. '+(score===3?'ممتاز! فهمت المؤشرات الأساسية.':'راجع تفسيرات المؤشرات وحاول مرة أخرى.'):'Votre score : '+score+'/3. '+(score===3?'Excellent ! Les indicateurs essentiels sont compris.':'Relisez les explications et réessayez.');}
 else result.textContent=lang==='ar'?'أجب عن الأسئلة الثلاثة ثم اضغط على التصحيح.':'Répondez aux trois questions puis lancez la correction.';
}
$('water-quality-quiz-check')?.addEventListener('click',()=>{
 const answers=['a','b','a'];let score=0,answered=0;
 answers.forEach((answer,index)=>{const choice=document.querySelector('input[name="wq-q'+(index+1)+'"]:checked');if(choice){answered++;if(choice.value===answer)score++;}});
 const result=$('water-quality-quiz-result');if(!result)return;
 if(answered<3){result.dataset.graded='';result.textContent=lang==='ar'?'أجب عن الأسئلة الثلاثة أولاً لإظهار النتيجة.':'Répondez d’abord aux trois questions pour afficher le résultat.';return;}
 result.dataset.graded='true';result.dataset.score=String(score);result.textContent=lang==='ar'?'نتيجتك: '+score+'/3. '+(score===3?'ممتاز! فهمت المؤشرات الأساسية.':'راجع تفسيرات المؤشرات وحاول مرة أخرى.'):'Votre score : '+score+'/3. '+(score===3?'Excellent ! Les indicateurs essentiels sont compris.':'Relisez les explications et réessayez.');
});
['wq-q1','wq-q2','wq-q3'].forEach(name=>document.querySelectorAll('input[name="'+name+'"]').forEach(input=>input.addEventListener('change',()=>{const result=$('water-quality-quiz-result');if(result){delete result.dataset.graded;delete result.dataset.score;updateWaterQualityQuiz();}})));


const waterTreatmentOrder=['settling','filtration','disinfection','storage'];
let waterTreatmentStep=0,waterTreatmentMessage='';
const waterTreatmentText={
 ar:{
  start:'ابدأ باختيار المرحلة الأولى.',
  wrong:'ليست هذه المرحلة التالية. فكّر في إزالة الجسيمات الكبيرة والعالقة قبل الانتقال إلى المراحل اللاحقة.',
  done:'أحسنت! رتّبت المسار التعليمي بصورة صحيحة. تختلف المعالجة الفعلية حسب خصائص الماء والتقنيات المعتمدة.',
  labels:{settling:'الترسيب',filtration:'الترشيح',disinfection:'التطهير',storage:'التخزين والتوزيع'}
 },
 fr:{
  start:'Commencez par choisir la première étape.',
  wrong:'Ce n’est pas l’étape suivante. Pensez à séparer les particules avant de passer aux étapes suivantes.',
  done:'Bravo ! Vous avez correctement ordonné ce parcours pédagogique. Le traitement réel dépend des caractéristiques de l’eau et des technologies utilisées.',
  labels:{settling:'Décantation',filtration:'Filtration',disinfection:'Désinfection',storage:'Stockage et distribution'}
 }
};
function renderWaterTreatmentLab(){
 const feedback=$('water-treatment-feedback'),progress=$('water-treatment-progress');
 if(!feedback||!progress)return;
 const copy=waterTreatmentText[lang];
 feedback.textContent=waterTreatmentMessage||copy.start;
 progress.textContent=waterTreatmentStep+' / 4';
 document.querySelectorAll('[data-treatment-step]').forEach(button=>{
  const index=waterTreatmentOrder.indexOf(button.dataset.treatmentStep);
  button.disabled=waterTreatmentStep===4||index<waterTreatmentStep;
  button.classList.toggle('is-complete',index<waterTreatmentStep);
  button.classList.toggle('is-next',index===waterTreatmentStep&&waterTreatmentStep<4);
  button.setAttribute('aria-pressed',String(index<waterTreatmentStep));
 });
 const sequence=$('water-treatment-sequence');
 if(sequence)sequence.querySelectorAll('span').forEach((node,index)=>{
  node.classList.toggle('is-complete',index<waterTreatmentStep);
  node.classList.toggle('is-current',index===waterTreatmentStep&&waterTreatmentStep<4);
 });
}
document.querySelectorAll('[data-treatment-step]').forEach(button=>button.addEventListener('click',()=>{
 if(waterTreatmentStep>=4)return;
 if(button.dataset.treatmentStep===waterTreatmentOrder[waterTreatmentStep]){
  waterTreatmentStep++;
  waterTreatmentMessage=waterTreatmentStep===4?waterTreatmentText[lang].done:lang==='ar'?'صحيح! انتقل إلى المرحلة التالية.':'Correct ! Passez à l’étape suivante.';
 }else waterTreatmentMessage=waterTreatmentText[lang].wrong;
 renderWaterTreatmentLab();
}));
$('water-treatment-reset')?.addEventListener('click',()=>{
 waterTreatmentStep=0;waterTreatmentMessage='';renderWaterTreatmentLab();
});
renderWaterTreatmentLab();

function updateWaterQualityLab(){
 const ph=$('water-quality-ph'),turbidity=$('water-quality-turbidity'),oxygen=$('water-quality-oxygen');
 if(!ph||!turbidity||!oxygen)return;
 const p=Number(ph.value),t=Number(turbidity.value),o=Number(oxygen.value);
 $('water-quality-ph-value').textContent=p.toFixed(1);
 $('water-quality-turbidity-value').textContent=String(t);
 $('water-quality-oxygen-value').textContent=o.toFixed(1);
 const concerns=[];
 if(p<6.5||p>8.5)concerns.push(lang==='ar'?'درجة الحموضة':'pH');
 if(t>=25)concerns.push(lang==='ar'?'العكارة':'turbidité');
 if(o<5)concerns.push(lang==='ar'?'الأكسجين المذاب':'oxygène dissous');
 const status=concerns.length===0
  ? {ar:'توازن تقريبي في هذا النموذج',fr:'Équilibre indicatif dans ce modèle'}
  : concerns.length===1
   ? {ar:'مؤشر واحد يستحق الانتباه',fr:'Un indicateur mérite une attention'}
   : {ar:'عدة مؤشرات تستحق الانتباه',fr:'Plusieurs indicateurs méritent une attention'};
 $('water-quality-status').textContent=status[lang];
 $('water-quality-focus').textContent=concerns.length?concerns.join('، '):'—';
 const messages=[];
 if(p<6.5)messages.push({ar:'الماء أكثر حمضية في هذا السيناريو؛ وقد يؤثر تغير pH في الكائنات المائية.',fr:'L’eau est plus acide dans ce scénario ; une variation du pH peut affecter les organismes aquatiques.'});
 else if(p>8.5)messages.push({ar:'الماء أكثر قاعدية في هذا السيناريو؛ وقد تؤثر القيم المرتفعة أو المنخفضة كثيراً في الأنواع الحساسة.',fr:'L’eau est plus basique dans ce scénario ; des valeurs très éloignées peuvent affecter les espèces sensibles.'});
 else messages.push({ar:'قيمة pH ضمن المجال التقريبي المعتمد في هذا النشاط، لكنها وحدها لا تكفي لتقييم جودة الماء.',fr:'Le pH se situe dans la plage indicative de cette activité, mais il ne suffit pas à évaluer la qualité de l’eau.'});
 if(t>=25)messages.push({ar:'العكارة مرتفعة في النموذج؛ قد تقلل الجسيمات العالقة من نفاذ الضوء إلى الماء.',fr:'La turbidité est élevée dans le modèle ; les particules en suspension peuvent réduire la pénétration de la lumière.'});
 else messages.push({ar:'العكارة ليست مرتفعة وفق عتبة هذا النشاط الافتراضي.',fr:'La turbidité n’est pas élevée selon le seuil fictif de cette activité.'});
 if(o<5)messages.push({ar:'الأكسجين المذاب منخفض في النموذج، ما قد يصعّب التنفس على بعض الكائنات المائية.',fr:'L’oxygène dissous est faible dans le modèle, ce qui peut gêner la respiration de certains organismes aquatiques.'});
 else messages.push({ar:'الأكسجين المذاب ليس منخفضاً وفق عتبة هذا النشاط؛ وتتغير الحاجات حسب الأنواع ودرجة الحرارة.',fr:'L’oxygène dissous n’est pas faible selon le seuil de cette activité ; les besoins varient selon les espèces et la température.'});
 $('water-quality-feedback').textContent=messages.map(m=>m[lang]).join(' ');
}
['water-quality-ph','water-quality-turbidity','water-quality-oxygen'].forEach(id=>$(id)?.addEventListener('input',updateWaterQualityLab));
$('water-quality-reset')?.addEventListener('click',()=>{
 $('water-quality-ph').value=6.5;$('water-quality-turbidity').value=12;$('water-quality-oxygen').value=7;updateWaterQualityLab();
});
updateWaterQualityLab();


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


function updateWaterAllocation(){
 const home=Number($('water-home-range').value),agri=Number($('water-agri-range').value),eco=Number($('water-eco-range').value);
 $('water-home-value').textContent=home;
 $('water-agri-value').textContent=agri;
 $('water-eco-value').textContent=eco;
 const total=home+agri+eco;
 $('water-allocation-total').textContent=total+' / 100';
 $('water-allocation-total').classList.toggle('is-over',total>100);
 let ar,fr;
 if(total<100){ar='لم توزّع كل الموارد المتاحة بعد. أعد ضبط المؤشرات حتى يصبح المجموع 100 وحدة.';fr='Toute la ressource disponible n’est pas encore répartie. Ajustez les curseurs pour atteindre 100 unités.';}
 else if(total>100){ar='تجاوزت الحصة المتاحة. خفّض بعض القيم حتى لا يتجاوز المجموع 100 وحدة.';fr='La ressource disponible est dépassée. Réduisez certaines valeurs pour ne pas dépasser 100 unités.';}
 else if(eco<10){ar='حصة الأنظمة البيئية منخفضة في هذا السيناريو؛ قد يضعف ذلك تلبية حاجات الأوساط الطبيعية.';fr='La part des écosystèmes est faible dans ce scénario ; leurs besoins risquent d’être insuffisamment couverts.';}
 else if(home<15){ar='الحصة المنزلية محدودة؛ ينبغي مراعاة حاجات السكان الأساسية ومياه الشرب والصرف الصحي.';fr='La part domestique est limitée ; les besoins essentiels des habitants, l’eau potable et l’assainissement doivent être pris en compte.';}
 else if(agri<25){ar='الحصة الزراعية منخفضة؛ يمكن التفكير في تحسين كفاءة الري وتقليل الضياع بدلاً من زيادة السحب فقط.';fr='La part agricole est faible ; améliorer l’efficacité de l’irrigation et réduire les pertes peut être préférable à une simple hausse des prélèvements.';}
 else {ar='توزيع افتراضي يراعي القطاعات الثلاثة. قارن بين الحاجات المحلية وكفاءة الاستعمال وحماية الأنظمة البيئية.';fr='Cette répartition fictive prend en compte les trois secteurs. Comparez les besoins locaux, l’efficacité des usages et la protection des écosystèmes.';}
 $('water-allocation-feedback').textContent=lang==='ar'?ar:fr;
}
['water-home-range','water-agri-range','water-eco-range'].forEach(id=>$(id).addEventListener('input',updateWaterAllocation));
$('water-allocation-reset').addEventListener('click',()=>{
 $('water-home-range').value=30;$('water-agri-range').value=50;$('water-eco-range').value=20;updateWaterAllocation();
});
updateWaterAllocation();



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



const mitosisOrder=['prophase','metaphase','anaphase','telophase'];
const mitosisDetails={
 prophase:{ar:'تتكثف الصبغيات وتصبح أوضح، ويتشكل مغزل الانقسام تدريجياً.',fr:'Les chromosomes se condensent et deviennent visibles ; le fuseau mitotique se met progressivement en place.'},
 metaphase:{ar:'تصطف الصبغيات على المستوى الاستوائي للخلية.',fr:'Les chromosomes s’alignent sur le plan équatorial de la cellule.'},
 anaphase:{ar:'تنفصل الكروماتيدات الشقيقة وتتجه نحو قطبي الخلية.',fr:'Les chromatides sœurs se séparent et migrent vers les deux pôles de la cellule.'},
 telophase:{ar:'تتكون نواتان جديدتان وتبدأ الصبغيات في التفكك.',fr:'Deux nouveaux noyaux se reforment et les chromosomes commencent à se décondenser.'}
};
const mitosisNames={
 prophase:{ar:'الطور التمهيدي',fr:'Prophase'},
 metaphase:{ar:'الطور الاستوائي',fr:'Métaphase'},
 anaphase:{ar:'الطور الانفصالي',fr:'Anaphase'},
 telophase:{ar:'الطور النهائي',fr:'Télophase'}
};
let mitosisStep=0;
function renderMitosis(){
 const sequence=$('mitosis-sequence'),feedback=$('mitosis-feedback');
 if(!sequence||!feedback)return;
 sequence.innerHTML='';
 if(mitosisStep===0){
  const li=document.createElement('li');li.textContent=lang==='ar'?'ابدأ باختيار الطور التمهيدي.':'Commencez par choisir la prophase.';sequence.appendChild(li);
 }else{
  mitosisOrder.slice(0,mitosisStep).forEach((stage,index)=>{
   const li=document.createElement('li');
   li.textContent=(index+1)+'. '+mitosisNames[stage][lang]+': '+mitosisDetails[stage][lang];
   sequence.appendChild(li);
  });
 }
 document.querySelectorAll('[data-mitosis-stage]').forEach(button=>{
  const stage=button.dataset.mitosisStage,done=mitosisOrder.indexOf(stage)<mitosisStep;
  button.disabled=done||mitosisStep===4;
  button.classList.toggle('is-selected',done);
 });
 $('mitosis-progress-label').textContent=lang==='ar'?'المراحل المرتبة: '+mitosisStep+' / 4':'Étapes ordonnées : '+mitosisStep+' / 4';
 $('mitosis-progress-bar').style.width=(mitosisStep/4*100)+'%';
 if(mitosisStep===4)feedback.textContent=lang==='ar'?'أحسنت! رتبت مراحل الانقسام الخيطي الأربع ترتيباً صحيحاً.':'Bravo ! Vous avez ordonné correctement les quatre phases de la mitose.';
 else if(mitosisStep===0)feedback.textContent=lang==='ar'?'اختر المرحلة التي تأتي مباشرة بعد الطور البيني.':'Choisissez la phase qui suit directement l’interphase.';
 else feedback.textContent=lang==='ar'?'صحيح! المرحلة التالية هي '+mitosisNames[mitosisOrder[mitosisStep]][lang]+'.':'Correct ! La phase suivante est '+mitosisNames[mitosisOrder[mitosisStep]][lang]+'.';
}
document.querySelectorAll('[data-mitosis-stage]').forEach(button=>button.addEventListener('click',()=>{
 const stage=button.dataset.mitosisStage;
 if(stage!==mitosisOrder[mitosisStep]){
  $('mitosis-feedback').textContent=lang==='ar'?'ليس هذا الترتيب الصحيح بعد. تذكّر أن الصبغيات تصطف قبل انفصال الكروماتيدات.':'Ce n’est pas encore le bon ordre. Rappelez-vous que les chromosomes s’alignent avant la séparation des chromatides.';
  button.classList.add('is-mistake');setTimeout(()=>button.classList.remove('is-mistake'),500);return;
 }
 mitosisStep++;renderMitosis();
}));
$('mitosis-reset')?.addEventListener('click',()=>{mitosisStep=0;renderMitosis();});
renderMitosis();



const meiosisItems=[
 {type:'mitosis',ar:'ينتج غالباً خليتين بنتين لهما العدد نفسه من الصبغيات كالخلية الأم.',fr:'Produit généralement deux cellules filles ayant le même nombre de chromosomes que la cellule mère.',whyAr:'هذا من نتائج الانقسام الخيطي الذي يحافظ على عدد الصبغيات.',whyFr:'C’est un résultat de la mitose, qui conserve le nombre de chromosomes.'},
 {type:'meiosis',ar:'يتضمن انقسامين متتاليين بعد تضاعف المادة الوراثية مرة واحدة.',fr:'Comporte deux divisions successives après une seule réplication de l’ADN.',whyAr:'يمر الانقسام المنصف الأول ثم الثاني دون تضاعف جديد للـADN بينهما.',whyFr:'La méiose comprend une première puis une deuxième division, sans nouvelle réplication de l’ADN entre les deux.'},
 {type:'mitosis',ar:'يساهم في نمو الكائن الحي وتجديد بعض خلاياه.',fr:'Contribue à la croissance de l’organisme et au renouvellement de certaines cellules.',whyAr:'تسمح الانقسامات الخيطية بزيادة عدد الخلايا وتجديدها.',whyFr:'Les mitoses permettent d’augmenter le nombre de cellules et d’en renouveler certaines.'},
 {type:'meiosis',ar:'يخفض عدد الصبغيات إلى النصف، وينتج خلايا أحادية الصيغة الصبغية.',fr:'Réduit de moitié le nombre de chromosomes et produit des cellules haploïdes.',whyAr:'يساهم ذلك في الحفاظ على عدد الصبغيات بعد الإخصاب في دورات التكاثر الجنسي.',whyFr:'Cela contribue au maintien du nombre de chromosomes après la fécondation dans les cycles sexués.'},
 {type:'meiosis',ar:'يحدث اقتران الصبغيات المتماثلة والعبور خلال الطور التمهيدي الأول.',fr:'L’appariement des chromosomes homologues et le crossing-over ont lieu en prophase I.',whyAr:'هذه أحداث مميزة للانقسام المنصف الأول وتساهم في التنوع الوراثي.',whyFr:'Ces événements caractéristiques de la méiose I contribuent à la diversité génétique.'},
 {type:'mitosis',ar:'تنفصل الكروماتيدات الشقيقة خلال مرحلة واحدة من الانقسام.',fr:'Les chromatides sœurs se séparent au cours d’une seule division.',whyAr:'في الانقسام الخيطي تنفصل الكروماتيدات الشقيقة خلال الانقسام نفسه.',whyFr:'En mitose, les chromatides sœurs se séparent au cours de cette division unique.'}
];
let meiosisStep=0;
function renderMeiosisCompare(){
 const list=$('meiosis-question-list'),feedback=$('meiosis-feedback'),progress=$('meiosis-progress'),bar=$('meiosis-progress-bar');
 if(!list||!feedback||!progress||!bar)return;
 list.innerHTML='';
 meiosisItems.forEach((item,index)=>{
  const card=document.createElement('article');card.className='gs-meiosis-question';
  const prompt=document.createElement('p');prompt.textContent=(index+1)+'. '+item[lang];card.appendChild(prompt);
  const actions=document.createElement('div');actions.className='gs-meiosis-options';
  [['mitosis',lang==='ar'?'الانقسام الخيطي':'Mitose'],['meiosis',lang==='ar'?'الانقسام المنصف':'Méiose']].forEach(([value,label])=>{
   const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.meiosisIndex=String(index);button.dataset.meiosisType=value;
   button.disabled=index<meiosisStep; if(index<meiosisStep&&value===item.type)button.classList.add('is-correct');
   actions.appendChild(button);
  });
  card.appendChild(actions);
  if(index<meiosisStep){const explanation=document.createElement('small');explanation.textContent=item[lang==='ar'?'whyAr':'whyFr'];card.appendChild(explanation);}
  list.appendChild(card);
 });
 progress.textContent=lang==='ar'?'الخصائص الصحيحة: '+meiosisStep+' / '+meiosisItems.length:'Caractéristiques correctes : '+meiosisStep+' / '+meiosisItems.length;
 bar.style.width=(meiosisStep/meiosisItems.length*100)+'%';
 if(meiosisStep===meiosisItems.length)feedback.textContent=lang==='ar'?'أحسنت! أكملت المقارنة بنجاح. تذكّر الفرق بين انقسام واحد وانقسامين متتاليين.':'Bravo ! Vous avez terminé la comparaison. Retenez la différence entre une division et deux divisions successives.';
 else feedback.textContent=lang==='ar'?'صنّف الخاصية رقم '+(meiosisStep+1)+' من أصل '+meiosisItems.length+'.':'Classez la caractéristique '+(meiosisStep+1)+' sur '+meiosisItems.length+'.';
}
$('meiosis-question-list')?.addEventListener('click',event=>{
 const button=event.target.closest('[data-meiosis-index]');if(!button)return;
 const index=Number(button.dataset.meiosisIndex);if(index!==meiosisStep)return;
 const item=meiosisItems[index];
 if(button.dataset.meiosisType!==item.type){
  $('meiosis-feedback').textContent=lang==='ar'?'حاول مجدداً. فكّر في عدد الانقسامات والنتيجة على عدد الصبغيات.':'Réessayez. Pensez au nombre de divisions et à leur effet sur le nombre de chromosomes.';
  button.classList.add('is-wrong');return;
 }
 meiosisStep++;renderMeiosisCompare();
});
$('meiosis-reset')?.addEventListener('click',()=>{meiosisStep=0;renderMeiosisCompare();});
renderMeiosisCompare();

const dnaComplement={A:'T',T:'A',C:'G',G:'C'};
let dnaChecked=false,dnaScore=null;
function renderDnaPairing(){
 const selects=[...document.querySelectorAll('[data-dna-position]')];
 selects.forEach(select=>{select.disabled=dnaChecked;});
 const feedback=$('dna-feedback');
 if(!feedback)return;
 if(dnaChecked&&dnaScore!==null)feedback.textContent=lang==='ar'?'نتيجتك: '+dnaScore+' / 4. '+(dnaScore===4?'ممتاز! السلسلة المكملة هي TGCA.':'راجع قاعدة A مع T وقاعدة C مع G، ثم أعد المحاولة.'):'Votre résultat : '+dnaScore+' / 4. '+(dnaScore===4?'Excellent ! Le brin complémentaire est TGCA.':'Revoyez les associations A-T et C-G, puis réessayez.');
 else feedback.textContent=lang==='ar'?'أكمل القواعد الأربع ثم اضغط على زر التحقق.':'Complétez les quatre bases puis cliquez sur Vérifier.';
}
document.querySelectorAll('[data-dna-position]').forEach(select=>select.addEventListener('change',()=>{dnaChecked=false;dnaScore=null;document.querySelectorAll('[data-dna-position]').forEach(item=>item.disabled=false);renderDnaPairing();}));
$('dna-check')?.addEventListener('click',()=>{
 const selects=[...document.querySelectorAll('[data-dna-position]')];
 if(selects.some(select=>!select.value)){
  $('dna-feedback').textContent=lang==='ar'?'أكمل الخانات الأربع قبل التحقق.':'Complétez les quatre cases avant la vérification.';return;
 }
 const given=['A','C','G','T'];
 const score=selects.filter((select,index)=>select.value===dnaComplement[given[index]]).length;
 dnaScore=score;dnaChecked=true;selects.forEach(select=>select.disabled=true);
 $('dna-feedback').textContent=lang==='ar'
  ?'نتيجتك: '+score+' / 4. '+(score===4?'ممتاز! السلسلة المكملة هي TGCA.':'راجع قاعدة A مع T وقاعدة C مع G، ثم أعد المحاولة.')
  :'Votre résultat : '+score+' / 4. '+(score===4?'Excellent ! Le brin complémentaire est TGCA.':'Revoyez les associations A-T et C-G, puis réessayez.');
});
$('dna-reset')?.addEventListener('click',()=>{
 dnaChecked=false;dnaScore=null;document.querySelectorAll('[data-dna-position]').forEach(select=>{select.value='';select.disabled=false;});renderDnaPairing();
});
renderDnaPairing();


function updateBiodiversityAbundance(){
 const inputs=[...document.querySelectorAll('[data-abundance]')];
 const counts=inputs.map(input=>{
  const value=Math.max(0,Math.min(100,Math.floor(Number(input.value)||0)));
  input.value=String(value);return value;
 });
 const total=counts.reduce((sum,value)=>sum+value,0);
 const present=counts.filter(value=>value>0).length;
 const index=total?1-counts.reduce((sum,value)=>sum+(value/total)**2,0):0;
 $('biodiv-abundance-total').textContent=new Intl.NumberFormat(lang==='ar'?'ar-MA':'fr-FR').format(total);
 $('biodiv-abundance-richness').textContent=present+' / '+counts.length;
 $('biodiv-simpson-index').textContent=index.toFixed(3);
 const names=lang==='ar'?['نباتات','حشرات','طيور','فطريات']:['Plantes','Insectes','Oiseaux','Champignons'];
 document.querySelectorAll('#biodiv-abundance-bars>div').forEach((row,i)=>{
  row.querySelector('span').textContent=names[i];
  row.querySelector('b').style.width=(total?counts[i]/total*100:0)+'%';
  row.querySelector('strong').textContent=String(counts[i]);
 });
 $('biodiv-abundance-feedback').textContent=lang==='ar'
  ?total===0?'أدخل عدداً موجباً لنوع واحد على الأقل لحساب المؤشر.':present===1?'توجد فئة واحدة فقط في العينة؛ لذلك يساوي مؤشر التنوع صفراً.':index>=0.7?'توزيع الأفراد متوازن نسبياً بين الأنواع الموجودة في هذه العينة.':'توجد فروق في أعداد الأفراد بين الأنواع؛ لاحظ كيف يتغير المؤشر عند تعديل القيم.'
  :total===0?'Saisissez un effectif positif pour au moins une espèce afin de calculer l’indice.':present===1?'Une seule catégorie est présente ; l’indice de diversité est donc nul.':index>=0.7?'Les effectifs sont relativement équilibrés entre les espèces présentes dans cet échantillon.':'Les effectifs diffèrent entre les espèces ; observez comment l’indice évolue lorsque vous modifiez les valeurs.';
}
document.querySelectorAll('[data-abundance]').forEach(input=>input.addEventListener('input',updateBiodiversityAbundance));
$('biodiv-abundance-reset')?.addEventListener('click',()=>{
 const defaults=[8,4,2,2];
 document.querySelectorAll('[data-abundance]').forEach((input,index)=>input.value=String(defaults[index]));
 updateBiodiversityAbundance();
});
updateBiodiversityAbundance();

function updateBiodiversitySampling(){
 const boxes=[...document.querySelectorAll('[data-sample-species]')];
 const count=boxes.filter(box=>box.checked).length;
 const output=$('biodiv-sampling-count'),feedback=$('biodiv-sampling-feedback');
 if(output)output.textContent=count+' / '+boxes.length;
 if(feedback)feedback.textContent=lang==='ar'
  ?count===0?'حدّد الكائنات التي رصدتها لاحتساب عدد الأنواع المختلفة.':'رصدت '+count+' أنواع مختلفة في هذه العينة الافتراضية.'
  :count===0?'Cochez les organismes observés pour compter les espèces différentes.':count+' espèces différentes observées dans cet échantillon fictif.';
}
document.querySelectorAll('[data-sample-species]').forEach(box=>box.addEventListener('change',updateBiodiversitySampling));
$('biodiv-sampling-reset')?.addEventListener('click',()=>{
 document.querySelectorAll('[data-sample-species]').forEach(box=>box.checked=false);
 updateBiodiversitySampling();
});
updateBiodiversitySampling();

function updateEnergyTransfer(){
 const base=Number($('energy-input').value),rate=Number($('energy-efficiency').value)/100;
 const values=[base,base*rate,base*rate*rate,base*rate*rate*rate];
 const ids=['producers','primary','secondary','tertiary'];
 values.forEach((value,index)=>{
  $(`energy-${ids[index]}`).textContent=new Intl.NumberFormat(lang==='ar'?'ar-MA':'fr-FR',{maximumFractionDigits:1}).format(value);
  $(`energy-${ids[index]}-bar`).style.width=(value/base*100)+'%';
 });
 $('energy-input-value').textContent=new Intl.NumberFormat(lang==='ar'?'ar-MA':'fr-FR').format(base);
 $('energy-efficiency-value').textContent=Math.round(rate*100)+'%';
 $('energy-transfer-feedback').textContent=lang==='ar'
  ?'عند انتقال '+Math.round(rate*100)+'% في كل مستوى، تصل إلى المستهلكات العليا نحو '+new Intl.NumberFormat('ar-MA',{maximumFractionDigits:1}).format(values[3])+' وحدة من أصل '+new Intl.NumberFormat('ar-MA').format(base)+'؛ والباقي لا ينتقل إلى المستوى التالي.'
  :'Avec un transfert de '+Math.round(rate*100)+' % à chaque niveau, les consommateurs supérieurs reçoivent environ '+new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(values[3])+' unités sur '+new Intl.NumberFormat('fr-FR').format(base)+' ; le reste n’est pas transféré au niveau suivant.';
}
['energy-input','energy-efficiency'].forEach(id=>$(id).addEventListener('input',updateEnergyTransfer));
$('energy-transfer-reset').addEventListener('click',()=>{
 $('energy-input').value='10000';$('energy-efficiency').value='10';updateEnergyTransfer();
});
updateEnergyTransfer();

loadCommonsPhotos();
})();
