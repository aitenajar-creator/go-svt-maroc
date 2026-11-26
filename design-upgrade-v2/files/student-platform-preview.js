/* Local preview only. Excluded from production by _config.yml. No Supabase client or demo grades. */
(function () {
  'use strict';
  const D=window.GoSVTPlatformDomain;
  const requested=new URLSearchParams(location.search).get('track')||'2BACSVT';
  const level=Object.keys(D.TRACKS).find(key=>D.TRACKS[key].includes(requested))||'2BAC';
  const track=D.TRACKS[level].includes(requested)?requested:'2BACSVT';
  const uid='local-preview-'+track;
  let profileId=null,ready=false;
  window.GoSVTPlatformPreview=true;
  window.currentLang='ar';
  const profile={id:uid,display_name:'رفيق التعلّم',role:'student',study_level:level,study_track:track};
  window.StudentAccount={
    isReady:()=>ready,isLoggedIn:()=>ready,getUser:()=>ready?{id:uid,email:'preview@example.invalid'}:null,
    getProfile:()=>ready?profile:null,activeProfileId:()=>profileId,
    getSyncStatus:()=>({phase:'local',failures:[]}),refreshProfile:async()=>{},
    renderGate:container=>{container.innerHTML='<p class="sp-loading">نجهّز ملف المعاينة المحلي…</p>';},
    renderBar:()=>'',logout:async()=>{}
  };
  const favoriteKey='gosvt-preview-favorites:'+uid;
  window.GoSVTStudyFavorites={get(){try{const list=JSON.parse(localStorage.getItem(favoriteKey)||'[]');return Array.isArray(list)?list:[];}catch(_){return [];}},set(paths){localStorage.setItem(favoriteKey,JSON.stringify(paths));}};
  document.addEventListener('DOMContentLoaded',()=>{
    const select=document.getElementById('sp-preview-track');
    select.innerHTML=Object.entries(D.TRACKS).map(([level,tracks])=>tracks.map(t=>'<option value="'+t+'" '+(t===track?'selected':'')+'>'+D.LEVEL_LABELS[level]+' · '+D.TRACK_LABELS[t]+'</option>').join('')).join('');
    select.onchange=()=>{const url=new URL(location.href);url.searchParams.set('track',select.value);location.href=url.pathname+url.search;};
    const mapping='gosvt-preview-profile:'+uid;
    profileId=localStorage.getItem(mapping);
    if(!profileId||!window.StudentSpace.getProfiles()[profileId]){profileId=window.StudentSpace.createProfile('معاينة '+track);localStorage.setItem(mapping,profileId);}
    ready=true;window.StudentSpace.switchProfile(profileId);window.StudentSpace.renderStudentSpace();
  },{once:true});
})();
