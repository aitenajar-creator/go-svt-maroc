/* Timed practice and server-graded assessments. Offline practice is never presented as an official grade. */
(function () {
  'use strict';
  const D=window.GoSVTPlatformDomain;
  const A=window.GoSVTPlatformArt;
  function create(store,ui){
    let active=store.activeExam(),body=null,saving=Promise.resolve(),requestId=0,disposed=false,serverStarting=false;
    if(active&&(!Array.isArray(active.questions)||!Number.isFinite(active.deadline)||!['practice','server'].includes(active.mode))){active=null;store.activeExam(null);}
    if(active){active.finishing=false;active.autoFailed=false;}
    function persist(){if(store.current())store.activeExam(active);}
    function remaining(){return active?Math.max(0,Math.ceil((active.deadline-Date.now())/1000)):0;}
    function same(id){return !disposed&&store.current()&&active&&active.id===id;}
    function status(text,bad){const el=body?.querySelector('[data-exam-save]');if(el){el.textContent=text;el.style.color=bad?'#ad7956':'#8b9e73';}}
    function display(){
      if(!active||!store.current())return;
      body=ui.open(active.title,'<div data-sp-exam></div>',{wide:false,subtitle:active.mode==='server'?'اختبار موقّت · التصحيح وحساب الأجل على الخادم':'تدريب ذاتي · التصحيح محلي، وليس نقطة امتحان رسمي',onClose(){body=null;}});
      draw();
    }
    function draw(){
      if(!active||!body?.isConnected)return;
      const index=Math.max(0,Math.min(active.questions.length-1,active.index||0));active.index=index;
      const q=active.questions[index];
      const answered=Object.keys(active.answers).length;
      body.innerHTML='<div class="sp-quiz-header"><span>السؤال '+(index+1)+' من '+active.questions.length+'</span><span class="sp-quiz-time" data-exam-time>'+A.icon('clock')+'<b>'+D.formatDuration(remaining())+'</b></span></div><div class="sp-progress-track"><i style="width:'+Math.round(answered/active.questions.length*100)+'%"></i></div><p class="sp-question" dir="auto">'+D.esc(q.prompt)+'</p><div class="sp-options">'+q.options.map((option,i)=>'<label class="sp-option" dir="auto"><input type="radio" name="sp-answer" value="'+i+'" '+(active.answers[q.id]===i?'checked':'')+' '+(!remaining()?'disabled':'')+'><span>'+D.esc(option)+'</span></label>').join('')+'</div><div class="sp-question-nav" aria-label="الانتقال بين الأسئلة">'+active.questions.map((x,i)=>'<button type="button" data-question="'+i+'" aria-label="السؤال '+(i+1)+'" aria-current="'+(i===index)+'" class="'+(Number.isInteger(active.answers[x.id])?'is-answered':'')+'">'+(i+1)+'</button>').join('')+'</div><p data-exam-save role="status" style="font-size:10px;color:#92a17e">'+(active.mode==='server'?'تُرسل الإجابات إلى الخادم أثناء الحل. بعد انتهاء الوقت يعتمد التصحيح آخر إجابات مزامنة.':'تُحفظ المحاولة لهذا الحساب في المتصفح. إغلاق النافذة لا يوقف المؤقت.')+'</p><div class="sp-dialog-actions"><button type="button" class="sp-button" data-exam-previous '+(index===0?'disabled':'')+'>السابق</button>'+(index<active.questions.length-1?'<button type="button" class="sp-button primary" data-exam-next>السؤال التالي '+A.icon('arrow')+'</button>':'')+'<button type="button" class="sp-button '+(index===active.questions.length-1?'primary':'subtle')+'" data-exam-finish>إنهاء وتصحيح</button></div>';
      body.onchange=answer;body.onclick=click;
    }
    function answer(event){
      if(!active||!store.current()||event.target.name!=='sp-answer')return;
      if(!remaining()){finish(true);return;}
      const value=Number(event.target.value),q=active.questions[active.index];
      if(!Number.isInteger(value)||value<0||value>=q.options.length)return;
      active.answers[q.id]=value;active.sequence=(active.sequence||0)+1;persist();
      const id=active.id,seq=active.sequence,snapshot={...active.answers};
      if(active.mode==='server'){
        status('جارٍ مزامنة الإجابة…');
        saving=saving.catch(()=>{}).then(async()=>{
          if(!same(id))return;
          const result=await store.saveAnswers(id,snapshot,seq);
          if(!result.accepted)throw new Error('المحاولة عُدلت في نافذة أخرى. أعد فتحها قبل المتابعة.');
          if(same(id)&&active.sequence===seq)status('تمت مزامنة الإجابات مع الخادم.');
        }).catch(error=>{if(same(id))status(error.message||'الإجابة محفوظة على الجهاز، ولم تتم مزامنتها بعد.',true);});
      }else status('حُفظت الإجابة على هذا الجهاز.');
      const nav=body?.querySelector('[data-question="'+active.index+'"]');if(nav)nav.classList.add('is-answered');
      const progress=body?.querySelector('.sp-progress-track i');if(progress)progress.style.width=Math.round(Object.keys(active.answers).length/active.questions.length*100)+'%';
    }
    function click(event){
      if(!active)return;
      const question=event.target.closest('[data-question]');
      if(question){active.index=Number(question.dataset.question);persist();draw();return;}
      if(event.target.closest('[data-exam-next]')){active.index=Math.min(active.questions.length-1,active.index+1);persist();draw();}
      if(event.target.closest('[data-exam-previous]')){active.index=Math.max(0,active.index-1);persist();draw();}
      if(event.target.closest('[data-exam-finish]'))finish(false);
    }
    async function startPractice(resource){
      if(serverStarting){ui.toast('جارٍ تجهيز محاولة خادمية.');return;}
      if(active){display();ui.toast('لديك محاولة جارية. أنهها قبل بدء اختبار آخر.');return;}
      const request=++requestId,intent=ui.intent?.();
      try{
        const response=await fetch(resource.path,{cache:'no-cache'});if(!response.ok)throw new Error('تعذر تحميل أسئلة التدريب.');
        const quiz=D.normalizeQuiz(await response.json());
        if(disposed||!store.current()||request!==requestId||(ui.intent&&ui.intent()!==intent))return;
        active={id:crypto.randomUUID(),owner:store.state.profile.id,mode:'practice',resourceId:resource.id,path:resource.path,title:quiz.title,questions:quiz.questions,answers:{},index:0,sequence:0,deadline:Date.now()+quiz.duration*60000,startedAt:Date.now()};
        persist();display();ui.refresh();
      }catch(error){if(!disposed&&store.current()&&request===requestId)ui.toast(error.message,true);}
    }
    async function startServer(assessment){
      if(serverStarting){ui.toast('جارٍ تجهيز المحاولة.');return;}
      if(active){await resume();ui.toast('لديك محاولة جارية.');return;}
      serverStarting=true;
      const request=++requestId,intent=ui.intent?.();
      try{
        const result=await store.startAssessment(assessment.id);
        if(disposed||!store.current()||request!==requestId)return;
        adoptServer(result);
        if(!ui.intent||ui.intent()===intent)display();else ui.toast('جُهزت المحاولة الموقّتة. استكملها من تنبيه الاختبار الجاري.');
        ui.refresh();
      }catch(error){if(!disposed&&store.current())ui.toast(friendly(error),true);}
      finally{serverStarting=false;}
    }
    function adoptServer(result){
      const serverTime=Date.parse(result?.server_time),deadlineAt=Date.parse(result?.deadline_at);
      if(!result||typeof result.id!=='string'||!result.id||typeof result.assessment_id!=='string'||!result.assessment_id||!Number.isFinite(serverTime)||!Number.isFinite(deadlineAt)||!Array.isArray(result.questions)||!result.questions.length||!result.questions.every(q=>q.id&&typeof q.prompt==='string'&&Array.isArray(q.options)&&q.options.length>=2))throw new Error('بيانات المحاولة أو توقيتها غير صالحة.');
      const left=deadlineAt-serverTime,sequence=Number(result.last_sequence);
      if(!Number.isSafeInteger(sequence)||sequence<0)throw new Error('تسلسل إجابات المحاولة غير صالح.');
      const questions=result.questions.map(q=>({id:q.id,prompt:q.prompt,options:q.options,points:q.points}));
      const rawAnswers=result.answers==null?{}:result.answers;
      if(!rawAnswers||typeof rawAnswers!=='object'||Array.isArray(rawAnswers))throw new Error('إجابات المحاولة المسترجعة غير صالحة.');
      const optionCounts=new Map(questions.map(q=>[q.id,q.options.length]));
      if(Object.entries(rawAnswers).some(([id,value])=>!optionCounts.has(id)||!Number.isInteger(value)||value<0||value>=optionCounts.get(id)))throw new Error('تحتوي المحاولة المسترجعة على إجابات غير صالحة.');
      const answers={...rawAnswers};
      active={id:result.id,assessmentId:result.assessment_id,owner:store.state.profile.id,mode:'server',title:result.title,questions,answers,sequence,index:0,deadline:Date.now()+Math.max(0,left),startedAt:Date.now()};
      persist();
    }
    async function resume(){
      if(!active)return;
      const intent=ui.intent?.();
      if(active.mode==='server'){
        try{
          const oldId=active.id,row=await store.attempt(oldId);
          if(!same(oldId))return;
          if(row?.submitted_at){active=null;persist();showResult({id:row.id,title:row.title_snapshot,score:row.score,maximum:row.max_score,percentage:Math.round(row.score/row.max_score*100),feedback:row.feedback,server_graded:true});return;}
          const result=await store.startAssessment(active.assessmentId);if(!same(oldId))return;adoptServer(result);
        }catch(error){ui.toast(friendly(error),true);return;}
      }
      if(!ui.intent||ui.intent()===intent)display();
    }
    async function finish(automatic){
      if(!active||active.finishing||!store.current())return;
      const unanswered=active.questions.filter(q=>!Number.isInteger(active.answers[q.id])).length;
      if(!automatic&&unanswered&&!window.confirm('بقي '+unanswered+' سؤالًا دون إجابة. هل تريد إنهاء المحاولة؟'))return;
      active.finishing=true;const attempt=active,intent=ui.intent?.();
      body?.querySelectorAll('input,button').forEach(el=>el.disabled=true);
      status('جارٍ التصحيح…');
      try{
        let result;
        if(attempt.mode==='server'){
          await saving;
          result=await store.submitAssessment(attempt.id,{...attempt.answers},attempt.sequence);
          if(!same(attempt.id))return;
          if(!result||result.id!==attempt.id||result.server_graded!==true||!Number.isInteger(result.score)||!Number.isInteger(result.maximum)||result.maximum<=0||result.score<0||result.score>result.maximum||!Array.isArray(result.feedback))throw new Error('لم تصل نتيجة تصحيح خادمي صالحة. أعد المحاولة للتحقق من النتيجة.');
          await store.loadHistory(true).catch(()=>{});
          window.StudentSpace?.updateStreak?.();
        }else{
          result={...D.grade(attempt.questions,attempt.answers),id:attempt.id,title:attempt.title,submitted_at:new Date().toISOString(),server_graded:false,resourceId:attempt.resourceId,path:attempt.path};
          store.savePractice(result);
          const mistakes=result.feedback.filter(x=>!x.correct).map(q=>({question:q.prompt,selected:q.selected===null?'لم تتم الإجابة':q.options[q.selected],correct:q.options[q.answer]}));
          window.StudentSpace?.saveQuizResult?.(attempt.path,result.feedback.filter(x=>x.correct).length,attempt.questions.length,mistakes,attempt.id,true);
        }
        const showingExam=!!body?.isConnected;
        active=null;persist();
        if(showingExam&&(!ui.intent||ui.intent()===intent))showResult(result);else ui.toast('انتهت المحاولة وصُحّحت. نتيجتها متاحة في سجل التقدم.');
        ui.refresh();
      }catch(error){
        if(!same(attempt.id))return;
        active.finishing=false;active.autoFailed=automatic;persist();
        if(body?.isConnected){draw();status(friendly(error)+' لم نعرض نجاحًا أو نقطة غير مؤكدة.',true);}
        ui.toast(friendly(error),true);
      }
    }
    function friendly(error){
      const text=String(error?.message||'تعذر الاتصال.');
      if(text.includes('assessment_not_available'))return 'هذا الاختبار غير منشور للمستوى والمسلك المرتبطين بحسابك.';
      if(text.includes('too_many_attempts'))return 'بلغت الحد المؤقت للمحاولات. خذ استراحة ثم حاول لاحقًا.';
      if(text.includes('attempt_updated_elsewhere'))return 'المحاولة عُدلت في نافذة أخرى. أعد فتحها لمتابعة أحدث الإجابات.';
      if(text.includes('authentication'))return 'تغيرت جلسة الحساب. سجّل الدخول من جديد.';
      return text;
    }
    function showResult(result){
      const feedback=Array.isArray(result.feedback)?result.feedback:[];
      const percentage=Number.isFinite(Number(result.percentage))?Math.round(Number(result.percentage)):Math.round(Number(result.score)/Number(result.maximum)*100)||0;
      body=ui.open(result.title||'نتيجة التدريب','',{wide:false,subtitle:result.server_graded?'نتيجة حُسبت وحُفظت على الخادم':'نتيجة تدريب ذاتي — ليست شهادة أو نقطة امتحان رسمي',onClose(){body=null;}});
      body.innerHTML='<div class="sp-score-summary"><div class="sp-score-circle">'+percentage+'%<small>'+D.esc(result.score)+' / '+D.esc(result.maximum)+'</small></div><h3>'+(percentage>=80?'عمل رائع، واصل التقدم':percentage>=50?'تقدّم جيد، لنراجع بعض الأفكار':'هذه بداية مفيدة. تعلّم من الإجابات')+'</h3><p>اقرأ التفسير، وحدّد فكرة واحدة ستراجعها قبل المحاولة التالية.</p></div>'+feedback.map((q,i)=>'<article class="sp-feedback '+(!q.correct?'wrong':'')+'"><h4 dir="auto">'+(i+1)+'. '+D.esc(q.prompt)+'</h4><p class="'+(q.correct?'sp-correct':'sp-wrong')+'" dir="auto">إجابتك: '+D.esc(q.selected==null?'لم تتم الإجابة':q.options?.[q.selected]||'—')+'</p>'+(!q.correct?'<p class="sp-correct" dir="auto">الإجابة الصحيحة: '+D.esc(q.options?.[q.answer]||'—')+'</p>':'')+'<p dir="auto">'+D.esc(q.explanation||'')+'</p></article>').join('')+'<div class="sp-dialog-actions"><button type="button" class="sp-button primary" data-result-close>العودة لمساري</button></div>';
      body.onclick=event=>{if(event.target.closest('[data-result-close]'))ui.close();};
    }
    const timer=setInterval(()=>{
      if(disposed||!store.current())return;
      const el=body?.querySelector('[data-exam-time]');if(el&&active){el.innerHTML=A.icon('clock')+'<b>'+D.formatDuration(remaining())+'</b>';el.classList.toggle('is-low',remaining()<60);}
      if(active&&!remaining()&&!active.finishing&&!active.autoFailed)finish(true);
      document.querySelectorAll('[data-active-exam-time]').forEach(el=>{el.textContent=active?D.formatDuration(remaining()):'';});
    },1000);
    function online(){if(active?.autoFailed){active.autoFailed=false;finish(true);}}
    window.addEventListener('online',online);
    return {startPractice,startServer,resume,showResult,getActive:()=>active,dispose(){disposed=true;requestId++;clearInterval(timer);window.removeEventListener('online',online);body=null;}};
  }
  window.GoSVTPlatformExams=Object.freeze({create});
})();
