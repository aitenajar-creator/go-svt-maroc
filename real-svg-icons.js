/* GO SVT Maroc — Consistent inline SVG icon system.
 * Original Lucide-style SVG paths; no emoji glyphs and no external icon font.
 */
(function () {
  'use strict';
  const paths = {
    book:'<path d="M12 7v14"/><path d="M3 18V5a2 2 0 0 1 2-2h4a3 3 0 0 1 3 3 3 3 0 0 1 3-3h4a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1h-5a3 3 0 0 0-3 2 3 3 0 0 0-3-2H4a1 1 0 0 1-1-1Z"/>',
    pencil:'<path d="m16 4 4 4"/><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/>',
    clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5Z"/><path d="M9 11h6M9 15h6"/>',
    globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>',
    chart:'<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>',
    target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    note:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    flame:'<path d="M12 22c4.4 0 7-3 7-7 0-3-1.5-5-4-8-.2 2-1 3-2 4-1-4-3-6-5-8 0 4-3 7-3 12 0 4 2.7 7 7 7Z"/><path d="M10 18c0-1.5 1-2.5 2-4 1 1 2 2.5 2 4a2 2 0 0 1-4 0Z"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    microscope:'<path d="m6 18 6-6"/><path d="m9 3 6 6"/><path d="m8 4 3-3 5 5-3 3"/><path d="M5 21h14"/><path d="M12 12a6 6 0 0 0 6 6"/><path d="M18 18v3"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    refresh:'<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/>',
    usersRound:'<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M20 8v6M23 11h-6"/>',
    award:'<circle cx="12" cy="8" r="6"/><path d="m8.2 13-1.2 9 5-3 5 3-1.2-9"/>',
    search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z"/>',
    flask:'<path d="M9 3h6M10 3v6l-5.5 9.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 9V3"/><path d="M8 15h8"/>',
    atom:'<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/>',
    leaf:'<path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-8 8-16Z"/><path d="M4 21c3-6 7-9 13-12"/>',
    dna:'<path d="M7 3c0 6 10 12 10 18M17 3C17 9 7 15 7 21M8 6h8M6 10h12M6 14h12M8 18h8"/>',
    testtube:'<path d="M9 3h6M10 3v11a4 4 0 1 0 4 0V3"/><path d="M10 15h4"/>',
    brain:'<path d="M12 18V5a3 3 0 0 0-5.8-1A4 4 0 0 0 4 11a4 4 0 0 0 3 7h5ZM12 18V5a3 3 0 0 1 5.8-1A4 4 0 0 1 20 11a4 4 0 0 1-3 7h-5Z"/>',
    clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    pin:'<path d="M16 3 21 8l-4 1-4 4-1 5-3-3-5 5"/><path d="m8 8 8 8"/>',
    send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    userCheck:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    fileText:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    megaphone:'<path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 14.5 13 21H8l-2-8"/><path d="M21 10v4"/>',
    filter:'<path d="M4 5h16M7 12h10m-7 7h4"/>',
    eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    bookmark:'<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z"/>',
    calendarPlus:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5m-2.5-2.5h5"/>',
    clipboardCheck:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5Z"/><path d="m8 13 2 2 5-5"/>',
    help:'<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-1.2 1.1-1.8 1.3-1.8 3M12 17h.01"/>',
    sort:'<path d="M4 6h16M7 12h10m-7 6h4"/><path d="m18 15 2 3 2-3"/>',
    userPlus:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M19 8v6m-3-3h6"/>',
    messageReply:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 12h8m-8-3h5"/>',
    pencilLine:'<path d="m12 20 9-9-4-4-9 9-1 5Z"/><path d="m14 6 4 4M4 20h4"/>',
    checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>'
  };
  const svg = name => '<svg class="gs-svg-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.book)+'</svg>';
  const tabIcons={dashboard:'chart',progress:'target',history:'clipboard',mistakes:'microscope',favorites:'heart',motivation:'trophy',planner:'calendar',notes:'note'};
  const emojiMap={'📚':'book','📖':'book','✏️':'pencil','📝':'clipboard','📋':'clipboard','🌍':'globe','🌐':'globe','📊':'chart','📈':'chart','🎯':'target','⭐':'award','🏅':'award','🏆':'trophy','🗓️':'calendar','📅':'calendar','🗒':'note','🔥':'flame','✅':'check','🌱':'leaf','🌿':'leaf','🧩':'target','⚡':'target','🎓':'users','👥':'users','💬':'message','📢':'bell','🔔':'bell','🔬':'microscope','🧪':'testtube','⚗️':'flask','🧬':'dna','⚛️':'atom','🧠':'brain','🔄':'refresh','🔍':'search','⚙️':'settings','⏱️':'clock','🛡️':'shield','✉️':'mail'};
  function addIcon(el,name,where){if(!el||el.querySelector(':scope > .gs-svg-icon'))return;const wrap=document.createElement('span');wrap.innerHTML=svg(name);const node=wrap.firstChild;if(where==='after')el.appendChild(node);else el.insertBefore(node,el.firstChild);}
  function decorate(root){
    (root||document).querySelectorAll('.feature-icon').forEach((el,i)=>{el.textContent='';el.appendChild(document.createRange().createContextualFragment(svg(['book','pencil','clipboard','globe'][i%4])));});
    (root||document).querySelectorAll('.space-tab[data-tab]').forEach(el=>{const key=el.getAttribute('data-tab');const name=tabIcons[key];if(name){el.textContent=el.textContent.replace(/^[\s🗓️🗒]+/u,'');addIcon(el,name);}});
    (root||document).querySelectorAll('.stat-icon').forEach((el,i)=>{const names=['book','check','pencil','clipboard','chart','target'];el.textContent='';el.appendChild(document.createRange().createContextualFragment(svg(names[i%names.length])));});
    (root||document).querySelectorAll('.gs-path-icon').forEach((el,i)=>{const names=['book','target','chart','trophy'];el.textContent='';el.appendChild(document.createRange().createContextualFragment(svg(names[i%names.length])));});
    (root||document).querySelectorAll('.gs-badge-icon').forEach(el=>{const name=emojiMap[el.textContent.trim()]||'award';el.textContent='';el.appendChild(document.createRange().createContextualFragment(svg(name)));});
    (root||document).querySelectorAll('.streak-icon').forEach(el=>{el.textContent='';el.appendChild(document.createRange().createContextualFragment(svg('flame')));});
    (root||document).querySelectorAll('#gs-classroom h3').forEach(el=>{
      if(el.dataset.gsIconDone)return;
      const raw=el.textContent.trim();let name='book';
      if(/أستاذ|enseignant|فضاء الأستاذ|échanges/i.test(raw))name='users';
      else if(/سؤال|مناقش|question|discussion/i.test(raw))name='message';
      else if(/قسم|classe|تلاميذ|élèves/i.test(raw))name='usersRound';
      else if(/واجب|devoir/i.test(raw))name='clipboard';
      else if(/إعلان|annonce/i.test(raw))name='bell';
      else if(/مراجعة|révision|séance/i.test(raw))name='calendar';
      else if(/تقرير|rapport|نتائج|résultat/i.test(raw))name='chart';
      else if(/إعداد|paramètre/i.test(raw))name='settings';
      else if(/مختبر|تجربة|laboratoire|expérience/i.test(raw))name='flask';
      else if(/وراثة|جين|adn|génétique/i.test(raw))name='dna';
      else if(/خلية|خلايا|cellule/i.test(raw))name='atom';
      else if(/نبات|بيئة|écologie|plante/i.test(raw))name='leaf';
      else if(/دماغ|عصب|cerveau|nerveux/i.test(raw))name='brain';
      else if(/وقت|مدة|وقت|temps|durée/i.test(raw))name='clock';
      else if(/بحث|recherche/i.test(raw))name='search';
      else {const emoji=Object.keys(emojiMap).find(e=>raw.startsWith(e));if(emoji)name=emojiMap[emoji];}
      el.innerHTML=el.innerHTML.replace(/^(?:\s|🎓|💬|📚|📢|🗓️)+/u,'');
      addIcon(el,name);el.dataset.gsIconDone='1';
    });
    (root||document).querySelectorAll('#gs-classroom button[data-action]').forEach(el=>{
      if(el.dataset.gsIconDone)return;
      const action=el.dataset.action;const actionIcons={'refresh-panel':'refresh','download-report':'download','thread':'messageReply','ask':'send','join':'userPlus','create-class':'users','roster':'usersRound','filter-inbox':'filter','toggle-pin':'pin','submit-assignment':'send','create-assignment':'clipboardCheck','create-announcement':'megaphone','create-session':'calendarPlus','grade-submission':'checkCircle','reply':'messageReply','export-class-report':'fileText','student-notes':'note','open-support-plan':'heart','student-report':'chart','print-student-report':'fileText','save-support-plan':'checkCircle','edit-student-note':'pencilLine','delete-student-note':'trash','save-student-note':'checkCircle','update-student-note':'pencilLine'};const name=actionIcons[action]||(action.includes('search')?'search':action.includes('delete')?'trash':action.includes('report')?'chart':action.includes('question')?'message':action.includes('review')?'calendar':'check');
      addIcon(el,name);el.dataset.gsIconDone='1';
    });
  }
  function start(){
    const style=document.createElement('style');style.id='gs-svg-icon-style';style.textContent='.gs-svg-icon{display:inline-block;width:1.2em;height:1.2em;flex:0 0 1.2em;vertical-align:-.22em;stroke:currentColor}.feature-icon .gs-svg-icon{width:32px;height:32px;color:#176b4b}.space-tab .gs-svg-icon{margin-inline-end:.45rem}.stat-icon .gs-svg-icon{width:25px;height:25px;color:#176b4b}.gs-path-icon .gs-svg-icon{width:23px;height:23px;color:#176b4b}.gs-badge-icon .gs-svg-icon{width:25px;height:25px;color:#b88626}.streak-icon .gs-svg-icon{width:27px;height:27px;color:#d97706}#gs-classroom h3 .gs-svg-icon{color:#238052}#gs-classroom .gs-cl-head h3 .gs-svg-icon{color:inherit}#gs-classroom button .gs-svg-icon{margin-inline-end:.4rem}';document.head.appendChild(style);
    decorate(document);
    const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)decorate(node);})));
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
