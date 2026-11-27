/* Small, accessible schematic illustrations; these are not microscope photographs. */
(function () {
  'use strict';
  const paths = {
    home:'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9', book:'M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z',
    route:'M5 5h10a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10M5 3v4M19 19v4', flask:'M9 3h6M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10',
    quiz:'M9 4h6M9 2h6v4H9ZM8 4H5v18h14V4h-3M8 12l2 2 5-5M8 18h7', calendar:'M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 18h2',
    note:'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5', chart:'M4 3v18h17M8 17v-5M13 17V7M18 17v-8', clock:'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', arrow:'M19 12H5m6-6-6 6 6 6', arrowRight:'M5 12h14m-6-6 6 6-6 6',
    check:'M5 12l4 4L19 6', close:'m6 6 12 12M18 6 6 18', plus:'M12 5v14M5 12h14', bookmark:'M6 3h12v18l-6-4-6 4Z',
    leaf:'M4 20C4 6 11 3 21 3c0 12-7 18-15 13M4 20 15 9', cap:'m2 9 10-5 10 5-10 5ZM6 11v7c4 3 8 3 12 0v-7M22 9v8',
    bell:'M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3ZM10 21h4', sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
    logout:'M9 3H4v18h5M10 12h11m-5-5 5 5-5 5', menu:'M4 6h16M4 12h16M4 18h16', download:'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4',
    play:'m8 4 12 8-12 8Z', pause:'M8 5v14M16 5v14', user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-2a8 8 0 0 1 16 0v2',
    cloud:'M7 18a5 5 0 1 1 0-10 7 7 0 0 1 13 3 4 4 0 0 1-1 8H7', info:'M12 11v6M12 7v.2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7', edit:'m4 16 12-12 4 4L8 20H4Zm10-10 4 4', school:'M3 10 12 4l9 6M5 9v12h14V9M9 21v-6h6v6M9 10h1M14 10h1',
    spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z', flag:'M5 22V3c5-4 9 4 15 0v10c-6 4-10-4-15 0', file:'M6 2h8l5 5v15H6ZM14 2v6h5M9 12h7M9 16h7'
  };
  function icon(name) { return '<svg class="sp-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (paths[name] || paths.book) + '"/></svg>'; }
  function cover(key) {
    let body = '';
    if (key === 'energy') body='<g transform="rotate(-16 120 68)"><ellipse cx="120" cy="67" rx="67" ry="36" fill="#dce7b8" stroke="#819d58" stroke-width="2"/><ellipse cx="120" cy="67" rx="59" ry="28" fill="#eaf0cc" stroke="#9bb26e" stroke-width="1.4"/><path d="M67 65q11-30 17-1t17-4 16 2 16-5 17 3 16-3" fill="none" stroke="#91a85d" stroke-width="4" stroke-linecap="round"/><g fill="#c1c47e"><circle cx="88" cy="53" r="3"/><circle cx="140" cy="82" r="3"/><circle cx="156" cy="56" r="3"/><circle cx="109" cy="80" r="2"/></g></g><g fill="#b5c491" opacity=".6"><circle cx="39" cy="43" r="5"/><circle cx="199" cy="94" r="7"/><circle cx="190" cy="32" r="3"/></g>';
    else if (key==='muscle') body='<g transform="rotate(-17 120 65)"><rect x="52" y="34" width="136" height="67" rx="30" fill="#e5b6a4"/><g stroke="#cf8f81" stroke-width="6"><path d="M66 45h107M60 59h122M60 73h122M69 88h103"/></g><g stroke="#f1d4c4" stroke-width="4"><path d="M83 36v63M104 34v67M125 34v67M146 34v67M167 39v56"/></g></g><circle cx="202" cy="35" r="4" fill="#dab9ad"/><circle cx="39" cy="98" r="7" fill="#e9cdc2"/>';
    else if (key==='genetics') body='<g fill="none" stroke-width="5" stroke-linecap="round"><path d="M94 12c95 36-44 78 50 112" stroke="#9d87b8"/><path d="M144 12c-95 36 44 78-50 112" stroke="#bac5a5"/></g><g stroke="#ad9cc3" stroke-width="3" opacity=".8"><path d="M101 19h36M112 32h13M106 46h25M93 60h52M94 75h50M108 88h22M112 101h14M101 115h35"/></g><circle cx="47" cy="51" r="15" fill="#e2dcf0"/><circle cx="194" cy="97" r="9" fill="#ddd5eb"/>';
    else if (key==='earth') body='<path d="m30 79 47-39 45 20 43-28 47 46v32H30Z" fill="#b8b78a"/><path d="m30 84 47-29 45 19 43-28 47 45v10H30Z" fill="#d5c79e"/><path d="m30 95 49-18 42 10 43-21 48 33v17H30Z" fill="#c0a57b"/><path d="m30 108 51-13 40 11 43-16 48 21v12H30Z" fill="#dfcaa6"/><path d="M49 87q11-10 16 1m75 17q8-9 15 0" fill="none" stroke="#8b8a62" stroke-width="3"/><circle cx="191" cy="30" r="12" fill="#e8d9b0"/>';
    else if (key==='exam') body='<g transform="rotate(8 120 68)"><rect x="74" y="14" width="92" height="112" rx="9" fill="#fdfcf5" stroke="#d8ceac" stroke-width="2"/><rect x="96" y="8" width="48" height="15" rx="5" fill="#bdc29c"/><g stroke="#d5d8bd" stroke-width="4" stroke-linecap="round"><path d="M91 43h57M91 56h42M91 78h57M91 91h34M91 104h45"/></g></g><path d="m167 99 20-57 9 3-20 57-9 6Z" fill="#a0ac7d"/><circle cx="44" cy="75" r="12" fill="#e9dfbf"/>';
    else body='<path d="M118 119V49" fill="none" stroke="#87a161" stroke-width="4"/><path d="M118 81C75 84 67 64 70 45c27-2 46 10 48 36" fill="#a8be84"/><path d="M119 67c1-30 25-46 53-45 2 26-15 48-53 45" fill="#87a964"/><path d="m119 80-35-25m35 12 40-33" fill="none" stroke="#6e9253" stroke-width="2"/><path d="M86 116q33-12 67 0" fill="none" stroke="#c6caaa" stroke-width="8" stroke-linecap="round"/><circle cx="49" cy="30" r="15" fill="#e0d999"/><circle cx="192" cy="101" r="6" fill="#ccd6b3"/>';
    return '<svg viewBox="0 0 240 136" role="img" aria-label="رسم مفاهيمي توضيحي، وليس صورة مجهرية">'+body+'</svg>';
  }
  window.GoSVTPlatformArt = Object.freeze({ icon, cover });
})();
