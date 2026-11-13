(()=>{'use strict';
const dict={
 nucleus:{ar:['النواة','تحتوي على المادة الوراثية (ADN) وتساهم في تنظيم أنشطة الخلية.','توجد النواة في الخلايا حقيقية النواة.'],fr:['Noyau','Contient le matériel génétique (ADN) et participe au contrôle des activités cellulaires.','Le noyau caractérise les cellules eucaryotes.']},
 vacuole:{ar:['الفجوة','حجرة غشائية تخزن الماء ومواد مذابة، وتساهم في الحفاظ على ضغط الامتلاء في الخلية النباتية.','تكون الفجوة المركزية كبيرة غالباً في الخلية النباتية الناضجة.'],fr:['Vacuole','Compartiment membranaire qui stocke notamment l’eau et contribue à la turgescence de la cellule végétale.','La vacuole centrale est généralement volumineuse dans une cellule végétale mature.']},
 chloroplast:{ar:['البلاستيدة الخضراء','تحتوي على اليخضور وتتم داخلها عملية التركيب الضوئي.','توجد البلاستيدات الخضراء في الخلايا النباتية الخضراء وبعض الطحالب.'],fr:['Chloroplaste','Contient la chlorophylle et constitue le siège de la photosynthèse.','Les chloroplastes se trouvent dans les cellules végétales chlorophylliennes et certaines algues.']},
 mitochondria:{ar:['الميتوكندريا','تساهم في إنتاج الطاقة القابلة للاستعمال من طرف الخلية عبر التنفس الخلوي.','توجد الميتوكندريا في الخلايا النباتية والحيوانية.'],fr:['Mitochondrie','Participe à la production d’énergie utilisable par la cellule grâce à la respiration cellulaire.','Les mitochondries existent dans les cellules végétales et animales.']}
};
let lang='ar',cell='plant',selectedRockProcess=null,selectedEcoLevel='producer',removedSpecies=null,selectedFoodWeb=null,selectedHabitat=null,selectedPressure=null,selectedPollution=null,selectedPollutionAction=null,selectedWaterCycle=null;
const $=id=>document.getElementById(id);
function setLang(next){lang=next;document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-ar][data-fr]').forEach(el=>el.textContent=el.dataset[lang]);$('lab-language').textContent=lang==='ar'?'Français':'العربية';const active=document.querySelector('.gs-cell-type.is-active');if(active)active.textContent=active.dataset[lang];if(cell==='animal'){$('organelle-title').textContent=lang==='ar'?'الخلية الحيوانية':'Cellule animale';$('organelle-description').textContent=lang==='ar'?'تتميز بغياب الجدار الخلوي والبلاستيدات الخضراء، وتكون فجواتها صغيرة عادة.':'Elle ne possède ni paroi cellulosique ni chloroplastes ; ses vacuoles sont généralement petites.';$('organelle-tip').textContent=lang==='ar'?'اختر أحد المكونات المشتركة للتعرف على وظيفته.':'Choisissez une structure commune pour découvrir son rôle.';}else showOrganelle('nucleus');if($('lab-light'))updatePhotosynthesis();if($('gen-parent-one'))updateGenetics();if($('geo-explanation'))setGeology(document.querySelector('.gs-geology-choice.is-active')?.dataset.geology||'horizontal');if(selectedRockProcess)showRockProcess(selectedRockProcess);if($('eco-level-detail'))showEcoLevel(selectedEcoLevel);if(removedSpecies)showBalanceResult(removedSpecies);if(selectedFoodWeb)showFoodWeb(selectedFoodWeb);if(selectedHabitat)showHabitat(selectedHabitat);if(selectedPressure)showPressure(selectedPressure);if(selectedPollution)showPollution(selectedPollution);if(selectedPollutionAction)showPollutionAction(selectedPollutionAction);if(selectedWaterCycle)showWaterCycle(selectedWaterCycle);}
function showOrganelle(key){const v=dict[key][lang];$('organelle-title').textContent=v[0];$('organelle-description').textContent=v[1];$('organelle-tip').textContent=v[2];}

async function loadCommonsPhotos(){
 const cards=Array.from(document.querySelectorAll('.lab-real-photo[data-commons-query]'));
 await Promise.all(cards.map(async card=>{
  const frame=card.querySelector('.lab-photo-frame'),credit=card.querySelector('.lab-photo-credit');
  if(!frame)return;
  try{
   const params=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrnamespace:'6',gsrsearch:card.dataset.commonsQuery+' filetype:bitmap',gsrlimit:'1',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'900'});
   const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params.toString(),{headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('Commons request failed');
   const payload=await response.json();
   const page=payload&&payload.query&&payload.query.pages?Object.values(payload.query.pages)[0]:null;
   const info=page&&Array.isArray(page.imageinfo)?page.imageinfo[0]:null;
   if(!info||!info.thumburl||!info.descriptionurl)throw new Error('No Commons image found');
   const imageUrl=new URL(info.thumburl),pageUrl=new URL(info.descriptionurl);
   if(imageUrl.hostname!=='upload.wikimedia.org'||pageUrl.hostname!=='commons.wikimedia.org')throw new Error('Unexpected image host');
   const meta=info.extmetadata||{};
   const plain=value=>String(value&&(value.value||value)||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
   const author=plain(meta.Artist)||plain(meta.Credit)||(lang==='ar'?'المؤلف غير محدد':'Auteur non indiqué');
   const license=plain(meta.LicenseShortName)||(lang==='ar'?'الترخيص غير محدد':'Licence non indiquée');
   const img=document.createElement('img');img.src=imageUrl.href;img.alt=page.title||'Photographie scientifique';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
   frame.replaceChildren(img);card.href=pageUrl.href;card.setAttribute('aria-label',(page.title||'Photographie scientifique')+' — '+license);
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
 const light=Number($('lab-light').value),co2=Number($('lab-co2').value);
 const rate=Math.min(light,co2);
 $('lab-light-value').textContent=light+'%';$('lab-co2-value').textContent=co2+'%';
 $('lab-photo-rate').textContent=rate+'%';$('lab-photo-meter-fill').style.width=rate+'%';
 $('lab-photo-explanation').textContent=lang==='ar'
  ?(rate===0?'أحد العاملين غير متوفر تقريباً؛ يكون النشاط التمثيلي ضعيفاً جداً في هذا النموذج.':light<co2?'الإضاءة هي العامل الأقل توفراً هنا؛ زيادتها قد ترفع النشاط ما دامت العوامل الأخرى ملائمة.':co2<light?'توفر CO₂ هو العامل الأقل هنا؛ زيادته قد ترفع النشاط ما دامت العوامل الأخرى ملائمة.':'الضوء وCO₂ متساويان في هذا النموذج؛ قد تصبح عوامل أخرى محدِّدة للنشاط.')
  :(rate===0?'L’un des facteurs est presque absent : l’activité est très faible dans ce modèle.':light<co2?'La lumière est le facteur le moins disponible ; l’augmenter peut accroître l’activité si les autres conditions sont favorables.':co2<light?'Le CO₂ est le facteur le moins disponible ; l’augmenter peut accroître l’activité si les autres conditions sont favorables.':'La lumière et le CO₂ sont équivalents dans ce modèle ; d’autres facteurs peuvent devenir limitants.');
}
$('lab-light').addEventListener('input',updatePhotosynthesis);
$('lab-co2').addEventListener('input',updatePhotosynthesis);

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
document.querySelectorAll('.gs-quiz-options button').forEach(btn=>btn.addEventListener('click',()=>{const ok=btn.dataset.answer==='correct';document.querySelectorAll('.gs-quiz-options button').forEach(b=>{b.disabled=true;if(b.dataset.answer==='correct')b.classList.add('is-correct');else if(b===btn)b.classList.add('is-wrong');});$('lab-quiz-feedback').textContent=ok?(lang==='ar'?'إجابة صحيحة! أحسنت. النواة تحتوي على المادة الوراثية.':'Bonne réponse ! Le noyau contient le matériel génétique.'):(lang==='ar'?'ليست الإجابة الصحيحة. راجع الاختيار المميز بالأخضر.':'Ce n’est pas la bonne réponse. Consultez la réponse en vert.');}));
const relativeButtons=document.querySelectorAll('[data-relative-answer]');
relativeButtons.forEach(btn=>btn.addEventListener('click',()=>{
 relativeButtons.forEach(b=>{b.disabled=true;b.classList.toggle('is-correct',b.dataset.relativeAnswer==='intrusion');b.classList.toggle('is-wrong',b===btn&&b.dataset.relativeAnswer!=='intrusion');});
 const correct=btn.dataset.relativeAnswer==='intrusion';
 $('relative-feedback').textContent=lang==='ar'
  ?(correct?'إجابة صحيحة! التداخل الناري أحدث من الطبقات لأنه يخترقها ويقطع استمراريتها.':'ليست الإجابة الصحيحة. تذكّر أن البنية التي تقطع طبقات موجودة تكون أحدث منها.')
  :(correct?'Bonne réponse ! L’intrusion est plus récente que les couches puisqu’elle les recoupe.':'Ce n’est pas la bonne réponse. Une structure qui recoupe des couches déjà présentes est plus récente qu’elles.');
}));


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


const balanceTexts={
 plants:{ar:'اختفاء النباتات يقلل مصدر الغذاء والطاقة للكائنات العاشبة، وقد يؤدي إلى تراجع الحشرات والعواشب ثم يؤثر في المفترسات التي تعتمد عليها. كما تتأثر حماية التربة.',fr:'La disparition des plantes réduit la source de nourriture et d’énergie des herbivores. Les insectes et autres herbivores peuvent diminuer, puis les prédateurs qui en dépendent ; la protection des sols est aussi affectée.'},
 insects:{ar:'قد يؤدي تراجع الحشرات العاشبة إلى تقليل غذاء الضفادع وبعض الطيور، بينما قد تزداد النباتات التي كانت تتغذى عليها هذه الحشرات.',fr:'La diminution des insectes herbivores peut réduire la nourriture disponible pour les grenouilles et certains oiseaux, tandis que les plantes consommées par ces insectes peuvent augmenter.'},
 frogs:{ar:'قد يؤدي اختفاء الضفادع إلى زيادة بعض الحشرات التي كانت تفترسها، وقد يتراجع غذاء الأفاعي والطيور التي كانت تتغذى عليها.',fr:'La disparition des grenouilles peut favoriser l’augmentation de certains insectes qu’elles consommaient et réduire la nourriture des serpents et des oiseaux qui s’en nourrissaient.'},
 birds:{ar:'قد تتغير أعداد الحشرات والفرائس التي كانت الطيور تتغذى عليها، كما قد تتأثر المفترسات التي تعتمد على بعض الطيور غذاءً لها.',fr:'Les populations d’insectes et de proies consommés par les oiseaux peuvent changer ; les prédateurs qui mangent certains oiseaux peuvent également être affectés.'},
 snakes:{ar:'قد تزداد بعض الفرائس التي كانت الأفاعي تتغذى عليها، وقد تتغير المنافسة على الموارد بين المفترسات الأخرى.',fr:'Certaines proies consommées par les serpents peuvent augmenter et la compétition pour les ressources entre autres prédateurs peut changer.'}
};
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

loadCommonsPhotos();
})();
