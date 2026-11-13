(function(){
  'use strict';
  const client=window.supabaseClient;
  if(!client) return;
  const lang=(document.documentElement.lang||'ar').toLowerCase().startsWith('fr')?'fr':'ar';
  function setText(id,value){const el=document.getElementById(id);if(el&&value)el.textContent=value;}
  async function load(){
    try{
      const {data,error}=await client.from('site_founder_profile').select('*').eq('id','main').maybeSingle();
      if(error||!data)return;
      setText('gs-founder-name',data['name_'+lang]);
      setText('gs-founder-role',data['role_'+lang]);
      setText('gs-founder-bio',data['bio_'+lang]);
      const extra=document.getElementById('gs-founder-bio-extra'); if(extra)extra.hidden=true;
      setText('gs-founder-vision-text',data['vision_'+lang]);
      if(data.portrait_path){
        const url=client.storage.from('site-content').getPublicUrl(data.portrait_path).data.publicUrl;
        const photo=document.getElementById('gs-founder-photo'), placeholder=document.getElementById('gs-founder-placeholder');
        if(photo){photo.src=url;photo.hidden=false;}
        if(placeholder)placeholder.hidden=true;
      }
    }catch(error){console.warn('[GO SVT] Founder profile could not be loaded.',error);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();