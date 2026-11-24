(function(){
'use strict';
const DATA={
heart:{ar:['القلب','يضخ الدم إلى مختلف أنحاء الجسم، ويساهم في ضمان وصول الأكسجين والمواد الغذائية إلى الخلايا.','ضخ الدم والمحافظة على الدورة الدموية.'],fr:['Le cœur','Il propulse le sang dans l’organisme et permet l’apport d’oxygène et de nutriments aux cellules.','Propulser le sang et maintenir la circulation.']},
lungs:{ar:['الرئتان','تستقبلان الهواء وتسمحان بالتبادلات الغازية على مستوى الحويصلات الرئوية: دخول الأكسجين وخروج ثاني أكسيد الكربون.','إنجاز التبادلات الغازية بين الهواء والدم.'],fr:['Les poumons','Ils assurent les échanges gazeux au niveau des alvéoles : entrée de dioxygène et élimination du dioxyde de carbone.','Assurer les échanges gazeux entre l’air et le sang.']},
brain:{ar:['الدماغ','يشرف على معالجة المعلومات وتنسيق كثير من أنشطة الجسم، ويتواصل مع الأعضاء عبر الجهاز العصبي.','معالجة المعلومات وتنسيق الاستجابات.'],fr:['Le cerveau','Il traite les informations et coordonne de nombreuses activités du corps grâce au système nerveux.','Traiter les informations et coordonner les réponses.']},
liver:{ar:['الكبد','يساهم في تنظيم المغذيات، وإنتاج الصفراء، وتحويل بعض المواد وتخزين مواد احتياطية.','الاستقلاب وتنظيم المغذيات وإنتاج الصفراء.'],fr:['Le foie','Il participe au métabolisme des nutriments, produit la bile et stocke certaines réserves.','Métabolisme, régulation des nutriments et production de bile.']},
stomach:{ar:['المعدة','تستقبل الطعام وتخلطه بالعصارة المعدية، وتساهم في الهضم الكيميائي والميكانيكي.','خلط الطعام والمساهمة في هضمه.'],fr:['L’estomac','Il reçoit les aliments, les brasse avec le suc gastrique et participe à leur digestion.','Brasser les aliments et participer à leur digestion.']},
kidneys:{ar:['الكليتان','ترشحان الدم وتساهمان في تكوين البول وتنظيم توازن الماء والأملاح في الجسم.','ترشيح الدم وتنظيم توازن الماء والأملاح.'],fr:['Les reins','Ils filtrent le sang, participent à la formation de l’urine et régulent l’équilibre hydrominéral.','Filtrer le sang et réguler l’équilibre hydrominéral.']},
intestines:{ar:['الأمعاء','تستكمل الأمعاء الدقيقة معظم عملية الهضم وامتصاص المغذيات، وتساهم الأمعاء الغليظة في امتصاص الماء وتكوين البراز.','امتصاص المغذيات والماء واستكمال الهضم.'],fr:['Les intestins','L’intestin grêle assure l’essentiel de la digestion finale et de l’absorption des nutriments ; le gros intestin absorbe notamment de l’eau.','Absorber les nutriments et l’eau et achever la digestion.']},
'spinal-cord':{ar:['النخاع الشوكي','جزء من الجهاز العصبي المركزي، ينقل الرسائل العصبية بين الدماغ وأجزاء الجسم ويساهم في بعض المنعكسات.','نقل السيالات العصبية والمساهمة في المنعكسات.'],fr:['La moelle épinière','Partie du système nerveux central, elle transmet des messages entre l’encéphale et le corps et participe à certains réflexes.','Transmettre les messages nerveux et participer aux réflexes.']},
trachea:{ar:['القصبة الهوائية','أنبوب يدعم مرور الهواء من الحنجرة نحو الشعب الهوائية، وتساعد بنيته على إبقائه مفتوحاً.','نقل الهواء نحو الشعب الهوائية.'],fr:['La trachée','Conduit l’air du larynx vers les bronches ; sa structure contribue à maintenir le passage ouvert.','Acheminer l’air vers les bronches.']},
bladder:{ar:['المثانة البولية','عضو عضلي مرن يخزن البول مؤقتاً قبل طرحه خارج الجسم.','تخزين البول مؤقتاً.'],fr:['La vessie','Organe musculaire extensible qui stocke temporairement l’urine avant son évacuation.','Stocker temporairement l’urine.']}
};
const isFr=()=>document.documentElement.lang==='fr';
let activeCleanup=null;
let threeLoadPromise=null;
function ensureThree(){
if(window.THREE)return Promise.resolve(window.THREE);
if(threeLoadPromise)return threeLoadPromise;
threeLoadPromise=new Promise((resolve,reject)=>{
const script=document.createElement('script');
script.src='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
script.crossOrigin='anonymous';
script.async=true;
script.onload=()=>window.THREE?resolve(window.THREE):reject(new Error('Three.js loaded without exposing THREE'));
script.onerror=()=>reject(new Error('Three.js network request failed'));
document.head.appendChild(script);
}).catch(error=>{threeLoadPromise=null;throw error;});
return threeLoadPromise;
}
function mount(root){
if(!root)return;
if(activeCleanup){activeCleanup();activeCleanup=null;}
if(root.dataset.gs3dReady==='1')return;
const canvas=root.querySelector('.gs-3d-canvas'),loading=root.querySelector('.gs-3d-loading');
if(!window.THREE){
if(root.dataset.gs3dLoading==='1')return;
root.dataset.gs3dLoading='1';
loading.textContent=isFr()?'Chargement du moteur 3D à la demande…':'جارٍ تحميل محرك العرض ثلاثي الأبعاد عند الطلب…';
ensureThree().then(()=>{
delete root.dataset.gs3dLoading;
if(root.isConnected)mount(root);
}).catch(error=>{
delete root.dataset.gs3dLoading;
loading.textContent=isFr()?'Le moteur 3D n’a pas pu être chargé. Vérifiez la connexion puis réessayez.':'تعذر تحميل محرك العرض ثلاثي الأبعاد. تحقق من الاتصال ثم أعد المحاولة.';
console.warn('3D engine could not be loaded:',error);
});
return;
}
const THREE=window.THREE,scene=new THREE.Scene();scene.background=new THREE.Color(0x142b25);
const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(0,1.1,8.5);
let renderer;
try {
renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
} catch(error) {
loading.textContent=isFr()?'WebGL est indisponible sur cet appareil.':'ميزة WebGL غير متاحة على هذا الجهاز.';
console.warn('3D lab could not create a WebGL renderer:',error);
return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
root.dataset.gs3dReady='1';
scene.add(new THREE.HemisphereLight(0xe9fff0,0x24352e,2.0));
const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(4,6,7);scene.add(key);
const fill=new THREE.DirectionalLight(0x75c6aa,1.2);fill.position.set(-5,2,-4);scene.add(fill);
const model=new THREE.Group();scene.add(model);
const material=(color,roughness=.58)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.02});
const skin=material(0xc98f70);skin.transparent=true;skin.opacity=.16;skin.depthWrite=false;const organRed=material(0xb83f4b),lungMat=material(0xc76d78),brainMat=material(0xe4a2a0),liverMat=material(0x7f3e35),stomachMat=material(0xe0a05e),kidneyMat=material(0x93484c),bone=material(0xe4d7b8);
const systems={circulatory:new THREE.Group(),respiratory:new THREE.Group(),nervous:new THREE.Group(),digestive:new THREE.Group(),urinary:new THREE.Group()};
Object.values(systems).forEach(group=>model.add(group));
function blob(name,pos,scale,mat,seg=32,parent=model){const m=new THREE.Mesh(new THREE.SphereGeometry(1,seg,seg),mat);m.name=name;m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
function tube(name,points,radius,mat,parent){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,48,radius,10,false),mat);mesh.name=name;parent.add(mesh);return mesh;}
/* Translucent body outline keeps the internal anatomy visible. */
blob('body',[0,-.05,0],[1.05,1.95,.48],skin,40);
blob('head',[0,2.18,0],[.52,.62,.48],skin);
blob('neck',[0,1.48,0],[.24,.38,.25],skin);
blob('shoulderL',[-1.12,1.05,0],[.28,.95,.3],skin);blob('shoulderR',[1.12,1.05,0],[.28,.95,.3],skin);
blob('legL',[-.42,-2.05,0],[.34,1.25,.37],skin);blob('legR',[.42,-2.05,0],[.34,1.25,.37],skin);
const organs={};
organs.brain=blob('brain',[0,2.27,.43],[.39,.34,.2],brainMat,32,systems.nervous);
blob('spinal-cord',[0,.15,.17],[.09,1.42,.09],bone,24,systems.nervous);
tube('nerves',[[-.03,1.25,.18],[-.55,.95,.16],[-.9,.5,.12]],.035,bone,systems.nervous);
tube('nerves',[[.03,1.25,.18],[.55,.95,.16],[.9,.5,.12]],.035,bone,systems.nervous);
organs.lungs=blob('lungs',[-.43,.65,.46],[.38,.68,.22],lungMat,32,systems.respiratory);
blob('lungs',[.43,.65,.46],[.38,.68,.22],lungMat,32,systems.respiratory);
tube('trachea',[[0,1.35,.47],[0,.98,.49],[0,.77,.49]],.085,bone,systems.respiratory);
tube('bronchi',[[0,.78,.49],[-.28,.55,.5],[-.42,.35,.49]],.055,bone,systems.respiratory);
tube('bronchi',[[0,.78,.49],[.28,.55,.5],[.42,.35,.49]],.055,bone,systems.respiratory);
organs.heart=blob('heart',[0,.43,.69],[.25,.36,.22],organRed,32,systems.circulatory);
const vessel=material(0xb93443),vein=material(0x3979bd);
tube('arteries',[[0,.45,.7],[0,1.15,.55],[0,1.45,.2]],.045,vessel,systems.circulatory);
tube('arteries',[[0,.8,.56],[-.5,.9,.3],[-.85,1.4,.12]],.035,vessel,systems.circulatory);
tube('veins',[[.08,.2,.68],[.12,-.45,.35],[0,-1.05,.15]],.04,vein,systems.circulatory);
organs.liver=blob('liver',[-.38,-.18,.47],[.53,.25,.18],liverMat,32,systems.digestive);
organs.stomach=blob('stomach',[.38,-.27,.48],[.29,.43,.18],stomachMat,32,systems.digestive);
tube('esophagus',[[0,1.25,.48],[.08,.75,.5],[.22,.1,.52],[.35,-.05,.5]],.07,bone,systems.digestive);
const intestineMat=material(0xd7a36f);
tube('intestines',[[-.28,-.55,.47],[.25,-.58,.5],[.28,-.88,.49],[-.2,-.9,.5],[-.27,-.68,.49],[.18,-.7,.5],[.22,-.98,.49]],.085,intestineMat,systems.digestive);
organs.kidneys=blob('kidneys',[-.53,-.72,.42],[.19,.3,.16],kidneyMat,32,systems.urinary);
blob('kidneys',[.53,-.72,.42],[.19,.3,.16],kidneyMat,32,systems.urinary);
tube('ureters',[[-.53,-.85,.42],[-.3,-1.15,.45],[0,-1.35,.45]],.035,bone,systems.urinary);
tube('ureters',[[.53,-.85,.42],[.3,-1.15,.45],[0,-1.35,.45]],.035,bone,systems.urinary);
blob('bladder',[0,-1.45,.47],[.22,.2,.17],stomachMat,24,systems.urinary);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.7,64),new THREE.MeshBasicMaterial({color:0x234438,transparent:true,opacity:.48}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.35;scene.add(floor);
let selected='heart',activeSystem='circulatory',rotY=0,rotX=0,drag=false,moved=false,lastX=0,lastY=0,zoom=1;
let quizState={active:false,target:null,mode:'name',score:0,answered:0};
let freeTest={active:false,queue:[],index:0,current:null,score:0,answered:0,bySystem:{}};
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
let highlighted=[];
const labelDefinitions=[
{ id:'brain',pos:[0,2.27,.68],ar:'الدماغ',fr:'Cerveau',system:'nervous'},
{ id:'spinal-cord',pos:[0,.2,.34],ar:'النخاع الشوكي',fr:'Moelle épinière',system:'nervous'},
{ id:'trachea',pos:[0,1.1,.6],ar:'القصبة الهوائية',fr:'Trachée',system:'respiratory'},
{ id:'lungs',pos:[-.43,.65,.72],ar:'الرئتان',fr:'Poumons',system:'respiratory'},
{ id:'heart',pos:[0,.43,.93],ar:'القلب',fr:'Cœur',system:'circulatory'},
{ id:'liver',pos:[-.38,-.18,.66],ar:'الكبد',fr:'Foie',system:'digestive'},
{ id:'stomach',pos:[.38,-.27,.68],ar:'المعدة',fr:'Estomac',system:'digestive'},
{ id:'intestines',pos:[0,-.76,.64],ar:'الأمعاء',fr:'Intestins',system:'digestive'},
{ id:'kidneys',pos:[-.53,-.72,.59],ar:'الكليتان',fr:'Reins',system:'urinary'},
{ id:'bladder',pos:[0,-1.45,.66],ar:'المثانة',fr:'Vessie',system:'urinary'}
];
const view=root.querySelector('.gs-3d-view');
const labelLayer=document.createElement('div');
labelLayer.className='gs-3d-label-layer';
labelLayer.setAttribute('aria-label',isFr()?'Étiquettes des organes':'تسميات الأعضاء');
const labelToggle=document.createElement('label');
labelToggle.className='gs-3d-label-toggle';
const labelCheck=document.createElement('input');
labelCheck.type='checkbox';labelCheck.checked=true;
const labelToggleText=document.createElement('span');
labelToggleText.textContent=isFr()?'Afficher les étiquettes':'إظهار تسميات الأعضاء';
labelToggle.append(labelCheck,labelToggleText);
view.append(labelLayer,labelToggle);
const labelNodes=new Map();
labelDefinitions.forEach(def=>{
 const button=document.createElement('button');
 button.type='button';button.className='gs-3d-organ-label';
 button.textContent=isFr()?def.fr:def.ar;
 button.setAttribute('aria-label',(isFr()?'Sélectionner ':'اختيار ')+(isFr()?def.fr:def.ar));
 button.addEventListener('click',()=>{if(challenge.active){acceptChallengeAnswer(def.id);return;}if(review.active){acceptReviewAnswer(def.id);return;}if(freeTest.active){acceptFreeTestAnswer(def.id);return;}if(quizState.active){answerQuiz(def.id);return;}if(def.system!==activeSystem)setSystem(def.system);select(def.id);});
 labelLayer.appendChild(button);labelNodes.set(def.id,{button,def});
});
const handleLabelToggle=()=>{if(challenge.active||review.active||freeTest.active||quizState.active){labelCheck.checked=false;labelLayer.hidden=true;return;}labelLayer.hidden=!labelCheck.checked;};
labelCheck.addEventListener('change',handleLabelToggle);
function updateOrganLabels(){
 const width=canvas.clientWidth,height=canvas.clientHeight;
 labelNodes.forEach(({button,def})=>{
   const point=new THREE.Vector3(...def.pos);model.localToWorld(point);point.project(camera);
   const visible=systems[def.system].visible&&point.z>-1&&point.z<1&&point.x>=-1.12&&point.x<=1.12&&point.y>=-1.12&&point.y<=1.12;
   button.hidden=!visible;
   if(visible){button.style.left=((point.x+1)*.5*width)+'px';button.style.top=((1-point.y)*.5*height)+'px';}
 });
}
const info=root.querySelector('.gs-3d-info');
const quizPanel=document.createElement('section');
quizPanel.className='gs-3d-quiz';
quizPanel.setAttribute('aria-labelledby','gs-3d-quiz-title');
const quizTitle=document.createElement('h5');quizTitle.id='gs-3d-quiz-title';quizTitle.textContent=isFr()?'Défi anatomique progressif':'التحدي التشريحي المتدرج';
const quizDescription=document.createElement('p');quizDescription.textContent=isFr()?'Un parcours en trois niveaux couvrant les cinq systèmes et les dix organes.':'مسار من ثلاثة مستويات يشمل الأجهزة الخمسة والأعضاء العشرة.';
const quizPrompt=document.createElement('p');quizPrompt.className='gs-3d-quiz-prompt';quizPrompt.setAttribute('aria-live','polite');quizPrompt.textContent=isFr()?'Prêt à commencer ?':'هل أنت مستعد للبدء؟';
const quizFeedback=document.createElement('p');quizFeedback.className='gs-3d-quiz-feedback';quizFeedback.setAttribute('aria-live','polite');
const quizProgress=document.createElement('p');quizProgress.className='gs-3d-quiz-progress';quizProgress.textContent=isFr()?'30 questions · 3 niveaux':'30 سؤالاً · 3 مستويات';
const quizStart=document.createElement('button');quizStart.type='button';quizStart.className='gs-3d-quiz-start';quizStart.textContent=isFr()?'Commencer le défi complet':'ابدأ التحدي الشامل';
const quizFinish=document.createElement('button');quizFinish.type='button';quizFinish.className='gs-3d-quiz-finish';quizFinish.textContent=isFr()?'Terminer et voir le bilan':'إنهاء التحدي وعرض التقرير';quizFinish.hidden=true;
quizPanel.append(quizTitle,quizDescription,quizProgress,quizPrompt,quizFeedback,quizStart,quizFinish);
const freeSection=document.createElement('section');freeSection.className='gs-3d-free-test';
const freeTitle=document.createElement('h6');freeTitle.textContent=isFr()?'Test anatomique libre':'اختبار تشريحي حر';
const freeDescription=document.createElement('p');freeDescription.textContent=isFr()?'Choisissez un système ou testez les cinq. Deux questions variées par organe.':'اختر جهازاً واحداً أو اختبر الأجهزة الخمسة. سؤالان متنوعان لكل عضو.';
const freeFilter=document.createElement('select');freeFilter.className='gs-3d-free-filter';freeFilter.setAttribute('aria-label',isFr()?'Système à évaluer':'الجهاز المراد اختباره');
const freeProgress=document.createElement('p');freeProgress.className='gs-3d-free-progress';freeProgress.setAttribute('aria-live','polite');
const freePrompt=document.createElement('p');freePrompt.className='gs-3d-quiz-prompt';freePrompt.setAttribute('aria-live','polite');freePrompt.textContent=isFr()?'Prêt à explorer ?':'هل أنت مستعد للاختبار؟';
const freeFeedback=document.createElement('p');freeFeedback.className='gs-3d-quiz-feedback';freeFeedback.setAttribute('aria-live','polite');
const freeStart=document.createElement('button');freeStart.type='button';freeStart.className='gs-3d-quiz-start';freeStart.textContent=isFr()?'Lancer le test libre':'ابدأ الاختبار الحر';
freeSection.append(freeTitle,freeDescription,freeFilter,freeProgress,freePrompt,freeFeedback,freeStart);quizPanel.appendChild(freeSection);
const organList=info&&info.querySelector('.gs-3d-organ-list');if(organList)organList.insertAdjacentElement('afterend',quizPanel);
const SYSTEM_NAMES={circulatory:{ar:'الجهاز الدوراني',fr:'Système circulatoire'},respiratory:{ar:'الجهاز التنفسي',fr:'Système respiratoire'},nervous:{ar:'الجهاز العصبي',fr:'Système nerveux'},digestive:{ar:'الجهاز الهضمي',fr:'Système digestif'},urinary:{ar:'الجهاز البولي',fr:'Système urinaire'}};
const LEVEL_NAMES=[{ar:'المستوى الأساسي',fr:'Niveau 1 · Essentiel'},{ar:'المستوى المتوسط',fr:'Niveau 2 · Fonctions'},{ar:'المستوى المتقدم',fr:'Niveau 3 · Raisonnement'}];
Object.entries(SYSTEM_NAMES).forEach(([value,names])=>{const option=document.createElement('option');option.value=value;option.textContent=names[isFr()?'fr':'ar'];freeFilter.appendChild(option);});
const allOption=document.createElement('option');allOption.value='all';allOption.textContent=isFr()?'Tous les systèmes':'جميع الأجهزة';freeFilter.insertBefore(allOption,freeFilter.firstChild);

const organStats={};
let challenge={active:false,finished:false,queue:[],index:0,score:0,answered:0,level:0,current:null};
function shuffle(items){const result=items.slice();for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function startFreeTest(){
 if(challenge.active||review.active)return;
 const chosen=freeFilter.value;
 const members=labelDefinitions.filter(item=>chosen==='all'||item.system===chosen);
 if(!members.length)return;
 freeTest={active:true,queue:[],index:0,current:null,score:0,answered:0,bySystem:{}};
 Object.keys(SYSTEM_NAMES).forEach(system=>freeTest.bySystem[system]={score:0,answered:0});
 members.forEach(item=>{freeTest.queue.push({id:item.id,mode:'name',system:item.system});freeTest.queue.push({id:item.id,mode:'function',system:item.system});});
 freeTest.queue=shuffle(freeTest.queue);
 freeFilter.disabled=true;freeStart.textContent=isFr()?'Question suivante':'السؤال التالي';
 freeStart.disabled=true;labelCheck.checked=false;labelCheck.disabled=true;handleLabelToggle();
 showFreeQuestion();
}
function showFreeQuestion(){
 if(!freeTest.active)return;
 if(freeTest.index>=freeTest.queue.length){finishFreeTest();return;}
 const q=freeTest.queue[freeTest.index];freeTest.current=q;setQuizSystem(q.system);select(q.id);
 const d=DATA[q.id][isFr()?'fr':'ar'];
 freeProgress.textContent=(isFr()?'Question ':'السؤال ')+(freeTest.index+1)+'/'+freeTest.queue.length+' · '+SYSTEM_NAMES[q.system][isFr()?'fr':'ar'];
 freePrompt.textContent=q.mode==='name'
  ?(isFr()?'Repérez cet organe sur le modèle : ':'حدّد هذا العضو على النموذج: ')+d[0]
  :(isFr()?'Quel organe assure cette fonction ? ':'أي عضو يقوم بهذه الوظيفة؟ ')+d[2];
 freeFeedback.textContent='';freeStart.disabled=true;
}
function acceptFreeTestAnswer(id){
 if(!freeTest.active||!freeTest.current)return;
 const q=freeTest.current,correct=id===q.id,d=DATA[q.id][isFr()?'fr':'ar'],chosen=DATA[id]?.[isFr()?'fr':'ar'];
 freeTest.answered++;if(correct)freeTest.score++;
 const stat=freeTest.bySystem[q.system];stat.answered++;if(correct)stat.score++;
 freeFeedback.textContent=correct
  ?(isFr()?'Correct ! ':'إجابة صحيحة! ')+d[0]+' — '+d[2]
  :(isFr()?'Organe attendu : ':'العضو الصحيح: ')+d[0]+' — '+d[2]+(chosen?(isFr()?' · Votre choix : ':' · اختيارك: ')+chosen[0]:'');
 freeTest.current=null;freeTest.index++;freeProgress.textContent=(isFr()?'Progression : ':'التقدم: ')+freeTest.index+'/'+freeTest.queue.length+' · '+(isFr()?'Score : ':'النتيجة: ')+freeTest.score;
 freePrompt.textContent=isFr()?'Réponse enregistrée. Continuez.':'تم تسجيل الإجابة. انتقل إلى السؤال التالي.';
 freeStart.disabled=false;
}
function finishFreeTest(){
 freeTest.active=false;freeFilter.disabled=false;freeStart.disabled=false;freeStart.textContent=isFr()?'Recommencer le test':'إعادة الاختبار الحر';
 labelCheck.disabled=false;labelCheck.checked=true;handleLabelToggle();
 freeProgress.textContent=(isFr()?'Résultat global : ':'النتيجة الإجمالية: ')+freeTest.score+'/'+freeTest.answered;
 freePrompt.textContent=isFr()?'Résultats par système':'النتائج حسب أجهزة الجسم';
 const report=document.createElement('div');report.className='gs-3d-free-report';
 Object.entries(freeTest.bySystem).forEach(([system,stat])=>{
  if(!stat.answered)return;
  const line=document.createElement('p'),percent=Math.round(stat.score/stat.answered*100);
  line.textContent=SYSTEM_NAMES[system][isFr()?'fr':'ar']+' · '+stat.score+'/'+stat.answered+' ('+percent+'%)';
  line.className=percent>=75?'is-strong':percent>=50?'is-progress':'needs-practice';report.appendChild(line);
 });
 const previous=freeSection.querySelector('.gs-3d-free-report');if(previous)previous.remove();freeSection.appendChild(report);
 freeFeedback.textContent=isFr()?'Test indépendant : aucun XP ni donnée scolaire n’a été modifié.':'اختبار مستقل: لم تتغير نقاط XP أو بيانات التقدم الدراسي.';
}
freeStart.addEventListener('click',()=>{if(!freeTest.active){const old=freeSection.querySelector('.gs-3d-free-report');if(old)old.remove();startFreeTest();}else if(freeTest.current===null)showFreeQuestion();});

function setQuizSystem(system){activeSystem=system;Object.entries(systems).forEach(([key,group])=>group.visible=key===system);root.querySelectorAll('[data-3d-system]').forEach(button=>{const active=button.dataset['3dSystem']===system;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',active?'true':'false');});}
function buildChallenge(){
 if(freeTest.active||review.active)return;
 const previousReport=quizPanel.querySelector('.gs-3d-quiz-report');if(previousReport)previousReport.remove();
 const previousReview=quizPanel.querySelector('.gs-3d-smart-review');if(previousReview)previousReview.remove();
 review={active:false,queue:[],index:0,current:null,results:{}};
 challenge={active:true,finished:false,queue:[],index:0,score:0,answered:0,level:0,current:null};
 Object.keys(DATA).forEach(id=>organStats[id]={attempts:0,correct:0});
 for(let level=0;level<3;level++){
  const round=shuffle(labelDefinitions);
  round.forEach(item=>challenge.queue.push({id:item.id,system:item.system,level}));
 }
 labelCheck.checked=false;labelCheck.disabled=true;handleLabelToggle();
 quizFinish.hidden=false;quizStart.hidden=false;quizStart.textContent=isFr()?'Question suivante':'السؤال التالي';
 showChallengeQuestion();
}
function showChallengeQuestion(){
 if(!challenge.active)return;
 if(challenge.index>=challenge.queue.length){finishChallenge();return;}
 const question=challenge.queue[challenge.index];challenge.current=question;challenge.level=question.level;
 setQuizSystem(question.system);select(question.id);
 const d=DATA[question.id][isFr()?'fr':'ar'];
 const levelName=LEVEL_NAMES[question.level][isFr()?'fr':'ar'];
 const systemName=SYSTEM_NAMES[question.system][isFr()?'fr':'ar'];
 quizProgress.textContent=(isFr()?'Question ':'السؤال ')+(challenge.index+1)+'/30 · '+levelName+' · '+systemName;
 if(question.level===0)quizPrompt.textContent=isFr()?'Niveau 1 — Repérez sur le modèle : '+d[0]:'المستوى الأساسي — حدّد على النموذج: '+d[0];
 else if(question.level===1)quizPrompt.textContent=isFr()?'Niveau 2 — Quel organe assure cette fonction ? '+d[2]:'المستوى المتوسط — أي عضو يقوم بهذه الوظيفة؟ '+d[2];
 else quizPrompt.textContent=isFr()?'Niveau 3 — Quel organe correspond à cette description ? '+d[1]:'المستوى المتقدم — ما العضو الذي تنطبق عليه هذه الخصائص؟ '+d[1];
 quizFeedback.textContent='';
 quizStart.disabled=true;
}
function acceptChallengeAnswer(id){
 if(!challenge.active||!challenge.current)return;
 const q=challenge.current,target=q.id,correct=id===target,stats=organStats[target];
 challenge.answered++;stats.attempts++;if(correct){challenge.score++;stats.correct++;}
 const lang=isFr()?'fr':'ar',d=DATA[target][lang],chosen=DATA[id][lang];
 quizFeedback.textContent=correct
  ?(isFr()?'Correct ! ':'إجابة صحيحة! ')+d[0]+' — '+d[2]
  :(isFr()?'Pas tout à fait. Organe attendu : ':'ليست الإجابة الصحيحة. العضو المطلوب: ')+d[0]+' — '+d[2]+(id&&DATA[id]?(isFr()?' Votre choix : ':' اختيارك: ')+chosen[0]:'');
 challenge.current=null;challenge.index++;
 quizProgress.textContent=(isFr()?'Progression : ':'التقدم: ')+challenge.answered+'/30 · '+(isFr()?'Score : ':'النتيجة: ')+challenge.score;
 quizPrompt.textContent=isFr()?'Réponse enregistrée. Passez à la question suivante.':'تم تسجيل الإجابة. انتقل إلى السؤال التالي.';
 quizStart.disabled=false;
}
function finishChallenge(){
 challenge.active=false;challenge.finished=true;challenge.current=null;
 labelCheck.disabled=false;labelCheck.checked=true;handleLabelToggle();
 quizStart.hidden=true;quizFinish.hidden=true;
 const accuracy=challenge.answered?Math.round(challenge.score/challenge.answered*100):0;
 quizProgress.textContent=(isFr()?'Bilan final · ':'التقرير النهائي · ')+challenge.score+'/'+challenge.answered+' ('+accuracy+'%)';
 quizPrompt.textContent=isFr()?'Votre bilan par système :':'حصيلتك حسب كل جهاز:';
 const report=document.createElement('div');report.className='gs-3d-quiz-report';
 Object.entries(SYSTEM_NAMES).forEach(([system,names])=>{
  const members=labelDefinitions.filter(item=>item.system===system);
  const total=members.reduce((sum,item)=>sum+organStats[item.id].correct,0);
  const attempts=members.reduce((sum,item)=>sum+organStats[item.id].attempts,0);
  const heading=document.createElement('h6');heading.textContent=names[langKey()]+' · '+total+'/'+attempts;
  report.appendChild(heading);
  members.forEach(item=>{
   const stat=organStats[item.id],line=document.createElement('p');
   const mastered=stat.attempts===3&&stat.correct>=2;
   line.textContent=(mastered?'✓ ':'↻ ')+DATA[item.id][langKey()][0]+' — '+stat.correct+'/'+stat.attempts+' / 3 · '+(mastered?(isFr()?'Acquis':'متقن'):(stat.attempts<3?(isFr()?'Incomplet':'غير مكتمل'):(isFr()?'À revoir':'يحتاج إلى مراجعة')));
   line.className=mastered?'is-mastered':'needs-review';report.appendChild(line);
   if(!mastered){
    const advice=document.createElement('small');advice.className='gs-3d-review-tip';
    advice.textContent=isFr()?'Révisez la fiche de '+DATA[item.id].fr[0]+' et retenez sa fonction : '+DATA[item.id].fr[2]:'راجع بطاقة '+DATA[item.id].ar[0]+' وركز على وظيفته: '+DATA[item.id].ar[2];
    report.appendChild(advice);
   }
  });
 });
 const previous=quizPanel.querySelector('.gs-3d-quiz-report');if(previous)previous.remove();
 quizPanel.appendChild(report);
 buildSmartReview();
 quizFeedback.textContent=isFr()?'Organe maîtrisé : au moins 2 bonnes réponses sur 3. Ce bilan reste dans cette session et ne modifie ni XP ni progression scolaire.':'يُعد العضو متقناً عند الحصول على إجابتين صحيحتين على الأقل من أصل 3. يبقى التقرير ضمن هذه الجلسة ولا يغيّر XP أو التقدم الدراسي.';
}
let review={active:false,queue:[],index:0,current:null,results:{}};
function buildSmartReview(){
 const targets=labelDefinitions.filter(item=>{const stat=organStats[item.id];return stat.attempts!==3||stat.correct<2;});
 if(!targets.length)return;
 const section=document.createElement('section');section.className='gs-3d-smart-review';section.setAttribute('aria-labelledby','gs-3d-review-title');
 const title=document.createElement('h6');title.id='gs-3d-review-title';title.textContent=isFr()?'Révision intelligente ciblée':'مراجعة ذكية موجهة';
 const intro=document.createElement('p');intro.textContent=isFr()?'Deux questions courtes par organe à retravailler. Le bilan initial reste inchangé.':'سؤالان قصيران لكل عضو يحتاج إلى تدريب. سيبقى التقرير الأصلي كما هو.';
 const progress=document.createElement('p');progress.className='gs-3d-review-progress';progress.setAttribute('aria-live','polite');
 const prompt=document.createElement('p');prompt.className='gs-3d-quiz-prompt';prompt.setAttribute('aria-live','polite');
 const feedback=document.createElement('p');feedback.className='gs-3d-quiz-feedback';feedback.setAttribute('aria-live','polite');
 const next=document.createElement('button');next.type='button';next.className='gs-3d-quiz-start';next.textContent=isFr()?'Démarrer la révision':'ابدأ المراجعة الذكية';
 section.append(title,intro,progress,prompt,feedback,next);quizPanel.appendChild(section);
 review={active:false,queue:[],index:0,current:null,results:{},section,progress,prompt,feedback,next,targets:targets.map(item=>item.id)};
 targets.forEach(item=>{
  const original=organStats[item.id];
  review.results[item.id]={correct:0,answered:0,followupAdded:false,startingCorrect:original.correct};
  const startingMode=original.correct===0?'name':(original.correct===1?'function':'description');
  review.queue.push({id:item.id,mode:startingMode,adaptive:true});
 });
 review.queue=shuffle(review.queue);
 next.addEventListener('click',()=>{
  if(!review.active){review.active=true;labelCheck.checked=false;labelCheck.disabled=true;handleLabelToggle();next.textContent=isFr()?'Question suivante':'السؤال التالي';showReviewQuestion();return;}
  if(review.current===null)showReviewQuestion();
 });
}
function showReviewQuestion(){
 if(!review.active)return;
 if(review.index>=review.queue.length){finishSmartReview();return;}
 const q=review.queue[review.index];review.current=q;setQuizSystem(SYSTEM_FOR[q.id]);select(q.id);
 const d=DATA[q.id][langKey()];
 review.progress.textContent=(isFr()?'Révision · Question ':'المراجعة · السؤال ')+(review.index+1)+'/'+review.queue.length;
 const difficulty=q.mode==='name'?(isFr()?'Repérage guidé':'تحديد أساسي'):q.mode==='function'?(isFr()?'Fonction':'ربط الوظيفة'): (isFr()?'Description scientifique':'وصف علمي');
 review.progress.textContent+=' · '+difficulty;
 review.prompt.textContent=q.mode==='name'
  ?(isFr()?'Niveau essentiel — Repérez cet organe sur le modèle : ':'المستوى الأساسي — حدّد هذا العضو على النموذج: ')+d[0]
  :q.mode==='function'
   ?(isFr()?'Niveau intermédiaire — Quel organe assure cette fonction ? ':'المستوى المتوسط — أي عضو يقوم بهذه الوظيفة؟ ')+d[2]
   :(isFr()?'Niveau avancé — Quel organe correspond à cette description ? ':'المستوى المتقدم — ما العضو الذي تنطبق عليه هذه الخصائص؟ ')+d[1];
 review.feedback.textContent='';review.next.disabled=true;
}
function acceptReviewAnswer(id){
 if(!review.active||!review.current)return;
 const q=review.current,correct=id===q.id,d=DATA[q.id][langKey()],chosen=DATA[id][langKey()];
 const result=review.results[q.id];result.answered++;if(correct)result.correct++;
 review.feedback.textContent=correct
  ?(isFr()?'Correct ! ':'إجابة صحيحة! ')+d[0]+' — '+d[2]
  :(isFr()?'À revoir : ':'تحتاج إلى تثبيت: ')+d[0]+' — '+d[2]+(DATA[id]?(isFr()?' Votre choix : ':' اختيارك: ')+chosen[0]:'');
 if(!result.followupAdded){
  result.followupAdded=true;
  const nextMode=correct
   ?(q.mode==='name'?'function':q.mode==='function'?'description':'description')
   :(q.mode==='description'?'function':'name');
  review.queue.push({id:q.id,mode:nextMode,adaptive:true});
  review.feedback.textContent+=(isFr()
   ?(correct?' Niveau suivant débloqué.':' Une question de consolidation est ajoutée.')
   :(correct?' تم الانتقال إلى مستوى أصعب.':' أُضيف سؤال لتثبيت الأساسيات.'));
 }
 review.current=null;review.index++;review.next.disabled=false;
 review.progress.textContent=(isFr()?'Progression : ':'التقدم: ')+review.index+'/'+review.queue.length;
 review.prompt.textContent=isFr()?'Réponse enregistrée. Continuez.':'تم تسجيل الإجابة. تابع إلى السؤال التالي.';
}
function finishSmartReview(){
 review.active=false;labelCheck.disabled=false;labelCheck.checked=true;handleLabelToggle();
 review.next.hidden=true;
 review.progress.textContent=isFr()?'Révision terminée':'انتهت المراجعة الذكية';
 review.prompt.textContent=isFr()?'Votre bilan de révision':'نتيجة المراجعة الذكية';
 const report=document.createElement('div');report.className='gs-3d-review-report';
 review.targets.forEach(id=>{
  const result=review.results[id],line=document.createElement('p');
  const improved=result.correct>=2;
  line.className=improved?'is-improved':'still-review';
  line.textContent=(improved?'✓ ':'↻ ')+DATA[id][langKey()][0]+' — '+result.correct+'/'+result.answered+' · '+(improved?(isFr()?'En progrès':'تحسن'):(isFr()?'À retravailler':'ما زال يحتاج إلى مراجعة'));
  report.appendChild(line);
 });
 review.section.appendChild(report);
 review.feedback.textContent=isFr()?'Ce bilan de révision est temporaire et ne modifie ni le défi initial, ni les XP, ni les données scolaires.':'هذا التقرير خاص بالمراجعة الحالية، ولا يغيّر نتيجة التحدي الأصلي أو XP أو بيانات التقدم الدراسي.';
}
function langKey(){return isFr()?'fr':'ar';}
function endQuiz(){
 if(challenge.active)finishChallenge();
}
quizStart.addEventListener('click',()=>{
 if(freeTest.active||review.active)return;
 if(challenge.active&&challenge.current===null){showChallengeQuestion();return;}
 if(!challenge.active)buildChallenge();
});
quizFinish.addEventListener('click',endQuiz);

function clearHighlight(){highlighted.forEach(item=>{item.mesh.material=item.original;});highlighted=[];}
function select(id){if(!DATA[id])return;selected=id;clearHighlight();model.traverse(object=>{if(!object.isMesh||object.name!==id)return;const original=object.material;const glow=original.clone();if(glow.emissive){glow.emissive.set(0xffc247);glow.emissiveIntensity=.72;}object.material=glow;highlighted.push({mesh:object,original});});const lang=isFr()?'fr':'ar',d=DATA[id][lang];root.querySelector('[data-3d-name]').textContent=d[0];root.querySelector('[data-3d-description]').textContent=d[1];root.querySelector('[data-3d-function]').textContent=d[2];root.querySelectorAll('[data-3d-organ]').forEach(b=>b.classList.toggle('is-active',b.dataset['3dOrgan']===id));}
const SYSTEM_FOR={heart:'circulatory',lungs:'respiratory',brain:'nervous',liver:'digestive',stomach:'digestive',kidneys:'urinary',intestines:'digestive','spinal-cord':'nervous',trachea:'respiratory',bladder:'urinary'};
function setSystem(id){if(!systems[id])return;activeSystem=id;Object.entries(systems).forEach(([key,group])=>group.visible=key===id);root.querySelectorAll('[data-3d-system]').forEach(b=>{const active=b.dataset['3dSystem']===id;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');});const first={circulatory:'heart',respiratory:'lungs',nervous:'brain',digestive:'stomach',urinary:'kidneys'}[id];select(first);}

function resize(){const w=canvas.clientWidth||500,h=canvas.clientHeight||480;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(root.getBoundingClientRect().width>0)resize();}):null;
if(ro)ro.observe(root);
let rafId=0,disposed=false,inViewport=true;
function canRender(){const rect=root.getBoundingClientRect();return !disposed&&root.isConnected&&document.visibilityState!=='hidden'&&inViewport&&rect.width>0&&rect.height>0;}
function draw(){rafId=0;if(!canRender())return;model.rotation.y=rotY;model.rotation.x=rotX;camera.position.z=8.5/zoom;camera.lookAt(0,0,0);camera.updateMatrixWorld();updateOrganLabels();renderer.render(scene,camera);rafId=requestAnimationFrame(draw);}
function startLoop(){if(!rafId&&canRender())rafId=requestAnimationFrame(draw);}
const handleDocVisibility=()=>{if(document.visibilityState==='hidden'){if(rafId)cancelAnimationFrame(rafId);rafId=0;}else{resize();startLoop();}};
document.addEventListener('visibilitychange',handleDocVisibility);
const io=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{inViewport=!!entries[0]?.isIntersecting;if(inViewport){resize();startLoop();}else if(rafId){cancelAnimationFrame(rafId);rafId=0;}},{threshold:0.01}):null;
if(io)io.observe(root);
function pointerDown(e){drag=true;moved=false;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);}
function pointerMove(e){if(!drag)return;if(Math.abs(e.clientX-lastX)+Math.abs(e.clientY-lastY)>3)moved=true;rotY+=(e.clientX-lastX)*.009;rotX=Math.max(-.65,Math.min(.65,rotX+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY;}
function pointerUp(){drag=false;}
const handleWheel=e=>{e.preventDefault();zoom=Math.max(.72,Math.min(1.55,zoom+(e.deltaY>0?-.07:.07)));};
const handleCanvasClick=e=>{if(moved){moved=false;return;}const rect=canvas.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(model.children,true);const hit=hits.find(h=>DATA[h.object.name]||h.object.name==='lungs'||h.object.name==='kidneys');if(hit){const name=hit.object.name;if(DATA[name]){select(name);if(challenge.active){acceptChallengeAnswer(name);return;}if(review.active){acceptReviewAnswer(name);return;}if(freeTest.active){acceptFreeTestAnswer(name);return;}answerQuiz(name);}}};
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
canvas.addEventListener('wheel',handleWheel,{passive:false});
canvas.addEventListener('click',handleCanvasClick);
const handleRootClick=e=>{const btn=e.target.closest('[data-3d-organ],[data-3d-action],[data-3d-system]');if(!btn)return;if(btn.dataset['3dOrgan']){const system=SYSTEM_FOR[btn.dataset['3dOrgan']];if(challenge.active){select(btn.dataset['3dOrgan']);acceptChallengeAnswer(btn.dataset['3dOrgan']);return;}if(review.active){select(btn.dataset['3dOrgan']);acceptReviewAnswer(btn.dataset['3dOrgan']);return;}if(freeTest.active){select(btn.dataset['3dOrgan']);acceptFreeTestAnswer(btn.dataset['3dOrgan']);return;}if(system&&!quizState.active)setSystem(system);select(btn.dataset['3dOrgan']);answerQuiz(btn.dataset['3dOrgan']);}if(btn.dataset['3dSystem']&&!quizState.active&&!challenge.active&&!review.active&&!freeTest.active)setSystem(btn.dataset['3dSystem']);if(btn.dataset['3dAction']==='reset'){rotY=0;rotX=0;zoom=1;}if(btn.dataset['3dAction']==='zoom-in')zoom=Math.min(1.55,zoom+.12);if(btn.dataset['3dAction']==='zoom-out')zoom=Math.max(.72,zoom-.12);};
root.addEventListener('click',handleRootClick);
activeCleanup=()=>{
disposed=true;
delete root.dataset.gs3dReady;
if(rafId)cancelAnimationFrame(rafId);
if(ro)ro.disconnect();
if(io)io.disconnect();
document.removeEventListener('visibilitychange',handleDocVisibility);
canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);
canvas.removeEventListener('wheel',handleWheel);canvas.removeEventListener('click',handleCanvasClick);
root.removeEventListener('click',handleRootClick);
quizPanel.remove();
labelCheck.removeEventListener('change',handleLabelToggle);labelLayer.remove();labelToggle.remove();
scene.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
renderer.dispose();
};
setSystem('circulatory');resize();loading.hidden=true;if(!io)startLoop();
}
window.GOSVT3DLab={mount};
})();
