/* Account-scoped platform data. Public resources stay available if optional cloud features fail. */
(function () {
  'use strict';
  const D=window.GoSVTPlatformDomain;
  let catalogPromise=null;
  function catalog(force){
    if(force)catalogPromise=null;
    if(!catalogPromise)catalogPromise=fetch('student-platform-catalog.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('تعذر تحميل فهرس الموارد.');return r.json();}).then(data=>{if(!data||!Array.isArray(data.resources))throw new Error('فهرس الموارد غير صالح.');return data.resources;}).catch(e=>{catalogPromise=null;throw e;});
    return catalogPromise;
  }
  const uuid=()=>crypto.randomUUID();
  function create(profile){
    const key='gosvt-platform-v1:'+profile.id;
    const client=window.GoSVTPlatformPreview?null:window.supabaseClient;
    let alive=true, generation=0, syncing=null, authSubscription=null;
    let local;
    try{local=JSON.parse(localStorage.getItem(key)||'null');}catch(_){local=null;}
    if(!local||local.owner!==profile.id)local={owner:profile.id,version:1,events:[],pending:[],preferences:{},practiceHistory:[]};
    for(const field of ['events','pending','practiceHistory'])if(!Array.isArray(local[field]))local[field]=[];
    local.events=local.events.filter(x=>x&&x.student_id===profile.id&&['lab','focus'].includes(x.event_kind));
    local.pending=local.pending.filter(x=>x&&x.student_id===profile.id&&['lab','focus'].includes(x.event_kind));
    if(!local.preferences||typeof local.preferences!=='object'||Array.isArray(local.preferences))local.preferences={};
    const state={profile,resources:[],assessments:[],history:[],historyMore:false,privateFavorites:new Set(),events:local.events,ready:false,loading:false,cloud:client?'loading':'local',errors:[]};
    const current=()=>alive&&window.StudentAccount&&window.StudentAccount.getUser&&window.StudentAccount.getUser()?.id===profile.id;
    const notify=()=>{if(current())document.dispatchEvent(new CustomEvent('gosvt:platform-data',{detail:{userId:profile.id}}));};
    function persist(){localStorage.setItem(key,JSON.stringify(local));}
    async function timed(request){
      let timer;try{return await Promise.race([Promise.resolve(request),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('انتهت مهلة الاتصال.')),12000);})]);}finally{clearTimeout(timer);}
    }
    async function result(request){const response=await timed(request);if(response.error)throw response.error;if(!current())throw new Error('تغيّر الحساب؛ أُلغيت العملية.');return response;}
    async function ensureIdentity(){
      if(!client||!current())throw new Error('هذه الخدمة تتطلب حسابًا متصلًا.');
      const {data,error}=await timed(client.auth.getUser());
      if(error||!data.user||data.user.id!==profile.id||!current())throw new Error('تغيّرت جلسة الحساب.');
    }
    if(client?.auth?.onAuthStateChange){
      const listener=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&session.user.id!==profile.id)){alive=false;generation++;}});
      authSubscription=listener?.data?.subscription;
    }
    async function load(force=false){
      const version=++generation;state.loading=true;state.errors=[];
      try{const resources=await catalog(force);if(!current()||version!==generation)return;state.resources=resources.filter(r=>D.allowed(r,profile));state.ready=true;notify();}
      catch(error){if(current()){state.errors.push('catalog');state.ready=true;state.loading=false;notify();}return;}
      if(!client){state.loading=false;notify();return;}
      try{await ensureIdentity();}catch(_){state.cloud='partial';state.errors.push('session');state.loading=false;notify();return;}
      const jobs=[
        ['resources',()=>client.from('learning_resources').select('id,title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position').eq('is_published',true).eq('study_level',profile.level).order('position',{ascending:true}).order('id',{ascending:true})],
        ['assessments',()=>client.from('learning_assessments').select('id,title,description,study_level,study_tracks,duration_minutes,question_count,revision').eq('is_published',true).eq('study_level',profile.level).order('updated_at',{ascending:false}).order('id',{ascending:false})],
        ['private',()=>client.from('private_student_lessons').select('id,title,description,study_level,study_track,language').eq('is_published',true).eq('study_level',profile.level).eq('study_track',profile.track).order('title')],
        ['uploads',()=>client.from('site_content_items').select('id,title,category,language,study_level,study_track,file_name,storage_path,size_bytes').eq('study_level',profile.level).order('created_at',{ascending:false}).order('id',{ascending:false})],
        ['privateFavorites',()=>client.from('student_favorites').select('content_key').eq('student_id',profile.id).eq('content_type','lesson').order('content_key') ]
      ];
      const responses=await Promise.allSettled(jobs.map(async([name,make])=>{
        const all=[];let start=0;
        for(;;){const response=await result(make().range(start,start+199));const rows=response.data||[];all.push(...rows);if(rows.length<200)break;start+=rows.length;}
        return [name,all];
      }));
      if(!current()||version!==generation)return;
      responses.forEach((response,index)=>{
        if(response.status==='rejected'){state.errors.push(jobs[index][0]);return;}
        const [name,rows]=response.value;
        if(name==='assessments')state.assessments=rows.filter(r=>D.allowed(r,profile));
        if(name==='privateFavorites')state.privateFavorites=new Set(rows.map(r=>r.content_key));
        if(name==='resources')state.resources.push(...rows.filter(r=>D.allowed(r,profile)).map(r=>({id:'managed:'+r.id,path:r.source_url,title:r.title,description:r.description,type:r.resource_kind,level:r.study_level,tracks:r.study_tracks,language:r.language,sequence:r.position,source:'managed'})));
        if(name==='private')state.resources.push(...rows.filter(r=>r.study_level===profile.level&&r.study_track===profile.track).map(r=>({id:'private-lesson:'+r.id,path:'/lesson-reader.html?reader=20261125-platform&id='+encodeURIComponent(r.id),title:r.title,description:r.description,type:'private',level:r.study_level,tracks:[r.study_track],language:r.language==='ar'?'arabe':'francais',source:'private'})));
        if(name==='uploads')state.resources.push(...rows.filter(r=>r.study_level===profile.level&&(!r.study_track||r.study_track===profile.track)).map(r=>{
          const category=r.category==='resumes'?'fiches':r.category;
          const parts=[category];if(['cours','exercices','examens','fiches'].includes(category)){parts.push(r.language||'francais',r.study_level);if(r.study_track)parts.push(r.study_track);}parts.push('__cloud',r.id,r.file_name);
          const bucket=client.storage.from('site-content');
          return {id:'uploaded:'+r.id,path:bucket.getPublicUrl(r.storage_path).data.publicUrl,download_url:bucket.getPublicUrl(r.storage_path,{download:r.file_name}).data.publicUrl,progress_key:'/'+parts.join('/'),title:r.title||r.file_name,original_title:r.file_name,type:r.category,level:r.study_level,tracks:r.study_track?[r.study_track]:D.TRACKS[r.study_level],language:r.language||'francais',source:'uploaded',bytes:r.size_bytes};
        }));
      });
      const unique=new Map();
      state.resources.forEach(item=>{
        const safe=D.safeUrl(item.path,location.origin);if(!safe)return;
        const url=new URL(safe);if(url.origin===location.origin){url.searchParams.delete('v');url.searchParams.delete('reader');url.searchParams.sort();}
        const old=unique.get(url.href);
        if(!old)unique.set(url.href,item);
        else if(item.source==='private')unique.set(url.href,{...item,...old,id:item.id,type:'private',source:'private',path:item.path});
        else if(item.source==='managed')unique.set(url.href,{...old,...item,id:old.id});
      });
      state.resources=[...unique.values()];
      const extra=await Promise.allSettled([loadEvents(),loadHistory(true)]);
      if(!current()||version!==generation)return;
      extra.forEach((x,i)=>{if(x.status==='rejected')state.errors.push(i?'history':'events');});
      state.cloud=state.errors.length?'partial':'ready';state.loading=false;notify();syncEvents();
    }
    async function loadEvents(){
      if(!client)return;
      const since=new Date(Date.now()-30*86400000).toISOString();const all=[];let start=0;
      for(;;){const response=await result(client.from('student_learning_events').select('id,student_id,event_kind,resource_key,payload,occurred_at').eq('student_id',profile.id).gte('occurred_at',since).order('occurred_at',{ascending:false}).order('id',{ascending:false}).range(start,start+199));const rows=response.data||[];all.push(...rows);if(rows.length<200)break;start+=rows.length;}
      if(!current())return;
      const merged=new Map([...local.events,...all,...local.pending].map(x=>[x.id,x]));
      state.events=[...merged.values()].filter(x=>Date.parse(x.occurred_at)>=Date.parse(since)).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
      local.events=state.events.slice(-500);persist();
    }
    async function loadHistory(reset){
      if(!client)return;
      const start=reset?0:state.history.length;
      const {data,count}=await result(client.from('learning_attempts').select('id,assessment_id,title_snapshot,started_at,submitted_at,score,max_score',{count:'exact'}).eq('student_id',profile.id).not('submitted_at','is',null).order('started_at',{ascending:false}).order('id',{ascending:false}).range(start,start+19));
      state.history=reset?(data||[]):state.history.concat(data||[]);state.historyMore=count==null?(data||[]).length===20:state.history.length<count;notify();
    }
    function record(event){
      if(!current())throw new Error('تغير الحساب.');
      const value={id:uuid(),student_id:profile.id,event_kind:event.event_kind,resource_key:event.resource_key,payload:event.payload,occurred_at:new Date().toISOString()};
      const previousEvents=local.events,previousPending=local.pending;
      local.events=local.events.concat(value).slice(-500);local.pending=local.pending.concat(value);
      try{persist();}catch(error){local.events=previousEvents;local.pending=previousPending;throw new Error('تعذر الحفظ في المتصفح. تحقق من مساحة التخزين.');}
      state.events=state.events.concat(value);
      try{window.StudentSpace?.updateStreak?.();}catch(error){console.warn('[Learning platform] Streak update deferred:',error.message);}
      notify();syncEvents();return value;
    }
    async function syncEvents(){
      if(!client||syncing||!local.pending.length||!current())return syncing;
      syncing=(async()=>{
        try{
          await ensureIdentity();
          while(local.pending.length&&current()){
            const batch=local.pending.slice(0,50);
            await result(client.from('student_learning_events').upsert(batch,{onConflict:'id',ignoreDuplicates:true}));
            const ids=new Set(batch.map(x=>x.id));local.pending=local.pending.filter(x=>!ids.has(x.id));persist();
          }
        }catch(_){if(current()){state.cloud='partial';if(!state.errors.includes('events'))state.errors.push('events');}}
        finally{syncing=null;notify();}
      })();return syncing;
    }
    function preference(name,value){if(!current())return;local.preferences[name]=value;persist();}
    function activeExam(value){if(arguments.length){if(!current())return;local.activeExam=value;persist();}return local.activeExam&&local.activeExam.owner===profile.id?local.activeExam:null;}
    function activeFocus(value){if(arguments.length){if(!current())return;local.activeFocus=value;persist();}return local.activeFocus&&local.activeFocus.owner===profile.id?local.activeFocus:null;}
    function savePractice(value){
      if(!current())return;
      if(!local.practiceHistory.some(x=>x.id===value.id))local.practiceHistory.unshift(value);
      local.practiceHistory=local.practiceHistory.slice(0,30);persist();notify();
    }
    async function rpc(name,params){await ensureIdentity();return (await result(client.rpc(name,params))).data;}
    return {
      state,local,client,load,loadHistory,record,syncEvents,preference,activeExam,activeFocus,savePractice,current,
      async togglePrivateFavorite(contentKey){
        if(!/^private-lesson:[a-f0-9-]{36}$/i.test(contentKey))throw new Error('معرّف درس غير صالح.');
        await ensureIdentity();
        const remove=state.privateFavorites.has(contentKey);
        if(remove)await result(client.from('student_favorites').delete().eq('student_id',profile.id).eq('content_key',contentKey).eq('content_type','lesson'));
        else await result(client.from('student_favorites').upsert({student_id:profile.id,content_key:contentKey,content_type:'lesson'},{onConflict:'student_id,content_key,content_type',ignoreDuplicates:true}));
        if(remove)state.privateFavorites.delete(contentKey);else state.privateFavorites.add(contentKey);
        notify();return !remove;
      },
      startAssessment:id=>rpc('gosvt_platform_start_assessment',{p_assessment_id:id,p_expected_student:profile.id}),
      saveAnswers:(id,answers,sequence)=>rpc('gosvt_platform_save_answers',{p_attempt_id:id,p_answers:answers,p_sequence:sequence,p_expected_student:profile.id}),
      submitAssessment:(id,answers,sequence)=>rpc('gosvt_platform_submit_assessment',{p_attempt_id:id,p_answers:answers,p_sequence:sequence,p_expected_student:profile.id}),
      async attempt(id){return (await result(client.from('learning_attempts').select('id,title_snapshot,submitted_at,score,max_score,feedback').eq('student_id',profile.id).eq('id',id).maybeSingle())).data;},
      dispose(){alive=false;generation++;authSubscription?.unsubscribe();}
    };
  }
  window.GoSVTPlatformStore=Object.freeze({create});
})();
