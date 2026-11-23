/* Go SVT Maroc — unified, attribution-aware science image catalogue */
(function (window, document) {
  'use strict';

  const QUERY_BY_CATEGORY = Object.freeze({
    'cell/plant': 'plant cell microscopy chloroplast',
    'genetics/dna': ['DNA molecule model scientific photography', 'DNA double helix molecular model photograph', 'DNA molecular structure physical model'],
    'cell/animal': ['animal tissue histology light microscopy micrograph', 'human epithelial tissue histology microscope', 'human muscle tissue histology microscopy', 'human neuron histology microscopy micrograph'],
    'cell/mitosis': 'mitosis onion root tip microscope micrograph',
    'respiratory/alveoli': ['human lung alveoli histology microscope micrograph', 'lung alveoli histology microscopy'],
    'ecology/ecosystem': 'forest ecosystem biodiversity field photography',
    'geology/rock': 'geological rock outcrop field photograph'
  });

  let cataloguePromise;

  function loadCatalogue() {
    if (!cataloguePromise) {
      cataloguePromise = fetch(new URL('science-media.json', document.baseURI).href, {
        cache: 'no-cache',
        headers: { Accept: 'application/json' }
      }).then(function (response) {
        if (!response.ok) throw new Error('Science image catalogue HTTP ' + response.status);
        return response.json();
      }).then(function (catalogue) {
        if (!catalogue || !catalogue.items || typeof catalogue.items !== 'object') {
          throw new Error('Invalid science image catalogue');
        }
        return catalogue.items;
      }).catch(function (error) {
        cataloguePromise = null;
        throw error;
      });
    }
    return cataloguePromise;
  }

  function safeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      if (url.protocol !== 'https:' && url.origin !== window.location.origin) return null;
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  async function getImage(category, subcategory) {
    const key = String(category || '').toLowerCase() + '/' + String(subcategory || '').toLowerCase();
    const queries = QUERY_BY_CATEGORY[key];
    if (!queries) return null;

    const items = await loadCatalogue();
    const candidates = Array.isArray(queries) ? queries : [queries];
    for (const query of candidates) {
      const item = items[query];
      if (!item || !item.image_url || !item.source_url || !item.license || !item.author) continue;
      if (/licence non indiquée|auteur non indiqué/i.test(item.license + ' ' + item.author)) continue;

      const url = safeImageUrl(item.image_url);
      const sourceUrl = safeImageUrl(item.source_url);
      if (!url || !sourceUrl) continue;

      const image = new URL(url);
      const source = new URL(sourceUrl);
      const localCached = image.origin === window.location.origin && image.pathname.includes('/science-media-cache/');
      const commonsImage = image.hostname === 'upload.wikimedia.org';
      if ((!localCached && !commonsImage) || source.hostname !== 'commons.wikimedia.org') continue;

      if (key === 'cell/plant' && (item.is_micrograph !== true || item.metadata_screened !== true)) continue;

      const originalUrl = item.original_url ? safeImageUrl(item.original_url) : url;
      if (!originalUrl) continue;
      const original = new URL(originalUrl);
      if (original.hostname !== 'upload.wikimedia.org' && original.origin !== window.location.origin) continue;

      return Object.assign({}, item, { url: url, source_url: source.href, original_url: original.href });
    }
    return null;
  }

  function applyImage(element, imageData) {
    if (!element || !imageData || !imageData.url) return;
    const probe = new Image();
    probe.onload = function () {
      element.style.backgroundImage = 'url("' + imageData.url.replace(/["\\\\]/g, '\\\\$&') + '")';
      element.style.backgroundSize = 'cover';
      element.style.backgroundPosition = 'center';
      element.setAttribute('data-real-image', 'true');
      element.setAttribute('title', (imageData.title || '') + ' — ' + imageData.license);
    };
    probe.onerror = function () {
      element.removeAttribute('data-real-image');
      element.style.removeProperty('background-image');
    };
    probe.src = imageData.url;
  }

  const CATEGORY_LABELS = Object.freeze({
     'cell/plant': { ar: 'خلايا نباتية تحت المجهر', fr: 'Cellules végétales au microscope', alt: 'صورة مجهرية حقيقية لخلايا نباتية', descriptionAr: 'لاحظ حدود الخلايا، انتظامها، ومناطق اللون المختلفة. لا تفترض وجود عضية إلا إذا كانت ظاهرة بوضوح في الصورة.', descriptionFr: 'Observer les limites cellulaires, leur organisation et les zones colorées. Ne conclure à la présence d’un organite que s’il est clairement visible.', questionAr: 'ما الذي يخبرك به انتظام الخلايا وحدودها عن بنية النسيج النباتي؟', questionFr: 'Que révèlent l’organisation et les limites des cellules sur la structure du tissu végétal ?' },
     'genetics/dna': { ar: 'الوراثة والحمض النووي', fr: 'Génétique et ADN', alt: 'صورة علمية للحمض النووي', descriptionAr: 'ميّز بين الصورة المجهرية والنموذج الجزيئي. ابحث عن شكل اللولب المزدوج، وتذكّر أن النماذج قد تستخدم ألواناً اصطلاحية.', descriptionFr: 'Distinguer une micrographie d’un modèle moléculaire. Repérer la double hélice et noter que les couleurs d’un modèle sont conventionnelles.', questionAr: 'ما المعلومة التي يقدمها شكل اللولب المزدوج عن تنظيم المادة الوراثية؟', questionFr: 'Que nous apprend la forme en double hélice sur l’organisation du matériel génétique ?' },
     'ecology/ecosystem': { ar: 'الأنظمة البيئية والتنوع الحيوي', fr: 'Écosystèmes et biodiversité', alt: 'صورة ميدانية لنظام بيئي', descriptionAr: 'حدّد مكونات حية وغير حية ظاهرة، ثم اقترح علاقة بيئية محتملة لا يمكن تأكيدها من الصورة وحدها.', descriptionFr: 'Identifier des éléments biotiques et abiotiques visibles, puis proposer une interaction possible sans la considérer comme confirmée par l’image seule.', questionAr: 'اختر مكوناً حياً وآخر غير حي، واقترح علاقة محتملة بينهما.', questionFr: 'Choisissez un élément biotique et un élément abiotique, puis proposez une interaction possible.' },
     'geology/rock': { ar: 'الصخور والتكوينات الجيولوجية', fr: 'Roches et formations géologiques', alt: 'صورة ميدانية لصخور جيولوجية', descriptionAr: 'لاحظ اللون، البنية، التطبق أو التشققات. لا تحدد نوع الصخر اعتماداً على الصورة فقط ما لم تدعمها معطيات إضافية.', descriptionFr: 'Observer la couleur, la texture, les strates ou les fissures. Ne déterminer le type de roche sur photo seule qu’avec prudence et données complémentaires.', questionAr: 'ما العلامات المرئية التي يمكن أن تساعد على وصف هذه الصخرة أو التكوين؟', questionFr: 'Quels indices visibles permettent de décrire cette roche ou cette formation ?' },
    'cell/animal': { ar: 'الأنسجة الحيوانية تحت المجهر', fr: 'Tissus animaux au microscope', alt: 'صورة مجهرية لأنسجة حيوانية', descriptionAr: 'تعرّف على تنظيم الخلايا في الأنسجة الحيوانية، وكيف يختلف شكل الخلايا بحسب وظيفتها.', descriptionFr: 'Observer l’organisation cellulaire des tissus animaux et relier leur forme à leur fonction.', questionAr: 'ما أوجه الاختلاف بين أشكال الخلايا، وكيف يمكن ربطها بوظائف النسيج؟', questionFr: 'Quelles différences de forme observez-vous et comment les relier à la fonction du tissu ?' },
    'cell/mitosis': { ar: 'الانقسام الخلوي', fr: 'Division cellulaire', alt: 'صورة مجهرية لمراحل الانقسام الخلوي', descriptionAr: 'ابحث عن تغيرات النواة والكروموسومات خلال مراحل الانقسام، مع الانتباه إلى أن الصورة قد تمثل مرحلة واحدة فقط.', descriptionFr: 'Repérer les changements du noyau et des chromosomes. L’image peut ne montrer qu’une seule phase.', questionAr: 'ما العلامة التي تساعدك على تمييز مرحلة الانقسام الظاهرة؟', questionFr: 'Quel indice permet d’identifier la phase de division représentée ?' },
    'respiratory/alveoli': { ar: 'الحويصلات الرئوية', fr: 'Alvéoles pulmonaires', alt: 'صورة مجهرية للحويصلات الرئوية', descriptionAr: 'الحويصلات فضاءات صغيرة تحيط بها شعيرات دموية؛ بنيتها تساعد على تبادل الغازات بين الهواء والدم.', descriptionFr: 'Les alvéoles sont de petits espaces entourés de capillaires où s’effectuent les échanges gazeux.', questionAr: 'كيف تساعد البنية الرقيقة للحويصلات وقرب الشعيرات الدموية على تبادل الغازات؟', questionFr: 'Comment la paroi fine des alvéoles et la proximité des capillaires facilitent-elles les échanges gazeux ?' }
  });

  const REVIEW_GUIDANCE = Object.freeze({
    'cell/plant': { ar: 'ابحث عن حدود الخلايا، انتظامها، وما تسمح الصورة برؤيته فعلاً. اربط ملاحظتك ببنية النسيج دون افتراض عضيات غير واضحة.', fr: 'Repérez les limites cellulaires, leur organisation et ce que l’image montre réellement. Reliez vos observations au tissu sans supposer des organites non visibles.', terms: ['خلية', 'خلايا', 'حدود', 'نسيج', 'cellule', 'cellules', 'limites', 'tissu'] },
    'genetics/dna': { ar: 'ميّز بين نموذج جزيئي وصورة مجهرية، واذكر اللولب المزدوج وعلاقته بتنظيم المادة الوراثية.', fr: 'Distinguez un modèle moléculaire d’une micrographie et mentionnez la double hélice et son rôle dans l’organisation du matériel génétique.', terms: ['لولب', 'مزدوج', 'وراث', 'حمض نووي', 'double hélice', 'adn', 'génétique'] },
    'ecology/ecosystem': { ar: 'اذكر عنصراً حياً وعنصراً غير حي، ثم وضّح العلاقة المحتملة بينهما مع الاستناد إلى دليل من الصورة.', fr: 'Citez un élément biotique et un élément abiotique, puis expliquez une interaction possible à partir d’un indice visible.', terms: ['حي', 'غير حي', 'نبات', 'ماء', 'تربة', 'biotique', 'abiotique', 'eau', 'sol', 'interaction'] },
    'geology/rock': { ar: 'صف علامات مرئية مثل اللون أو النسيج أو التطبق أو التشققات. تجنب الجزم بنوع الصخر دون معطيات إضافية.', fr: 'Décrivez des indices visibles comme la couleur, la texture, les strates ou les fissures. Évitez d’identifier la roche sans données complémentaires.', terms: ['لون', 'نسيج', 'تطبق', 'تشققات', 'couleur', 'texture', 'strates', 'fissures'] },
    'cell/animal': { ar: 'قارن شكل الخلايا وتنظيمها، ثم اقترح كيف يمكن أن يرتبط الشكل بوظيفة النسيج.', fr: 'Comparez la forme et l’organisation des cellules, puis reliez prudemment leur forme à la fonction du tissu.', terms: ['خلايا', 'شكل', 'نسيج', 'وظيفة', 'cellules', 'forme', 'tissu', 'fonction'] },
    'cell/mitosis': { ar: 'استند إلى مظهر النواة أو الكروموسومات لتحديد ما يمكن ملاحظته، ولا تعمم مرحلة واحدة على كل الانقسام.', fr: 'Appuyez-vous sur l’aspect du noyau ou des chromosomes et évitez de généraliser une seule phase à toute la division.', terms: ['نواة', 'كروموسوم', 'انقسام', 'chromosome', 'noyau', 'division'] },
    'respiratory/alveoli': { ar: 'اربط رقة جدار الحويصلات وقرب الشعيرات الدموية بانتقال الغازات بين الهواء والدم.', fr: 'Reliez la finesse de la paroi alvéolaire et la proximité des capillaires aux échanges gazeux entre l’air et le sang.', terms: ['حويصل', 'شعيرات', 'غازات', 'دم', 'alvéol', 'capillaires', 'échanges gazeux', 'sang'] }
  });

  const processedGalleries = new WeakSet();

  function renderImageContainer(container) {
    if (!container || processedGalleries.has(container)) return;
    processedGalleries.add(container);
    const category = (container.getAttribute('data-real-images') || '').toLowerCase();
    const subcategory = (container.getAttribute('data-real-images-sub') || '').toLowerCase();
    const key = category + '/' + subcategory;
    const labels = CATEGORY_LABELS[key];
    if (!labels) {
      container.textContent = document.documentElement.lang === 'fr'
        ? 'Catégorie d’image scientifique non reconnue.'
        : 'فئة الصور العلمية غير معروفة.';
      return;
    }

    container.classList.add('ri-gallery-container');
    container.setAttribute('aria-busy', 'true');
    const loading = document.createElement('p');
    loading.className = 'ri-placeholder';
    loading.textContent = document.documentElement.lang === 'fr' ? 'Chargement de la photo scientifique…' : 'جارٍ تحميل الصورة العلمية…';
    container.replaceChildren(loading);

    getImage(category, subcategory).then(function (item) {
      if (!item) throw new Error('No verified image for ' + key);
      const card = document.createElement('a');
      card.href = '#';
      card.className = 'gs-real-science-photo ri-image-card';
      card.setAttribute('aria-label', (document.documentElement.lang === 'fr' ? 'Agrandir : ' : 'تكبير الصورة: ') + (item.title || labels.ar));
      card.dataset.realImageUrl = item.url;
      card.dataset.sourcePageUrl = item.source_url;
      card.dataset.originalFileUrl = item.original_url || item.url;
      card.dataset.scienceTitle = item.title || '';
      card.dataset.scienceDescription = item.description || '';
      card.dataset.scienceDate = item.date_taken || '';
      card.dataset.scienceDimensions = item.width && item.height ? item.width + ' × ' + item.height + ' px' : '';
      card.dataset.scienceMime = item.mime || '';
      card.dataset.scienceCredit = item.credit || '';
      const frame = document.createElement('span');
      frame.className = 'ri-image-frame';
      const image = document.createElement('img');
      image.className = 'ri-image';
      image.src = item.url;
      image.alt = labels.alt;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', function () {
        card.remove();
        showGalleryFallback(container, labels);
      }, { once: true });
      frame.appendChild(image);
      const overlay = document.createElement('span');
      overlay.className = 'ri-image-overlay';
      overlay.textContent = document.documentElement.lang === 'fr' ? 'Cliquer pour agrandir' : 'اضغط لتكبير الصورة';
      frame.appendChild(overlay);
      const info = document.createElement('span');
      info.className = 'ri-image-info';
      const title = document.createElement('strong');
      title.textContent = item.title || (document.documentElement.lang === 'fr' ? labels.fr : labels.ar);
      const credit = document.createElement('span');
      credit.className = 'gs-science-media-credit';
      credit.textContent = (item.author || '') + ' · ' + (item.license || '');
      info.append(title, credit);
      if (labels.descriptionAr || labels.descriptionFr) {
        const guide = document.createElement('span');
        guide.className = 'ri-image-observation-guide';
        const guideLabel = document.createElement('strong');
        guideLabel.className = 'ri-image-observation-label';
        guideLabel.textContent = document.documentElement.lang === 'fr' ? 'Guide d’observation' : 'دليل الملاحظة العلمية';
        const description = document.createElement('span');
        description.className = 'ri-image-description';
        description.textContent = document.documentElement.lang === 'fr' ? (labels.descriptionFr || '') : (labels.descriptionAr || '');
        guide.append(guideLabel, description);
        if (labels.questionAr || labels.questionFr) {
          const question = document.createElement('span');
          question.className = 'ri-image-observation-question';
          const questionLabel = document.createElement('strong');
          questionLabel.textContent = document.documentElement.lang === 'fr' ? 'Question de réflexion' : 'سؤال للتفكير';
          const questionText = document.createElement('span');
          questionText.textContent = document.documentElement.lang === 'fr' ? (labels.questionFr || '') : (labels.questionAr || '');
          question.append(questionLabel, questionText);
          guide.appendChild(question);
        }
        info.appendChild(guide);
      }
      card.append(frame, info);
      container.replaceChildren(card, createObservationActivity(key));
      container.setAttribute('aria-busy', 'false');
    }).catch(function () {
      showGalleryFallback(container, labels);
    });
  }

  function ensureGuidedReasoningStyles() {
    if (document.getElementById('ri-guided-reasoning-styles')) return;
    const style = document.createElement('style');
    style.id = 'ri-guided-reasoning-styles';
    style.textContent = '.ri-guided-reasoning{display:grid;gap:12px;margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:14px;background:rgba(14,116,144,.06)}.ri-guided-reasoning>strong{font-size:1.05rem}.ri-guided-reasoning p{margin:0;line-height:1.7}.ri-guided-step label{display:grid;gap:6px;font-weight:600}.ri-guided-step textarea{width:100%;min-height:64px;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:Canvas;color:CanvasText;font:inherit;resize:vertical}.ri-observation-compose{justify-self:start;padding:9px 16px;border:0;border-radius:9px;background:#0e7490;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ri-observation-compose-status{font-size:.9em;line-height:1.6}@media(max-width:600px){.ri-guided-reasoning{padding:12px}.ri-observation-compose{width:100%}}';
    document.head.appendChild(style);
  }

  function createObservationActivity(categoryKey) {
    ensureGuidedReasoningStyles();
    const isFrench = document.documentElement.lang === 'fr';
    const activity = document.createElement('section');
    activity.className = 'ri-observation-activity';
    const guidePanel = document.createElement('div');
    guidePanel.className = 'ri-guided-reasoning';
    const guideTitle = document.createElement('strong');
    guideTitle.textContent = isFrench ? 'Construisez votre conclusion en 3 étapes' : 'ابنِ استنتاجك في ثلاث خطوات';
    const guideIntro = document.createElement('p');
    guideIntro.textContent = isFrench ? 'Décrivez d’abord, interprétez ensuite, puis formulez une conclusion.' : 'ابدأ بوصف ما تراه، ثم فسّر الملاحظة، وبعدها صغ استنتاجك.';
    guidePanel.append(guideTitle, guideIntro);
    const guidedFields = [
      { key: 'evidence', ar: '1. ماذا ألاحظ؟', fr: '1. Que vois-je ?', placeholderAr: 'اذكر شكلاً أو بنية أو لوناً أو علاقة ظاهرة…', placeholderFr: 'Décrivez une forme, une structure, une couleur ou une relation visible…' },
      { key: 'meaning', ar: '2. ماذا تعني ملاحظتي؟', fr: '2. Comment interpréter cette observation ?', placeholderAr: 'اربط الملاحظة بمفهوم علمي تعرفه…', placeholderFr: 'Reliez votre observation à une notion scientifique…' },
      { key: 'conclusion', ar: '3. ما الاستنتاج الذي أصل إليه؟', fr: '3. Quelle conclusion en tirer ?', placeholderAr: 'اكتب خلاصة قصيرة تستند إلى ما سبق…', placeholderFr: 'Formulez une courte conclusion fondée sur les étapes précédentes…' }
    ];
    const guidedInputs = {};
    guidedFields.forEach(function (step) {
      const group = document.createElement('div');
      group.className = 'ri-guided-step';
      const stepLabel = document.createElement('label');
      stepLabel.textContent = isFrench ? step.fr : step.ar;
      const field = document.createElement('textarea');
      field.rows = 2;
      field.maxLength = 700;
      field.placeholder = isFrench ? step.placeholderFr : step.placeholderAr;
      stepLabel.appendChild(field);
      group.appendChild(stepLabel);
      guidePanel.appendChild(group);
      guidedInputs[step.key] = field;
    });
    const compose = document.createElement('button');
    compose.type = 'button';
    compose.className = 'ri-observation-compose';
    compose.textContent = isFrench ? 'Assembler ma réponse' : 'تجميع استنتاجي';
    const composeStatus = document.createElement('span');
    composeStatus.className = 'ri-observation-compose-status';
    composeStatus.setAttribute('role', 'status');
    compose.addEventListener('click', function () {
      const values = guidedFields.map(function (step) { return guidedInputs[step.key].value.trim(); });
      if (values.every(function (value) { return !value; })) {
        composeStatus.textContent = isFrench ? 'Complétez au moins une étape.' : 'أكمل خطوة واحدة على الأقل أولاً.';
        return;
      }
      const headings = isFrench
        ? ['Observation : ', 'Interprétation : ', 'Conclusion : ']
        : ['الملاحظة: ', 'التفسير: ', 'الاستنتاج: '];
      textarea.value = guidedFields.map(function (step, index) {
        return values[index] ? headings[index] + values[index] : '';
      }).filter(Boolean).join('\\n');
      composeStatus.textContent = isFrench ? 'Votre réponse structurée est prête. Vous pouvez la modifier puis l’enregistrer.' : 'أصبح استنتاجك منظماً في مساحة الإجابة. يمكنك تعديله ثم حفظه.';
      textarea.focus();
    });
    guidePanel.append(compose, composeStatus);
    const label = document.createElement('label');
    const fieldId = 'ri-observation-answer-' + categoryKey.replace(/[^a-z0-9]+/gi, '-');
    label.htmlFor = fieldId;
    label.textContent = isFrench ? 'Votre hypothèse ou conclusion' : 'اكتب فرضيتك أو استنتاجك';
    const textarea = document.createElement('textarea');
    textarea.id = fieldId;
    textarea.rows = 3;
    textarea.maxLength = 2000;
    textarea.placeholder = isFrench ? 'Appuyez-vous sur des indices visibles dans la photo…' : 'استند إلى أدلة وعناصر ظاهرة في الصورة…';
    const status = document.createElement('span');
    status.className = 'ri-observation-status';
    status.setAttribute('role', 'status');
    const actions = document.createElement('div');
    actions.className = 'ri-observation-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'ri-observation-save';
    save.textContent = isFrench ? 'Enregistrer ma réponse' : 'حفظ إجابتي';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ri-observation-clear';
    clear.textContent = isFrench ? 'Effacer' : 'مسح';
    const storageKey = 'gosvt_science_observation_v1_' + categoryKey;
    try {
      textarea.value = window.localStorage.getItem(storageKey) || '';
      if (textarea.value) status.textContent = isFrench ? 'Réponse enregistrée sur cet appareil.' : 'إجابتك محفوظة على هذا الجهاز.';
    } catch (_) {
      status.textContent = isFrench ? 'Stockage local indisponible.' : 'الحفظ المحلي غير متاح في هذا المتصفح.';
      save.disabled = true;
    }
    save.addEventListener('click', function () {
      if (!textarea.value.trim()) {
        status.textContent = isFrench ? 'Écrivez d’abord votre observation.' : 'اكتب ملاحظتك أولاً.';
        textarea.focus();
        return;
      }
      try {
        window.localStorage.setItem(storageKey, textarea.value.trim());
        status.textContent = isFrench ? 'Réponse enregistrée sur cet appareil.' : 'تم حفظ إجابتك على هذا الجهاز.';
      } catch (_) {
        status.textContent = isFrench ? 'Enregistrement impossible.' : 'تعذر الحفظ في هذا المتصفح.';
      }
    });
    clear.addEventListener('click', function () {
      try {
        window.localStorage.removeItem(storageKey);
        textarea.value = '';
        status.textContent = isFrench ? 'Réponse effacée.' : 'تم مسح الإجابة.';
      } catch (_) {
        status.textContent = isFrench ? 'Effacement impossible.' : 'تعذر مسح الإجابة.';
      }
    });
    actions.append(save, clear);
    const review = document.createElement('button');
    review.type = 'button';
    review.className = 'ri-observation-review';
    review.textContent = isFrench ? 'Revoir mon raisonnement' : 'راجع استنتاجي';
    const feedback = document.createElement('p');
    feedback.className = 'ri-observation-feedback';
    feedback.setAttribute('role', 'status');
    feedback.hidden = true;
    review.addEventListener('click', function () {
      const answer = textarea.value.trim().toLocaleLowerCase();
      const guide = REVIEW_GUIDANCE[categoryKey];
      feedback.hidden = false;
      if (answer.length < 25) {
        feedback.textContent = isFrench
          ? 'Développez votre réponse : décrivez au moins un indice visible, puis expliquez ce qu’il peut signifier.'
          : 'وسّع إجابتك قليلاً: صف دليلاً واحداً على الأقل تراه في الصورة، ثم اشرح ما الذي يمكن أن يدل عليه.';
        return;
      }
      const matched = guide ? guide.terms.some(function (term) { return answer.includes(term.toLocaleLowerCase()); }) : false;
      const prompt = isFrench ? guide.fr : guide.ar;
      const opening = matched
        ? (isFrench ? 'Bonne piste : vous avez mentionné une notion pertinente. ' : 'بداية موفقة: تضمنت إجابتك مفهوماً مرتبطاً بالموضوع. ')
        : (isFrench ? 'À approfondir : essayez d’utiliser les notions scientifiques du sujet. ' : 'تحتاج إجابتك إلى مزيد من التحديد باستعمال مفاهيم الدرس. ');
      feedback.textContent = opening + prompt
        + (isFrench ? ' Cet accompagnement est indicatif et ne remplace pas la correction de votre enseignant.' : ' هذه المراجعة إرشادية فقط ولا تعوّض تصحيح الأستاذ.');
    });
    const privacy = document.createElement('p');
    privacy.className = 'ri-observation-privacy';
    privacy.textContent = isFrench ? 'Enregistrement local uniquement : votre réponse n’est pas envoyée au serveur.' : 'يُحفظ الجواب على هذا الجهاز فقط ولا يُرسل إلى الخادم.';
    activity.append(guidePanel, label, textarea, actions, review, feedback, status, privacy);
    return activity;
  }

  function showGalleryFallback(container, labels) {
    container.setAttribute('aria-busy', 'false');
    const message = document.createElement('p');
    message.className = 'ri-error';
    message.textContent = document.documentElement.lang === 'fr'
      ? 'Photo vérifiée indisponible pour le moment. La source et la licence seront affichées dès qu’une image valide sera disponible.'
      : 'الصورة الموثقة غير متاحة حالياً. لن نعرض صورة بديلة غير موثوقة أو رسماً على أنه صورة حقيقية.';
    container.replaceChildren(message);
  }

  function enhanceGalleries(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const containers = [];
    if (scope.matches && scope.matches('[data-real-images][data-real-images-sub]')) containers.push(scope);
    containers.push.apply(containers, Array.from(scope.querySelectorAll('[data-real-images][data-real-images-sub]')));
    containers.forEach(renderImageContainer);
  }

  const processedIcons = new WeakSet();
  async function enhanceStatIcons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const icons = [];
    if (scope.matches && scope.matches('.stat-icon[data-image-category]')) icons.push(scope);
    icons.push.apply(icons, Array.from(scope.querySelectorAll('.stat-icon[data-image-category]')));
    await Promise.all(icons.map(async function (icon, index) {
      if (processedIcons.has(icon)) return;
      processedIcons.add(icon);
      const parts = icon.getAttribute('data-image-category').split('/');
      try {
        const imageData = await getImage(parts[0], parts[1]);
        if (imageData) applyImage(icon, imageData);
      } catch (error) {
        // Keep the original icon intact when the catalogue or image is unavailable.
        console.warn('[GoSVTImages] Could not load statistic image:', error.message);
      }
    }));
  }

  window.GoSVTImages = Object.freeze({
    getImage: getImage,
    loadCatalogue: loadCatalogue,
    enhanceStatIcons: enhanceStatIcons
  });

  function installGalleryStyles() {
    if (document.getElementById('go-svt-real-gallery-styles')) return;
    const style = document.createElement('style');
    style.id = 'go-svt-real-gallery-styles';
    style.textContent = [
      '.ri-gallery{margin:22px 0;padding:18px;border:1px solid #dce9df;border-radius:18px;background:#f8fcf8}',
      '.ri-gallery h4{margin:0 0 14px;color:#205b39;font-size:1.05rem}',
      '.ri-gallery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:14px}',
      '.ri-gallery-container{min-width:0;min-height:190px}',
      '.ri-image-card{display:flex;flex-direction:column;gap:9px;min-width:0;padding:10px;border:1px solid #dce8df;border-radius:15px;background:#fff;color:#254c34;text-decoration:none;overflow:hidden}',
      '.ri-image-frame{position:relative;display:block;aspect-ratio:4/3;overflow:hidden;border-radius:10px;background:#edf4ee}',
      '.ri-image{display:block;width:100%;height:100%;object-fit:cover;transition:transform .25s}',
      '.ri-image-card:hover .ri-image{transform:scale(1.035)}',
      '.ri-image-overlay{position:absolute;inset:auto 8px 8px;padding:6px 9px;border-radius:8px;background:#102e20d9;color:#fff;font-size:.78rem}',
      '.ri-image-info{display:grid;gap:5px;line-height:1.5;overflow-wrap:anywhere}',
      '.ri-image-info strong{font-size:.88rem}',
      '.ri-image-info .gs-science-media-credit{font-size:.75rem;color:#607466}',
      '.ri-image-observation-guide{display:grid;gap:5px;margin-top:3px;padding:9px 10px;border-inline-start:3px solid #65a17a;border-radius:8px;background:#f2f8f3}',
      '.ri-image-observation-label{font-size:.76rem;color:#27623c}',
      '.ri-image-description{font-size:.82rem;line-height:1.65;color:#344f3c}',
      '.ri-image-observation-question{display:grid;gap:4px;margin-top:5px;padding:9px 10px;border:1px dashed #9ab9a2;border-radius:8px;background:#fff;font-size:.82rem;line-height:1.6;color:#244b32}',
      '.ri-image-observation-question strong{font-size:.76rem;color:#1d6a3a}',
      '.ri-observation-activity{display:grid;gap:9px;margin-top:10px;padding:13px;border:1px solid #d7e5da;border-radius:13px;background:#f7fbf7}',
      '.ri-observation-activity label{font-size:.88rem;font-weight:700;color:#245b38}',
      '.ri-observation-activity textarea{display:block;width:100%;min-height:82px;box-sizing:border-box;padding:10px;border:1px solid #b9cdbd;border-radius:9px;background:#fff;color:#203c2a;font:inherit;line-height:1.6;resize:vertical}',
      '.ri-observation-activity textarea:focus{outline:3px solid #9bc9a8;outline-offset:2px}',
      '.ri-observation-actions{display:flex;flex-wrap:wrap;gap:8px}',
      '.ri-observation-actions button{padding:8px 13px;border:1px solid #8eaf98;border-radius:9px;background:#fff;color:#245b38;font:inherit;font-size:.82rem;cursor:pointer}',
      '.ri-observation-actions .ri-observation-save{background:#24613b;border-color:#24613b;color:#fff}',
      '.ri-observation-actions button:focus-visible{outline:3px solid #9bc9a8;outline-offset:2px}',
      '.ri-observation-status{min-height:1.3em;font-size:.8rem;color:#27623c}',
      '.ri-observation-privacy{margin:0;font-size:.74rem;color:#64786a}',
      '.ri-placeholder,.ri-error{padding:16px;border-radius:12px;background:#fff;color:#526b5a;line-height:1.7}',
      '@media(max-width:520px){.ri-gallery{padding:12px}.ri-gallery-grid{grid-template-columns:1fr 1fr}}'
    ].join('');
    document.head.appendChild(style);
  }

  function start() {
    installGalleryStyles();
    enhanceStatIcons(document);
    enhanceGalleries(document);
    if (document.body && window.MutationObserver) {
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) { enhanceStatIcons(node); enhanceGalleries(node); }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window, document);
