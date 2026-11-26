/* Guided virtual experiments. Relative outputs are explicitly illustrative, not lab measurements. */
(function () {
  'use strict';
  const D = window.GoSVTPlatformDomain;
  const labs = [
    { id:'genetics', title:'مختبر الوراثة', subtitle:'ابنِ تزاوجًا، وتوقّع نسب الأنماط الوراثية.', topic:'genetics', color:'lilac', levels:['2BAC'], skill:'الاحتمال وتفسير النتائج', icon:'spark' },
    { id:'photosynthesis', title:'ورقة خضراء، تجربة حيّة', subtitle:'غيّر الإضاءة وCO₂ والحرارة، ثم قارن استجابة النموذج.', topic:'plant', color:'sage', levels:['1BAC'], skill:'عزل المتغيرات وقراءة المنحنى', icon:'leaf' },
    { id:'soil', title:'ماذا تخفي التربة؟', subtitle:'قارن النفاذية والاحتفاظ بالماء في نموذج مبسّط.', topic:'earth', color:'sand', levels:['TC'], skill:'المقارنة وبناء الاستنتاج', icon:'flask' }
  ];
  function mount(root, id, existing, onRecord) {
    const lab = labs.find(x => x.id === id);
    if (!lab) throw new Error('التجربة غير موجودة.');
    let records = (existing || []).filter(x => x.resource_key === 'lab:' + id).slice(-30);
    let active = true, lastSignature = '', trial = null;
    const initial = id === 'genetics' ? {mother:'Aa',father:'Aa'} : id === 'soil' ? {sand:50} : {light:55,co2:600,temperature:25};
    const values = {...initial};
    const control = (key,label,min,max,step,value,unit) => '<label for="sp-lab-'+key+'">'+label+'<b data-lab-value="'+key+'">'+value+' '+unit+'</b></label><input id="sp-lab-'+key+'" data-lab-control="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'" aria-label="'+label+'">';
    const controls = id === 'genetics'
      ? '<label for="sp-lab-mother">النمط الوراثي للأصل الأول</label><select id="sp-lab-mother" data-lab-control="mother"><option>AA</option><option selected>Aa</option><option>aa</option></select><label for="sp-lab-father">النمط الوراثي للأصل الثاني</label><select id="sp-lab-father" data-lab-control="father"><option>AA</option><option selected>Aa</option><option>aa</option></select>'
      : id === 'soil' ? control('sand','نسبة الرمل في خليط افتراضي',0,100,5,50,'%')
      : control('light','شدة الإضاءة النسبية',0,100,5,55,'')+control('co2','تركيز CO₂ المفترض',0,1200,50,600,'ppm')+control('temperature','درجة الحرارة المفترضة',0,50,1,25,'°C');
    const caveat = id==='genetics' ? 'نموذج لصفة واحدة بسيادة تامة وإخصاب عشوائي. الأليل A سائد وa متنحٍ؛ ليست كل الصفات تتبع هذا النموذج.' : 'هذه محاكاة مفاهيمية مبسّطة؛ القيم الناتجة مؤشرات نسبية وليست قياسات مخبرية. تختلف الاستجابات الحقيقية حسب العينة والشروط.';
    root.innerHTML='<div class="sp-lab-layout"><div class="sp-lab-controls"><div class="sp-eyebrow">01 · ضع توقعًا ثم غيّر عاملًا</div>'+controls+'<p style="font-size:10px;color:#92a17c">قارن عدة حالات، مع تثبيت بقية الشروط حين تختبر أثر عامل واحد.</p><button type="button" class="sp-button primary" data-lab-record>سجّل هذه الحالة</button><p data-lab-status role="status" style="font-size:10px;color:#8a9b70"></p></div><div><div class="sp-lab-display" data-lab-display></div><p class="sp-lab-hypothesis">'+caveat+'</p></div></div><div class="sp-section-heading" style="margin-top:24px"><div><h3>02 · دفتر التجربة</h3><p>سجّل ثلاث حالات مختلفة على الأقل، ثم قارن النتائج.</p></div><button type="button" class="sp-text-link" data-lab-export>تصدير القياسات CSV</button></div><div class="sp-table-wrap" data-lab-table></div><div class="sp-suggestion" data-lab-conclusion></div>';
    function calculate() {
      if(id==='genetics') return D.cross(values.mother,values.father);
      if(id==='soil') return D.soil(values.sand);
      return {rate:D.photosynthesis(values.light,values.co2,values.temperature)};
    }
    function draw() {
      trial=calculate();
      root.querySelectorAll('[data-lab-value]').forEach(el=>{const key=el.dataset.labValue;el.textContent=values[key]+(key==='temperature'?' °C':key==='co2'?' ppm':key==='sand'?' %':'');});
      const display=root.querySelector('[data-lab-display]');
      if(id==='genetics') display.innerHTML='<div class="sp-punnett">'+trial.cells.map(x=>'<div class="'+(x==='aa'?'is-recessive':'')+'">'+x+'</div>').join('')+'</div><p style="font-size:11px;color:#8a9879;margin:14px 0 0">صفة سائدة: '+trial.dominant+'% · صفة متنحية: '+trial.recessive+'%</p>';
      else if(id==='soil') display.innerHTML='<svg viewBox="0 0 280 180" role="img" aria-label="مقارنة مؤشري النفاذية والاحتفاظ بالماء"><path d="M40 20v130h210" fill="none" stroke="#d5dfc5"/><rect x="74" y="'+(150-trial.infiltration*1.2)+'" width="54" height="'+trial.infiltration*1.2+'" rx="6" fill="#c2b58a"/><rect x="160" y="'+(150-trial.retention*1.2)+'" width="54" height="'+trial.retention*1.2+'" rx="6" fill="#a7bb91"/><text x="101" y="173" text-anchor="middle" font-size="11" fill="#8c9879">النفاذية</text><text x="187" y="173" text-anchor="middle" font-size="11" fill="#8c9879">الاحتفاظ</text><text x="101" y="'+(140-trial.infiltration*1.2)+'" text-anchor="middle" font-size="14" fill="#897a52">'+trial.infiltration+'</text><text x="187" y="'+(140-trial.retention*1.2)+'" text-anchor="middle" font-size="14" fill="#71895a">'+trial.retention+'</text></svg><small class="sp-lab-unit">مؤشرات نسبية في النموذج، لا نسب مقاسة للماء</small>';
      else {
        const points=Array.from({length:21},(_,i)=>[25+i*11,145-D.photosynthesis(i*5,values.co2,values.temperature)]);
        display.innerHTML='<svg viewBox="0 0 275 175" role="img" aria-label="استجابة نموذج التركيب الضوئي لشدة الإضاءة"><path d="M25 20v125h235" fill="none" stroke="#dce5cf"/><path d="'+points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')+'" fill="none" stroke="#7b9d57" stroke-width="3"/><circle cx="'+(25+Number(values.light)*2.2)+'" cy="'+(145-trial.rate)+'" r="5" fill="#497237" stroke="#fff" stroke-width="2"/><text x="140" y="170" text-anchor="middle" font-size="10" fill="#8a9978">شدة الإضاءة النسبية</text></svg><div class="sp-lab-value">'+trial.rate+'</div><small class="sp-lab-unit">مؤشر الاستجابة النسبية</small>';
      }
      root.querySelector('[data-lab-record]').disabled=JSON.stringify(values)===lastSignature;
    }
    function row(event) {
      const p=event.payload&&event.payload.parameters||{};
      if(id==='genetics') {
        if(!['AA','Aa','aa'].includes(p.mother)||!['AA','Aa','aa'].includes(p.father))return null;
        const result=D.cross(p.mother,p.father);return [p.mother+' × '+p.father,result.dominant+'%',result.recessive+'%'];
      }
      if(id==='soil'){const result=D.soil(p.sand);return [D.clamp(p.sand,0,100)+'%',result.infiltration,result.retention];}
      return [D.clamp(p.light,0,100),D.clamp(p.co2,0,1200),D.clamp(p.temperature,0,50),D.photosynthesis(p.light,p.co2,p.temperature)];
    }
    const headers=id==='genetics'?['التزاوج','الصفة السائدة','الصفة المتنحية']:id==='soil'?['الرمل','مؤشر النفاذية','مؤشر الاحتفاظ']:['الإضاءة','CO₂ المفترض','الحرارة','الاستجابة'];
    function renderTable() {
      const rows=records.map(row).filter(Boolean);
      root.querySelector('[data-lab-table]').innerHTML=rows.length?'<table class="sp-table"><thead><tr><th>الحالة</th>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(-10).map((x,i)=>'<tr><td>'+ (i+1)+'</td>'+x.map(v=>'<td>'+D.esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<div class="sp-empty"><p>غيّر أحد المتغيرات وسجّل أول حالة. لن نملأ الجدول بقياسات وهمية.</p></div>';
      root.querySelector('[data-lab-conclusion]').innerHTML='<strong>03 · ابنِ استنتاجك</strong>'+(rows.length>=3?(id==='genetics'?'قارن نسب AA وAa وaa. هل تميّز بين النمط الوراثي والصفة الظاهرة؟ تحقّق من التزاوج Aa × Aa لتفسير النسبة 3:1.':id==='soil'?'أي الخليطين يعطي مؤشر نفاذية أكبر؟ لا تعمم أرقام النموذج على تربة حقيقية؛ فكّر أيضًا في البنية والمادة العضوية.':'قارن حالات تغيّر فيها عامل واحد فقط. لاحظ أن رفع الإضاءة لا يضمن ارتفاعًا مماثلًا عندما يصبح عامل آخر محدِّدًا.'):'تحتاج إلى '+Math.max(0,3-rows.length)+' حالات إضافية للمقارنة. اكتب تفسيرًا يميز بين النتيجة وافتراضات النموذج.');
    }
    async function record() {
      const button=root.querySelector('[data-lab-record]');button.disabled=true;
      try{
        const signature=JSON.stringify(values);
        if(signature===lastSignature)return;
        const event=await onRecord({event_kind:'lab',resource_key:'lab:'+id,payload:{parameters:{...values},result:calculate(),model:'illustrative-v1'}});
        if(!active)return;
        records.push(event);lastSignature=signature;renderTable();
        root.querySelector('[data-lab-status]').textContent='حُفظت الحالة في دفتر التجربة على هذا الجهاز.';
      }catch(error){if(active)root.querySelector('[data-lab-status]').textContent=error.message||'تعذر حفظ الحالة.';}
      finally{if(active)button.disabled=JSON.stringify(values)===lastSignature;}
    }
    function input(event){const key=event.target.dataset.labControl;if(!key)return;values[key]=id==='genetics'?event.target.value:Number(event.target.value);draw();}
    function click(event){if(event.target.closest('[data-lab-record]'))record();if(event.target.closest('[data-lab-export]')){
      const rows=records.map(row).filter(Boolean);if(!rows.length){root.querySelector('[data-lab-status]').textContent='سجّل حالة أولًا.';return;}
      const csv=String.fromCodePoint(0xfeff)+[headers,...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='gosvt-'+id+'-trials.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }}
    root.addEventListener('input',input);root.addEventListener('change',input);root.addEventListener('click',click);draw();renderTable();
    return {dispose(){active=false;root.removeEventListener('input',input);root.removeEventListener('change',input);root.removeEventListener('click',click);}};
  }
  window.GoSVTPlatformLabs=Object.freeze({labs,mount});
})();
