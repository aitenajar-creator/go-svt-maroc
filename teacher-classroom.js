/* GO SVT Maroc — Teacher classroom and student support UI.
 * Data access is enforced by Supabase RLS/RPC; this script never assigns roles.
 */
(function () {
  'use strict';
  const client = window.supabaseClient;
  if (!client) return;
  const rootId = 'student-space-content';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ar = () => (typeof currentLang !== 'undefined' ? currentLang === 'ar' : document.documentElement.dir === 'rtl');
  const tr = (a, f) => ar() ? a : f;
  const noteTypeLabel = type => ({
    understanding:tr('صعوبات الفهم','Difficultés de compréhension'),
    results:tr('ضعف النتائج','Résultats insuffisants'),
    attendance:tr('المواظبة والمشاركة','Assiduité et participation'),
    progress:tr('تقدم دراسي','Progrès scolaires'),
    other:tr('ملاحظة عامة','Note générale')
  }[type] || tr('ملاحظة عامة','Note générale'));
  const tracks = {
    TC: [['TCS','الجذع المشترك العلمي'],['TCL','الجذع المشترك الأدبي']],
    '1BAC': [['1BACSE','العلوم التجريبية'],['1BACSM','العلوم الرياضية'],['1BACL','الآداب']],
    '2BAC': [['2BACSVT','علوم الحياة والأرض'],['2BACSP','العلوم الفيزيائية'],['2BACSM','العلوم الرياضية']]
  };
  let mountedFor = null;
  let busy = false;
  let lastClassReport = null;
  let inboxFilter = 'open';

  function styles() {
    if (document.getElementById('gs-classroom-style')) return;
    const style = document.createElement('style');
    style.id = 'gs-classroom-style';
    style.textContent = `
      #gs-classroom{margin:2rem 0;padding:clamp(1rem,3vw,1.6rem);border:1px solid var(--gs-class-border,#d9e5d7);border-radius:18px;background:var(--gs-class-bg,#fff);color:var(--gs-class-text,#263528);box-shadow:0 8px 28px rgba(30,70,35,.07);direction:inherit}
      html.gs-dark #gs-classroom{--gs-class-bg:#17231b;--gs-class-text:#e7f0e8;--gs-class-border:#344a38}
      #gs-classroom *{box-sizing:border-box}#gs-classroom h3{margin:0 0 .45rem;color:inherit}#gs-classroom p{margin:.35rem 0}
      #gs-classroom .gs-cl-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
      #gs-classroom .gs-cl-tag{font-size:.8rem;border-radius:99px;padding:.25rem .7rem;background:#e6f2e5;color:#245b2c}
      #gs-classroom .gs-cl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:1rem}
      #gs-classroom .gs-cl-card{border:1px solid var(--gs-class-border,#d9e5d7);border-radius:14px;padding:1rem;min-width:0}
      #gs-classroom label{display:block;font-weight:600;margin:.55rem 0 .25rem}
      #gs-classroom input,#gs-classroom select,#gs-classroom textarea{width:100%;min-width:0;padding:.72rem;border:1px solid #b8c9b8;border-radius:9px;background:var(--gs-class-bg,#fff);color:inherit;font:inherit}
      #gs-classroom textarea{min-height:105px;resize:vertical}
      #gs-classroom button{font:inherit;cursor:pointer;border:0;border-radius:9px;padding:.65rem .95rem;min-height:42px;background:#2c6b36;color:white;font-weight:700}
      #gs-classroom button:disabled{opacity:.55;cursor:wait}
      #gs-classroom .gs-cl-secondary{background:#e8f1e8;color:#245b2c}
      #gs-classroom .gs-cl-list{display:grid;gap:.65rem;margin-top:.75rem}
      #gs-classroom .gs-cl-row{padding:.75rem;border-radius:10px;background:rgba(120,160,120,.09);min-width:0;overflow-wrap:anywhere}
      #gs-classroom .gs-cl-muted{opacity:.75;font-size:.9rem}#gs-classroom .gs-cl-msg{min-height:1.5rem;color:#2b7135;font-weight:600}
      #gs-classroom .gs-cl-thread{max-height:360px;overflow:auto;display:grid;gap:.5rem;margin:.7rem 0}
      #gs-classroom .gs-cl-bubble{padding:.7rem;border-radius:12px;background:rgba(120,160,120,.13);overflow-wrap:anywhere}
      #gs-classroom .gs-cl-bubble small{display:block;opacity:.7;margin-bottom:.25rem}
      @media(max-width:520px){#gs-classroom .gs-cl-head{align-items:flex-start}#gs-classroom button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function panelShell(role) {
    return `<section id="gs-classroom" aria-labelledby="gs-cl-title">
      <div class="gs-cl-head"><div><h3 id="gs-cl-title">🎓 ${tr('فضاء الأستاذ والتواصل','Espace enseignant et échanges')}</h3><p class="gs-cl-muted">${tr('متابعة تعليمية داخل الأقسام المسندة فقط.','Suivi pédagogique limité aux classes autorisées.')}</p></div><span class="gs-cl-tag">${role === 'admin' ? tr('مدير المنصة','Administrateur') : role === 'teacher' ? tr('أستاذ','Enseignant') : tr('تلميذ','Élève')}</span></div>
      <div id="gs-cl-content"><p class="gs-cl-muted">${tr('جارٍ تحميل فضاء القسم...','Chargement de l’espace classe...')}</p></div>
    </section>`;
  }

  async function currentUser() {
    const {data,error}=await client.auth.getUser();
    if(error) throw error;
    return data.user || null;
  }
  async function profileFor(user) {
    const {data,error}=await client.from('profiles').select('id,display_name,role').eq('id',user.id).single();
    if(error) throw error;
    return data;
  }
  function downloadClassReport(report) {
    if (!report) return;
    const rows = [
      [tr('المؤشر','Indicateur'),tr('القيمة','Valeur')],
      [tr('عدد التلاميذ','Nombre d’élèves'),report.studentCount],
      [tr('مجموع الدروس المكتملة','Total des leçons terminées'),report.lessonTotal],
      [tr('متوسط نتائج التلاميذ المسجلين (%)','Moyenne des résultats des élèves inscrits (%)'),report.quizAverage],
      [tr('إجابات الواجبات الفريدة المستلمة','Soumissions de devoirs uniques reçues'),report.uniqueSubmissionCount],
      [tr('إجمالي فرص التسليم','Nombre total de remises attendues'),report.expectedSubmissionCount],
      [tr('معدل التسليم (%)','Taux de remise (%)'),report.submissionRate],
      [tr('واجبات متأخرة غير مسلمة','Devoirs en retard non remis'),report.overdueMissingCount],
      [tr('تاريخ التصدير','Date d’export'),new Date().toLocaleString(ar()?'ar-MA':'fr-FR')]
    ];
    const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value==null?'':value).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download='go-svt-rapport-classe-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function notice(text, bad) {
    const el=document.querySelector('#gs-classroom .gs-cl-msg');
    if(el){el.textContent=text;el.style.color=bad?'#b42318':'#2b7135';}
  }
  function mount() {
    const root=document.getElementById(rootId);
    const account=window.StudentAccount;
    if(!root||!account||!account.isReady()||!account.isLoggedIn()) return;
    const p=account.getProfile();
    if(!p||!['student','teacher','admin'].includes(p.role)) return;
    if(root.querySelector('#gs-classroom')) return;
    root.insertAdjacentHTML('beforeend',panelShell(p.role));
    styles();
    load(p).catch(err=>{const el=document.getElementById('gs-cl-content');if(el)el.innerHTML=`<p class="gs-cl-msg">${esc(err.message||tr('تعذر تحميل القسم.','Impossible de charger la classe.'))}</p>`;});
  }

  async function load(profile) {
    const host=document.getElementById('gs-cl-content');
    if(!host)return;
    const user=await currentUser();
    if(!user)return;
    if(profile.role==='teacher'||profile.role==='admin') await loadTeacher(host,user,profile);
    else await loadStudent(host,user);
  }

  async function loadStudent(host,user) {
    const {data:links,error}=await client.rpc('gosvt_student_classes');
    if(error) throw error;
    const classes=(links||[]).map(x=>({id:x.class_id,name:x.class_name,study_level:x.study_level,study_track:x.study_track}));
    host.innerHTML=`
      <div class="gs-cl-grid">
        <div class="gs-cl-card"><h3>${tr('الانضمام إلى قسم','Rejoindre une classe')}</h3><p class="gs-cl-muted">${tr('أدخل رمز القسم الذي يمنحك إياه الأستاذ.','Saisissez le code fourni par votre enseignant.')}</p><label for="gs-cl-code">${tr('رمز الانضمام','Code de classe')}</label><input id="gs-cl-code" maxlength="10" autocomplete="off" placeholder="XXXXXXXXXX"><button type="button" data-action="join">${tr('الانضمام','Rejoindre')}</button></div>
        <div class="gs-cl-card"><h3>${tr('أقسامك','Mes classes')}</h3><div class="gs-cl-list">${classes.length?classes.map(c=>`<div class="gs-cl-row"><strong>${esc(c.name)}</strong><p class="gs-cl-muted">${esc(c.study_level)} · ${esc(c.study_track)}</p></div>`).join(''):`<p class="gs-cl-muted">${tr('لم تنضم إلى أي قسم بعد.','Vous n’avez rejoint aucune classe.')}</p>`}</div></div>
      </div>
      <div class="gs-cl-card" style="margin-top:1rem"><h3>${tr('💬 اسأل أستاذك','💬 Poser une question')}</h3><label for="gs-cl-question-class">${tr('القسم','Classe')}</label><select id="gs-cl-question-class">${classes.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><label for="gs-cl-question-title">${tr('موضوع السؤال','Sujet de la question')}</label><input id="gs-cl-question-title" maxlength="180" placeholder="${tr('مثلاً: صعوبة في درس المناعة','Ex. : difficulté sur l’immunité')}"><label for="gs-cl-question-body">${tr('اكتب سؤالك','Votre question')}</label><textarea id="gs-cl-question-body" maxlength="8000"></textarea><button type="button" data-action="ask" ${classes.length?'':'disabled'}>${tr('إرسال السؤال','Envoyer la question')}</button><p class="gs-cl-msg" role="status" aria-live="polite"></p></div>
      <div class="gs-cl-card" style="margin-top:1rem"><h3>${tr('أسئلتي ومناقشاتي','Mes questions et échanges')}</h3><div id="gs-cl-my-questions" class="gs-cl-list"><p class="gs-cl-muted">${tr('جارٍ التحميل...','Chargement...')}</p></div></div>`;
    const {data:questions,error:qerr}=await client.from('teacher_questions').select('id,subject,body,status,created_at,class_id').eq('student_id',user.id).order('created_at',{ascending:false}).limit(40);
    if(qerr) throw qerr;
    const qhost=document.getElementById('gs-cl-my-questions');
    if(qhost)qhost.innerHTML=(questions||[]).length?(questions||[]).map(q=>`<article class="gs-cl-row"><strong>${esc(q.subject)}</strong><p>${esc(q.body)}</p><p class="gs-cl-muted">${esc(q.status)} · ${new Date(q.created_at).toLocaleString()}</p><button class="gs-cl-secondary" type="button" data-action="thread" data-id="${esc(q.id)}">${tr('فتح المحادثة','Ouvrir la discussion')}</button><div id="gs-cl-thread-${esc(q.id)}"></div></article>`).join(''):`<p class="gs-cl-muted">${tr('لم ترسل أي سؤال بعد.','Vous n’avez pas encore envoyé de question.')}</p>`;
    const work=document.createElement('div');work.id='gs-cl-student-work';work.innerHTML='<div class="gs-cl-card" style="margin-top:1rem"><h3>'+tr('📚 واجباتي','📚 Mes devoirs')+'</h3><div id="gs-cl-student-assignments" class="gs-cl-list"></div></div><div class="gs-cl-grid" style="margin-top:1rem"><div class="gs-cl-card"><h3>'+tr('📢 إعلانات الأقسام','📢 Annonces')+'</h3><div id="gs-cl-student-announcements" class="gs-cl-list"></div></div><div class="gs-cl-card"><h3>'+tr('🗓️ حصص المراجعة','🗓️ Séances de révision')+'</h3><div id="gs-cl-student-sessions" class="gs-cl-list"></div></div></div>';
    host.appendChild(work);
    await loadStudentExtras(classes,user);
  }

  async function loadTeacher(host,user,profile) {
    let query=client.from('teacher_classes').select('id,name,study_level,study_track,join_code,created_at').order('created_at',{ascending:false});
    if(profile.role!=='admin')query=query.eq('teacher_id',user.id);
    const {data:classes,error}=await query;
    if(error)throw error;
    host.innerHTML=`
      <div class="gs-cl-grid">
        <div class="gs-cl-card"><h3>${tr('إنشاء قسم جديد','Créer une classe')}</h3><label for="gs-cl-name">${tr('اسم القسم','Nom de la classe')}</label><input id="gs-cl-name" maxlength="120" placeholder="${tr('مثلاً: الثانية باكالوريا SVT','Ex. : 2e Bac SVT')}"><label for="gs-cl-level">${tr('المستوى','Niveau')}</label><select id="gs-cl-level"><option value="TC">TC</option><option value="1BAC">1BAC</option><option value="2BAC">2BAC</option></select><label for="gs-cl-track">${tr('المسلك','Filière')}</label><select id="gs-cl-track"></select><button type="button" data-action="create-class">${tr('إنشاء القسم','Créer la classe')}</button></div>
        <div class="gs-cl-card"><h3>${tr('أقسامك ورموز الانضمام','Classes et codes d’accès')}</h3><div class="gs-cl-list" id="gs-cl-classes">${classes.length?classes.map(c=>`<article class="gs-cl-row"><strong>${esc(c.name)}</strong><p class="gs-cl-muted">${esc(c.study_level)} · ${esc(c.study_track)}</p><p><strong>${tr('رمز الانضمام','Code')}: ${esc(c.join_code)}</strong></p><button type="button" class="gs-cl-secondary" data-action="roster" data-id="${esc(c.id)}">${tr('عرض التلاميذ','Voir les élèves')}</button></article>`).join(''):`<p class="gs-cl-muted">${tr('لا توجد أقسام بعد.','Aucune classe pour le moment.')}</p>`}</div></div>
      </div>
      <div class="gs-cl-card" style="margin-top:1rem"><h3>🔔 ${tr('تنبيهات المتابعة','Alertes de suivi')}</h3><div id="gs-cl-alerts" class="gs-cl-grid"><p class="gs-cl-muted">${tr('جارٍ إعداد التنبيهات...','Préparation des alertes...')}</p></div></div>
      <div class="gs-cl-card" style="margin-top:1rem"><h3>${tr('📨 أسئلة التلاميذ','📨 Questions des élèves')}</h3><div id="gs-cl-inbox" class="gs-cl-list"><p class="gs-cl-muted">${tr('جارٍ التحميل...','Chargement...')}</p></div></div>
      <div class="gs-cl-card" style="margin-top:1rem"><h3>${tr('👥 ملف القسم','👥 Tableau de classe')}</h3><div id="gs-cl-roster"><p class="gs-cl-muted">${tr('اختر قسماً لعرض التلاميذ والمؤشرات الدراسية.','Choisissez une classe pour afficher les élèves et les indicateurs.')}</p></div></div>
      <p class="gs-cl-msg" role="status" aria-live="polite"></p>`;
    const level=document.getElementById('gs-cl-level'),track=document.getElementById('gs-cl-track');
    function fillTracks(){track.innerHTML=(tracks[level.value]||[]).map(x=>`<option value="${x[0]}">${esc(x[0])} — ${esc(x[1])}</option>`).join('');}
    level.addEventListener('change',fillTracks);fillTracks();
    const ids=(classes||[]).map(c=>c.id);
    if(ids.length){
      const alertHost=document.getElementById('gs-cl-alerts');
      const today=new Date().toISOString();
      const [pendingQuestions,lateAssignments,latePlans]=await Promise.all([
        client.from('teacher_questions').select('id',{count:'exact',head:true}).in('class_id',ids).neq('status','answered'),
        client.from('teacher_assignments').select('id',{count:'exact',head:true}).in('class_id',ids).not('due_at','is',null).lt('due_at',today),
        client.from('teacher_student_support_plans').select('id',{count:'exact',head:true}).in('class_id',ids).not('due_at','is',null).lt('due_at',today).neq('status','completed')
      ]);
      if(pendingQuestions.error)throw pendingQuestions.error;
      if(lateAssignments.error)throw lateAssignments.error;
      if(latePlans.error)throw latePlans.error;
      if(alertHost){
        const cards=[
          {n:pendingQuestions.count||0,t:tr('أسئلة تنتظر جوابك','Questions en attente'),d:tr('أسئلة التلاميذ التي لم تتم الإجابة عنها','Questions des élèves sans réponse')},
          {n:lateAssignments.count||0,t:tr('واجبات تجاوزت آخر أجل','Devoirs après échéance'),d:tr('واجبات تجاوز تاريخ تسليمها','Devoirs dont la date limite est dépassée')},
          {n:latePlans.count||0,t:tr('خطط دعم تحتاج إلى مراجعة','Plans de soutien à revoir'),d:tr('خطط لم تكتمل وتجاوزت تاريخ المراجعة','Plans non terminés dont la date de révision est dépassée')}
        ];
        const priorities=[
          {n:pendingQuestions.count||0,level:1,t:tr('أجب عن أسئلة التلاميذ أولاً','Répondre d’abord aux questions des élèves'),d:tr('توجد أسئلة تنتظر إجابتك.','Des questions attendent votre réponse.'),href:'#gs-cl-inbox',cta:tr('فتح صندوق الأسئلة','Ouvrir la boîte de réception')},
          {n:latePlans.count||0,level:2,t:tr('راجع خطط الدعم المتأخرة','Réviser les plans de soutien en retard'),d:tr('تحقق من الخطط غير المكتملة وحدد الإجراء التالي.','Vérifiez les plans incomplets et définissez la prochaine action.'),href:'#gs-cl-classes',cta:tr('مراجعة الأقسام','Examiner les classes')},
          {n:lateAssignments.count||0,level:3,t:tr('تابع الواجبات المتأخرة','Suivre les devoirs en retard'),d:tr('تحقق من التسليمات الناقصة في أقسامك.','Vérifiez les remises manquantes dans vos classes.'),href:'#gs-cl-classes',cta:tr('مراجعة الأقسام','Examiner les classes')}
        ].filter(x=>x.n>0).sort((a,b)=>a.level-b.level);
        alertHost.innerHTML=cards.map(x=>'<article class="gs-cl-row"><strong style="font-size:1.5rem">'+x.n+'</strong><p><strong>'+x.t+'</strong></p><small class="gs-cl-muted">'+x.d+'</small></article>').join('')+
          '<section class="gs-cl-row" style="grid-column:1/-1"><h4>'+tr('أولوياتك اليوم','Vos priorités du jour')+'</h4>'+
          (priorities.length?'<ol>'+priorities.map(x=>'<li style="margin:.5rem 0"><strong>'+x.t+'</strong> — '+x.n+'<p class="gs-cl-muted">'+x.d+'</p><a class="gs-cl-secondary" href="'+x.href+'">'+x.cta+'</a></li>').join('')+'</ol>':'<p class="gs-cl-muted">'+tr('لا توجد مهام عاجلة حسب المؤشرات الحالية. أحسنت!','Aucune tâche urgente selon les indicateurs actuels. Bravo !')+'</p>')+
          '</section>';
      }

      const {data:questions,error:qerr}=await client.from('teacher_questions').select('id,class_id,student_id,subject,body,status,created_at').in('class_id',ids).order('created_at',{ascending:false}).limit(60);
      if(qerr)throw qerr;
      const inbox=document.getElementById('gs-cl-inbox');
      if(inbox){
        const openCount=(questions||[]).filter(q=>q.status!=='answered').length;
        const answeredCount=(questions||[]).filter(q=>q.status==='answered').length;
        inbox.innerHTML='<div class="gs-cl-head" role="group" aria-label="'+tr('تصفية الأسئلة','Filtrer les questions')+'">'+
          '<button type="button" class="gs-cl-secondary" data-action="filter-inbox" data-filter="open" aria-pressed="'+(inboxFilter==='open')+'">'+tr('تحتاج إلى جواب','À traiter')+' ('+openCount+')</button>'+
          '<button type="button" class="gs-cl-secondary" data-action="filter-inbox" data-filter="answered" aria-pressed="'+(inboxFilter==='answered')+'">'+tr('تمت الإجابة','Répondues')+' ('+answeredCount+')</button>'+
          '<button type="button" class="gs-cl-secondary" data-action="filter-inbox" data-filter="all" aria-pressed="'+(inboxFilter==='all')+'">'+tr('كل الأسئلة','Toutes')+' ('+(questions||[]).length+')</button></div>'+
          ((questions||[]).filter(q=>inboxFilter==='all'||(inboxFilter==='answered'?q.status==='answered':q.status!=='answered')).length
            ? (questions||[]).filter(q=>inboxFilter==='all'||(inboxFilter==='answered'?q.status==='answered':q.status!=='answered')).map(q=>`<article class="gs-cl-row"><strong>${esc(q.subject)}</strong><p>${esc(q.body)}</p><p class="gs-cl-muted">${q.status==='answered'?tr('تمت الإجابة','Répondu') : tr('ينتظر جواب الأستاذ','En attente de réponse')} · ${new Date(q.created_at).toLocaleString()}</p><button type="button" data-action="thread" data-id="${esc(q.id)}">${q.status==='answered'?tr('فتح المحادثة','Ouvrir la discussion'):tr('الإجابة عن السؤال','Répondre')}</button><div id="gs-cl-thread-${esc(q.id)}"></div></article>`).join('')
            : '<p class="gs-cl-muted">'+(inboxFilter==='answered'?tr('لا توجد أسئلة تمت الإجابة عنها بعد.','Aucune question répondue pour le moment.'):inboxFilter==='open'?tr('أحسنت! لا توجد أسئلة تنتظر الإجابة.','Aucune question en attente.'):tr('لا توجد أسئلة واردة حالياً.','Aucune question reçue.'))+'</p>');
      }
    } else {
      const inbox=document.getElementById('gs-cl-inbox');if(inbox)inbox.innerHTML=`<p class="gs-cl-muted">${tr('أنشئ قسماً أولاً لاستقبال الأسئلة.','Créez une classe pour recevoir des questions.')}</p>`;
    }
    const work=document.createElement('div');work.id='gs-cl-teacher-work';work.style.marginTop='1rem';host.appendChild(work);
    await loadTeacherExtras(classes,user);
  }


  function safeHttpUrl(value) {
    try { const u=new URL(String(value||''),window.location.origin); return /^https?:$/.test(u.protocol)?u.href:''; }
    catch (_) { return ''; }
  }
  function safeLink(value,label) {
    const url=safeHttpUrl(value);
    return url ? '<p><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a></p>' : '';
  }
  async function loadStudentExtras(classes,user) {
    const ids=classes.map(c=>c.id);
    const host=document.getElementById('gs-cl-student-work');
    if(!host)return;
    if(!ids.length){host.innerHTML='<p class="gs-cl-muted">'+tr('انضم إلى قسم لعرض واجباته وإعلاناته وحصصه.','Rejoignez une classe pour voir ses devoirs, annonces et séances.')+'</p>';return;}
    const [ar,ann,ses]=await Promise.all([
      client.from('teacher_assignments').select('id,class_id,title,instructions,resource_url,due_at,created_at').in('class_id',ids).order('created_at',{ascending:false}).limit(60),
      client.from('teacher_announcements').select('id,class_id,title,body,created_at').in('class_id',ids).order('created_at',{ascending:false}).limit(40),
      client.from('teacher_review_sessions').select('id,class_id,title,description,starts_at,meeting_url').in('class_id',ids).order('starts_at',{ascending:true}).limit(40)
    ]);
    if(ar.error)throw ar.error;if(ann.error)throw ann.error;if(ses.error)throw ses.error;
    const assignments=ar.data||[];
    const sub=assignments.length?await client.from('teacher_assignment_submissions').select('id,assignment_id,answer,score,feedback,submitted_at,reviewed_at').eq('student_id',user.id).in('assignment_id',assignments.map(a=>a.id)): {data:[],error:null};
    if(sub.error)throw sub.error;
    const byId=new Map((sub.data||[]).map(x=>[x.assignment_id,x]));
    const aHost=document.getElementById('gs-cl-student-assignments');
    if(aHost)aHost.innerHTML=assignments.length?assignments.map(a=>{
      const x=byId.get(a.id),due=a.due_at?new Date(a.due_at).toLocaleString():'—';
      return '<article class="gs-cl-row"><strong>'+esc(a.title)+'</strong><p>'+esc(a.instructions||'')+'</p><p class="gs-cl-muted">'+tr('آخر أجل','Échéance')+': '+esc(due)+'</p>'+safeLink(a.resource_url,tr('فتح المورد المرفق','Ouvrir la ressource'))+(x?'<p class="gs-cl-muted">'+tr('تم إرسال إجابتك','Réponse envoyée')+' · '+esc(new Date(x.submitted_at).toLocaleString())+'</p><p>'+tr('النقطة','Note')+': <strong>'+(x.score==null?'—':esc(x.score)+'/20')+'</strong></p><p>'+esc(x.feedback||tr('لم يضف الأستاذ ملاحظته بعد.','Aucun commentaire pour le moment.'))+'</p><details><summary>'+tr('عرض إجابتي','Voir ma réponse')+'</summary><p>'+esc(x.answer)+'</p></details>':'<label>'+tr('إجابتك','Votre réponse')+'</label><textarea data-answer-for="'+esc(a.id)+'" maxlength="12000"></textarea><button type="button" data-action="submit-assignment" data-id="'+esc(a.id)+'">'+tr('إرسال الإجابة','Envoyer la réponse')+'</button>')+'</article>';
    }).join(''):'<p class="gs-cl-muted">'+tr('لا توجد واجبات منشورة حالياً.','Aucun devoir publié pour le moment.')+'</p>';
    const nHost=document.getElementById('gs-cl-student-announcements');
    if(nHost)nHost.innerHTML=(ann.data||[]).length?ann.data.map(x=>'<article class="gs-cl-row"><strong>'+esc(x.title)+'</strong><p>'+esc(x.body)+'</p><small class="gs-cl-muted">'+esc(new Date(x.created_at).toLocaleString())+'</small></article>').join(''):'<p class="gs-cl-muted">'+tr('لا توجد إعلانات.','Aucune annonce.')+'</p>';
    const sHost=document.getElementById('gs-cl-student-sessions');
    if(sHost)sHost.innerHTML=(ses.data||[]).length?ses.data.map(x=>'<article class="gs-cl-row"><strong>'+esc(x.title)+'</strong><p>'+esc(x.description||'')+'</p><p class="gs-cl-muted">'+esc(new Date(x.starts_at).toLocaleString())+'</p>'+safeLink(x.meeting_url,tr('الانضمام إلى الحصة','Rejoindre la séance'))+'</article>').join(''):'<p class="gs-cl-muted">'+tr('لا توجد حصص مبرمجة.','Aucune séance programmée.')+'</p>';
  }
  async function loadTeacherExtras(classes,user) {
    const host=document.getElementById('gs-cl-teacher-work');
    if(!host)return;
    const ids=classes.map(c=>c.id);
    if(!ids.length){host.innerHTML='<p class="gs-cl-muted">'+tr('أنشئ قسماً أولاً لنشر الواجبات والإعلانات والحصص.','Créez une classe pour publier devoirs, annonces et séances.')+'</p>';return;}
    const opts=classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
    host.innerHTML='<div class="gs-cl-grid">'+
      '<div class="gs-cl-card"><h3>'+tr('📝 نشر واجب','📝 Publier un devoir')+'</h3><label>'+tr('القسم','Classe')+'</label><select id="gs-cl-assignment-class">'+opts+'</select><label>'+tr('عنوان الواجب','Titre')+'</label><input id="gs-cl-assignment-title" maxlength="180"><label>'+tr('التعليمات','Consignes')+'</label><textarea id="gs-cl-assignment-instructions" maxlength="8000"></textarea><label>'+tr('رابط المورد (اختياري)','Lien ressource (facultatif)')+'</label><input id="gs-cl-assignment-url" type="url" placeholder="https://..."><label>'+tr('آخر أجل (اختياري)','Échéance (facultatif)')+'</label><input id="gs-cl-assignment-due" type="datetime-local"><button type="button" data-action="create-assignment">'+tr('نشر الواجب','Publier')+'</button></div>'+
      '<div class="gs-cl-card"><h3>'+tr('📢 نشر إعلان','📢 Publier une annonce')+'</h3><label>'+tr('القسم','Classe')+'</label><select id="gs-cl-announcement-class">'+opts+'</select><label>'+tr('العنوان','Titre')+'</label><input id="gs-cl-announcement-title" maxlength="180"><label>'+tr('نص الإعلان','Message')+'</label><textarea id="gs-cl-announcement-body" maxlength="8000"></textarea><button type="button" data-action="create-announcement">'+tr('نشر الإعلان','Publier')+'</button></div>'+
      '<div class="gs-cl-card"><h3>'+tr('📅 برمجة حصة مراجعة','📅 Programmer une séance')+'</h3><label>'+tr('القسم','Classe')+'</label><select id="gs-cl-session-class">'+opts+'</select><label>'+tr('عنوان الحصة','Titre')+'</label><input id="gs-cl-session-title" maxlength="180"><label>'+tr('الوصف','Description')+'</label><textarea id="gs-cl-session-description" maxlength="5000"></textarea><label>'+tr('التاريخ والوقت','Date et heure')+'</label><input id="gs-cl-session-start" type="datetime-local"><label>'+tr('رابط اللقاء (اختياري)','Lien de réunion (facultatif)')+'</label><input id="gs-cl-session-url" type="url" placeholder="https://..."><button type="button" data-action="create-session">'+tr('برمجة الحصة','Programmer')+'</button></div></div>'+
      '<div class="gs-cl-card" style="margin-top:1rem"><h3>'+tr('📥 إجابات التلاميذ والتصحيح','📥 Réponses et correction')+'</h3><div id="gs-cl-submissions" class="gs-cl-list">'+tr('جارٍ تحميل الإجابات...','Chargement des réponses...')+'</div></div>';
    const a=await client.from('teacher_assignments').select('id,title,class_id').in('class_id',ids).order('created_at',{ascending:false}).limit(60);
    if(a.error)throw a.error;
    const subHost=document.getElementById('gs-cl-submissions');
    if(!a.data.length){if(subHost)subHost.innerHTML='<p class="gs-cl-muted">'+tr('لم تنشر واجبات بعد.','Aucun devoir publié.')+'</p>';return;}
    const submissions=await client.from('teacher_assignment_submissions').select('id,assignment_id,student_id,answer,score,feedback,submitted_at').in('assignment_id',a.data.map(x=>x.id)).order('submitted_at',{ascending:false}).limit(150);
    if(submissions.error)throw submissions.error;
    const titles=new Map(a.data.map(x=>[x.id,x.title]));
    if(subHost)subHost.innerHTML=(submissions.data||[]).length?submissions.data.map(x=>'<article class="gs-cl-row"><strong>'+esc(titles.get(x.assignment_id)||tr('واجب','Devoir'))+'</strong><p class="gs-cl-muted">'+tr('معرّف التلميذ','ID élève')+': '+esc(x.student_id.slice(0,8))+' · '+esc(new Date(x.submitted_at).toLocaleString())+'</p><details><summary>'+tr('عرض الإجابة','Voir la réponse')+'</summary><p>'+esc(x.answer)+'</p></details><label>'+tr('النقطة من 20','Note sur 20')+'</label><input type="number" min="0" max="20" step="0.25" data-score-for="'+esc(x.id)+'" value="'+(x.score==null?'':esc(x.score))+'"><label>'+tr('ملاحظات التصحيح','Commentaire')+'</label><textarea data-feedback-for="'+esc(x.id)+'" maxlength="5000">'+esc(x.feedback||'')+'</textarea><button type="button" data-action="grade-submission" data-id="'+esc(x.id)+'">'+tr('حفظ التصحيح','Enregistrer la correction')+'</button></article>').join(''):'<p class="gs-cl-muted">'+tr('لم يتوصل القسم بإجابات بعد.','Aucune réponse reçue pour le moment.')+'</p>';
  }

  async function renderThread(id) {
    const host=document.getElementById('gs-cl-thread-'+id);if(!host)return;
    const {data:messages,error}=await client.from('teacher_question_messages').select('id,sender_id,body,created_at').eq('question_id',id).order('created_at',{ascending:true});
    if(error)throw error;
    const user=await currentUser();
    host.innerHTML=`<div class="gs-cl-thread">${(messages||[]).map(m=>`<div class="gs-cl-bubble"><small>${m.sender_id===user.id?tr('أنت','Vous'):tr('الطرف الآخر','Votre correspondant')} · ${new Date(m.created_at).toLocaleString()}</small>${esc(m.body)}</div>`).join('')}</div><label>${tr('اكتب رداً','Écrire une réponse')}</label><textarea data-reply-for="${esc(id)}" maxlength="8000"></textarea><button type="button" data-action="reply" data-id="${esc(id)}">${tr('إرسال الرد','Envoyer la réponse')}</button>`;
  }

  function profileForNotePermission(note,user){
    const profile=window.StudentAccount&&window.StudentAccount.getProfile?window.StudentAccount.getProfile():null;
    return !!(profile&&(profile.role==='admin'||note.teacher_id===user.id));
  }

  async function act(button) {
    if(busy)return;
    const action=button.dataset.action, id=button.dataset.id;
    busy=true;button.disabled=true;
    try {
      const user=await currentUser();if(!user)throw new Error(tr('يرجى تسجيل الدخول.','Veuillez vous connecter.'));
      if(action==='join'){
        const code=document.getElementById('gs-cl-code').value.trim();
        const {error}=await client.rpc('gosvt_join_teacher_class',{p_join_code:code});if(error)throw error;
        notice(tr('تم الانضمام إلى القسم بنجاح.','Vous avez rejoint la classe.'));
        await refreshPanel();
      } else if(action==='ask'){
        const classId=document.getElementById('gs-cl-question-class').value;
        const subject=document.getElementById('gs-cl-question-title').value.trim();
        const body=document.getElementById('gs-cl-question-body').value.trim();
        const {error}=await client.from('teacher_questions').insert({class_id:classId,student_id:user.id,subject,body});
        if(error)throw error;
        notice(tr('تم إرسال سؤالك إلى الأستاذ.','Votre question a été envoyée.'));
        await refreshPanel();
      } else if(action==='create-class'){
        const name=document.getElementById('gs-cl-name').value.trim();
        const study_level=document.getElementById('gs-cl-level').value;
        const study_track=document.getElementById('gs-cl-track').value;
        const {error}=await client.from('teacher_classes').insert({teacher_id:user.id,name,study_level,study_track});
        if(error)throw error;
        await refreshPanel();
      } else if(action==='roster'){
        const {data,error}=await client.rpc('gosvt_teacher_class_roster',{p_class_id:id});if(error)throw error;
        const host=document.getElementById('gs-cl-roster');
        const students=data||[];
        window.__gosvtTeacherRoster=students;
        const assignmentsResult=await client.from('teacher_assignments').select('id,title,due_at').eq('class_id',id);
        if(assignmentsResult.error)throw assignmentsResult.error;
        const assignmentIds=(assignmentsResult.data||[]).map(a=>a.id);
        const submissionsResult=assignmentIds.length
          ? await client.from('teacher_assignment_submissions').select('assignment_id,student_id,submitted_at,score').in('assignment_id',assignmentIds)
          : {data:[],error:null};
        if(submissionsResult.error)throw submissionsResult.error;
        const submissions=submissionsResult.data||[];
        const submittedByStudent=new Map();
        const submittedPairs=new Set();
        submissions.forEach(x=>{
          const pair=x.student_id+':'+x.assignment_id;
          if(submittedPairs.has(pair))return;
          submittedPairs.add(pair);
          submittedByStudent.set(x.student_id,(submittedByStudent.get(x.student_id)||0)+1);
        });
        const now=Date.now();
        const overdueAssignments=(assignmentsResult.data||[]).filter(a=>a.due_at&&new Date(a.due_at).getTime()<now);
        const overdueByStudent=new Map();
        students.forEach(s=>{const missing=overdueAssignments.filter(a=>!submittedPairs.has(s.student_id+':'+a.id)).length;overdueByStudent.set(s.student_id,missing);});
        const totalLessons=students.reduce((n,s)=>n+(Number(s.completed_lessons)||0),0);
        const quizAverages=students.filter(s=>s.average_score!=null).map(s=>Number(s.average_score));
        const classAverage=quizAverages.length?(quizAverages.reduce((a,b)=>a+b,0)/quizAverages.length).toFixed(1):'—';
        const submissionRate=students.length&&assignmentIds.length
          ? Math.min(100,Math.round((submittedPairs.size/(students.length*assignmentIds.length))*100)):null;
        const overdueMissingCount=Array.from(overdueByStudent.values()).reduce((sum,value)=>sum+value,0);
        const followUpCount=students.filter(s=>{
          const overdue=overdueByStudent.get(s.student_id)||0;
          return overdue>0||(s.average_score!=null&&Number(s.average_score)<50)||(Number(s.completed_lessons)||0)===0;
        }).length;
        lastClassReport=students.length?{
          studentCount:students.length,lessonTotal,totalQuizAverage:classAverage,
          quizAverage:classAverage,uniqueSubmissionCount:submittedPairs.size,
          expectedSubmissionCount:students.length*assignmentIds.length,
          submissionRate:submissionRate===null?'—':submissionRate,
          overdueMissingCount
        }:null;
        if(host)host.innerHTML=students.length
          ? '<div class="gs-cl-head"><strong>'+tr('ملخص القسم','Résumé de la classe')+'</strong><button type="button" class="gs-cl-secondary" data-action="export-class-report">'+tr('تصدير تقرير CSV','Exporter le rapport CSV')+'</button></div><div class="gs-cl-grid" style="margin-bottom:1rem">'+
            '<div class="gs-cl-row"><strong>'+students.length+'</strong><p class="gs-cl-muted">'+tr('تلميذاً في القسم','élèves dans la classe')+'</p></div>'+
            '<div class="gs-cl-row"><strong>'+totalLessons+'</strong><p class="gs-cl-muted">'+tr('درساً مكتملاً','leçons terminées')+'</p></div>'+
            '<div class="gs-cl-row"><strong>'+classAverage+(classAverage==='—'?'':'%')+'</strong><p class="gs-cl-muted">'+tr('متوسط نتائج التلاميذ المسجلين','moyenne des élèves inscrits')+'</p></div>'+
            '<div class="gs-cl-row"><strong>'+submittedPairs.size+'</strong><p class="gs-cl-muted">'+tr('إجابة واجب فريدة مستلمة','réponses uniques reçues')+'</p></div>'+
            '<div class="gs-cl-row"><strong>'+followUpCount+'</strong><p class="gs-cl-muted">'+tr('تلاميذ مقترح تتبعهم','élèves à suivre')+'</p></div>'+
            '</div>'+
            (submissionRate===null?'':'<p class="gs-cl-muted">'+tr('معدل تسليم الواجبات','Taux de remise')+': '+submissionRate+'%</p>')+
            students.map(s=>{
              const submitted=submittedByStudent.get(s.student_id)||0;
              const overdue=overdueByStudent.get(s.student_id)||0;
              const assignmentProgress=assignmentIds.length?Math.round(submitted/assignmentIds.length*100):null;
              const reasons=[];
              if(overdue>0)reasons.push(tr('واجبات متأخرة غير مسلمة: '+overdue,'Devoirs en retard non remis : '+overdue));
              if(s.average_score!=null&&Number(s.average_score)<50)reasons.push(tr('متوسط النتائج أقل من 50%','Moyenne des résultats inférieure à 50 %'));
              if((Number(s.completed_lessons)||0)===0)reasons.push(tr('لم يسجل دروساً مكتملة بعد','Aucune leçon terminée enregistrée'));
              const needsFollowUp=reasons.length>0;
              return '<article class="gs-cl-row"><strong>'+esc(s.display_name)+'</strong>'+(needsFollowUp?'<p class="gs-cl-muted">'+tr('متابعة تربوية مقترحة','Suivi pédagogique suggéré')+'</p><ul>'+reasons.map(reason=>'<li>'+esc(reason)+'</li>').join('')+'</ul>':'')+
                '<p class="gs-cl-muted">'+esc(s.study_level||'')+' · '+esc(s.study_track||'')+' · '+tr('تاريخ الانضمام','Inscrit le')+' '+(s.joined_at?esc(new Date(s.joined_at).toLocaleDateString(ar()?'ar-MA':'fr-FR')):'—')+'</p>'+
                '<p>'+tr('الدروس المكتملة','Leçons terminées')+': <strong>'+(Number(s.completed_lessons)||0)+'</strong> · '+tr('محاولات الاختبار','Tentatives')+': <strong>'+(Number(s.quiz_attempts)||0)+'</strong> · '+tr('متوسط النتائج','Moyenne')+': <strong>'+(s.average_score==null?'—':esc(s.average_score)+'%')+'</strong></p>'+
                '<p class="gs-cl-muted">'+tr('الواجبات المسلمة','Devoirs remis')+': '+submitted+'/'+assignmentIds.length+(assignmentProgress===null?'':' · '+assignmentProgress+'%')+'</p>'+(overdue?'<p class="gs-cl-muted">'+tr('واجبات متأخرة غير مسلمة','Devoirs en retard non remis')+': '+overdue+'</p>':'')+'<div class="gs-cl-head"><button type="button" class="gs-cl-secondary" data-action="student-notes" data-id="'+esc(s.student_id)+'" data-class-id="'+esc(id)+'" data-name="'+esc(s.display_name)+'">'+tr('ملاحظات الأستاذ الخاصة','Notes pédagogiques privées')+'</button><button type="button" class="gs-cl-secondary" data-action="open-support-plan" data-id="'+esc(s.student_id)+'" data-class-id="'+esc(id)+'" data-name="'+esc(s.display_name)+'">'+tr('خطة الدعم الفردية','Plan de soutien individuel')+'</button><button type="button" class="gs-cl-secondary" data-action="student-report" data-id="'+esc(s.student_id)+'" data-class-id="'+esc(id)+'" data-name="'+esc(s.display_name)+'">'+tr('التقرير التربوي','Rapport pédagogique')+'</button></div><div id="gs-cl-notes-'+esc(s.student_id)+'"></div><div id="gs-cl-support-'+esc(s.student_id)+'"></div><div id="gs-cl-report-'+esc(s.student_id)+'"></div></article>';
            }).join('')
          : '<p class="gs-cl-muted">'+tr('لا يوجد تلاميذ في هذا القسم بعد.','Aucun élève dans cette classe.')+'</p>';
      } else if(action==='student-report'){
        const classId=button.dataset.classId,studentId=id;
        const host=document.getElementById('gs-cl-report-'+studentId);
        if(!host)throw new Error(tr('تعذر فتح التقرير التربوي.','Impossible d’ouvrir le rapport pédagogique.'));
        const [notesResult,plansResult,trendResult]=await Promise.all([
          client.from('teacher_student_notes').select('note,note_type,created_at').eq('class_id',classId).eq('student_id',studentId).order('created_at',{ascending:false}).limit(50),
          client.from('teacher_student_support_plans').select('title,status,due_at,created_at').eq('class_id',classId).eq('student_id',studentId).order('created_at',{ascending:false}).limit(20),
          client.rpc('gosvt_teacher_student_quiz_trend',{p_class_id:classId,p_student_id:studentId})
        ]);
        if(notesResult.error)throw notesResult.error;
        if(plansResult.error)throw plansResult.error;
        if(trendResult.error)throw trendResult.error;
        const notes=notesResult.data||[],plans=plansResult.data||[],trend=trendResult.data||[];
        const categories=['understanding','results','attendance','progress','other'];
        const categoryCounts=categories.map(type=>({type,count:notes.filter(n=>(n.note_type||'other')===type).length})).filter(x=>x.count);
        const categoryNames={understanding:tr('صعوبات الفهم','Difficultés de compréhension'),results:tr('ضعف النتائج','Résultats insuffisants'),attendance:tr('المواظبة والمشاركة','Assiduité et participation'),progress:tr('تقدم دراسي','Progrès scolaires'),other:tr('ملاحظات عامة','Notes générales')};
        const planCounts={planned:plans.filter(p=>p.status==='planned').length,in_progress:plans.filter(p=>p.status==='in_progress').length,completed:plans.filter(p=>p.status==='completed').length};
        const statusNames={planned:tr('مخططة','Planifiées'),in_progress:tr('قيد التنفيذ','En cours'),completed:tr('مكتملة','Terminées')};
        const timeline=[
          ...notes.map(n=>({date:n.created_at,title:tr('ملاحظة تربوية','Note pédagogique'),detail:categoryNames[n.note_type||'other']})),
          ...plans.map(p=>({date:p.created_at,title:tr('خطة دعم','Plan de soutien'),detail:(p.title||'')+' · '+(statusNames[p.status]||p.status)}))
        ].filter(x=>x.date).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
        const trendBars=trend.map(x=>({date:x.attempt_date,average:Number(x.average_percentage)||0,count:Number(x.attempt_count)||0,best:Number(x.best_percentage)||0}));
        const firstWindow=trendBars.slice(0,Math.min(3,trendBars.length)),lastWindow=trendBars.slice(-Math.min(3,trendBars.length));
        const meanWindow=arr=>arr.length?arr.reduce((sum,x)=>sum+x.average,0)/arr.length:null;
        const earlyAverage=meanWindow(firstWindow),recentAverage=meanWindow(lastWindow);
        const trendDelta=earlyAverage===null||recentAverage===null?null:Number((recentAverage-earlyAverage).toFixed(1));
        const latestPlan=plans.filter(p=>p.created_at).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
        const beforePlan=latestPlan?trendBars.filter(x=>new Date(x.date+'T23:59:59')<new Date(latestPlan.created_at)):[],afterPlan=latestPlan?trendBars.filter(x=>new Date(x.date+'T00:00:00')>=new Date(latestPlan.created_at)):[];
        const beforePlanAverage=meanWindow(beforePlan),afterPlanAverage=meanWindow(afterPlan);
        const trendHtml=trendBars.length
          ? '<div class="gs-cl-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin:.7rem 0">'+trendBars.map(x=>'<div class="gs-cl-row"><strong>'+x.average.toFixed(1)+'%</strong><div role="img" aria-label="'+tr('متوسط النتائج','Moyenne des résultats')+' '+x.average.toFixed(1)+'%" style="height:9px;background:var(--gs-cl-border,#ddd);border-radius:8px;overflow:hidden"><span style="display:block;width:'+Math.max(0,Math.min(100,x.average))+'%;height:100%;background:var(--gs-cl-accent,#27866b)"></span></div><small class="gs-cl-muted">'+esc(new Date(x.date+'T00:00:00').toLocaleDateString(ar()?'ar-MA':'fr-FR'))+' · '+x.count+' '+tr('محاولات','tentatives')+' · '+tr('أفضل','Meilleur')+' '+x.best+'%</small></div>').join('')+'</div>'
          : '<p class="gs-cl-muted">'+tr('لا تتوفر محاولات اختبار كافية لعرض التطور بعد.','Pas encore assez de tentatives pour afficher l’évolution.')+'</p>';
        const supportComparison=latestPlan
          ? '<p>'+tr('آخر خطة دعم: ','Dernier plan de soutien : ')+'<strong>'+esc(latestPlan.title)+'</strong> · '+esc(new Date(latestPlan.created_at).toLocaleDateString(ar()?'ar-MA':'fr-FR'))+'</p>'+
            (beforePlanAverage!==null&&afterPlanAverage!==null?'<p>'+tr('متوسط النتائج قبل الخطة: ','Moyenne avant le plan : ')+beforePlanAverage.toFixed(1)+'% · '+tr('بعد الخطة: ','après le plan : ')+afterPlanAverage.toFixed(1)+'% · '+tr('التغير: ','variation : ')+(afterPlanAverage-beforePlanAverage>0?'+':'')+(afterPlanAverage-beforePlanAverage).toFixed(1)+'%</p>':'<p class="gs-cl-muted">'+tr('نحتاج إلى محاولات قبل الخطة وبعدها للمقارنة.','Des tentatives avant et après le plan sont nécessaires pour comparer.')+'</p>')+
            '<small class="gs-cl-muted">'+tr('هذه مقارنة وصفية ولا تثبت أن الخطة وحدها سببت تغير النتائج.','Cette comparaison est descriptive et ne prouve pas que le plan a causé l’évolution des résultats.')+'</small>'
          : '<p class="gs-cl-muted">'+tr('أضف خطة دعم لمقارنة النتائج قبلها وبعدها لاحقاً.','Ajoutez un plan de soutien pour comparer les résultats avant et après ultérieurement.')+'</p>';
        const rosterStudent=(window.__gosvtTeacherRoster||[]).find(x=>x.student_id===studentId);
        host.innerHTML='<section class="gs-cl-card" style="margin-top:.7rem"><strong>'+tr('التقرير التربوي الفردي: ','Rapport pédagogique individuel : ')+esc(button.dataset.name)+'</strong><p>'+tr('الدروس المكتملة','Leçons terminées')+': <strong>'+(rosterStudent?Number(rosterStudent.completed_lessons)||0:'—')+'</strong> · '+tr('محاولات الاختبار','Tentatives de quiz')+': <strong>'+(rosterStudent?Number(rosterStudent.quiz_attempts)||0:'—')+'</strong> · '+tr('متوسط النتائج','Moyenne des résultats')+': <strong>'+(rosterStudent&&rosterStudent.average_score!=null?esc(rosterStudent.average_score)+'%':'—')+'</strong></p><h4>'+tr('تطور نتائج الاختبارات','Évolution des résultats aux quiz')+'</h4><p>'+tr('الفترات المعروضة','Périodes affichées')+': '+trendBars.length+' · '+tr('متوسط أول الفترات','Moyenne initiale')+': '+(earlyAverage===null?'—':earlyAverage.toFixed(1)+'%')+' · '+tr('متوسط أحدث الفترات','Moyenne récente')+': '+(recentAverage===null?'—':recentAverage.toFixed(1)+'%')+' · '+tr('التغير','Variation')+': '+(trendDelta===null?'—':(trendDelta>0?'+':'')+trendDelta+'%')+'</p>'+trendHtml+'<h4>'+tr('مقارنة النتائج بخطة الدعم','Résultats et plan de soutien')+'</h4>'+supportComparison+'<h4>'+tr('الملاحظات التربوية','Notes pédagogiques')+'</h4><p>'+tr('عدد الملاحظات المعروضة','Notes consultées')+': '+notes.length+'</p><ul>'+categoryCounts.map(x=>'<li>'+esc(categoryNames[x.type])+': '+x.count+'</li>').join('')+'</ul>'+(notes[0]?'<p class="gs-cl-muted">'+tr('آخر ملاحظة','Dernière note')+' ('+esc(categoryNames[notes[0].note_type||'other'])+') · '+esc(new Date(notes[0].created_at).toLocaleDateString(ar()?'ar-MA':'fr-FR'))+'</p><p>'+esc(notes[0].note)+'</p>':'<p class="gs-cl-muted">'+tr('لا توجد ملاحظات مسجلة.','Aucune note enregistrée.')+'</p>')+'<h4>'+tr('خطط الدعم','Plans de soutien')+'</h4><p>'+tr('مجموع الخطط','Total des plans')+': '+plans.length+'</p><ul>'+Object.keys(planCounts).map(k=>'<li>'+esc(statusNames[k])+': '+planCounts[k]+'</li>').join('')+'</ul>'+(plans[0]?'<p>'+tr('آخر خطة','Dernier plan')+': <strong>'+esc(plans[0].title)+'</strong>'+(plans[0].due_at?' · '+tr('تاريخ المراجعة','Date de révision')+': '+esc(plans[0].due_at):'')+'</p>':'<p class="gs-cl-muted">'+tr('لا توجد خطط دعم بعد.','Aucun plan de soutien pour le moment.')+'</p>')+'<h4>'+tr('السجل الزمني للمتابعة','Historique chronologique du suivi')+'</h4>'+(timeline.length?'<ol>'+timeline.map(x=>'<li style="margin:.45rem 0"><strong>'+esc(x.title)+'</strong> · '+esc(x.detail)+'<br><small class="gs-cl-muted">'+esc(new Date(x.date).toLocaleString(ar()?'ar-MA':'fr-FR'))+'</small></li>').join('')+'</ol>':'<p class="gs-cl-muted">'+tr('لا توجد أحداث مسجلة بعد.','Aucun événement enregistré pour le moment.')+'</p>')+'<small class="gs-cl-muted">'+tr('السجل يجمع الملاحظات وخطط الدعم المسجلة لهذا التلميذ داخل هذا القسم فقط.','L’historique regroupe les notes et plans de soutien de cet élève dans cette classe uniquement.')+'</small><small class="gs-cl-muted">'+tr('التقرير مخصص لمتابعة الأستاذ ولا يظهر للتلميذ.','Rapport réservé au suivi de l’enseignant et non visible par l’élève.')+'</small><p><button type="button" class="gs-cl-secondary" data-action="print-student-report" data-id="'+esc(studentId)+'">'+tr('طباعة التقرير','Imprimer le rapport')+'</button></p></section>';
      } else if(action==='print-student-report'){
        const report=document.getElementById('gs-cl-report-'+id);
        if(!report||!report.querySelector('.gs-cl-card'))throw new Error(tr('افتح التقرير أولاً قبل الطباعة.','Ouvrez d’abord le rapport avant l’impression.'));
        let printStyle=document.getElementById('gs-cl-print-style');
        if(!printStyle){
          printStyle=document.createElement('style');printStyle.id='gs-cl-print-style';
          printStyle.textContent='@media print{body *{visibility:hidden!important}#gs-cl-report-print-target,#gs-cl-report-print-target *{visibility:visible!important}#gs-cl-report-print-target{position:absolute!important;inset:0!important;width:100%!important;margin:0!important;padding:12mm!important;background:#fff!important;color:#111!important;box-shadow:none!important;border:0!important}#gs-cl-report-print-target button{display:none!important}#gs-cl-report-print-target .gs-cl-card{break-inside:avoid}}';
          document.head.appendChild(printStyle);
        }
        document.querySelectorAll('#gs-classroom .gs-cl-report-print-target').forEach(el=>{el.classList.remove('gs-cl-report-print-target');el.removeAttribute('id');});
        report.classList.add('gs-cl-report-print-target');report.id='gs-cl-report-print-target';
        const cleanup=()=>{report.classList.remove('gs-cl-report-print-target');report.removeAttribute('id');window.removeEventListener('afterprint',cleanup);};
        window.addEventListener('afterprint',cleanup);
        window.print();
      } else if(action==='open-support-plan'){
        const classId=button.dataset.classId,studentId=id;
        const host=document.getElementById('gs-cl-support-'+studentId);
        if(!host)throw new Error(tr('تعذر فتح خطة الدعم.','Impossible d’ouvrir le plan de soutien.'));
        const {data:plans,error}=await client.from('teacher_student_support_plans').select('id,title,actions,success_criteria,due_at,status,created_at').eq('class_id',classId).eq('student_id',studentId).order('created_at',{ascending:false}).limit(20);
        if(error)throw error;
        const statusLabel=status=>({planned:tr('مخططة','Planifiée'),in_progress:tr('قيد التنفيذ','En cours'),completed:tr('مكتملة','Terminée')}[status]||status);
        host.innerHTML='<div class="gs-cl-card" style="margin-top:.7rem"><strong>'+tr('خطة الدعم الفردية لـ ','Plan de soutien individuel pour ')+esc(button.dataset.name)+'</strong>'+(plans||[]).map(p=>'<article class="gs-cl-row"><strong>'+esc(p.title)+'</strong><p>'+esc(p.actions)+'</p>'+(p.success_criteria?'<p class="gs-cl-muted">'+tr('مؤشر النجاح: ','Critère de réussite : ')+esc(p.success_criteria)+'</p>':'')+'<small class="gs-cl-muted">'+tr('الحالة: ','Statut : ')+esc(statusLabel(p.status))+(p.due_at?' · '+tr('الأجل: ','Échéance : ')+esc(p.due_at):'')+'</small></article>').join('')+(plans.length?'':'<p class="gs-cl-muted">'+tr('لا توجد خطة دعم بعد.','Aucun plan de soutien pour le moment.')+'</p>')+'<label>'+tr('عنوان الخطة','Titre du plan')+'</label><input data-support-title="'+esc(studentId)+'" maxlength="160" placeholder="'+tr('مثلاً: دعم في فهم الوراثة','Ex. : soutien en génétique')+'"><label>'+tr('الإجراءات التربوية','Actions pédagogiques')+'</label><textarea data-support-actions="'+esc(studentId)+'" maxlength="5000" placeholder="'+tr('حدد الأنشطة والتمارين والمواكبة المقترحة','Décrivez les activités, exercices et l’accompagnement')+'"></textarea><label>'+tr('مؤشر النجاح','Critère de réussite')+'</label><input data-support-criteria="'+esc(studentId)+'" maxlength="500" placeholder="'+tr('كيف سنقيس التحسن؟','Comment mesurer les progrès ?')+'"><label>'+tr('تاريخ المراجعة','Date de révision')+'</label><input type="date" data-support-due="'+esc(studentId)+'"><label>'+tr('الحالة','Statut')+'</label><select data-support-status="'+esc(studentId)+'"><option value="planned">'+tr('مخططة','Planifiée')+'</option><option value="in_progress">'+tr('قيد التنفيذ','En cours')+'</option><option value="completed">'+tr('مكتملة','Terminée')+'</option></select><button type="button" data-action="save-support-plan" data-id="'+esc(studentId)+'" data-class-id="'+esc(classId)+'">'+tr('حفظ خطة الدعم','Enregistrer le plan')+'</button></div>';
      } else if(action==='save-support-plan'){
        const field=attr=>document.querySelector('['+attr+'="'+CSS.escape(id)+'"]');
        const title=field('data-support-title')?.value.trim()||'';
        const actions=field('data-support-actions')?.value.trim()||'';
        const success_criteria=field('data-support-criteria')?.value.trim()||'';
        const due_at=field('data-support-due')?.value||null;
        const status=field('data-support-status')?.value||'planned';
        if(title.length<2||actions.length<3)throw new Error(tr('أدخل عنواناً وإجراءات واضحة للخطة.','Saisissez un titre et des actions précises.'));
        const {error}=await client.from('teacher_student_support_plans').insert({class_id:button.dataset.classId,student_id:id,teacher_id:user.id,title,actions,success_criteria,due_at,status});
        if(error)throw error;
        notice(tr('تم حفظ خطة الدعم الفردية.','Plan de soutien individuel enregistré.'));
        const host=document.getElementById('gs-cl-support-'+id);
        if(host)host.innerHTML='<p class="gs-cl-msg">'+tr('حُفظت الخطة. اضغط على «خطة الدعم الفردية» لعرض السجل المحدث.','Plan enregistré. Cliquez sur « Plan de soutien individuel » pour actualiser le registre.')+'</p>';
      } else if(action==='student-notes'){
        const classId=button.dataset.classId, studentId=id;
        const notesHost=document.getElementById('gs-cl-notes-'+studentId);
        if(!notesHost)throw new Error(tr('تعذر فتح سجل الملاحظات.','Impossible d’ouvrir les notes.'));
        const {data:notes,error}=await client.from('teacher_student_notes').select('id,note,note_type,created_at,teacher_id').eq('class_id',classId).eq('student_id',studentId).order('created_at',{ascending:false}).limit(50);
        if(error)throw error;
        notesHost.innerHTML='<div class="gs-cl-card" style="margin-top:.7rem"><strong>'+tr('ملاحظات الأستاذ الخاصة بـ ','Notes privées pour ')+esc(button.dataset.name)+'</strong><div class="gs-cl-list">'+(notes||[]).map(n=>{const canManage=profileForNotePermission(n,user);return '<article class="gs-cl-row" data-note-card="'+esc(n.id)+'" data-note-type="'+esc(n.note_type||'other')+'"><span class="gs-cl-pill">'+esc(noteTypeLabel(n.note_type))+'</span><p data-note-text="'+esc(n.id)+'">'+esc(n.note)+'</p><small class="gs-cl-muted">'+esc(new Date(n.created_at).toLocaleString(ar()?'ar-MA':'fr-FR'))+'</small>'+(canManage?'<div class="gs-cl-head" style="margin-top:.5rem"><button type="button" class="gs-cl-secondary" data-action="edit-student-note" data-id="'+esc(n.id)+'" data-student-id="'+esc(studentId)+'" data-class-id="'+esc(classId)+'">'+tr('تعديل','Modifier')+'</button><button type="button" class="gs-cl-secondary" data-action="delete-student-note" data-id="'+esc(n.id)+'" data-student-id="'+esc(studentId)+'" data-class-id="'+esc(classId)+'">'+tr('حذف','Supprimer')+'</button></div>':'')+'</article>';}).join('')+(notes.length?'':'<p class="gs-cl-muted">'+tr('لا توجد ملاحظات مسجلة بعد.','Aucune note enregistrée.')+'</p>')+'</div><label>'+tr('تصنيف الملاحظة','Catégorie de la note')+'</label><select data-note-type-for="'+esc(studentId)+'"><option value="understanding">'+tr('صعوبات الفهم','Difficultés de compréhension')+'</option><option value="results">'+tr('ضعف النتائج','Résultats insuffisants')+'</option><option value="attendance">'+tr('المواظبة والمشاركة','Assiduité et participation')+'</option><option value="progress">'+tr('تقدم دراسي','Progrès scolaires')+'</option><option value="other">'+tr('ملاحظة عامة','Note générale')+'</option></select><label>'+tr('إضافة ملاحظة تربوية','Ajouter une note pédagogique')+'</label><textarea data-note-for="'+esc(studentId)+'" maxlength="5000"></textarea><button type="button" data-action="save-student-note" data-id="'+esc(studentId)+'" data-class-id="'+esc(classId)+'">'+tr('حفظ الملاحظة','Enregistrer la note')+'</button></div>';
      } else if(action==='edit-student-note'){
        const card=button.closest('[data-note-card]');
        const text=card&&card.querySelector('[data-note-text]');
        if(!card||!text)throw new Error(tr('تعذر فتح الملاحظة للتعديل.','Impossible de modifier cette note.'));
        card.insertAdjacentHTML('beforeend','<label>'+tr('تصنيف الملاحظة','Catégorie de la note')+'</label><select data-edit-note-type="'+esc(id)+'"><option value="understanding">'+tr('صعوبات الفهم','Difficultés de compréhension')+'</option><option value="results">'+tr('ضعف النتائج','Résultats insuffisants')+'</option><option value="attendance">'+tr('المواظبة والمشاركة','Assiduité et participation')+'</option><option value="progress">'+tr('تقدم دراسي','Progrès scolaires')+'</option><option value="other">'+tr('ملاحظة عامة','Note générale')+'</option></select><label>'+tr('تعديل الملاحظة','Modifier la note')+'</label><textarea data-edit-note="'+esc(id)+'" maxlength="5000">'+esc(text.textContent)+'</textarea><button type="button" data-action="update-student-note" data-id="'+esc(id)+'" data-student-id="'+esc(button.dataset.studentId)+'" data-class-id="'+esc(button.dataset.classId)+'">'+tr('حفظ التعديل','Enregistrer les modifications')+'</button>');
        const typeSelect=card.querySelector('[data-edit-note-type="'+CSS.escape(id)+'"]');
        if(typeSelect)typeSelect.value=card.dataset.noteType||'other';
        button.disabled=true;
      } else if(action==='update-student-note'){
        const field=document.querySelector('[data-edit-note="'+CSS.escape(id)+'"]');
        const typeField=document.querySelector('[data-edit-note-type="'+CSS.escape(id)+'"]');
        const note=field?field.value.trim():'';
        const note_type=typeField?typeField.value:'other';
        if(!note)throw new Error(tr('لا يمكن حفظ ملاحظة فارغة.','La note ne peut pas être vide.'));
        const {error}=await client.from('teacher_student_notes').update({note,note_type,updated_at:new Date().toISOString()}).eq('id',id);
        if(error)throw error;
        notice(tr('تم تحديث الملاحظة.','Note mise à jour.'));
        const card=button.closest('[data-note-card]');
        const text=card&&card.querySelector('[data-note-text]');
        if(text)text.textContent=note;
        if(card){const typeBadge=card.querySelector('.gs-cl-pill');if(typeBadge)typeBadge.textContent=noteTypeLabel(note_type);if(card)card.dataset.noteType=note_type;card.querySelectorAll('label,textarea[data-edit-note],select[data-edit-note-type],button[data-action="update-student-note"]').forEach(el=>el.remove());}
      } else if(action==='delete-student-note'){
        if(!window.confirm(tr('هل تريد حذف هذه الملاحظة نهائياً؟','Supprimer définitivement cette note ?')))return;
        const {error}=await client.from('teacher_student_notes').delete().eq('id',id);
        if(error)throw error;
        notice(tr('تم حذف الملاحظة.','Note supprimée.'));
        const card=button.closest('[data-note-card]');
        if(card)card.remove();
      } else if(action==='save-student-note'){
        const field=document.querySelector('[data-note-for="'+CSS.escape(id)+'"]');
        const note=field?field.value.trim():'';
        const typeField=document.querySelector('[data-note-type-for="'+CSS.escape(id)+'"]');
        const note_type=typeField?typeField.value:'other';
        if(!note)throw new Error(tr('اكتب الملاحظة قبل الحفظ.','Saisissez une note avant l’enregistrement.'));
        const {error}=await client.from('teacher_student_notes').insert({class_id:button.dataset.classId,student_id:id,teacher_id:user.id,note,note_type});
        if(error)throw error;
        notice(tr('تم حفظ الملاحظة الخاصة.','Note privée enregistrée.'));
        const notesHost=document.getElementById('gs-cl-notes-'+id);
        if(notesHost)notesHost.innerHTML='<p class="gs-cl-msg">'+tr('حُفظت الملاحظة. اضغط على «ملاحظات الأستاذ الخاصة» لعرض السجل المحدث.','Note enregistrée. Cliquez sur « Notes pédagogiques privées » pour actualiser le registre.')+'</p>';
      } else if(action==='create-assignment'){
        const class_id=document.getElementById('gs-cl-assignment-class').value;
        const title=document.getElementById('gs-cl-assignment-title').value.trim();
        const instructions=document.getElementById('gs-cl-assignment-instructions').value.trim();
        if(title.length<2)throw new Error(tr('أدخل عنواناً من حرفين على الأقل.','Saisissez un titre d’au moins 2 caractères.'));
        const rawUrl=document.getElementById('gs-cl-assignment-url').value.trim();
        const resource_url=rawUrl?safeHttpUrl(rawUrl):null;
        if(rawUrl&&!resource_url)throw new Error(tr('الرابط يجب أن يبدأ بـ http أو https.','Le lien doit commencer par http ou https.'));
        const rawDue=document.getElementById('gs-cl-assignment-due').value;
        const due_at=rawDue?new Date(rawDue).toISOString():null;
        const {error}=await client.from('teacher_assignments').insert({class_id,created_by:user.id,title,instructions,resource_url,due_at});if(error)throw error;
        notice(tr('تم نشر الواجب.','Devoir publié.'));await refreshPanel();
      } else if(action==='create-announcement'){
        const class_id=document.getElementById('gs-cl-announcement-class').value;
        const title=document.getElementById('gs-cl-announcement-title').value.trim();
        const body=document.getElementById('gs-cl-announcement-body').value.trim();
        if(title.length<2||body.length<1)throw new Error(tr('أدخل عنوان الإعلان ونصه.','Saisissez le titre et le texte de l’annonce.'));
        const {error}=await client.from('teacher_announcements').insert({class_id,created_by:user.id,title,body});if(error)throw error;
        notice(tr('تم نشر الإعلان.','Annonce publiée.'));await refreshPanel();
      } else if(action==='create-session'){
        const class_id=document.getElementById('gs-cl-session-class').value;
        const title=document.getElementById('gs-cl-session-title').value.trim();
        const description=document.getElementById('gs-cl-session-description').value.trim();
        if(title.length<2)throw new Error(tr('أدخل عنوان الحصة.','Saisissez le titre de la séance.'));
        const rawStart=document.getElementById('gs-cl-session-start').value;
        if(!rawStart)throw new Error(tr('حدد تاريخ الحصة ووقتها.','Veuillez choisir la date et l’heure.'));
        const starts_at=new Date(rawStart).toISOString();
        const rawUrl=document.getElementById('gs-cl-session-url').value.trim();
        const meeting_url=rawUrl?safeHttpUrl(rawUrl):null;
        if(rawUrl&&!meeting_url)throw new Error(tr('الرابط يجب أن يبدأ بـ http أو https.','Le lien doit commencer par http ou https.'));
        const {error}=await client.from('teacher_review_sessions').insert({class_id,created_by:user.id,title,description,starts_at,meeting_url});if(error)throw error;
        notice(tr('تمت برمجة حصة المراجعة.','Séance programmée.'));await refreshPanel();
      } else if(action==='submit-assignment'){
        const field=document.querySelector('[data-answer-for="'+CSS.escape(id)+'"]');
        const answer=field?field.value.trim():'';
        if(!answer)throw new Error(tr('اكتب إجابتك قبل الإرسال.','Saisissez votre réponse avant l’envoi.'));
        const {error}=await client.from('teacher_assignment_submissions').insert({assignment_id:id,student_id:user.id,answer});if(error)throw error;
        notice(tr('تم إرسال إجابتك إلى الأستاذ.','Votre réponse a été envoyée.'));await refreshPanel();
      } else if(action==='grade-submission'){
        const scoreField=document.querySelector('[data-score-for="'+CSS.escape(id)+'"]');
        const feedbackField=document.querySelector('[data-feedback-for="'+CSS.escape(id)+'"]');
        const rawScore=scoreField?scoreField.value.trim():'';
        const score=rawScore===''?null:Number(rawScore);
        if(score!==null&&(!Number.isFinite(score)||score<0||score>20))throw new Error(tr('النقطة يجب أن تكون بين 0 و20.','La note doit être comprise entre 0 et 20.'));
        const feedback=feedbackField?feedbackField.value.trim():'';
        const {error}=await client.from('teacher_assignment_submissions').update({score,feedback,reviewed_at:new Date().toISOString()}).eq('id',id);if(error)throw error;
        notice(tr('تم حفظ التصحيح.','Correction enregistrée.'));await refreshPanel();
      } else if(action==='export-class-report'){
        if(!lastClassReport)throw new Error(tr('لا يوجد تقرير جاهز للتصدير.','Aucun rapport disponible à exporter.'));
        downloadClassReport(lastClassReport);
      } else if(action==='filter-inbox'){
        const filter=button.dataset.filter;
        if(!['open','answered','all'].includes(filter))throw new Error(tr('عامل التصفية غير صالح.','Filtre invalide.'));
        inboxFilter=filter;
        await refreshPanel();
      } else if(action==='thread'){
        await renderThread(id);
      } else if(action==='reply'){
        const field=document.querySelector('[data-reply-for="'+CSS.escape(id)+'"]');
        const body=field?field.value.trim():'';
        const {error}=await client.from('teacher_question_messages').insert({question_id:id,sender_id:user.id,body});if(error)throw error;
        const {error:updateError}=await client.from('teacher_questions').update({status:'answered'}).eq('id',id);if(updateError)throw updateError;
        await renderThread(id);
        notice(tr('تم إرسال الرد.','Réponse envoyée.'));
      }
    } catch(err){notice(err.message||tr('تعذر تنفيذ العملية.','Action impossible.'),true);}
    finally{busy=false;if(button.isConnected)button.disabled=false;}
  }

  async function refreshPanel(){
    const root=document.getElementById(rootId),panel=root&&root.querySelector('#gs-classroom');
    if(!panel)return;
    panel.remove();
    mountedFor=null;
    mount();
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest&&e.target.closest('#gs-classroom [data-action]');
    if(button){e.preventDefault();act(button);}
  });
  document.addEventListener('gosvt:auth-changed',()=>{mountedFor=null;setTimeout(mount,0);});
  const observer=new MutationObserver(()=>mount());
  function start(){const root=document.getElementById(rootId);if(root)observer.observe(root,{childList:true});mount();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.GoSVTClassroom={refresh:refreshPanel};
})();