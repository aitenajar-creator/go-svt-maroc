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
  const tracks = {
    TC: [['TCS','الجذع المشترك العلمي'],['TCL','الجذع المشترك الأدبي']],
    '1BAC': [['1BACSE','العلوم التجريبية'],['1BACSM','العلوم الرياضية'],['1BACL','الآداب']],
    '2BAC': [['2BACSVT','علوم الحياة والأرض'],['2BACSP','العلوم الفيزيائية'],['2BACSM','العلوم الرياضية']]
  };
  let mountedFor = null;
  let busy = false;

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
      <div class="gs-cl-card" style="margin-top:1rem"><h3>${tr('📨 أسئلة التلاميذ','📨 Questions des élèves')}</h3><div id="gs-cl-inbox" class="gs-cl-list"><p class="gs-cl-muted">${tr('جارٍ التحميل...','Chargement...')}</p></div></div>
      <div class="gs-cl-card" style="margin-top:1rem"><h3>${tr('👥 ملف القسم','👥 Tableau de classe')}</h3><div id="gs-cl-roster"><p class="gs-cl-muted">${tr('اختر قسماً لعرض التلاميذ والمؤشرات الدراسية.','Choisissez une classe pour afficher les élèves et les indicateurs.')}</p></div></div>
      <p class="gs-cl-msg" role="status" aria-live="polite"></p>`;
    const level=document.getElementById('gs-cl-level'),track=document.getElementById('gs-cl-track');
    function fillTracks(){track.innerHTML=(tracks[level.value]||[]).map(x=>`<option value="${x[0]}">${esc(x[0])} — ${esc(x[1])}</option>`).join('');}
    level.addEventListener('change',fillTracks);fillTracks();
    const ids=(classes||[]).map(c=>c.id);
    if(ids.length){
      const {data:questions,error:qerr}=await client.from('teacher_questions').select('id,class_id,student_id,subject,body,status,created_at').in('class_id',ids).order('created_at',{ascending:false}).limit(60);
      if(qerr)throw qerr;
      const inbox=document.getElementById('gs-cl-inbox');
      if(inbox)inbox.innerHTML=(questions||[]).length?questions.map(q=>`<article class="gs-cl-row"><strong>${esc(q.subject)}</strong><p>${esc(q.body)}</p><p class="gs-cl-muted">${esc(q.status)} · ${new Date(q.created_at).toLocaleString()}</p><button type="button" data-action="thread" data-id="${esc(q.id)}">${tr('الإجابة عن السؤال','Répondre')}</button><div id="gs-cl-thread-${esc(q.id)}"></div></article>`).join(''):`<p class="gs-cl-muted">${tr('لا توجد أسئلة واردة حالياً.','Aucune question reçue.')}</p>`;
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
        if(host)host.innerHTML=(data||[]).length?data.map(s=>`<article class="gs-cl-row"><strong>${esc(s.display_name)}</strong><p class="gs-cl-muted">${esc(s.study_level||'')} · ${esc(s.study_track||'')}</p><p>${tr('الدروس المكتملة','Leçons terminées')}: ${Number(s.completed_lessons)||0} · ${tr('محاولات الاختبار','Tentatives')}: ${Number(s.quiz_attempts)||0} · ${tr('المعدل','Moyenne')}: ${s.average_score==null?'—':esc(s.average_score)+'%'}</p></article>`).join(''):`<p class="gs-cl-muted">${tr('لا يوجد تلاميذ في هذا القسم بعد.','Aucun élève dans cette classe.')}</p>`;
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