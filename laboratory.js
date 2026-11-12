(()=>{'use strict';
const dict={
 nucleus:{ar:['النواة','تحتوي على المادة الوراثية (ADN) وتساهم في تنظيم أنشطة الخلية.','توجد النواة في الخلايا حقيقية النواة.'],fr:['Noyau','Contient le matériel génétique (ADN) et participe au contrôle des activités cellulaires.','Le noyau caractérise les cellules eucaryotes.']},
 vacuole:{ar:['الفجوة','حجرة غشائية تخزن الماء ومواد مذابة، وتساهم في الحفاظ على ضغط الامتلاء في الخلية النباتية.','تكون الفجوة المركزية كبيرة غالباً في الخلية النباتية الناضجة.'],fr:['Vacuole','Compartiment membranaire qui stocke notamment l’eau et contribue à la turgescence de la cellule végétale.','La vacuole centrale est généralement volumineuse dans une cellule végétale mature.']},
 chloroplast:{ar:['البلاستيدة الخضراء','تحتوي على اليخضور وتتم داخلها عملية التركيب الضوئي.','توجد البلاستيدات الخضراء في الخلايا النباتية الخضراء وبعض الطحالب.'],fr:['Chloroplaste','Contient la chlorophylle et constitue le siège de la photosynthèse.','Les chloroplastes se trouvent dans les cellules végétales chlorophylliennes et certaines algues.']},
 mitochondria:{ar:['الميتوكندريا','تساهم في إنتاج الطاقة القابلة للاستعمال من طرف الخلية عبر التنفس الخلوي.','توجد الميتوكندريا في الخلايا النباتية والحيوانية.'],fr:['Mitochondrie','Participe à la production d’énergie utilisable par la cellule grâce à la respiration cellulaire.','Les mitochondries existent dans les cellules végétales et animales.']}
};
let lang='ar',cell='plant';
const $=id=>document.getElementById(id);
function setLang(next){lang=next;document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-ar][data-fr]').forEach(el=>el.textContent=el.dataset[lang]);$('lab-language').textContent=lang==='ar'?'Français':'العربية';const active=document.querySelector('.gs-cell-type.is-active');if(active)active.textContent=active.dataset[lang];showOrganelle('nucleus');if($('lab-light'))updatePhotosynthesis();if($('gen-parent-one'))updateGenetics();if($('geo-explanation'))setGeology(document.querySelector('.gs-geology-choice.is-active')?.dataset.geology||'horizontal');}
function showOrganelle(key){const v=dict[key][lang];$('organelle-title').textContent=v[0];$('organelle-description').textContent=v[1];$('organelle-tip').textContent=v[2];}



const geologyTexts={
 horizontal:{ar:'في الطبقات الأفقية غير المشوهة، تكون الطبقات السفلى أقدم من الطبقات العليا وفق مبدأ التراكب، إذا لم يحدث انقلاب أو اضطراب جيولوجي.',fr:'Dans une série horizontale non déformée, les couches inférieures sont plus anciennes que les couches supérieures selon le principe de superposition, en l’absence de renversement ou de perturbation.'},
 fold:{ar:'الطية انثناء في الطبقات الصخرية ناتج عن التشوه، غالباً بفعل قوى الضغط. يوضح الرسم انحناء الطبقات حول محور الطية.',fr:'Un pli est une courbure des couches rocheuses due à la déformation, souvent sous l’effet de contraintes compressives. Le schéma montre les couches qui se courbent autour d’un axe.'},
 fault:{ar:'الفالق كسر تصاحبه إزاحة نسبية للكتل الصخرية. يوضح الرسم انقطاع الطبقات واختلاف موضعها على جانبي مستوى الفالق.',fr:'Une faille est une fracture accompagnée d’un déplacement relatif des blocs rocheux. Le schéma montre la rupture et le décalage des couches de part et d’autre du plan de faille.'}
};
function setGeology(type){
 document.querySelectorAll('[data-geo-scene]').forEach(g=>{g.hidden=g.dataset.geoScene!==type;});
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
document.querySelectorAll('.gs-cell-type').forEach(btn=>btn.addEventListener('click',()=>{cell=btn.dataset.cell;document.querySelectorAll('.gs-cell-type').forEach(b=>{b.classList.toggle('is-active',b===btn);b.textContent=b.dataset[lang];});const drawing=$('gs-cell-drawing');drawing.classList.toggle('animal-cell',cell==='animal');const wall=drawing.querySelector('.cell-wall');wall.style.display=cell==='animal'?'none':'';drawing.querySelector('.cell-chloro').style.display=cell==='animal'?'none':'';drawing.querySelector('.cell-vacuole').style.opacity=cell==='animal'?'.25':'.8';drawing.querySelectorAll('.gs-organelle-hit').forEach(hit=>{hit.hidden=cell==='animal'&&['chloroplast','vacuole'].includes(hit.dataset.organelle);});if(cell==='animal'){ $('organelle-title').textContent=lang==='ar'?'الخلية الحيوانية':'Cellule animale';$('organelle-description').textContent=lang==='ar'?'تتميز بغياب الجدار الخلوي والبلاستيدات الخضراء، وتكون فجواتها صغيرة عادة.':'Elle ne possède ni paroi cellulosique ni chloroplastes ; ses vacuoles sont généralement petites.';$('organelle-tip').textContent=lang==='ar'?'قارن بين الخلية النباتية والحيوانية من حيث البنيات المشتركة والمختلفة.':'Comparez les structures communes et spécifiques des deux types cellulaires.';}else showOrganelle('nucleus');}));
document.querySelectorAll('.gs-geology-choice').forEach(btn=>btn.addEventListener('click',()=>setGeology(btn.dataset.geology)));
setGeology('horizontal');
['gen-parent-one','gen-parent-two'].forEach(id=>$(id).addEventListener('change',updateGenetics));
updateGenetics();
document.querySelectorAll('.gs-quiz-options button').forEach(btn=>btn.addEventListener('click',()=>{const ok=btn.dataset.answer==='correct';document.querySelectorAll('.gs-quiz-options button').forEach(b=>{b.disabled=true;if(b.dataset.answer==='correct')b.classList.add('is-correct');else if(b===btn)b.classList.add('is-wrong');});$('lab-quiz-feedback').textContent=ok?(lang==='ar'?'إجابة صحيحة! أحسنت. النواة تحتوي على المادة الوراثية.':'Bonne réponse ! Le noyau contient le matériel génétique.'):(lang==='ar'?'ليست الإجابة الصحيحة. راجع الاختيار المميز بالأخضر.':'Ce n’est pas la bonne réponse. Consultez la réponse en vert.');}));
})();
