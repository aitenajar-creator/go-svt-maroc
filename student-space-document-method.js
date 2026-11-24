/* GO SVT Maroc — Document-study method card (skill scaffold, curriculum content-neutral).
 * Does not grade, save, or modify student records. */
(() => {
  'use strict';
  const CARD='gs-document-method';
  const CONTENT={
    ar:{eyebrow:'مهارة منهجية في علوم الحياة والأرض',title:'كيف أستغل وثيقة علمية؟',intro:'خطوات منهجية تساعدك على بناء جواب علمي انطلاقاً من وثيقة. اتبع المطلوب في السؤال، ولا تخلط بين الوصف والتفسير.',steps:[
      ['1','أحدد نوع الوثيقة ومصدرها','جدول، منحنى، رسم، صورة مجهرية، تجربة… وأقرأ العنوان والوحدات.'],
      ['2','أحدد المطلوب','ما الذي يسأل عنه السؤال تحديداً؟ أختار المعطيات المرتبطة به.'],
      ['3','أستخرج المعطيات','أذكر القيم أو الملاحظات بدقة، مع الوحدات عند الحاجة.'],
      ['4','أصف دون تفسير','أوضح التغير أو العلاقة أو المقارنة كما تظهر في الوثيقة.'],
      ['5','أفسر علمياً','أربط الملاحظات بمعارف مناسبة للمستوى الدراسي، مع بيان العلاقة.'],
      ['6','أصوغ استنتاجاً','أجيب عن السؤال بجملة علمية واضحة، مستندة إلى المعطيات والتفسير.']
    ],self:'تحقق من جوابك',checks:['هل استخدمت معطيات محددة من الوثيقة؟','هل فصلت الوصف عن التفسير؟','هل استعملت مفاهيم علمية مناسبة؟','هل استنتاجي يجيب مباشرة عن السؤال؟'],disclaimer:'هذه بطاقة منهجية عامة؛ ستُخصص أمثلتها وصياغاتها حسب البرنامج الرسمي والمستوى بعد مراجعة الوثائق المرجعية.'},
    fr:{eyebrow:'Méthode en SVT',title:'Comment exploiter un document scientifique ?',intro:'Une démarche pour construire une réponse scientifique à partir d’un document. Respectez la consigne et distinguez description et interprétation.',steps:[
      ['1','Identifier le document et sa source','Tableau, courbe, schéma, micrographie, expérience… lire le titre et les unités.'],
      ['2','Repérer la consigne','Que demande précisément la question ? Sélectionner les données utiles.'],
      ['3','Relever les données','Citer les valeurs ou observations avec précision et les unités si nécessaire.'],
      ['4','Décrire sans interpréter','Présenter l’évolution, la relation ou la comparaison observée.'],
      ['5','Interpréter scientifiquement','Relier les observations à des connaissances adaptées au niveau.'],
      ['6','Conclure','Formuler une réponse claire à la question, fondée sur les données et l’interprétation.']
    ],self:'Auto-vérification',checks:['Ai-je cité des données précises du document ?','Ai-je séparé description et interprétation ?','Ai-je utilisé des notions scientifiques adaptées ?','Ma conclusion répond-elle directement à la consigne ?'],disclaimer:'Cette fiche est un cadre méthodologique général. Les exemples et formulations seront adaptés au programme officiel et au niveau après vérification des documents de référence.'}
  };
  const trackNames={TCS:['الجذع المشترك العلمي','Tronc commun scientifique'],TCL:['الجذع المشترك الأدبي','Tronc commun lettres'], '1BACSE':['الأولى باكالوريا علوم تجريبية','1ère Bac sciences expérimentales'],'1BACSM':['الأولى باكالوريا علوم رياضية','1ère Bac sciences mathématiques'],'1BACL':['الأولى باكالوريا آداب','1ère Bac lettres'],'2BACSVT':['الثانية باكالوريا علوم الحياة والأرض','2ème Bac SVT'],'2BACSP':['الثانية باكالوريا علوم فيزيائية','2ème Bac sciences physiques'],'2BACSM':['الثانية باكالوريا علوم رياضية','2ème Bac sciences mathématiques']};
  const lang=()=>document.documentElement.lang==='fr'?'fr':'ar';
  function student(){try{return window.StudentAccount&&StudentAccount.isLoggedIn()?StudentAccount.getProfile():null}catch(_){return null}}
  function build(){
    const panel=document.getElementById('panel-dashboard');const welcome=panel&&panel.querySelector('.gs-student-welcome');if(!welcome)return;
    const p=student();let old=document.getElementById(CARD);if(!p||['admin','teacher'].includes(String(p.role||'').toLowerCase())){old?.remove();return;}
    const L=lang(),d=CONTENT[L],track=String(p.study_track||'').toUpperCase(),level=String(p.study_level||'').toUpperCase(),trackText=trackNames[track]?.[L]||track;
    const box=document.createElement('section');box.id=CARD;box.className='gs-document-method';box.dir=L==='ar'?'rtl':'ltr';
    const eyebrow=document.createElement('span');eyebrow.className='gs-dm-eyebrow';eyebrow.textContent=d.eyebrow;
    const title=document.createElement('h3');title.textContent=d.title;
    const intro=document.createElement('p');intro.className='gs-dm-intro';intro.textContent=d.intro;
    const profile=document.createElement('span');profile.className='gs-dm-profile';profile.textContent=[level,trackText].filter(Boolean).join(' · ');
    const head=document.createElement('div');head.className='gs-dm-head';head.append(eyebrow,title,intro,profile);box.append(head);
    const list=document.createElement('ol');list.className='gs-dm-steps';
    d.steps.forEach(([num,label,desc])=>{const li=document.createElement('li');const badge=document.createElement('span');badge.className='gs-dm-num';badge.textContent=num;const body=document.createElement('div');const h=document.createElement('strong');h.textContent=label;const p=document.createElement('p');p.textContent=desc;body.append(h,p);li.append(badge,body);list.append(li);});box.append(list);
    const details=document.createElement('details');details.className='gs-dm-self';const summary=document.createElement('summary');summary.textContent=d.self;details.append(summary);
    const checklist=document.createElement('ul');d.checks.forEach(s=>{const li=document.createElement('li');const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';const span=document.createElement('span');span.textContent=s;label.append(input,span);li.append(label);checklist.append(li);});details.append(checklist);box.append(details);
    const note=document.createElement('p');note.className='gs-dm-note';note.textContent=d.disclaimer;box.append(note);
    old?old.replaceWith(box):welcome.insertAdjacentElement('afterend',box);
  }
  let timer;function queue(){clearTimeout(timer);timer=setTimeout(build,120);}
  function init(){const root=document.getElementById('student-space-content');if(!root)return;new MutationObserver(queue).observe(root,{childList:true,subtree:true});document.addEventListener('gosvt:auth-changed',queue);document.addEventListener('click',e=>{if(e.target.closest('.lang-switcher'))queue();});window.addEventListener('storage',queue);build();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
