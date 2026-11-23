(function(){
'use strict';
const DATA={
heart:{ar:['القلب','يضخ الدم إلى مختلف أنحاء الجسم، ويساهم في ضمان وصول الأكسجين والمواد الغذائية إلى الخلايا.','ضخ الدم والمحافظة على الدورة الدموية.'],fr:['Le cœur','Il propulse le sang dans l’organisme et permet l’apport d’oxygène et de nutriments aux cellules.','Propulser le sang et maintenir la circulation.']},
lungs:{ar:['الرئتان','تستقبلان الهواء وتسمحان بالتبادلات الغازية على مستوى الحويصلات الرئوية: دخول الأكسجين وخروج ثاني أكسيد الكربون.','إنجاز التبادلات الغازية بين الهواء والدم.'],fr:['Les poumons','Ils assurent les échanges gazeux au niveau des alvéoles : entrée de dioxygène et élimination du dioxyde de carbone.','Assurer les échanges gazeux entre l’air et le sang.']},
brain:{ar:['الدماغ','يشرف على معالجة المعلومات وتنسيق كثير من أنشطة الجسم، ويتواصل مع الأعضاء عبر الجهاز العصبي.','معالجة المعلومات وتنسيق الاستجابات.'],fr:['Le cerveau','Il traite les informations et coordonne de nombreuses activités du corps grâce au système nerveux.','Traiter les informations et coordonner les réponses.']},
liver:{ar:['الكبد','يساهم في تنظيم المغذيات، وإنتاج الصفراء، وتحويل بعض المواد وتخزين مواد احتياطية.','الاستقلاب وتنظيم المغذيات وإنتاج الصفراء.'],fr:['Le foie','Il participe au métabolisme des nutriments, produit la bile et stocke certaines réserves.','Métabolisme, régulation des nutriments et production de bile.']},
stomach:{ar:['المعدة','تستقبل الطعام وتخلطه بالعصارة المعدية، وتساهم في الهضم الكيميائي والميكانيكي.','خلط الطعام والمساهمة في هضمه.'],fr:['L’estomac','Il reçoit les aliments, les brasse avec le suc gastrique et participe à leur digestion.','Brasser les aliments et participer à leur digestion.']},
kidneys:{ar:['الكليتان','ترشحان الدم وتساهمان في تكوين البول وتنظيم توازن الماء والأملاح في الجسم.','ترشيح الدم وتنظيم توازن الماء والأملاح.'],fr:['Les reins','Ils filtrent le sang, participent à la formation de l’urine et régulent l’équilibre hydrominéral.','Filtrer le sang et réguler l’équilibre hydrominéral.']}
};
const isFr=()=>document.documentElement.lang==='fr';
function mount(root){
if(!root||root.dataset.gs3dReady==='1')return;
root.dataset.gs3dReady='1';
const canvas=root.querySelector('.gs-3d-canvas'),loading=root.querySelector('.gs-3d-loading');
if(!window.THREE){loading.textContent=isFr()?'Le moteur 3D n’a pas pu être chargé. Vérifiez la connexion puis rechargez la page.':'تعذر تحميل محرك العرض ثلاثي الأبعاد. تحقق من الاتصال ثم أعد تحميل الصفحة.';return;}
const THREE=window.THREE,scene=new THREE.Scene();scene.background=new THREE.Color(0x142b25);
const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(0,1.1,8.5);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xe9fff0,0x24352e,2.0));
const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(4,6,7);scene.add(key);
const fill=new THREE.DirectionalLight(0x75c6aa,1.2);fill.position.set(-5,2,-4);scene.add(fill);
const model=new THREE.Group();scene.add(model);
const material=(color,roughness=.58)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.02});
const skin=material(0xc98f70),organRed=material(0xb83f4b),lungMat=material(0xc76d78),brainMat=material(0xe4a2a0),liverMat=material(0x7f3e35),stomachMat=material(0xe0a05e),kidneyMat=material(0x93484c),bone=material(0xe4d7b8);
function blob(name,pos,scale,mat,seg=32){const m=new THREE.Mesh(new THREE.SphereGeometry(1,seg,seg),mat);m.name=name;m.position.set(...pos);m.scale.set(...scale);model.add(m);return m;}
/* Educational schematic body silhouette */
blob('body',[0,-.05,0],[1.05,1.95,.48],skin,40);
blob('head',[0,2.18,0],[.52,.62,.48],skin);
blob('neck',[0,1.48,0],[.24,.38,.25],skin);
blob('shoulderL',[-1.12,1.05,0],[.28,.95,.3],skin);blob('shoulderR',[1.12,1.05,0],[.28,.95,.3],skin);
blob('legL',[-.42,-2.05,0],[.34,1.25,.37],skin);blob('legR',[.42,-2.05,0],[.34,1.25,.37],skin);
const organs={};
organs.brain=blob('brain',[0,2.27,.43],[.39,.34,.2],brainMat);
organs.lungs=blob('lungs',[-.43,.65,.46],[.38,.68,.22],lungMat);blob('lungs',[.43,.65,.46],[.38,.68,.22],lungMat);
organs.heart=blob('heart',[0,.43,.69],[.25,.36,.22],organRed);
organs.liver=blob('liver',[-.38,-.18,.47],[.53,.25,.18],liverMat);
organs.stomach=blob('stomach',[.38,-.27,.48],[.29,.43,.18],stomachMat);
organs.kidneys=blob('kidneys',[-.53,-.72,.42],[.19,.3,.16],kidneyMat);blob('kidneys',[.53,-.72,.42],[.19,.3,.16],kidneyMat);
const spine=blob('spine',[0,-.25,-.24],[.11,1.35,.1],bone);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.7,64),new THREE.MeshBasicMaterial({color:0x234438,transparent:true,opacity:.48}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.35;scene.add(floor);
let selected='heart',rotY=0,rotX=0,drag=false,lastX=0,lastY=0,zoom=1;
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
function select(id){if(!DATA[id])return;selected=id;const lang=isFr()?'fr':'ar',d=DATA[id][lang];root.querySelector('[data-3d-name]').textContent=d[0];root.querySelector('[data-3d-description]').textContent=d[1];root.querySelector('[data-3d-function]').textContent=d[2];root.querySelectorAll('[data-3d-organ]').forEach(b=>b.classList.toggle('is-active',b.dataset['3dOrgan']===id));}
function resize(){const w=canvas.clientWidth||500,h=canvas.clientHeight||480;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
const ro=new ResizeObserver(()=>{if(root.getBoundingClientRect().width>0)resize();});ro.observe(root);
function draw(){requestAnimationFrame(draw);model.rotation.y=rotY;model.rotation.x=rotX;camera.position.z=8.5/zoom;camera.lookAt(0,0,0);renderer.render(scene,camera);}
function pointerDown(e){drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);}
function pointerMove(e){if(!drag)return;rotY+=(e.clientX-lastX)*.009;rotX=Math.max(-.65,Math.min(.65,rotX+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY;}
function pointerUp(){drag=false;}
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.72,Math.min(1.55,zoom+(e.deltaY>0?-.07:.07)));},{passive:false});
canvas.addEventListener('click',e=>{const rect=canvas.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(model.children,true);const hit=hits.find(h=>DATA[h.object.name]||h.object.name==='lungs'||h.object.name==='kidneys');if(hit){const name=hit.object.name;if(DATA[name])select(name);}});
root.addEventListener('click',e=>{const btn=e.target.closest('[data-3d-organ],[data-3d-action]');if(!btn)return;if(btn.dataset['3dOrgan'])select(btn.dataset['3dOrgan']);if(btn.dataset['3dAction']==='reset'){rotY=0;rotX=0;zoom=1;}if(btn.dataset['3dAction']==='zoom-in')zoom=Math.min(1.55,zoom+.12);if(btn.dataset['3dAction']==='zoom-out')zoom=Math.max(.72,zoom-.12);});
select('heart');resize();loading.hidden=true;draw();
}
window.GOSVT3DLab={mount};
})();
