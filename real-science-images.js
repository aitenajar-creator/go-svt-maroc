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

  const SCIENCE_CONCLUSION_MODELS = Object.freeze({
    'cell/plant': { ar: 'تُظهر الصورة خلايا متجاورة ذات حدود واضحة ومنظمة. تدعم هذه الملاحظة وصف النسيج بأنه مكوّن من خلايا، لكنها لا تكفي وحدها لتحديد وظيفة كل خلية أو جميع عضياتها.', fr: 'L’image montre des cellules voisines aux limites nettes et organisées. Cette observation permet de décrire un tissu constitué de cellules, sans déterminer à elle seule la fonction de chaque cellule ni tous ses organites.' },
    'genetics/dna': { ar: 'يمثل النموذج بنية ADN على شكل لولب مزدوج. يوضح ذلك التنظيم الجزيئي للمادة الوراثية، مع الانتباه إلى أن ألوان النموذج تمثيلية وليست بالضرورة ألوان الجزيء الحقيقي.', fr: 'Le modèle représente l’ADN sous la forme d’une double hélice. Il illustre l’organisation moléculaire du matériel génétique ; les couleurs du modèle sont conventionnelles et ne sont pas nécessairement celles de la molécule réelle.' },
    'ecology/ecosystem': { ar: 'تُظهر الصورة وجود نبات وماء في الوسط نفسه. يمكن وصفهما كعنصرين من الوسط، لكن إثبات تأثير الماء في نمو النبات يتطلب ملاحظات أو مقارنة تجريبية إضافية.', fr: 'L’image montre une plante et de l’eau dans un même milieu. On peut décrire leur présence, mais démontrer l’effet de l’eau sur la croissance nécessite des observations ou une comparaison expérimentale complémentaire.' },
    'geology/rock': { ar: 'تُلاحظ في التكوين الصخري علامات بنيوية مثل التطبق أو التشققات. تسمح هذه العلامات بوصف مظهره، أما تحديد نوع الصخر أو عمره فيحتاج إلى معطيات ميدانية ومعدنية إضافية.', fr: 'La formation rocheuse présente des indices structuraux comme la stratification ou des fissures. Ils permettent de décrire son aspect, tandis que l’identification de la roche ou de son âge demande des données de terrain et minéralogiques complémentaires.' },
    'cell/animal': { ar: 'تُظهر الصورة خلايا تختلف في الشكل أو الترتيب داخل النسيج. قد يرتبط هذا الاختلاف بتخصص الخلايا، لكن تفسير الوظيفة يتطلب معرفة موقع النسيج ومعطيات أخرى.', fr: 'L’image montre des cellules dont la forme ou l’agencement varie dans le tissu. Cette variation peut être liée à une spécialisation, mais l’interprétation fonctionnelle demande de connaître la localisation du tissu et d’autres données.' },
    'cell/mitosis': { ar: 'يُظهر المشهد توزعاً معيناً للكروموسومات داخل الخلية، وقد يساعد ذلك على اقتراح مرحلة من الانقسام. ينبغي الاستناد إلى شكل الكروموسومات وموقعها، لا إلى صورة واحدة لتعميم جميع مراحل الانقسام.', fr: 'La scène montre une répartition particulière des chromosomes dans la cellule, ce qui peut aider à proposer une phase de division. Il faut s’appuyer sur leur forme et leur position, sans généraliser toutes les étapes à partir d’une seule image.' },
    'respiratory/alveoli': { ar: 'تتميز الحويصلات الرئوية بجدار رقيق وتجاور الشعيرات الدموية، ما يقلل مسافة انتشار الغازات بين الهواء والدم ويسهل التبادلات الغازية.', fr: 'Les alvéoles pulmonaires possèdent une paroi fine et sont proches des capillaires. Cette organisation réduit la distance de diffusion entre l’air et le sang et facilite les échanges gazeux.' }
  });

  const SCIENCE_REASONING_CASES = Object.freeze({
    'cell/plant': { ar: { observation: 'تُظهر الصورة خلايا نباتية متجاورة ذات حدود واضحة.', flawed: 'إذن جميع خلايا النبات متطابقة وتؤدي الوظيفة نفسها.', options: ['الصورة تُظهر جزءاً من نسيج فقط، ولا تثبت تطابق جميع خلايا النبات أو وظائفها.', 'لون الصورة لا يسمح بتحديد عمر النبات.', 'عدد الخلايا في الصورة غير كافٍ لحساب مساحة الورقة.'], answer: 0, correction: 'نستنتج أن النسيج المعروض يتكون من خلايا متجاورة، ويمكن أن تختلف الخلايا في بنيتها ووظيفتها حسب النسيج.' }, fr: { observation: 'L’image montre des cellules végétales voisines aux limites nettes.', flawed: 'Donc toutes les cellules de la plante sont identiques et ont la même fonction.', options: ['L’image ne montre qu’une partie d’un tissu et ne prouve pas l’identité de toutes les cellules ni de leurs fonctions.', 'La couleur ne permet pas de connaître l’âge de la plante.', 'Le nombre de cellules ne suffit pas à calculer la surface de la feuille.'], answer: 0, correction: 'On peut conclure que le tissu présenté est constitué de cellules voisines, dont la structure et la fonction peuvent varier selon le tissu.' } },
    'genetics/dna': { ar: { observation: 'يعرض الشكل نموذجاً تعليمياً للولب المزدوج ADN بألوان مختلفة.', flawed: 'إذن جزيء ADN داخل الخلية ملون بهذه الألوان نفسها.', options: ['ألوان النموذج اصطلاحية لتسهيل التمييز ولا تثبت اللون الحقيقي للجزيء.', 'النموذج لا يوضح أي بنية جزيئية.', 'كل جزيئات الخلية لها الألوان نفسها.'], answer: 0, correction: 'يمثل النموذج بنية ADN ذات اللولب المزدوج، أما الألوان فهي وسيلة توضيحية وليست دليلاً على اللون الحقيقي.' }, fr: { observation: 'Le schéma présente un modèle pédagogique de la double hélice d’ADN avec plusieurs couleurs.', flawed: 'La molécule d’ADN dans la cellule possède donc exactement ces couleurs.', options: ['Les couleurs du modèle sont conventionnelles et ne prouvent pas la couleur réelle de la molécule.', 'Le modèle ne représente aucune structure moléculaire.', 'Toutes les molécules cellulaires ont les mêmes couleurs.'], answer: 0, correction: 'Le modèle représente la structure en double hélice de l’ADN ; les couleurs servent à distinguer les éléments.' } },
    'ecology/ecosystem': { ar: { observation: 'تُظهر الصورة نباتاً وماءً في الوسط نفسه.', flawed: 'إذن الصورة تثبت أن الماء هو سبب نمو هذا النبات.', options: ['الصورة تثبت التواجد فقط؛ إثبات السببية يحتاج مقارنة وتجربة مع ضبط العوامل الأخرى.', 'وجود الماء يعني أن النبات لا يحتاج إلى الضوء.', 'لا يمكن أن يوجد نبات في وسط يحتوي على الماء.'], answer: 0, correction: 'يمكن وصف وجود النبات والماء معاً، واختبار تأثير الماء بتجربة مقارنة مناسبة.' }, fr: { observation: 'La photo montre une plante et de l’eau dans le même milieu.', flawed: 'La photo prouve donc que l’eau est la cause de la croissance de cette plante.', options: ['La photo montre leur présence simultanée ; établir une causalité demande une expérience comparative contrôlée.', 'La présence d’eau signifie que la plante n’a pas besoin de lumière.', 'Une plante ne peut pas se trouver dans un milieu contenant de l’eau.'], answer: 0, correction: 'On décrit la présence de la plante et de l’eau ; l’effet de l’eau se teste par une expérience comparative adaptée.' } },
    'geology/rock': { ar: { observation: 'تظهر في الصورة طبقات متوازية داخل تكوين صخري.', flawed: 'إذن نعرف من الصورة وحدها نوع الصخر وعمره الدقيق.', options: ['التطبق وصف مرئي، لكن تحديد النوع والعمر يتطلب معطيات معدنية وطبقية وميدانية إضافية.', 'الطبقات لا يمكن أن توجد في الصخور.', 'عمر الصخر يساوي دائماً عدد الطبقات الظاهرة.'], answer: 0, correction: 'نصف التكوين بأنه متطبق، ثم نحتاج إلى أدلة إضافية لتحديد طبيعته وعمره.' }, fr: { observation: 'La photo montre des couches parallèles dans une formation rocheuse.', flawed: 'La photo suffit donc à déterminer précisément la nature et l’âge de la roche.', options: ['La stratification est observable, mais la nature et l’âge demandent des données minéralogiques, stratigraphiques et de terrain.', 'Les couches ne peuvent jamais exister dans les roches.', 'L’âge d’une roche correspond toujours au nombre de couches visibles.'], answer: 0, correction: 'On décrit une formation stratifiée ; des indices complémentaires sont nécessaires pour préciser sa nature et son âge.' } },
    'cell/animal': { ar: { observation: 'تُظهر الصورة خلايا ذات أشكال مختلفة داخل نسيج حيواني.', flawed: 'إذن شكل كل خلية وحده يكشف وظيفتها بشكل قطعي.', options: ['الشكل قد يرتبط بالوظيفة، لكن يلزم معرفة موقع الخلية وبنية النسيج ومعطيات أخرى.', 'جميع الخلايا الحيوانية لها شكل واحد.', 'لا علاقة مطلقاً بين البنية والوظيفة.'], answer: 0, correction: 'قد يعكس اختلاف الشكل تخصصاً خلوياً، ويُدعّم تفسير الوظيفة بدراسة الموقع والبنية.' }, fr: { observation: 'L’image montre des cellules de formes différentes dans un tissu animal.', flawed: 'La forme seule révèle donc avec certitude la fonction de chaque cellule.', options: ['La forme peut être liée à la fonction, mais il faut aussi connaître la localisation, le tissu et d’autres données.', 'Toutes les cellules animales ont une seule forme.', 'La structure n’a absolument aucun lien avec la fonction.'], answer: 0, correction: 'La variation de forme peut traduire une spécialisation ; l’interprétation demande aussi le contexte et la structure.' } },
    'cell/mitosis': { ar: { observation: 'تُظهر الصورة كروموسومات مصطفة قرب وسط الخلية.', flawed: 'إذن هذه الصورة تمثل جميع مراحل الانقسام الخيطي.', options: ['الصورة الثابتة قد تساعد على تحديد مرحلة واحدة، ولا تمثل وحدها تسلسل جميع المراحل.', 'الكروموسومات لا تشارك في الانقسام.', 'كل مراحل الانقسام لها المظهر نفسه.'], answer: 0, correction: 'اصطفاف الكروموسومات قد يشير إلى الطور الاستوائي؛ أما بقية المراحل فتحتاج إلى مشاهد أو صور أخرى.' }, fr: { observation: 'L’image montre des chromosomes alignés près du centre de la cellule.', flawed: 'Cette image représente donc toutes les phases de la mitose.', options: ['Une image fixe peut aider à identifier une phase, mais ne montre pas à elle seule toute la succession.', 'Les chromosomes ne participent pas à la division.', 'Toutes les phases de la mitose ont le même aspect.'], answer: 0, correction: 'L’alignement peut indiquer la métaphase ; les autres phases nécessitent d’autres observations.' } },
    'respiratory/alveoli': { ar: { observation: 'تُظهر الصورة حويصلات رئوية ذات جدران رقيقة وقريبة من الشعيرات الدموية.', flawed: 'إذن كل الغازات تنتقل في الاتجاه نفسه وبالسرعة نفسها.', options: ['بنية الحويصلات تسهل الانتشار، لكن اتجاه انتقال كل غاز يتبع تدرج تركيزه أو ضغطه الجزئي.', 'رقة الجدار تمنع أي تبادل غازي.', 'الشعيرات الدموية لا علاقة لها بالتبادل الغازي.'], answer: 0, correction: 'رقة الحاجز وقرب الشعيرات يسهلان التبادلات؛ وينتقل كل غاز وفق تدرجه الخاص.' }, fr: { observation: 'L’image montre des alvéoles à paroi fine proches des capillaires.', flawed: 'Tous les gaz se déplacent donc dans le même sens et à la même vitesse.', options: ['La structure facilite la diffusion, mais chaque gaz suit son propre gradient de pression partielle.', 'La finesse de la paroi empêche tout échange gazeux.', 'Les capillaires n’ont aucun rôle dans les échanges.'], answer: 0, correction: 'La finesse de la barrière et la proximité des capillaires facilitent les échanges ; chaque gaz suit son gradient.' } }
  });

  function createReasoningRepairActivity(categoryKey, isFrench) {
    const item = SCIENCE_REASONING_CASES[categoryKey];
    if (!item) return null;
    const data = item[isFrench ? 'fr' : 'ar'];
    const panel = document.createElement('section');
    panel.className = 'ri-reasoning-repair';
    const title = document.createElement('strong');
    title.textContent = isFrench ? 'Atelier : repérer et corriger une erreur' : 'ورشة: اكتشف الخطأ وصحّح الاستنتاج';
    const intro = document.createElement('p');
    intro.textContent = isFrench ? 'Lisez l’observation et la conclusion proposée, puis choisissez pourquoi le raisonnement doit être corrigé.' : 'اقرأ الملاحظة والاستنتاج المقترح، ثم اختر سبب ضرورة تصحيح هذا الاستنتاج.';
    const observation = document.createElement('p');
    observation.className = 'ri-repair-observation';
    const obsLabel = document.createElement('b');
    obsLabel.textContent = isFrench ? 'Observation : ' : 'الملاحظة: ';
    observation.append(obsLabel, document.createTextNode(data.observation));
    const flawed = document.createElement('p');
    flawed.className = 'ri-repair-flawed';
    const flawLabel = document.createElement('b');
    flawLabel.textContent = isFrench ? 'Conclusion proposée : ' : 'الاستنتاج المقترح: ';
    flawed.append(flawLabel, document.createTextNode(data.flawed));
    const select = document.createElement('select');
    select.className = 'ri-repair-select';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = isFrench ? 'Choisissez la raison...' : 'اختر سبب الخطأ...';
    select.appendChild(placeholder);
    data.options.forEach(function (option, index) {
      const choice = document.createElement('option');
      choice.value = String(index);
      choice.textContent = option;
      select.appendChild(choice);
    });
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'ri-repair-check';
    check.textContent = isFrench ? 'Vérifier mon analyse' : 'تحقق من تحليلي';
    const feedback = document.createElement('div');
    feedback.className = 'ri-repair-feedback';
    feedback.hidden = true;
    feedback.setAttribute('aria-live', 'polite');
    check.addEventListener('click', function () {
      feedback.hidden = false;
      if (select.value === '') {
        feedback.textContent = isFrench ? 'Choisissez d’abord une réponse.' : 'اختر إجابة أولاً.';
        return;
      }
      const correct = Number(select.value) === data.answer;
      feedback.dataset.correct = String(correct);
      feedback.textContent = (correct
        ? (isFrench ? 'Bonne analyse. ' : 'تحليل موفق. ')
        : (isFrench ? 'Pas tout à fait. Voici le raisonnement attendu. ' : 'ليس تماماً. إليك التفسير العلمي المناسب. '))
        + data.options[data.answer] + ' ' + (isFrench ? 'Conclusion corrigée : ' : 'الاستنتاج المصحح: ') + data.correction;
    });
    panel.append(title, intro, observation, flawed, select, check, feedback);
    return panel;
  }

  const SCIENCE_HYPOTHESIS_CASES = Object.freeze({
    'cell/plant': { ar: { scenario: 'نلاحظ أن أوراق نبات قرب نافذة تبدو أكثر نمواً من أوراق نبات بعيد عنها.', hypothesis: 'زيادة توفر الضوء قد تؤثر في نمو النبات.', evidence: ['قياس نمو نباتات متماثلة مع اختلاف مدة تعرضها للضوء مع تثبيت الماء والتربة.', 'مقارنة لون صورتين التقطتا بإضاءة مختلفة.', 'قياس طول نبات واحد مرة واحدة دون بيانات سابقة.'], evidenceAnswer: 0, experiment: ['تقسيم نباتات متماثلة إلى مجموعات بمدد إضاءة مختلفة، مع توحيد الماء والتربة ومدة التجربة.', 'تغيير الضوء والماء ونوع التربة معاً ثم مقارنة النتائج.', 'اختيار نبات واحد وتغيير مكانه دون تسجيل القياسات.'], experimentAnswer: 0, why: 'نغير عاملاً واحداً هو مدة الإضاءة ونقيس النمو بانتظام، مع تثبيت العوامل الأخرى لتفسير النتائج.' }, fr: { scenario: 'Les feuilles d’une plante près d’une fenêtre semblent davantage développées que celles d’une plante éloignée.', hypothesis: 'La disponibilité de la lumière pourrait influencer la croissance.', evidence: ['Mesurer des plantes comparables exposées à des durées de lumière différentes, en gardant l’eau et le sol constants.', 'Comparer deux photos prises avec des éclairages différents.', 'Mesurer une seule plante une seule fois, sans valeur de référence.'], evidenceAnswer: 0, experiment: ['Répartir des plantes comparables entre plusieurs durées d’éclairage, en gardant l’eau et le sol identiques.', 'Modifier simultanément la lumière, l’eau et le sol.', 'Déplacer une seule plante sans relever de mesures.'], experimentAnswer: 0, why: 'On fait varier la durée d’éclairage et on mesure la croissance régulièrement, en contrôlant les autres facteurs.' } },
    'genetics/dna': { ar: { scenario: 'نريد اختبار ما إذا كانت عينة مجهولة تحتوي على ADN.', hypothesis: 'إذا كانت العينة تحتوي على ADN فستعطي نتيجة إيجابية في اختبار نوعي مناسب مع شاهد موجب.', evidence: ['إجراء اختبار نوعي موثوق للعينة ومقارنته بشاهد موجب وشاهد سالب.', 'الاعتماد على لون العينة بالعين فقط.', 'استنتاج وجود ADN من مصدر العينة دون تحليل.'], evidenceAnswer: 0, experiment: ['تحضير العينة والشاهدين وفق بروتوكول مخبري معتمد، ثم مقارنة النتائج.', 'خلط مواد مختلفة دون شواهد أو شروط مضبوطة.', 'تكرار النظر إلى العينة دون استعمال اختبار.'], experimentAnswer: 0, why: 'الشواهد الموجبة والسالبة تساعد على التحقق من صلاحية الاختبار وتمييز النتيجة الحقيقية عن التلوث أو الخطأ.' }, fr: { scenario: 'On veut vérifier si un échantillon inconnu contient de l’ADN.', hypothesis: 'Si l’échantillon contient de l’ADN, un test qualitatif adapté donnera un résultat positif, avec un témoin positif.', evidence: ['Réaliser un test qualitatif validé sur l’échantillon et le comparer à un témoin positif et un témoin négatif.', 'Se fier uniquement à la couleur visible de l’échantillon.', 'Déduire la présence d’ADN à partir de l’origine supposée de l’échantillon.'], evidenceAnswer: 0, experiment: ['Préparer l’échantillon et les deux témoins selon un protocole de laboratoire validé, puis comparer les résultats.', 'Mélanger différentes substances sans témoins ni conditions contrôlées.', 'Observer l’échantillon sans effectuer de test.'], experimentAnswer: 0, why: 'Les témoins positif et négatif vérifient le fonctionnement du test et aident à distinguer un résultat réel d’une contamination ou d’une erreur.' } },
    'ecology/ecosystem': { ar: { scenario: 'نريد معرفة هل تؤثر كمية الماء في نمو نباتات من النوع نفسه.', hypothesis: 'ضمن شروط مناسبة، قد يؤدي اختلاف كمية الماء إلى اختلاف في نمو النباتات.', evidence: ['قياس نمو مجموعات متشابهة تتلقى كميات ماء محددة ومختلفة مع تثبيت الضوء والتربة.', 'مقارنة نباتات من أنواع مختلفة في أماكن مختلفة.', 'ملاحظة نبات واحد بعد سقيه مرة واحدة.'], evidenceAnswer: 0, experiment: ['توزيع نباتات متشابهة عشوائياً على مجموعات بمقادير ماء مختلفة، وقياس نموها خلال المدة نفسها.', 'تغيير كمية الماء والضوء والحرارة معاً.', 'سقي نبات واحد ثم إصدار حكم عام دون تكرار.'], experimentAnswer: 0, why: 'توحيد النوع والضوء والتربة والمدة، مع تغيير كمية الماء فقط وتكرار القياس، يسمح باختبار أثر الماء.' }, fr: { scenario: 'On cherche à savoir si la quantité d’eau influence la croissance de plantes de la même espèce.', hypothesis: 'Dans des conditions adaptées, des apports d’eau différents pourraient modifier la croissance.', evidence: ['Mesurer des groupes comparables recevant des quantités d’eau définies, avec lumière et sol constants.', 'Comparer des plantes d’espèces différentes dans des lieux différents.', 'Observer une seule plante après un arrosage unique.'], evidenceAnswer: 0, experiment: ['Répartir des plantes comparables en groupes recevant différentes quantités d’eau et mesurer leur croissance pendant la même durée.', 'Modifier simultanément l’eau, la lumière et la température.', 'Arroser une seule plante puis généraliser sans répétition.'], experimentAnswer: 0, why: 'Garder l’espèce, la lumière, le sol et la durée constants, ne faire varier que l’eau et répéter les mesures permet de tester son effet.' } },
    'geology/rock': { ar: { scenario: 'نجد طبقات رسوبية في موقعين ونريد اختبار فرضية أنها ترسبت في ظروف متقاربة.', hypothesis: 'قد تشير أوجه التشابه في حجم الحبيبات وتركيبها وتسلسل الطبقات إلى ظروف ترسيب متقاربة.', evidence: ['مقارنة عينات موثقة من الموقعين من حيث حجم الحبيبات والتركيب والتتابع الطبقي.', 'مقارنة لون الصورتين فقط.', 'الاعتماد على المسافة بين الموقعين دون دراسة الطبقات.'], evidenceAnswer: 0, experiment: ['جمع عينات ممثلة وفق قواعد السلامة والتوثيق، ثم وصفها وتحليلها ومقارنة مقاطع الطبقات.', 'أخذ عينة واحدة من سطح كل موقع دون توثيق موضعها.', 'تحديد عمر الطبقات من لونها وحده.'], experimentAnswer: 0, why: 'تعدد المؤشرات المعدنية والحبيبية والطبقية يوفر أساساً أقوى للمقارنة؛ ولا يكفي مؤشر بصري منفرد لإثبات ظروف الترسيب.' }, fr: { scenario: 'Deux sites présentent des couches sédimentaires ; on veut tester l’hypothèse de conditions de dépôt comparables.', hypothesis: 'Des ressemblances de granulométrie, de composition et de succession des couches pourraient indiquer des conditions de dépôt proches.', evidence: ['Comparer des échantillons documentés des deux sites : taille des grains, composition et succession stratigraphique.', 'Comparer uniquement la couleur des photos.', 'Se baser sur la distance entre les sites sans étudier les couches.'], evidenceAnswer: 0, experiment: ['Prélever des échantillons représentatifs selon les règles de sécurité et de traçabilité, puis décrire et analyser les coupes.', 'Prendre un seul échantillon de surface par site sans noter sa provenance précise.', 'Déterminer l’âge des couches à partir de leur seule couleur.'], experimentAnswer: 0, why: 'Plusieurs indices minéralogiques, granulométriques et stratigraphiques permettent une comparaison plus solide qu’un seul indice visuel.' } },
    'cell/animal': { ar: { scenario: 'نقارن بين نسيجين حيوانيين لمعرفة هل يرتبط شكل الخلايا بوظيفتهما.', hypothesis: 'قد يرتبط اختلاف شكل الخلايا وتنظيمها باختلاف وظيفة النسيج.', evidence: ['مقارنة صور مجهرية موثقة للنسيجين وربط البنية بموقعهما ووظيفتهما المعروفة.', 'مقارنة لون صبغتين مختلفتين دون فحص البنية.', 'اختيار خلية واحدة من كل نسيج وتعميم النتيجة.'], evidenceAnswer: 0, experiment: ['فحص مقاطع متماثلة التحضير، ووصف أشكال الخلايا وترتيبها ثم مقارنتها بوظيفة كل نسيج.', 'استعمال طرق تحضير مختلفة ثم نسبة كل اختلاف إلى الوظيفة.', 'تحديد الوظيفة من شكل صورة منخفضة الجودة فقط.'], experimentAnswer: 0, why: 'توحيد التحضير ومقارنة عدة خلايا مع معرفة موضع النسيج يقللان التعميم ويدعمان الربط بين البنية والوظيفة.' }, fr: { scenario: 'On compare deux tissus animaux pour savoir si la forme des cellules est liée à leur fonction.', hypothesis: 'La forme et l’organisation des cellules pourraient être liées à la fonction du tissu.', evidence: ['Comparer des préparations microscopiques documentées et relier la structure à la localisation et à la fonction connues.', 'Comparer la couleur de deux colorations sans étudier la structure.', 'Choisir une seule cellule par tissu et généraliser.'], evidenceAnswer: 0, experiment: ['Observer des coupes préparées de façon comparable, décrire plusieurs cellules et confronter les observations à la fonction du tissu.', 'Utiliser des préparations différentes puis attribuer toute différence à la fonction.', 'Déduire la fonction uniquement d’une image de faible qualité.'], experimentAnswer: 0, why: 'Des préparations comparables, plusieurs cellules et la connaissance de la localisation du tissu rendent le lien structure-fonction plus fiable.' } },
    'cell/mitosis': { ar: { scenario: 'نريد اختبار هل تتغير نسبة الخلايا التي تظهر فيها مظاهر الانقسام بين عينتين من نسيج نامٍ.', hypothesis: 'قد تختلف نسبة الخلايا المنقسمة بين العينتين تبعاً لنشاط النمو أو ظروف العينة.', evidence: ['عدّ الخلايا في مراحل مختلفة ضمن عدد كبير من المجالات المجهرية وبطريقة أخذ عينات موحدة.', 'اختيار صورة واحدة تبدو واضحة من كل عينة.', 'مقارنة حجم الصورتين على الشاشة.'], evidenceAnswer: 0, experiment: ['تحضير عينات متماثلة، واختيار مجالات عشوائية متعددة، ثم حساب النسب باستعمال معيار تصنيف موحد.', 'اختيار الخلايا التي تؤيد الفرضية فقط.', 'تغيير طريقة التلوين والتكبير بين العينتين دون توحيدهما.'], experimentAnswer: 0, why: 'العد المنهجي في مجالات متعددة مع توحيد التحضير والتصنيف يقلل تحيز الاختيار ويسمح بمقارنة النسب.' }, fr: { scenario: 'On veut tester si la proportion de cellules en division diffère entre deux échantillons de tissu en croissance.', hypothesis: 'La proportion de cellules en division pourrait varier selon l’activité de croissance ou les conditions de l’échantillon.', evidence: ['Compter les cellules à différents stades dans de nombreux champs microscopiques échantillonnés de façon uniforme.', 'Choisir une seule image jugée représentative pour chaque échantillon.', 'Comparer la taille des images à l’écran.'], evidenceAnswer: 0, experiment: ['Préparer les échantillons de façon comparable, sélectionner plusieurs champs au hasard et calculer les proportions avec les mêmes critères.', 'Ne retenir que les cellules qui confirment l’hypothèse.', 'Changer la coloration et le grossissement entre les deux échantillons.'], experimentAnswer: 0, why: 'Un comptage systématique dans plusieurs champs, avec préparation et critères uniformes, limite le biais de sélection.' } },
    'respiratory/alveoli': { ar: { scenario: 'نريد اختبار أثر سماكة الحاجز بين الهواء والدم في سرعة انتشار غاز عبره.', hypothesis: 'كلما زادت سماكة الحاجز، قد تباطأ انتشار الغاز إذا بقيت العوامل الأخرى ثابتة.', evidence: ['مقارنة نماذج أو قياسات لحواجز مختلفة السماكة مع تثبيت مساحة التبادل وفرق الضغط والحرارة.', 'مقارنة رئتين مختلفتي الحجم دون ضبط العوامل.', 'قياس عدد الحويصلات دون تقدير سماكة الحاجز أو الانتشار.'], evidenceAnswer: 0, experiment: ['استعمال نموذج انتشار مضبوط تتغير فيه السماكة وحدها، وقياس معدل انتقال الغاز في الشروط نفسها.', 'تغيير السماكة والمساحة وفرق الضغط معاً.', 'استنتاج سرعة الانتشار من صورة تشريحية فقط.'], experimentAnswer: 0, why: 'عزل السماكة وتثبيت مساحة التبادل وفرق الضغط وبقية الشروط يسمح بدراسة أثرها على الانتشار دون خلط المتغيرات.' }, fr: { scenario: 'On veut tester l’effet de l’épaisseur de la barrière air-sang sur la vitesse de diffusion d’un gaz.', hypothesis: 'Une barrière plus épaisse pourrait ralentir la diffusion si les autres facteurs restent constants.', evidence: ['Comparer des modèles ou mesures de barrières d’épaisseurs différentes en gardant constants la surface, le gradient de pression et la température.', 'Comparer deux poumons de tailles différentes sans contrôler les facteurs.', 'Compter les alvéoles sans mesurer l’épaisseur ni la diffusion.'], evidenceAnswer: 0, experiment: ['Utiliser un modèle de diffusion contrôlé où seule l’épaisseur varie et mesurer le transfert du gaz dans les mêmes conditions.', 'Modifier simultanément l’épaisseur, la surface et le gradient de pression.', 'Déduire la vitesse de diffusion d’une simple image anatomique.'], experimentAnswer: 0, why: 'Isoler l’épaisseur tout en maintenant constants la surface, le gradient de pression et les autres conditions permet d’étudier son effet.' } }
  });

  function createHypothesisWorkshop(categoryKey, isFrench) {
    const item = SCIENCE_HYPOTHESIS_CASES[categoryKey];
    if (!item) return null;
    const data = item[isFrench ? 'fr' : 'ar'];
    const panel = document.createElement('section');
    panel.className = 'ri-hypothesis-workshop';
    const title = document.createElement('strong');
    title.textContent = isFrench ? 'Laboratoire : construire et tester une hypothèse' : 'مختبر: ابنِ فرضية واختبرها';
    const intro = document.createElement('p');
    intro.textContent = isFrench ? 'Formulez votre hypothèse, choisissez un indice pertinent, puis sélectionnez un protocole qui teste une seule variable à la fois.' : 'صغ فرضيتك، واختر دليلاً مناسباً، ثم حدد تجربة تختبر متغيراً واحداً في كل مرة.';
    const scenario = document.createElement('p');
    scenario.className = 'ri-hypothesis-scenario';
    const scenarioLabel = document.createElement('b');
    scenarioLabel.textContent = isFrench ? 'Situation : ' : 'الوضعية: ';
    scenario.append(scenarioLabel, document.createTextNode(data.scenario));
    const hypothesisLabel = document.createElement('label');
    hypothesisLabel.textContent = isFrench ? 'Votre hypothèse :' : 'فرضيتك:';
    const hypothesis = document.createElement('textarea');
    hypothesis.rows = 2;
    hypothesis.maxLength = 500;
    hypothesis.placeholder = isFrench ? 'Si…, alors…, parce que…' : 'إذا… فإن… لأن…';
    hypothesisLabel.appendChild(hypothesis);
    function makeSelect(labelText, options, className) {
      const wrap = document.createElement('label');
      wrap.className = 'ri-hypothesis-field';
      const label = document.createElement('span');
      label.textContent = labelText;
      const select = document.createElement('select');
      select.className = 'ri-hypothesis-select';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = isFrench ? 'Choisissez une proposition…' : 'اختر اقتراحاً…';
      select.appendChild(empty);
      options.forEach(function (option, index) {
        const choice = document.createElement('option');
        choice.value = String(index);
        choice.textContent = option;
        select.appendChild(choice);
      });
      wrap.append(label, select);
      return { wrap: wrap, select: select };
    }
    const evidence = makeSelect(isFrench ? 'Quel indice permet de tester l’hypothèse ?' : 'أي دليل يساعد على اختبار الفرضية؟', data.evidence, 'evidence');
    const experiment = makeSelect(isFrench ? 'Quel protocole est le plus adapté ?' : 'ما التجربة الأنسب للتحقق؟', data.experiment, 'experiment');
    const verify = document.createElement('button');
    verify.type = 'button';
    verify.className = 'ri-hypothesis-check';
    verify.textContent = isFrench ? 'Analyser mon protocole' : 'تحليل اختياراتي';
    const feedback = document.createElement('div');
    feedback.className = 'ri-hypothesis-feedback';
    feedback.hidden = true;
    feedback.setAttribute('aria-live', 'polite');
    verify.addEventListener('click', function () {
      feedback.hidden = false;
      if (!hypothesis.value.trim() || evidence.select.value === '' || experiment.select.value === '') {
        feedback.textContent = isFrench ? 'Complétez votre hypothèse et les deux choix avant de vérifier.' : 'أكمل فرضيتك واختر الدليل والتجربة قبل التحقق.';
        return;
      }
      const evidenceOk = Number(evidence.select.value) === data.evidenceAnswer;
      const experimentOk = Number(experiment.select.value) === data.experimentAnswer;
      feedback.dataset.result = evidenceOk && experimentOk ? 'success' : 'review';
      feedback.textContent = (isFrench ? 'Indice : ' : 'الدليل: ')
        + (evidenceOk ? (isFrench ? 'choix pertinent. ' : 'اختيار مناسب. ') : (isFrench ? 'à revoir. ' : 'يحتاج إلى مراجعة. '))
        + (isFrench ? 'Protocole : ' : 'التجربة: ')
        + (experimentOk ? (isFrench ? 'choix pertinent. ' : 'اختيار مناسب. ') : (isFrench ? 'à revoir. ' : 'يحتاج إلى مراجعة. '))
        + data.why
        + (isFrench ? ' Hypothèse de départ possible : ' : ' مثال لفرضية منطلق: ')
        + data.hypothesis;
    });
    panel.append(title, intro, scenario, hypothesisLabel, evidence.wrap, experiment.wrap, verify, feedback);
    return panel;
  }

  const SCIENCE_DATA_CASES = Object.freeze({
    'cell/plant': { ar: { title:'نمو النبات حسب مدة الإضاءة', headers:['مدة الإضاءة يومياً','متوسط النمو بعد 10 أيام'], unit:'سم', rows:[['2 ساعات','1.2'],['4 ساعات','2.1'],['6 ساعات','3.0']], question:'ما العلاقة التي تدعمها هذه البيانات ضمن شروط التجربة؟', options:['ازداد متوسط النمو مع زيادة مدة الإضاءة في هذا المجال التجريبي.','الضوء هو العامل الوحيد المؤثر في نمو كل النباتات.','كلما زادت الإضاءة بلا حدود زاد النمو دائماً.'], answer:0, explain:'تُظهر القيم ارتفاع متوسط النمو من 1.2 إلى 3.0 سم مع زيادة مدة الإضاءة. هذا يدعم وجود علاقة في شروط التجربة فقط، ولا يثبت أن الضوء هو العامل الوحيد أو أن الزيادة تستمر بلا حدود.' }, fr: { title:'Croissance végétale selon la durée d’éclairage', headers:['Durée quotidienne de lumière','Croissance moyenne après 10 jours'], unit:'cm', rows:[['2 heures','1,2'],['4 heures','2,1'],['6 heures','3,0']], question:'Quelle relation ces données soutiennent-elles dans les conditions de l’expérience ?', options:['La croissance moyenne augmente avec la durée d’éclairage dans cette plage expérimentale.','La lumière est le seul facteur qui influence la croissance de toutes les plantes.','La croissance augmente toujours sans limite avec la lumière.'], answer:0, explain:'La croissance moyenne passe de 1,2 à 3,0 cm lorsque la durée d’éclairage augmente. Cela soutient une relation dans les conditions testées, sans prouver que la lumière est le seul facteur ni que l’augmentation est illimitée.' } },
    'genetics/dna': { ar: { title:'تركيز ADN في عينات مخبرية تعليمية', headers:['العينة','تركيز ADN المقاس'], unit:'ng/µL', rows:[['A','18'],['B','32'],['C','11']], question:'أي استنتاج يمكن استخلاصه من القياسات وحدها؟', options:['العينة B سجلت أعلى تركيز مقاس بين العينات الثلاث.','العينة B تحتوي بالضرورة على عدد أكبر من الجينات.','العينة B تنتمي حتماً إلى كائن حي أكثر تعقيداً.'], answer:0, explain:'القياس يصف تركيز ADN في العينات كما أُعدّت. لا يحدد وحده عدد الجينات أو تعقيد الكائن، كما تتطلب المقارنة الدقيقة توحيد شروط أخذ العينات والقياس.' }, fr: { title:'Concentration d’ADN dans des échantillons pédagogiques', headers:['Échantillon','Concentration d’ADN mesurée'], unit:'ng/µL', rows:[['A','18'],['B','32'],['C','11']], question:'Quelle conclusion peut-on tirer des seules mesures ?', options:['L’échantillon B présente la concentration mesurée la plus élevée parmi les trois.','L’échantillon B possède nécessairement davantage de gènes.','L’échantillon B provient forcément d’un organisme plus complexe.'], answer:0, explain:'La mesure décrit la concentration d’ADN dans les échantillons préparés. Elle ne détermine pas à elle seule le nombre de gènes ni la complexité de l’organisme ; les conditions de prélèvement et de mesure doivent aussi être comparables.' } },
    'ecology/ecosystem': { ar: { title:'نمو نباتات حسب كمية الماء', headers:['كمية الماء يومياً','متوسط النمو بعد أسبوعين'], unit:'سم', rows:[['10 mL','1.0'],['20 mL','2.4'],['30 mL','2.7']], question:'ما التفسير الأكثر دقة للنتائج؟', options:['ارتفع النمو بين 10 و30 mL، لكن الزيادة كانت أقل بين 20 و30 mL.','كلما زادت كمية الماء زاد النمو بنفس المقدار دائماً.','تثبت النتائج أن الماء وحده يحدد نمو النبات في الطبيعة.'], answer:0, explain:'النمو ارتفع من 1.0 إلى 2.7 سم، لكن الفارق بين 20 و30 mL أصغر من الفارق السابق. لا تسمح هذه البيانات باستنتاج علاقة خطية أو إهمال بقية العوامل.' }, fr: { title:'Croissance de plantes selon la quantité d’eau', headers:['Quantité d’eau par jour','Croissance moyenne après deux semaines'], unit:'cm', rows:[['10 mL','1,0'],['20 mL','2,4'],['30 mL','2,7']], question:'Quelle interprétation est la plus rigoureuse ?', options:['La croissance augmente entre 10 et 30 mL, mais moins fortement entre 20 et 30 mL.','La croissance augmente toujours de la même quantité quand l’eau augmente.','Ces résultats prouvent que l’eau seule détermine la croissance dans la nature.'], answer:0, explain:'La croissance passe de 1,0 à 2,7 cm, mais l’écart entre 20 et 30 mL est plus faible. Ces données ne démontrent ni une relation linéaire ni l’absence d’autres facteurs.' } },
    'geology/rock': { ar: { title:'توزيع أحجام الحبيبات في ثلاثة مواضع', headers:['الموضع','متوسط قطر الحبيبات'], unit:'mm', rows:[['قريب من المصدر','4.8'],['الموضع الأوسط','2.6'],['بعيد عن المصدر','1.1']], question:'ما النمط الذي تصفه القياسات؟', options:['يتناقص متوسط قطر الحبيبات بين المواضع المسجلة.','تثبت القياسات وحدها العمر الدقيق للرواسب.','جميع الحبيبات في كل موضع لها القطر نفسه.'], answer:0, explain:'تُظهر القياسات تناقص متوسط القطر من 4.8 إلى 1.1 mm. قد ينسجم ذلك مع فرز الحبيبات أثناء النقل، لكن تحديد الآلية والسياق يتطلب أدلة ميدانية إضافية.' }, fr: { title:'Répartition des tailles de grains en trois points', headers:['Position','Diamètre moyen des grains'], unit:'mm', rows:[['Près de la source','4,8'],['Position intermédiaire','2,6'],['Loin de la source','1,1']], question:'Quelle tendance les mesures décrivent-elles ?', options:['Le diamètre moyen des grains diminue entre les positions relevées.','Les mesures donnent à elles seules l’âge exact des dépôts.','Tous les grains d’une position ont exactement le même diamètre.'], answer:0, explain:'Le diamètre moyen diminue de 4,8 à 1,1 mm. Cela peut être compatible avec un tri pendant le transport, mais le mécanisme et le contexte demandent d’autres indices de terrain.' } },
    'cell/animal': { ar: { title:'قياسات خلايا من نسيجين مختلفين', headers:['العينة','متوسط طول الخلية'], unit:'µm', rows:[['نسيج A','42'],['نسيج B','18'],['نسيج C','40']], question:'أي عبارة تصف النتائج دون تعميم زائد؟', options:['متوسط طول الخلايا في A وC أكبر من B في العينات المقاسة.','كل خلايا النسيج A أطول من كل خلايا النسيج B.','طول الخلية وحده يحدد وظيفتها بشكل قطعي.'], answer:0, explain:'المعطيات تعرض متوسطات عينات فقط. لا تكشف تداخل القيم الفردية ولا تكفي وحدها لتحديد الوظيفة؛ يلزم فحص البنية والسياق النسيجي.' }, fr: { title:'Mesures de cellules issues de trois tissus', headers:['Échantillon','Longueur moyenne des cellules'], unit:'µm', rows:[['Tissu A','42'],['Tissu B','18'],['Tissu C','40']], question:'Quelle phrase décrit les résultats sans généralisation excessive ?', options:['La longueur moyenne des cellules de A et C dépasse celle de B dans les échantillons mesurés.','Toutes les cellules du tissu A sont plus longues que toutes celles du tissu B.','La longueur seule détermine avec certitude la fonction cellulaire.'], answer:0, explain:'Les données présentent des moyennes d’échantillons. Elles ne montrent pas la dispersion des valeurs individuelles et ne suffisent pas à déterminer la fonction ; la structure et le contexte tissulaire comptent aussi.' } },
    'cell/mitosis': { ar: { title:'نسبة الخلايا المرصودة في الانقسام', headers:['العينة','خلايا منقسمة من أصل 100 خلية'], unit:'%', rows:[['A','8'],['B','17'],['C','12']], question:'ما الاستنتاج المدعوم مباشرة بالعد؟', options:['سجلت العينة B أعلى نسبة خلايا منقسمة ضمن المجالات المفحوصة.','العينة B تنمو دائماً أسرع في جميع الظروف.','كل خلايا العينة B كانت في المرحلة نفسها من الانقسام.'], answer:0, explain:'النسبة الأعلى في B هي 17% من الخلايا المعدودة. لا تكفي لقطة العد وحدها لإثبات سرعة نمو دائمة أو أن الخلايا في مرحلة واحدة.' }, fr: { title:'Proportion de cellules observées en division', headers:['Échantillon','Cellules en division sur 100 cellules comptées'], unit:'%', rows:[['A','8'],['B','17'],['C','12']], question:'Quelle conclusion est directement soutenue par le comptage ?', options:['L’échantillon B présente la plus forte proportion de cellules en division dans les champs observés.','L’échantillon B croît toujours plus vite dans toutes les conditions.','Toutes les cellules de B sont au même stade de division.'], answer:0, explain:'La proportion la plus élevée dans B est de 17 % des cellules comptées. Ce comptage seul ne prouve ni une vitesse de croissance permanente ni un stade identique pour toutes les cellules.' } },
    'respiratory/alveoli': { ar: { title:'انتشار غاز عبر حواجز مختلفة السماكة', headers:['سماكة الحاجز في نموذج تعليمي','كمية الغاز المنتشرة خلال مدة ثابتة'], unit:'وحدة نسبية', rows:[['1','9'],['2','6'],['3','4']], question:'ما العلاقة التي توضحها بيانات هذا النموذج؟', options:['انخفضت كمية الغاز المنتشرة مع زيادة سماكة الحاجز في شروط النموذج.','تثبت البيانات أن سماكة الحاجز هي العامل الوحيد في تبادل الغازات داخل الجسم.','تنتشر جميع الغازات بالمقدار نفسه مهما اختلف الحاجز.'], answer:0, explain:'في النموذج انخفض الانتشار من 9 إلى 4 وحدات نسبية مع زيادة السماكة. هذه نتيجة نموذج مضبوط، ولا يجوز تعميمها دون مراعاة مساحة التبادل وتدرج الضغط وخصائص الغازات.' }, fr: { title:'Diffusion d’un gaz à travers des barrières d’épaisseurs différentes', headers:['Épaisseur de la barrière dans un modèle pédagogique','Quantité de gaz diffusée pendant une durée fixe'], unit:'unité relative', rows:[['1','9'],['2','6'],['3','4']], question:'Quelle relation les données de ce modèle montrent-elles ?', options:['La quantité diffusée diminue lorsque l’épaisseur augmente dans les conditions du modèle.','Les données prouvent que l’épaisseur est le seul facteur des échanges gazeux dans le corps.','Tous les gaz diffusent en même quantité quelle que soit la barrière.'], answer:0, explain:'Dans ce modèle, la diffusion passe de 9 à 4 unités relatives quand l’épaisseur augmente. Il s’agit d’un modèle contrôlé ; une généralisation doit tenir compte de la surface, du gradient de pression et des propriétés des gaz.' } }
  });

  function createDataAnalysisWorkshop(categoryKey, isFrench) {
    const item = SCIENCE_DATA_CASES[categoryKey];
    if (!item) return null;
    const data = item[isFrench ? 'fr' : 'ar'];
    const panel = document.createElement('section');
    panel.className = 'ri-data-analysis';
    const title = document.createElement('strong');
    title.textContent = isFrench ? 'Atelier : lire les données et argumenter' : 'ورشة: اقرأ البيانات وابنِ استنتاجاً';
    const intro = document.createElement('p');
    intro.textContent = isFrench ? 'Ces données sont simulées à des fins pédagogiques. Comparez les valeurs, repérez la tendance et choisissez une conclusion qui ne dépasse pas les résultats.' : 'هذه بيانات محاكاة لأغراض تعليمية. قارن القيم، وحدد الاتجاه، ثم اختر استنتاجاً لا يتجاوز ما تثبته النتائج.';
    const table = document.createElement('table');
    table.className = 'ri-data-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    data.headers.forEach(function (heading) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = heading;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    const tbody = document.createElement('tbody');
    data.rows.forEach(function (row) {
      const tr = document.createElement('tr');
      row.forEach(function (value, index) {
        const td = document.createElement('td');
        td.textContent = index === 1 ? value + ' ' + data.unit : value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    const question = document.createElement('p');
    question.className = 'ri-data-question';
    question.textContent = data.question;
    const select = document.createElement('select');
    select.className = 'ri-data-select';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = isFrench ? 'Choisissez une conclusion…' : 'اختر الاستنتاج المناسب…';
    select.appendChild(empty);
    data.options.forEach(function (option, index) {
      const choice = document.createElement('option');
      choice.value = String(index);
      choice.textContent = option;
      select.appendChild(choice);
    });
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'ri-data-check';
    check.textContent = isFrench ? 'Vérifier mon interprétation' : 'تحقق من استنتاجي';
    const feedback = document.createElement('p');
    feedback.className = 'ri-data-feedback';
    feedback.hidden = true;
    feedback.setAttribute('aria-live', 'polite');
    check.addEventListener('click', function () {
      feedback.hidden = false;
      if (select.value === '') {
        feedback.textContent = isFrench ? 'Choisissez une conclusion avant de vérifier.' : 'اختر استنتاجاً قبل التحقق.';
        return;
      }
      const correct = Number(select.value) === data.answer;
      feedback.dataset.correct = String(correct);
      feedback.textContent = (correct ? (isFrench ? 'Bonne interprétation. ' : 'استنتاج موفق. ') : (isFrench ? 'Relisez les valeurs. La conclusion la mieux soutenue est : ' : 'أعد قراءة القيم. الاستنتاج الأكثر دعماً هو: '))
        + data.options[data.answer] + ' ' + data.explain;
    });
    panel.append(title, intro, table, question, select, check, feedback);
    return panel;
  }

  const SCIENCE_CHALLENGES = Object.freeze({
    'cell/plant': { ar: { q: 'أي دليل يساعد أكثر على وصف تنظيم النسيج النباتي في صورة مجهرية؟', options: ['حدود الخلايا وترتيبها', 'لون خلفية الصورة فقط', 'حجم الصورة على الشاشة'], answer: 0, why: 'حدود الخلايا وترتيبها أدلة مباشرة على تنظيم النسيج، أما لون الخلفية وحجم العرض فلا يكفيان لتفسير البنية.' }, fr: { q: 'Quel indice aide le mieux à décrire l’organisation d’un tissu végétal ?', options: ['Les limites et l’agencement des cellules', 'La couleur du fond seulement', 'La taille de l’image à l’écran'], answer: 0, why: 'Les limites et l’agencement renseignent directement sur l’organisation du tissu.' } },
    'genetics/dna': { ar: { q: 'ما الذي يمثله نموذج اللولب المزدوج عادة؟', options: ['بنية جزيء ADN', 'شكل خلية كاملة', 'نسيج نباتي'], answer: 0, why: 'اللولب المزدوج نموذج يوضح البنية الجزيئية للحمض النووي ADN.' }, fr: { q: 'Que représente généralement le modèle en double hélice ?', options: ['La structure de la molécule d’ADN', 'Une cellule entière', 'Un tissu végétal'], answer: 0, why: 'La double hélice représente la structure moléculaire de l’ADN.' } },
    'ecology/ecosystem': { ar: { q: 'أي مثال يجمع عنصراً حياً وآخر غير حي؟', options: ['نبات وماء', 'صخرتان', 'حيوان ونبات'], answer: 0, why: 'النبات عنصر حي، والماء عنصر غير حي. أما الحيوان والنبات فكلاهما عنصران حيان.' }, fr: { q: 'Quel exemple associe un élément vivant et un élément non vivant ?', options: ['Une plante et de l’eau', 'Deux roches', 'Un animal et une plante'], answer: 0, why: 'La plante est vivante et l’eau est un élément non vivant.' } },
    'geology/rock': { ar: { q: 'ما التصرف العلمي الأنسب عند تحديد نوع صخر من صورة فقط؟', options: ['وصف العلامات المرئية وطلب معطيات إضافية', 'الجزم بالنوع من اللون وحده', 'تجاهل بنية الصخر'], answer: 0, why: 'الوصف الدقيق أولاً، ثم الاستعانة بخصائص ومعطيات إضافية، أكثر موثوقية من الاعتماد على اللون وحده.' }, fr: { q: 'Quelle démarche est la plus rigoureuse pour identifier une roche à partir d’une photo ?', options: ['Décrire les indices visibles et demander d’autres données', 'Conclure à partir de la seule couleur', 'Ignorer la texture'], answer: 0, why: 'Une identification fiable demande plusieurs indices et parfois des analyses complémentaires.' } },
    'cell/animal': { ar: { q: 'ما الذي ينبغي مقارنته لفهم تنظيم نسيج حيواني؟', options: ['أشكال الخلايا وترتيبها', 'إطار الصورة فقط', 'اسم ملف الصورة فقط'], answer: 0, why: 'شكل الخلايا وترتيبها يساعدان على وصف بنية النسيج، ثم يمكن مناقشة علاقتهما بالوظيفة.' }, fr: { q: 'Que faut-il comparer pour comprendre l’organisation d’un tissu animal ?', options: ['La forme et l’agencement des cellules', 'Le cadre de l’image seulement', 'Le nom du fichier seulement'], answer: 0, why: 'La forme et l’agencement des cellules aident à décrire le tissu.' } },
    'cell/mitosis': { ar: { q: 'ما البنية التي تساعد على تتبع مراحل الانقسام الخلوي؟', options: ['الكروموسومات وتغير توزعها', 'لون الشريحة وحده', 'حجم المجهر'], answer: 0, why: 'تغير مظهر الكروموسومات وتوزعها من العلامات المهمة لمتابعة الانقسام.' }, fr: { q: 'Quelle structure aide à suivre les étapes de la division cellulaire ?', options: ['Les chromosomes et leur répartition', 'La seule couleur de la lame', 'La taille du microscope'], answer: 0, why: 'L’aspect et la répartition des chromosomes sont des indices importants de la division.' } },
    'respiratory/alveoli': { ar: { q: 'ما الخاصية التي تسهل تبادل الغازات في الحويصلات الرئوية؟', options: ['جدار رقيق وقرب الشعيرات الدموية', 'جدار سميك وغياب الأوعية', 'الابتعاد عن الدم'], answer: 0, why: 'رقة الجدار وقرب الشعيرات الدموية يسهلان انتقال الغازات بين الهواء والدم.' }, fr: { q: 'Quelle caractéristique facilite les échanges gazeux dans les alvéoles ?', options: ['Une paroi fine et des capillaires proches', 'Une paroi épaisse sans vaisseaux', 'L’éloignement du sang'], answer: 0, why: 'La finesse de la paroi et la proximité des capillaires facilitent les échanges entre l’air et le sang.' } }
  });

  const processedGalleries = new WeakSet();

  // Ressources réellement présentes dans la bibliothèque du site.
  // Les associations restent volontairement limitées aux documents dont le titre est explicite.
  const RELATED_LEARNING_RESOURCES = Object.freeze({
    'geology/rock': [
      { path: 'divers/Les grandes structures géologiques.pdf', ar: 'مرجع: البنيات الجيولوجية الكبرى', fr: 'Référence : Les grandes structures géologiques', typeAr: 'وثيقة علمية', typeFr: 'Document scientifique' }
    ],
    'ecology/ecosystem': [
      { path: 'exercices/francais/2BAC/2BACSP/POLLUTION.pdf', ar: 'تمارين: التلوث', fr: 'Exercices : Pollution', typeAr: 'تمارين – الثانية باكالوريا علوم فيزيائية', typeFr: 'Exercices – 2e Bac Sciences Physiques' },
      { path: 'exercices/francais/2BAC/2BACSP/SERIE POLLUTION.pdf', ar: 'سلسلة تمارين حول التلوث', fr: 'Série d’exercices sur la pollution', typeAr: 'تمارين – الثانية باكالوريا علوم فيزيائية', typeFr: 'Exercices – 2e Bac Sciences Physiques' }
    ],
    'cell/animal': [
      { path: "cours/francais/2BAC/2BACSVT/eleves- cours 2bacsvt-francais- unite 1 -Chap 2-role de muscle strie.pdf", ar: 'درس: دور العضلة المخططة', fr: 'Cours : Rôle du muscle strié', typeAr: 'درس – الثانية باكالوريا علوم الحياة والأرض', typeFr: 'Cours – 2e Bac Sciences de la Vie et de la Terre' }
    ]
  });

  function createRelatedLearningPanel(categoryKey) {
    const isFrench = document.documentElement.lang === 'fr';
    const panel = document.createElement('section');
    panel.className = 'ri-related-learning';
    const heading = document.createElement('strong');
    heading.textContent = isFrench ? 'Pour poursuivre votre apprentissage' : 'واصل تعلمك من مكتبة الموقع';
    const intro = document.createElement('p');
    intro.textContent = isFrench
      ? 'Ressources disponibles dont le titre présente un lien identifiable avec ce thème.'
      : 'موارد متاحة في الموقع، أُدرجت هنا عندما يدل عنوانها بوضوح على صلتها بهذا الموضوع.';
    panel.append(heading, intro);
    const resources = RELATED_LEARNING_RESOURCES[categoryKey] || [];
    if (!resources.length) {
      const empty = document.createElement('p');
      empty.className = 'ri-related-learning-empty';
      empty.textContent = isFrench
        ? 'Aucune ressource directement correspondante n’a été identifiée dans le catalogue actuel. Cette rubrique sera enrichie lorsque des documents adaptés seront disponibles.'
        : 'لم نعثر بعد على مورد مطابق مباشرة لهذا الموضوع في الفهرس الحالي. سيُضاف المحتوى المناسب عند توفره.';
      panel.appendChild(empty);
      return panel;
    }
    const list = document.createElement('ul');
    resources.forEach(function (resource) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '/' + resource.path.split('/').map(encodeURIComponent).join('/');
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = isFrench ? resource.fr : resource.ar;
      const meta = document.createElement('small');
      meta.textContent = isFrench ? resource.typeFr : resource.typeAr;
      item.append(link, meta);
      list.appendChild(item);
    });
    panel.appendChild(list);
    return panel;
  }

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
      container.replaceChildren(card, createObservationActivity(key), createRelatedLearningPanel(key));
      container.setAttribute('aria-busy', 'false');
    }).catch(function () {
      showGalleryFallback(container, labels);
    });
  }

  function ensureGuidedReasoningStyles() {
    if (document.getElementById('ri-guided-reasoning-styles')) return;
    const style = document.createElement('style');
    style.id = 'ri-guided-reasoning-styles';
    style.textContent = '.ri-learning-stage{margin:0 0 3px;color:#287044;font-size:.72rem;font-weight:800;letter-spacing:.045em}.ri-related-learning{display:grid;gap:9px;margin:14px 0;padding:14px;border:1px solid #b8cdbd;border-radius:13px;background:rgba(22,101,52,.045)}.ri-related-learning>strong{color:#245d3a;font-size:1rem}.ri-related-learning p{margin:0;line-height:1.65;font-size:.9rem}.ri-related-learning ul{display:grid;gap:9px;margin:0;padding-inline-start:22px}.ri-related-learning li{padding:4px 0;line-height:1.5}.ri-related-learning a{color:#176b45;font-weight:700;text-decoration:underline;text-underline-offset:3px}.ri-related-learning small{display:block;margin-top:3px;color:#64748b;font-size:.78rem}.ri-related-learning-empty{padding:9px;border-radius:8px;background:rgba(100,116,139,.08)}html.gs-dark .ri-related-learning{background:rgba(34,197,94,.06);border-color:#405846}html.gs-dark .ri-related-learning>strong,html.gs-dark .ri-related-learning a{color:#9ed8ad}.ri-science-challenge{display:grid;gap:10px;margin:16px 0;padding:15px;border:1px solid #94a3b8;border-radius:14px;background:rgba(2,132,199,.06)}.ri-science-challenge p{margin:0;line-height:1.7}.ri-science-challenge-hint{justify-self:start;padding:7px 12px;border:1px solid #0e7490;border-radius:8px;background:transparent;color:#0e7490;font:inherit;cursor:pointer}.ri-science-challenge-hint-text{padding:9px 11px;border-inline-start:3px solid #0e7490;border-radius:7px;background:rgba(14,116,144,.1)}.ri-science-challenge-select{width:100%;min-height:42px;padding:8px;border:1px solid #94a3b8;border-radius:8px;background:Canvas;color:CanvasText;font:inherit}.ri-science-challenge-check{justify-self:start;padding:9px 15px;border:0;border-radius:9px;background:#0369a1;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ri-science-challenge-feedback{padding:10px;border-radius:8px;background:rgba(14,116,144,.1)}.ri-science-review-advice{display:grid;gap:7px;padding:12px;border:1px solid #86b99a;border-inline-start:4px solid #16835d;border-radius:10px;background:rgba(22,101,52,.07)}.ri-science-review-advice strong{color:#24613b}.ri-science-review-advice p{margin:0;line-height:1.7;font-size:.9rem}html.gs-dark .ri-science-review-advice{border-color:#456b50;background:rgba(34,197,94,.08)}html.gs-dark .ri-science-review-advice strong{color:#9ed8ad}.ri-science-journal{display:grid;gap:8px;margin:12px 0;padding:13px;border:1px solid #a7c7b3;border-radius:12px;background:rgba(22,101,52,.05)}.ri-science-journal>strong{color:#24613b}.ri-science-journal-summary{margin:0;line-height:1.6;font-size:.9rem}.ri-science-journal-list{display:grid;gap:6px;margin:0;padding-inline-start:22px}.ri-science-journal-list li{padding:5px 0;font-size:.84rem;line-height:1.5}.ri-science-journal-list li[data-completed=true]{color:#24613b;font-weight:600}.ri-science-missions{display:grid;gap:7px}.ri-science-mission{margin:0;padding:9px 11px;border-radius:9px;background:rgba(2,132,199,.07);font-size:.86rem;line-height:1.55}.ri-science-level{display:grid;gap:7px;padding:12px;border:1px solid #9bb9d0;border-radius:12px;background:rgba(2,132,199,.06)}.ri-science-level-meta{margin:0;font-size:.84rem;line-height:1.5}.ri-science-level-track{height:10px;overflow:hidden;border-radius:99px;background:#dbe5ed}.ri-science-level-fill{display:block;height:100%;width:0;border-radius:inherit;background:#16835d;transition:width .25s ease}.ri-science-badge-title{display:block;margin-top:8px}.ri-science-badges{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}.ri-science-badge{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #cbd5e1;border-radius:11px;background:rgba(255,255,255,.65)}.ri-science-badge[data-unlocked=true]{border-color:#86b99a;background:rgba(22,101,52,.08)}.ri-science-badge[data-unlocked=false]{opacity:.62;filter:grayscale(.65)}.ri-science-badge-icon{font-size:1.5rem}.ri-science-badge-details{display:grid;gap:3px}.ri-science-badge-details small{font-size:.76rem;line-height:1.4}.ri-science-badge-details small:last-child{font-weight:700;color:#24613b}.ri-hypothesis-workshop{display:grid;gap:11px;margin:14px 0;padding:15px;border:1px solid #7ca9b9;border-radius:14px;background:rgba(14,116,144,.055)}.ri-hypothesis-workshop>strong{color:#0e7490}.ri-hypothesis-workshop p{margin:0;line-height:1.7}.ri-hypothesis-scenario{padding:10px;border-inline-start:3px solid #0e7490;border-radius:8px;background:rgba(14,116,144,.08)}.ri-hypothesis-workshop>label,.ri-hypothesis-field{display:grid;gap:6px;font-weight:600}.ri-hypothesis-workshop textarea{width:100%;min-height:65px;padding:10px;border:1px solid #94a3b8;border-radius:9px;background:Canvas;color:CanvasText;font:inherit;resize:vertical}.ri-hypothesis-select{width:100%;min-height:46px;padding:9px;border:1px solid #94a3b8;border-radius:9px;background:Canvas;color:CanvasText;font:inherit;line-height:1.5}.ri-hypothesis-check{justify-self:start;padding:10px 15px;border:0;border-radius:9px;background:#0e7490;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ri-hypothesis-feedback{padding:11px;border-radius:9px;background:rgba(14,116,144,.1);line-height:1.75}.ri-hypothesis-feedback[data-result=success]{border-inline-start:4px solid #16835d;background:rgba(22,131,93,.1)}.ri-hypothesis-feedback[data-result=review]{border-inline-start:4px solid #c0841a;background:rgba(245,158,11,.1)}html.gs-dark .ri-hypothesis-workshop{border-color:#426879;background:rgba(14,116,144,.1)}html.gs-dark .ri-hypothesis-workshop>strong{color:#8bd2e2}@media(max-width:600px){.ri-hypothesis-workshop{padding:11px}.ri-hypothesis-check{width:100%}}.ri-data-analysis{display:grid;gap:11px;margin:14px 0;padding:15px;border:1px solid #8da9c6;border-radius:14px;background:rgba(59,130,246,.055)}.ri-data-analysis>strong{color:#245d91}.ri-data-analysis p{margin:0;line-height:1.7}.ri-data-table{width:100%;border-collapse:collapse;table-layout:fixed;background:rgba(255,255,255,.55);border-radius:9px;overflow:hidden}.ri-data-table th,.ri-data-table td{padding:9px 10px;border:1px solid #cbd5e1;text-align:start;vertical-align:top;overflow-wrap:anywhere;line-height:1.5}.ri-data-table th{background:rgba(14,116,144,.12);font-weight:700}.ri-data-question{font-weight:700}.ri-data-select{width:100%;min-height:46px;padding:9px;border:1px solid #94a3b8;border-radius:9px;background:Canvas;color:CanvasText;font:inherit;line-height:1.5}.ri-data-check{justify-self:start;padding:10px 15px;border:0;border-radius:9px;background:#245d91;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ri-data-feedback{padding:11px;border-radius:9px;background:rgba(14,116,144,.1)}.ri-data-feedback[data-correct=true]{border-inline-start:4px solid #16835d;background:rgba(22,131,93,.1)}.ri-data-feedback[data-correct=false]{border-inline-start:4px solid #c0841a;background:rgba(245,158,11,.1)}html.gs-dark .ri-data-analysis{border-color:#435d79;background:rgba(59,130,246,.09)}html.gs-dark .ri-data-analysis>strong{color:#9cc9f4}html.gs-dark .ri-data-table{background:rgba(15,23,42,.5)}html.gs-dark .ri-data-table th,html.gs-dark .ri-data-table td{border-color:#475569}@media(max-width:600px){.ri-data-analysis{padding:11px}.ri-data-table th,.ri-data-table td{padding:7px;font-size:.85rem}.ri-data-check{width:100%}}.ri-guided-reasoning{display:grid;gap:12px;margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:14px;background:rgba(14,116,144,.06)}.ri-guided-reasoning>strong{font-size:1.05rem}.ri-guided-reasoning p{margin:0;line-height:1.7}.ri-guided-step label{display:grid;gap:6px;font-weight:600}.ri-guided-step textarea{width:100%;min-height:64px;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:Canvas;color:CanvasText;font:inherit;resize:vertical}.ri-observation-compose{justify-self:start;padding:9px 16px;border:0;border-radius:9px;background:#0e7490;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ri-observation-compose-status{font-size:.9em;line-height:1.6}.ri-reasoning-repair{display:grid;gap:10px;margin:14px 0;padding:14px;border:1px solid #c49b58;border-radius:13px;background:rgba(245,158,11,.07)}.ri-reasoning-repair>strong{color:#925b12}.ri-reasoning-repair p{margin:0;line-height:1.7}.ri-repair-observation{padding:9px;border-inline-start:3px solid #0e7490;background:rgba(14,116,144,.07);border-radius:7px}.ri-repair-flawed{padding:9px;border-inline-start:3px solid #c0841a;background:rgba(245,158,11,.09);border-radius:7px}.ri-repair-select{width:100%;min-height:44px;padding:9px;border:1px solid #94a3b8;border-radius:9px;background:Canvas;color:CanvasText;font:inherit}.ri-repair-check{justify-self:start;padding:9px 14px;border:0;border-radius:9px;background:#94620e;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ri-repair-feedback{padding:11px;border-radius:9px;background:rgba(14,116,144,.1);line-height:1.7}.ri-repair-feedback[data-correct=true]{background:rgba(22,131,93,.1);border-inline-start:4px solid #16835d}.ri-repair-feedback[data-correct=false]{background:rgba(245,158,11,.1);border-inline-start:4px solid #c0841a}html.gs-dark .ri-reasoning-repair{border-color:#806334;background:rgba(245,158,11,.08)}html.gs-dark .ri-reasoning-repair>strong{color:#f2c879}@media(max-width:600px){.ri-reasoning-repair{padding:11px}.ri-repair-check{width:100%}}.ri-reasoning-map{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;position:relative;margin:4px 0 8px}.ri-reasoning-node{display:grid;align-content:start;gap:6px;min-width:0;padding:12px;border:1px solid #b8cbd5;border-radius:11px;background:rgba(255,255,255,.62);transition:border-color .18s,background .18s}.ri-reasoning-node strong{font-size:.9rem;color:#0e7490}.ri-reasoning-node small{font-size:.75rem;color:#64748b}.ri-reasoning-node p{margin:0;min-height:3.5em;overflow-wrap:anywhere;font-size:.82rem;line-height:1.55;color:CanvasText}.ri-reasoning-node.has-content{border-color:#16835d;background:rgba(22,131,93,.08)}.ri-reasoning-node.has-content strong{color:#16835d}html.gs-dark .ri-reasoning-node{background:rgba(15,23,42,.5);border-color:#475569}html.gs-dark .ri-reasoning-node.has-content{background:rgba(34,197,94,.1);border-color:#4b8b62}html.gs-dark .ri-reasoning-node.has-content strong{color:#9ed8ad}@media(max-width:600px){.ri-reasoning-map{grid-template-columns:1fr;gap:8px}.ri-reasoning-node{padding:10px}.ri-reasoning-node p{min-height:0}}@media(max-width:600px){.ri-guided-reasoning{padding:12px}.ri-observation-compose{width:100%}}';
    document.head.appendChild(style);
  }

  const CHALLENGE_STAGES = Object.freeze({
    'cell/plant': {
      ar: [
        { q: 'إذا لاحظت خلايا متجاورة ذات حدود واضحة، فما الاستنتاج الأكثر حذراً؟', options: ['أن النسيج يتكون من خلايا منظمة', 'أن كل خلية تقوم بالوظيفة نفسها حتماً', 'أن الصورة تثبت جميع العضيات'], answer: 0, why: 'الحدود والترتيب يدعمان وصف التنظيم الخلوي، لكنهما لا يكشفان وحدهما كل الوظائف أو العضيات.' },
        { q: 'ما المعطى الإضافي الذي يساعد على تحديد وظيفة نسيج نباتي؟', options: ['موقع النسيج وبنيته ومعلومات عن العضو', 'درجة سطوع الشاشة', 'حجم ملف الصورة'], answer: 0, why: 'تفسير الوظيفة يحتاج ربط البنية بموقع النسيج ومعطيات أخرى، وليس خصائص عرض الصورة.' }
      ],
      fr: [
        { q: 'Si des cellules voisines présentent des limites nettes, quelle conclusion est la plus prudente ?', options: ['Le tissu présente une organisation cellulaire', 'Toutes les cellules ont forcément la même fonction', 'L’image révèle tous les organites'], answer: 0, why: 'Les limites et l’agencement décrivent l’organisation, mais ne révèlent pas à eux seuls toutes les fonctions ou tous les organites.' },
        { q: 'Quelle donnée supplémentaire aide à déterminer la fonction d’un tissu végétal ?', options: 'La position du tissu, sa structure et des informations sur l’organe|La luminosité de l’écran|La taille du fichier image'.split('|'), answer: 0, why: 'Il faut relier la structure à la position du tissu et à d’autres données, pas aux propriétés d’affichage.' }
      ]
    },
    'genetics/dna': {
      ar: [
        { q: 'إذا كان المعروض نموذجاً للولب المزدوج، فما الذي لا يمكن استنتاجه من ألوانه وحدها؟', options: ['الألوان الحقيقية للجزيء داخل الخلية', 'وجود بنية جزيئية ممثلة', 'أن النموذج يوضح تنظيم ADN'], answer: 0, why: 'ألوان النماذج اصطلاحية غالباً، ولا تمثل بالضرورة ألوان الجزيئات الحقيقية.' },
        { q: 'أي مستوى من التنظيم يمثله ADN مباشرة؟', options: ['المستوى الجزيئي', 'مستوى النظام البيئي', 'مستوى العضو'], answer: 0, why: 'ADN جزيء يحمل المعلومة الوراثية، لذلك نتحدث عن المستوى الجزيئي.' }
      ],
      fr: [
        { q: 'Si l’image montre un modèle de double hélice, que ne peut-on pas déduire de ses couleurs seules ?', options: ['Les couleurs réelles de la molécule dans la cellule', 'La représentation d’une structure moléculaire', 'L’organisation de l’ADN'], answer: 0, why: 'Les couleurs des modèles sont souvent conventionnelles et ne représentent pas nécessairement les couleurs réelles des molécules.' },
        { q: 'Quel niveau d’organisation l’ADN représente-t-il directement ?', options: ['Le niveau moléculaire', 'Le niveau de l’écosystème', 'Le niveau de l’organe'], answer: 0, why: 'L’ADN est une molécule qui porte l’information génétique : il relève du niveau moléculaire.' }
      ]
    },
    'ecology/ecosystem': {
      ar: [
        { q: 'وجود نبات وماء في صورة واحدة يثبت أي علاقة؟', options: ['يثبت وجودهما معاً فقط؛ أما التفاعل فيحتاج أدلة إضافية', 'يثبت أن النبات امتص الماء لحظة التصوير', 'يثبت أن الماء هو العامل المحدد للنمو'], answer: 0, why: 'الصورة الثابتة تُظهر التواجد، لكنها لا تثبت وحدها حدوث عملية أو علاقة سببية.' },
        { q: 'كيف نتحقق بشكل أفضل من فرضية تأثير الماء في نمو النبات؟', options: ['مقارنة نمو نباتات في شروط مائية مختلفة مع ضبط العوامل الأخرى', 'الاعتماد على صورة واحدة', 'مقارنة لون صورتين مختلفتي الإضاءة'], answer: 0, why: 'المقارنة المنهجية مع ضبط العوامل تساعد على اختبار الفرضية بدل الاكتفاء بالملاحظة.' }
      ],
      fr: [
        { q: 'La présence d’une plante et d’eau dans une même photo prouve quelle relation ?', options: 'Elle prouve seulement leur présence simultanée ; l’interaction demande d’autres preuves|Elle prouve que la plante a absorbé l’eau au moment de la photo|Elle prouve que l’eau limite la croissance'.split('|'), answer: 0, why: 'Une image fixe montre une co-présence, mais ne prouve pas à elle seule un processus ou une causalité.' },
        { q: 'Comment tester plus solidement l’hypothèse d’un effet de l’eau sur la croissance ?', options: 'Comparer des plantes avec des conditions hydriques différentes en contrôlant les autres facteurs|Utiliser une seule photo|Comparer deux images avec des éclairages différents'.split('|'), answer: 0, why: 'Une comparaison méthodique avec contrôle des facteurs permet de tester l’hypothèse.' }
      ]
    },
    'geology/rock': {
      ar: [
        { q: 'لاحظت طبقات متوازية في تكوين صخري. ما الوصف المناسب قبل تحديد نوع الصخر؟', options: ['تكوين ذو بنية متطبقة', 'صخر ناري مؤكد', 'صخر من عصر جيولوجي محدد'], answer: 0, why: 'التطبق وصف بنيوي مرئي، لكنه لا يكفي وحده للجزم بالنوع أو العمر.' },
        { q: 'أي دليل يساعد على تفسير أصل التكوين الصخري؟', options: ['التركيب المعدني والسياق الطبقي والعينات', 'اللون في صورة واحدة فقط', 'اسم المنطقة دون فحص'], answer: 0, why: 'تحديد الأصل يحتاج جمع أدلة ميدانية ومخبرية وسياقية.' }
      ],
      fr: [
        { q: 'Vous observez des couches parallèles dans une formation rocheuse. Quelle description convient avant d’identifier la roche ?', options: ['Une formation à structure stratifiée', 'Une roche magmatique certaine', 'Une roche d’un âge géologique précis'], answer: 0, why: 'La stratification est une description visible, mais elle ne suffit pas à déterminer seule la nature ou l’âge.' },
        { q: 'Quel indice aide à interpréter l’origine d’une formation rocheuse ?', options: 'La composition minérale, le contexte stratigraphique et les échantillons|La couleur d’une seule photo|Le nom de la région sans examen'.split('|'), answer: 0, why: 'L’interprétation de l’origine demande plusieurs indices de terrain, de laboratoire et de contexte.' }
      ]
    },
    'cell/animal': {
      ar: [
        { q: 'إذا اختلف شكل الخلايا داخل نسيج، فما الفرضية العلمية الممكنة؟', options: ['قد يرتبط اختلاف الشكل بتخصص وظيفي', 'كل الخلايا تنتمي بالضرورة إلى أنسجة مختلفة', 'الشكل وحده يحدد الوظيفة بشكل قطعي'], answer: 0, why: 'قد يرتبط الشكل بالوظيفة، لكن يلزم فحص خصائص أخرى لتأكيد التخصص.' },
        { q: 'ما أفضل طريقة لدعم الربط بين شكل الخلية ووظيفتها؟', options: ['مقارنة البنية والموقع ومعطيات وظيفة النسيج', 'الاعتماد على شكل خلية واحدة', 'تجاهل تنظيم الخلايا'], answer: 0, why: 'الاستدلال الأقوى يجمع الملاحظة المجهرية مع موقع الخلايا ووظيفة النسيج.' }
      ],
      fr: [
        { q: 'Si les cellules d’un tissu ont des formes différentes, quelle hypothèse est possible ?', options: ['La forme peut être liée à une spécialisation fonctionnelle', 'Toutes les cellules appartiennent forcément à des tissus différents', 'La forme seule détermine définitivement la fonction'], answer: 0, why: 'La forme peut être liée à la fonction, mais d’autres caractéristiques sont nécessaires pour confirmer la spécialisation.' },
        { q: 'Quelle démarche soutient le mieux le lien entre forme et fonction ?', options: 'Comparer la structure, la position et les données sur la fonction du tissu|Se baser sur une seule cellule|Ignorer l’organisation cellulaire'.split('|'), answer: 0, why: 'Un raisonnement solide associe l’observation microscopique à la position des cellules et à la fonction du tissu.' }
      ]
    },
    'cell/mitosis': {
      ar: [
        { q: 'إذا ظهرت الكروموسومات مصطفة قرب وسط الخلية، فما المرحلة المحتملة؟', options: ['الطور الاستوائي', 'الطور النهائي', 'مرحلة السكون'], answer: 0, why: 'اصطفاف الكروموسومات في المستوى الاستوائي علامة مميزة للطور الاستوائي، مع ضرورة مراعاة جودة الصورة.' },
        { q: 'ما الحدث الذي يلي انفصال الكروماتيدات الشقيقة؟', options: ['تتحرك نحو قطبي الخلية', 'تتحد لتكوين نواة واحدة جديدة فوراً', 'تختفي المادة الوراثية'], answer: 0, why: 'في الطور الانفصالي تتجه الكروماتيدات الشقيقة نحو قطبي الخلية.' }
      ],
      fr: [
        { q: 'Si les chromosomes semblent alignés au centre de la cellule, quelle phase est probable ?', options: ['La métaphase', 'La télophase', 'L’interphase'], answer: 0, why: 'L’alignement des chromosomes sur le plan équatorial caractérise la métaphase, sous réserve de la qualité de l’image.' },
        { q: 'Que se passe-t-il après la séparation des chromatides sœurs ?', options: ['Elles migrent vers les pôles de la cellule', 'Elles fusionnent immédiatement en un seul noyau', 'Le matériel génétique disparaît'], answer: 0, why: 'Pendant l’anaphase, les chromatides sœurs migrent vers les pôles opposés.' }
      ]
    },
    'respiratory/alveoli': {
      ar: [
        { q: 'لماذا تعد رقة جدار الحويصلة مفيدة للتبادل الغازي؟', options: ['تقلل مسافة انتشار الغازات', 'تمنع وصول الدم', 'تزيد المسافة بين الهواء والشعيرات'], answer: 0, why: 'قصر مسافة الانتشار يسهل انتقال الأكسجين وثاني أكسيد الكربون بين الهواء والدم.' },
        { q: 'ما الذي قد يضعف كفاءة التبادل الغازي؟', options: ['زيادة سماكة الحاجز بين الهواء والدم', 'قرب الشعيرات الدموية', 'اتساع مساحة التبادل'], answer: 0, why: 'زيادة سماكة الحاجز تطيل مسافة الانتشار، وقد تعيق انتقال الغازات.' }
      ],
      fr: [
        { q: 'Pourquoi la finesse de la paroi alvéolaire favorise-t-elle les échanges ?', options: ['Elle réduit la distance de diffusion des gaz', 'Elle empêche l’arrivée du sang', 'Elle éloigne l’air des capillaires'], answer: 0, why: 'Une faible distance de diffusion facilite le passage de l’oxygène et du dioxyde de carbone entre l’air et le sang.' },
        { q: 'Quel changement pourrait réduire l’efficacité des échanges gazeux ?', options: ['Un épaississement de la barrière entre l’air et le sang', 'La proximité des capillaires', 'Une grande surface d’échange'], answer: 0, why: 'Une barrière plus épaisse augmente la distance de diffusion et peut freiner le transfert des gaz.' }
      ]
    }
  });

  const SCIENCE_JOURNAL_KEY = 'gosvt_science_challenge_journal_v1';

  function readScienceJournal() {
    try {
      const value = JSON.parse(window.localStorage.getItem(SCIENCE_JOURNAL_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }

  function getScienceMissionDates(now) {
    const date = new Date(now || Date.now());
    const dayKey = date.toISOString().slice(0, 10);
    const dayNumber = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return { dayKey: dayKey, weekKey: monday.toISOString().slice(0, 10), dayNumber: dayNumber };
  }

  function saveScienceJournalEntry(categoryKey, score) {
    try {
      const records = readScienceJournal();
      const previous = records[categoryKey] || {};
      const now = new Date();
      const isoNow = now.toISOString();
      const dates = getScienceMissionDates(now);
      const categoryKeys = ['cell/plant', 'genetics/dna', 'ecology/ecosystem', 'geology/rock', 'cell/animal', 'cell/mitosis', 'respiratory/alveoli'];
      const dailyCategory = categoryKeys[((dates.dayNumber % categoryKeys.length) + categoryKeys.length) % categoryKeys.length];
      const meta = records._meta && typeof records._meta === 'object' ? records._meta : {};
      let bonusXp = 0;
      let dailyDone = meta.dailyMissionDate === dates.dayKey;
      let weeklyDone = meta.weeklyMissionKey === dates.weekKey;
      records[categoryKey] = {
        bestScore: Math.max(Number(previous.bestScore) || 0, score),
        lastScore: score,
        attempts: (Number(previous.attempts) || 0) + 1,
        completedAt: isoNow
      };
      if (!dailyDone && categoryKey === dailyCategory) {
        bonusXp += 10;
        dailyDone = true;
        meta.dailyMissionDate = dates.dayKey;
      }
      const weeklyCount = categoryKeys.filter(function (key) {
        const record = records[key];
        if (!record || !record.completedAt) return false;
        return getScienceMissionDates(record.completedAt).weekKey === dates.weekKey;
      }).length;
      if (!weeklyDone && weeklyCount >= 3) {
        bonusXp += 25;
        weeklyDone = true;
        meta.weeklyMissionKey = dates.weekKey;
      }
      const baseXp = 15 + (Math.max(0, Math.min(3, Number(score) || 0)) * 5);
      const earnedXp = baseXp + bonusXp;
      meta.xp = (Number(meta.xp) || 0) + earnedXp;
      meta.updatedAt = isoNow;
      records._meta = meta;
      records[categoryKey].lastXp = earnedXp;
      records[categoryKey].lastBonusXp = bonusXp;
      window.localStorage.setItem(SCIENCE_JOURNAL_KEY, JSON.stringify(records));
      return { records: records, earnedXp: earnedXp, bonusXp: bonusXp, dailyDone: dailyDone, weeklyDone: weeklyDone };
    } catch (_) { return null; }
  }

  function createScienceJournal(isFrench) {
    const panel = document.createElement('section');
    panel.className = 'ri-science-journal';
    const title = document.createElement('strong');
    title.textContent = isFrench ? 'Mon carnet de découvertes' : 'دفتر اكتشافاتي العلمية';
    const summary = document.createElement('p');
    summary.className = 'ri-science-journal-summary';
    const missions = document.createElement('div');
    missions.className = 'ri-science-missions';
    const dailyMission = document.createElement('p');
    const weeklyMission = document.createElement('p');
    dailyMission.className = 'ri-science-mission';
    weeklyMission.className = 'ri-science-mission';
    missions.append(dailyMission, weeklyMission);
    const levelPanel = document.createElement('div');
    levelPanel.className = 'ri-science-level';
    const levelName = document.createElement('strong');
    const levelMeta = document.createElement('p');
    levelMeta.className = 'ri-science-level-meta';
    const levelTrack = document.createElement('div');
    levelTrack.className = 'ri-science-level-track';
    levelTrack.setAttribute('role', 'progressbar');
    levelTrack.setAttribute('aria-valuemin', '0');
    levelTrack.setAttribute('aria-valuemax', '100');
    const levelFill = document.createElement('span');
    levelFill.className = 'ri-science-level-fill';
    levelTrack.appendChild(levelFill);
    const badgeTitle = document.createElement('strong');
    badgeTitle.className = 'ri-science-badge-title';
    badgeTitle.textContent = isFrench ? 'Mes badges scientifiques' : 'شاراتي العلمية';
    const badges = document.createElement('div');
    badges.className = 'ri-science-badges';
    const list = document.createElement('ul');
    list.className = 'ri-science-journal-list';
    const names = {
      'cell/plant': { ar: 'الخلايا النباتية', fr: 'Cellules végétales' },
      'genetics/dna': { ar: 'الوراثة و ADN', fr: 'Génétique et ADN' },
      'ecology/ecosystem': { ar: 'النظام البيئي', fr: 'Écosystème' },
      'geology/rock': { ar: 'الصخور والجيولوجيا', fr: 'Roches et géologie' },
      'cell/animal': { ar: 'الأنسجة الحيوانية', fr: 'Tissus animaux' },
      'cell/mitosis': { ar: 'الانقسام الخلوي', fr: 'Division cellulaire' },
      'respiratory/alveoli': { ar: 'الحويصلات الرئوية', fr: 'Alvéoles pulmonaires' }
    };
    const badgeRules = [
      { id: 'first', icon: '🔎', ar: 'بداية الاستكشاف', fr: 'Premier pas', arWhy: 'إكمال أول تحدٍّ علمي', frWhy: 'Terminer un premier défi', test: function (r, n, a) { return a > 0; } },
      { id: 'three', icon: '🧭', ar: 'مستكشف نشيط', fr: 'Explorateur actif', arWhy: 'استكشاف ثلاثة مواضيع مختلفة', frWhy: 'Explorer trois thèmes différents', test: function (r, n) { return n >= 3; } },
      { id: 'all', icon: '🌍', ar: 'رحّالة العلوم', fr: 'Voyageur scientifique', arWhy: 'إكمال تحدٍّ في المواضيع السبعة', frWhy: 'Terminer un défi dans les sept thèmes', test: function (r, n) { return n === 7; } },
      { id: 'perfect', icon: '🏅', ar: 'دقة علمية', fr: 'Précision scientifique', arWhy: 'تحقيق 3 من 3 في أحد التحديات', frWhy: 'Obtenir 3 bonnes réponses sur 3', test: function (r) { return Object.keys(r).some(function (k) { return Number(r[k].bestScore) === 3; }); } },
      { id: 'practice', icon: '📚', ar: 'مثابر في التعلم', fr: 'Persévérant', arWhy: 'إكمال خمسة تحديات على الأقل', frWhy: 'Terminer au moins cinq défis', test: function (r, n, a) { return a >= 5; } }
    ];
    function refresh() {
      const records = readScienceJournal();
      const keys = Object.keys(names);
      const completed = keys.filter(function (key) { return !!records[key]; }).length;
      const attempts = keys.reduce(function (sum, key) {
        return sum + (records[key] ? Number(records[key].attempts) || 0 : 0);
      }, 0);
      summary.textContent = isFrench
        ? completed + ' / ' + keys.length + ' thèmes explorés · ' + attempts + ' défis terminés'
        : completed + ' من ' + keys.length + ' مواضيع مستكشفة · ' + attempts + ' تحدياً مكتملاً';
      const missionDates = getScienceMissionDates();
      const categoryKeys = Object.keys(names);
      const dailyCategory = categoryKeys[((missionDates.dayNumber % categoryKeys.length) + categoryKeys.length) % categoryKeys.length];
      const dailyNames = names[dailyCategory];
      const meta = records._meta || {};
      const dailyDone = meta.dailyMissionDate === missionDates.dayKey;
      const weeklyDone = meta.weeklyMissionKey === missionDates.weekKey;
      const weeklyCount = categoryKeys.filter(function (key) {
        return !!records[key] && !!records[key].completedAt && getScienceMissionDates(records[key].completedAt).weekKey === missionDates.weekKey;
      }).length;
      dailyMission.textContent = (isFrench ? 'Mission du jour : terminer le défi « ' + dailyNames.fr + ' » · +10 XP — ' : 'مهمة اليوم: إكمال تحدي «' + dailyNames.ar + '» · +10 XP — ') + (dailyDone ? (isFrench ? 'Terminée' : 'مكتملة') : (isFrench ? 'À faire' : 'بانتظارك'));
      weeklyMission.textContent = (isFrench ? 'Mission de la semaine : explorer 3 thèmes différents · +25 XP — ' : 'مهمة الأسبوع: استكشاف 3 مواضيع مختلفة · +25 XP — ') + (weeklyDone ? (isFrench ? 'Terminée' : 'مكتملة') : (isFrench ? weeklyCount + ' / 3 thèmes' : weeklyCount + ' من 3 مواضيع'));
      const xp = Math.max(0, Number(records._meta && records._meta.xp) || 0);
      const levels = [
        { min: 0, next: 40, ar: 'مبتدئ', fr: 'Débutant' },
        { min: 40, next: 100, ar: 'مستكشف', fr: 'Explorateur' },
        { min: 100, next: 180, ar: 'باحث', fr: 'Chercheur' },
        { min: 180, next: 180, ar: 'خبير', fr: 'Expert' }
      ];
      const currentLevel = levels.filter(function (level) { return xp >= level.min; }).pop();
      const progressXp = currentLevel.next > currentLevel.min
        ? Math.min(100, Math.round(((xp - currentLevel.min) / (currentLevel.next - currentLevel.min)) * 100))
        : 100;
      levelName.textContent = isFrench
        ? 'Niveau ' + currentLevel.fr + ' · ' + xp + ' XP'
        : 'المستوى: ' + currentLevel.ar + ' · ' + xp + ' نقطة XP';
      levelMeta.textContent = currentLevel.next > currentLevel.min
        ? (isFrench ? (currentLevel.next - xp) + ' XP pour le niveau suivant' : 'بقيت ' + (currentLevel.next - xp) + ' نقطة للمستوى التالي')
        : (isFrench ? 'Niveau maximal atteint' : 'وصلت إلى أعلى مستوى');
      levelFill.style.width = progressXp + '%';
      levelTrack.setAttribute('aria-valuenow', String(progressXp));
      levelTrack.setAttribute('aria-label', isFrench ? 'Progression vers le niveau suivant' : 'التقدم نحو المستوى التالي');
      list.replaceChildren();
      keys.forEach(function (key) {
        const item = document.createElement('li');
        const record = records[key];
        const name = names[key][isFrench ? 'fr' : 'ar'];
        item.textContent = record
          ? name + ' — ' + (isFrench ? 'Meilleur résultat : ' : 'أفضل نتيجة: ') + record.bestScore + '/3 · ' + (isFrench ? 'Tentatives : ' : 'المحاولات: ') + record.attempts
          : name + ' — ' + (isFrench ? 'À découvrir' : 'لم يُستكشف بعد');
        item.setAttribute('data-completed', record ? 'true' : 'false');
        list.appendChild(item);
      });
      const earned = badgeRules.filter(function (rule) { return rule.test(records, completed, attempts); });
      badgeTitle.textContent = isFrench
        ? 'Mes badges scientifiques · ' + earned.length + ' / ' + badgeRules.length
        : 'شاراتي العلمية · ' + earned.length + ' من ' + badgeRules.length;
      badges.replaceChildren();
      badgeRules.forEach(function (rule) {
        const unlocked = earned.some(function (item) { return item.id === rule.id; });
        const badge = document.createElement('div');
        badge.className = 'ri-science-badge';
        badge.setAttribute('data-unlocked', unlocked ? 'true' : 'false');
        const icon = document.createElement('span');
        icon.className = 'ri-science-badge-icon';
        icon.textContent = unlocked ? rule.icon : '🔒';
        const details = document.createElement('span');
        details.className = 'ri-science-badge-details';
        const name = document.createElement('strong');
        name.textContent = rule[isFrench ? 'fr' : 'ar'];
        const condition = document.createElement('small');
        condition.textContent = rule[isFrench ? 'frWhy' : 'arWhy'];
        const state = document.createElement('small');
        state.textContent = unlocked
          ? (isFrench ? 'Badge obtenu' : 'تم الحصول عليها')
          : (isFrench ? 'À débloquer' : 'لم تُفتح بعد');
        details.append(name, condition, state);
        badge.append(icon, details);
        badges.appendChild(badge);
      });
    }
    panel.append(title, summary, missions, levelPanel, badgeTitle, badges, list);
    levelPanel.append(levelName, levelMeta, levelTrack);
    panel.refresh = refresh;
    refresh();
    return panel;
  }

  function createScienceChallenge(categoryKey, onComplete) {
    const isFrench = document.documentElement.lang === 'fr';
    const challenge = SCIENCE_CHALLENGES[categoryKey];
    const stages = CHALLENGE_STAGES[categoryKey];
    if (!challenge || !stages) return null;
    const base = isFrench ? challenge.fr : challenge.ar;
    const stageData = stages[isFrench ? 'fr' : 'ar'];
    const hints = {
      'cell/plant': { ar: 'ركّز على الحدود الفاصلة بين الخلايا وكيفية انتظامها.', fr: 'Concentrez-vous sur les limites entre les cellules et leur agencement.' },
      'genetics/dna': { ar: 'تذكّر الفرق بين تمثيل جزيء وبين صورة مجهرية لخلية.', fr: 'Rappelez-vous la différence entre un modèle moléculaire et une micrographie de cellule.' },
      'ecology/ecosystem': { ar: 'اسأل نفسك: هل يمكن لهذا العنصر أن ينمو أو يتغذى؟', fr: 'Demandez-vous : cet élément peut-il grandir ou se nourrir ?' },
      'geology/rock': { ar: 'التحديد العلمي يحتاج أكثر من لون واحد؛ انتبه إلى الوصف والأدلة.', fr: 'Une identification scientifique demande plus qu’une couleur : examinez plusieurs indices.' },
      'cell/animal': { ar: 'ابدأ بمقارنة شكل الخلايا وطريقة تجمعها.', fr: 'Commencez par comparer la forme des cellules et leur organisation.' },
      'cell/mitosis': { ar: 'تتبّع البنية التي يتغير شكلها وموقعها أثناء الانقسام.', fr: 'Suivez la structure dont l’aspect et la position changent pendant la division.' },
      'respiratory/alveoli': { ar: 'فكّر في المسافة التي ينبغي أن تعبرها الغازات بين الهواء والدم.', fr: 'Pensez à la distance que les gaz doivent parcourir entre l’air et le sang.' }
    };
    const reviewGuidance = {
      'cell/plant': { ar: 'راجع مكوّنات الخلية النباتية، والفرق بين وصف ما يظهر بالمجهر وتحديد وظيفة النسيج. أعد رسم خلية مبسطة وسمِّ البنيات التي درستها.', fr: 'Révisez les constituants de la cellule végétale et la différence entre décrire une image microscopique et déterminer la fonction d’un tissu. Refaites un schéma simple et légendez les structures étudiées.' },
      'genetics/dna': { ar: 'راجع مستويات التنظيم الحيوي وبنية ADN، وميّز بين النموذج التوضيحي والصورة المجهرية؛ فالألوان في النماذج اصطلاحية.', fr: 'Révisez les niveaux d’organisation du vivant et la structure de l’ADN. Distinguez un modèle explicatif d’une micrographie : les couleurs des modèles sont conventionnelles.' },
      'ecology/ecosystem': { ar: 'راجع الفرق بين الملاحظة والفرضية والاستنتاج والعلاقة السببية. تدرب على اقتراح تجربة تغيّر عاملاً واحداً مع تثبيت العوامل الأخرى.', fr: 'Révisez la différence entre observation, hypothèse, conclusion et causalité. Entraînez-vous à proposer une expérience où un seul facteur varie.' },
      'geology/rock': { ar: 'راجع وصف البنيات الجيولوجية ومبدأ التطبق، ولا تحدد نوع الصخر أو عمره من اللون وحده. اجمع قرائن من العينة والسياق الطبقي.', fr: 'Révisez la description des structures géologiques et la stratification. N’identifiez pas une roche ou son âge par sa couleur seule : croisez plusieurs indices.' },
      'cell/animal': { ar: 'راجع العلاقة بين بنية الخلية ووظيفتها وتخصص الأنسجة. قارن خلايا النسيج الواحد من حيث الشكل والتنظيم والموقع.', fr: 'Révisez le lien entre structure cellulaire, fonction et spécialisation des tissus. Comparez la forme, l’organisation et la position des cellules.' },
      'cell/mitosis': { ar: 'راجع مراحل الانقسام غير المباشر وعلامة كل مرحلة، خصوصاً اصطفاف الصبغيات في الطور الاستوائي وهجرة الكروماتيدات في الطور الانفصالي.', fr: 'Révisez les étapes de la mitose et leurs critères : alignement des chromosomes en métaphase et migration des chromatides en anaphase.' },
      'respiratory/alveoli': { ar: 'راجع تكيف الحويصلات الرئوية مع التبادل الغازي: رقة الجدار، قرب الشعيرات، واتساع سطح التبادل، واربطها بانتشار الغازات.', fr: 'Révisez les adaptations des alvéoles aux échanges gazeux : paroi fine, proximité des capillaires et grande surface d’échange. Reliez-les à la diffusion.' }
    };
    const section = document.createElement('section');
    section.className = 'ri-science-challenge';
    const heading = document.createElement('strong');
    const progress = document.createElement('p');
    const question = document.createElement('p');
    const hintButton = document.createElement('button');
    hintButton.type = 'button';
    hintButton.className = 'ri-science-challenge-hint';
    const hintText = document.createElement('p');
    hintText.className = 'ri-science-challenge-hint-text';
    hintText.hidden = true;
    const select = document.createElement('select');
    select.className = 'ri-science-challenge-select';
    select.setAttribute('aria-label', isFrench ? 'Choisir une réponse' : 'اختر إجابة');
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'ri-science-challenge-check';
    const feedback = document.createElement('p');
    feedback.className = 'ri-science-challenge-feedback';
    feedback.setAttribute('role', 'status');
    feedback.hidden = true;
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'ri-science-challenge-check';
    next.hidden = true;
    let step = -1;
    let score = 0;
    let verified = false;

    function renderStep() {
      verified = false;
      feedback.hidden = true;
      next.hidden = true;
      hintText.hidden = true;
      hintButton.setAttribute('aria-expanded', 'false');
      hintButton.textContent = isFrench ? 'Afficher un indice' : 'إظهار تلميح';
      select.replaceChildren();
      const data = step === -1 ? base : stageData[step];
      heading.textContent = isFrench ? 'Défi scientifique progressif' : 'تحدٍّ علمي متدرّج';
      progress.textContent = step === -1
        ? (isFrench ? 'Étape de départ · 1 / 3' : 'مرحلة الانطلاق · 1 / 3')
        : (isFrench ? 'Étape d’analyse · ' + (step + 2) + ' / 3' : 'مرحلة التحليل · ' + (step + 2) + ' / 3');
      question.textContent = data.q;
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = isFrench ? 'Choisissez une réponse…' : 'اختر إجابتك…';
      select.appendChild(placeholder);
      data.options.forEach(function (option, index) {
        const item = document.createElement('option');
        item.value = String(index);
        item.textContent = option;
        select.appendChild(item);
      });
      check.textContent = isFrench ? 'Vérifier' : 'تحقق من الإجابة';
      next.textContent = step < 1
        ? (isFrench ? 'Étape suivante' : 'المرحلة التالية')
        : (isFrench ? 'Terminer le défi' : 'إنهاء التحدي');
    }

    hintButton.addEventListener('click', function () {
      hintText.hidden = !hintText.hidden;
      hintText.textContent = hints[categoryKey][isFrench ? 'fr' : 'ar'];
      hintButton.setAttribute('aria-expanded', String(!hintText.hidden));
      hintButton.textContent = isFrench
        ? (hintText.hidden ? 'Afficher un indice' : 'Masquer l’indice')
        : (hintText.hidden ? 'إظهار تلميح' : 'إخفاء التلميح');
    });
    check.addEventListener('click', function () {
      if (verified) return;
      if (select.value === '') {
        feedback.hidden = false;
        feedback.textContent = isFrench ? 'Choisissez une réponse avant de vérifier.' : 'اختر إجابة قبل التحقق.';
        return;
      }
      const data = step === -1 ? base : stageData[step];
      const correct = Number(select.value) === data.answer;
      if (correct) score += 1;
      verified = true;
      feedback.hidden = false;
      const selectedOption = data.options[Number(select.value)];
      const correctOption = data.options[data.answer];
      feedback.textContent = correct
        ? (isFrench
          ? 'Bonne réponse ! Votre choix (« ' + selectedOption + ' ») est correct. Pourquoi ? ' + data.why
          : 'إجابة صحيحة! اختيارك (« ' + selectedOption + ' ») مناسب. لماذا؟ ' + data.why)
        : (isFrench
          ? 'Réponse à revoir. Vous avez choisi (« ' + selectedOption + ' »), mais la réponse la plus juste est (« ' + correctOption + ' »). Pourquoi ? ' + data.why
          : 'تحتاج الإجابة إلى مراجعة. اخترت (« ' + selectedOption + ' »)، لكن الإجابة الأدق هي (« ' + correctOption + ' »). لماذا؟ ' + data.why);
      select.disabled = true;
      check.disabled = true;
      next.hidden = false;
    });
    next.addEventListener('click', function () {
      if (step < 1) {
        step += 1;
        select.disabled = false;
        check.disabled = false;
        renderStep();
        return;
      }
      const result = saveScienceJournalEntry(categoryKey, score);
      const records = result && result.records ? result.records : readScienceJournal();
      if (typeof onComplete === 'function') onComplete(records);
      section.replaceChildren(heading, progress, feedback, next);
      heading.textContent = isFrench ? 'Défi terminé' : 'اكتمل التحدي';
      progress.textContent = isFrench
        ? 'Résultat indicatif : ' + score + ' / 3 bonnes réponses.'
        : 'نتيجتك التدريبية: ' + score + ' من 3 إجابات صحيحة.';
      feedback.textContent = (isFrench
        ? 'Relisez les explications et comparez-les à vos observations. Ce résultat est un entraînement, pas une note scolaire.'
        : 'راجع التفسيرات وقارنها بملاحظاتك. هذه نتيجة تدريبية وليست نقطة مدرسية.')
        + (result && result.bonusXp ? (isFrench ? ' Bonus de mission : +' + result.bonusXp + ' XP !' : ' مكافأة المهمة: +' + result.bonusXp + ' XP!') : '');
      const reviewPanel = document.createElement('aside');
      reviewPanel.className = 'ri-science-review-advice';
      reviewPanel.setAttribute('aria-live', 'polite');
      const reviewTitle = document.createElement('strong');
      const reviewText = document.createElement('p');
      const reviewTask = document.createElement('p');
      const guidance = reviewGuidance[categoryKey];
      reviewTitle.textContent = score <= 1
        ? (isFrench ? 'Votre prochaine étape : revoir la notion' : 'خطوتك التالية: مراجعة المفهوم')
        : (score === 2
          ? (isFrench ? 'Votre prochaine étape : consolider vos acquis' : 'خطوتك التالية: تثبيت المكتسبات')
          : (isFrench ? 'Votre prochaine étape : approfondir' : 'خطوتك التالية: تعميق التعلم'));
      reviewText.textContent = guidance[isFrench ? 'fr' : 'ar'];
      reviewTask.textContent = score <= 1
        ? (isFrench ? 'Conseil : relisez cette notion dans votre cours, puis revenez refaire le défi.' : 'اقتراح عملي: ارجع إلى الدرس المرتبط بهذا المفهوم، ثم أعد التحدي بعد المراجعة.')
        : (score === 2
          ? (isFrench ? 'Conseil : expliquez cette notion avec vos propres mots et vérifiez-la sur une autre observation.' : 'اقتراح عملي: اشرح المفهوم بكلماتك، ثم اختبر فهمك بملاحظة علمية أخرى.')
          : (isFrench ? 'Conseil : appliquez cette notion à un nouvel exemple et justifiez votre interprétation par des indices.' : 'اقتراح عملي: طبّق المفهوم على مثال جديد، وبرّر تفسيرك بالاعتماد على قرائن واضحة.'));
      reviewPanel.append(reviewTitle, reviewText, reviewTask);
      section.appendChild(reviewPanel);
      next.textContent = isFrench ? 'Recommencer' : 'إعادة التحدي';
      next.hidden = false;
      next.onclick = function () {
        step = -1;
        score = 0;
        select.disabled = false;
        check.disabled = false;
        section.replaceChildren(heading, progress, question, hintButton, hintText, select, check, feedback, next);
        renderStep();
        next.onclick = null;
      };
    });
    section.append(heading, progress, question, hintButton, hintText, select, check, feedback, next);
    renderStep();
    return section;
  }

  function createScienceSimulationWorkshop(categoryKey, isFrench) {
    const models = {
      'cell/plant': { ar:['مدة الإضاءة','ساعة/يوم','النمو النسبي','يزداد النمو مع الإضاءة ثم يقترب من حدّ التشبع؛ لا يعني ذلك أن الإضاءة غير المحدودة مفيدة.'], fr:['Durée d’éclairage','h/jour','Croissance relative','La croissance augmente puis tend vers un plateau ; un éclairage illimité n’est pas nécessairement bénéfique.'], calc:v=>Math.round(100*(1-Math.exp(-v/38))) },
      'genetics/dna': { ar:['كمية ADN في العينة','وحدة نسبية','إشارة القياس','تزداد الإشارة مع كمية ADN عند ثبات طريقة القياس وعدم تشبع الجهاز.'], fr:['Quantité d’ADN','unité relative','Signal mesuré','Le signal augmente avec la quantité d’ADN si la méthode reste constante et sans saturation.'], calc:v=>v },
      'ecology/ecosystem': { ar:['توفر الماء','% من المستوى المرجعي','نمو النباتات','يكون النمو أفضل قرب مستوى ملائم؛ النقص أو الزيادة الكبيرة قد يحدّان منه.'], fr:['Disponibilité en eau','% du niveau de référence','Croissance végétale','La croissance est meilleure près d’un niveau adapté ; déficit ou excès peuvent la limiter.'], calc:v=>Math.max(0,Math.round(100-Math.abs(v-60)*1.35)) },
      'geology/rock': { ar:['سرعة التبريد','وحدة نسبية','حجم البلورات النسبي','التبريد الأسرع يرتبط عادة ببلورات أصغر، والأبطأ يسمح بنمو أكبر.'], fr:['Vitesse de refroidissement','unité relative','Taille relative des cristaux','Un refroidissement rapide est généralement associé à de petits cristaux ; un refroidissement lent favorise leur croissance.'], calc:v=>Math.max(5,Math.round(100/(1+v/12))) },
      'cell/animal': { ar:['مساحة سطح التبادل','وحدة نسبية','كفاءة التبادل النموذجية','زيادة سطح التبادل ترفع القدرة على التبادل عند ثبات بقية العوامل.'], fr:['Surface d’échange','unité relative','Capacité relative d’échange','Une surface plus grande augmente la capacité d’échange si les autres facteurs restent constants.'], calc:v=>v },
      'cell/mitosis': { ar:['مدة الملاحظة','وحدة زمنية','الخلايا المرصودة في الانقسام','تتغير النسبة المرصودة مع توقيت أخذ العينة؛ ولا تمثل سرعة انقسام خلية بعينها.'], fr:['Moment de l’observation','unité de temps','Cellules observées en division','La proportion dépend du moment du prélèvement et ne représente pas la vitesse d’une cellule.'], calc:v=>Math.round(8+22*Math.abs(Math.sin(v/16))) },
      'respiratory/alveoli': { ar:['سماكة حاجز التبادل','وحدة نسبية','معدل الانتشار النسبي','تقل قيمة الانتشار كلما زادت السماكة، مع ثبات مساحة السطح وفرق التركيز.'], fr:['Épaisseur de la barrière','unité relative','Diffusion relative','La diffusion diminue lorsque l’épaisseur augmente, à surface et gradient constants.'], calc:v=>Math.round(100/(1+v/18)) }
    };
    const model = models[categoryKey];
    if (!model) return null;
    const copy = model[isFrench ? 'fr' : 'ar'];
    if (!document.getElementById('ri-experiment-design-styles')) {
      const style = document.createElement('style');
      style.id = 'ri-experiment-design-styles';
      style.textContent = '.ri-experiment-design{display:grid;gap:11px;margin:14px 0;padding:15px;border:1px solid #a8bfae;border-radius:14px;background:rgba(22,101,52,.045)}.ri-experiment-design p{margin:0;line-height:1.65}.ri-experiment-scenario{padding:10px;border-inline-start:3px solid #16835d;background:rgba(22,101,52,.07)}.ri-experiment-design label{display:grid;gap:6px;font-weight:650}.ri-experiment-design textarea,.ri-experiment-select{width:100%;min-height:42px;padding:9px;border:1px solid #a7b9ad;border-radius:8px;background:Canvas;color:CanvasText;font:inherit}.ri-experiment-design textarea{resize:vertical}.ri-experiment-check{justify-self:start;padding:9px 14px;border:0;border-radius:9px;background:#24613b;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ri-experiment-feedback{padding:11px;border-radius:9px;background:rgba(14,116,144,.09);line-height:1.7}.ri-experiment-note{font-size:.82rem;color:#64786a}html.gs-dark .ri-experiment-design{background:rgba(34,197,94,.06);border-color:#456b50}html.gs-dark .ri-experiment-scenario{background:rgba(34,197,94,.1)}';
      document.head.appendChild(style);
    }
    if (!document.getElementById('ri-science-simulation-styles')) {
      const style = document.createElement('style');
      style.id = 'ri-science-simulation-styles';
      style.textContent = '.ri-science-simulation{display:grid;gap:10px;margin:14px 0;padding:15px;border:1px solid #8db6a0;border-radius:14px;background:rgba(16,120,75,.055)}.ri-science-simulation p{margin:0;line-height:1.65}.ri-science-simulation label{font-weight:700}.ri-simulation-slider{width:100%;accent-color:#16835d;cursor:pointer}.ri-simulation-value{font-size:.88rem;font-weight:700}.ri-simulation-meter{height:13px;overflow:hidden;border-radius:99px;background:rgba(100,116,139,.2)}.ri-simulation-meter span{display:block;height:100%;border-radius:inherit;background:#16835d;transition:width .15s ease}.ri-simulation-result{font-weight:800;color:#24613b}html.gs-dark .ri-science-simulation{background:rgba(34,197,94,.07);border-color:#456b50}html.gs-dark .ri-simulation-result{color:#9ed8ad}';
      document.head.appendChild(style);
    }
    const panel = document.createElement('section');
    panel.className = 'ri-science-simulation';
    const heading = document.createElement('strong');
    heading.textContent = isFrench ? 'Laboratoire de simulation : faites varier un paramètre' : 'مختبر المحاكاة: غيّر عاملاً ولاحظ النتيجة';
    const intro = document.createElement('p');
    intro.textContent = isFrench ? 'Modèle pédagogique simplifié : faites glisser le curseur. Les autres facteurs sont supposés constants.' : 'نموذج تعليمي مبسط: حرّك المؤشر ولاحظ النتيجة. نفترض ثبات العوامل الأخرى.';
    const label = document.createElement('label');
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '5'; slider.value = '50';
    slider.className = 'ri-simulation-slider';
    slider.id = 'ri-simulation-' + categoryKey.replace(/[^a-z0-9]+/gi, '-');
    label.htmlFor = slider.id;
    label.textContent = copy[0] + ' (' + copy[1] + ')';
    const output = document.createElement('output');
    output.setAttribute('aria-live', 'polite');
    const valueText = document.createElement('span');
    valueText.className = 'ri-simulation-value';
    const meter = document.createElement('div');
    meter.className = 'ri-simulation-meter';
    meter.setAttribute('role', 'meter'); meter.setAttribute('aria-valuemin','0'); meter.setAttribute('aria-valuemax','100');
    const fill = document.createElement('span'); meter.appendChild(fill);
    const result = document.createElement('p');
    result.className = 'ri-simulation-result'; result.setAttribute('aria-live','polite');
    const explanation = document.createElement('p');
    explanation.textContent = copy[3];
    function update() {
      const value = Number(slider.value);
      const score = Math.max(0, Math.min(100, model.calc(value)));
      output.textContent = value + ' ' + copy[1];
      valueText.textContent = copy[2] + ': ' + score + ' / 100';
      fill.style.width = score + '%';
      meter.setAttribute('aria-valuenow', String(score));
      result.textContent = isFrench ? 'Résultat simulé : ' + score + ' / 100' : 'النتيجة المحاكاة: ' + score + ' من 100';
    }
    slider.addEventListener('input', update);
    panel.append(heading, intro, label, slider, output, valueText, meter, result, explanation);
    update();
    return panel;
  }

  function createExperimentDesignWorkshop(categoryKey, isFrench) {
    const cases = {
      'cell/plant': { ar:['مدة الإضاءة','معدل نمو نباتات متماثلة','كمية الماء ونوع التربة ودرجة الحرارة','مجموعة تتعرض لمدة إضاءة مرجعية'], fr:['Durée d’éclairage','Croissance de plantes comparables','Quantité d’eau, sol et température','Groupe soumis à une durée de référence'] },
      'genetics/dna': { ar:['نوع العينة (مجهولة أو شواهد)','نتيجة اختبار وجود ADN','طريقة الاختبار والكواشف وشروط القياس','شاهد موجب وشاهد سالب'], fr:['Type d’échantillon (inconnu ou témoins)','Résultat du test de présence d’ADN','Méthode, réactifs et conditions de mesure','Témoin positif et témoin négatif'] },
      'ecology/ecosystem': { ar:['كمية الماء المتاحة','نمو النباتات','نوع النبات والضوء والتربة','مجموعة تتلقى كمية ماء مرجعية'], fr:['Quantité d’eau disponible','Croissance des plantes','Espèce, lumière et sol','Groupe recevant une quantité d’eau de référence'] },
      'geology/rock': { ar:['سرعة التبريد في نموذج التبلور','حجم البلورات المتكوّنة','تركيب المادة وكمية العينة','عينة تبرد وفق الشروط المرجعية'], fr:['Vitesse de refroidissement du modèle de cristallisation','Taille des cristaux formés','Composition et quantité de matière','Échantillon refroidi selon les conditions de référence'] },
      'cell/animal': { ar:['مساحة سطح التبادل في نموذج','كمية المادة المنتقلة خلال مدة ثابتة','فرق التركيز والمدة ودرجة الحرارة','نموذج ذو مساحة سطح مرجعية'], fr:['Surface d’échange du modèle','Quantité transférée pendant une durée fixe','Gradient, durée et température','Modèle avec une surface de référence'] },
      'cell/mitosis': { ar:['نوع النسيج أو الحالة المدروسة','نسبة الخلايا المرصودة في الانقسام','طريقة أخذ العينة ووقت الملاحظة ومعايير العد','عينة مرجعية من النسيج نفسه'], fr:['Type de tissu ou condition étudiée','Proportion de cellules observées en division','Prélèvement, moment d’observation et critères de comptage','Échantillon de référence du même tissu'] },
      'respiratory/alveoli': { ar:['سماكة حاجز الانتشار في النموذج','كمية الغاز المنتقلة خلال مدة ثابتة','مساحة السطح وفرق التركيز والحرارة','حاجز ذو سماكة مرجعية'], fr:['Épaisseur de la barrière de diffusion','Quantité de gaz transférée pendant une durée fixe','Surface, gradient de concentration et température','Barrière d’épaisseur de référence'] }
    };
    const data = cases[categoryKey];
    if (!data) return null;
    const values = data[isFrench ? 'fr' : 'ar'];
    const panel = document.createElement('section');
    panel.className = 'ri-experiment-design';
    const title = document.createElement('strong');
    title.textContent = isFrench ? 'Atelier de conception expérimentale' : 'ورشة تصميم التجربة العلمية';
    const intro = document.createElement('p');
    intro.textContent = isFrench ? 'Construisez un protocole en distinguant le facteur modifié, le résultat mesuré, les facteurs contrôlés et le témoin.' : 'صمّم بروتوكولاً يميز بين العامل الذي ستغيره، والنتيجة التي ستقيسها، والعوامل التي ستثبتها، والمجموعة المرجعية.';
    const scenario = document.createElement('p');
    scenario.className = 'ri-experiment-scenario';
    scenario.textContent = isFrench ? 'Mission : proposer une expérience permettant de tester une relation scientifique sans confondre corrélation et causalité.' : 'المهمة: اقترح تجربة لاختبار علاقة علمية دون الخلط بين التزامن والسببية.';
    const hypothesisLabel = document.createElement('label');
    hypothesisLabel.textContent = isFrench ? 'Votre hypothèse :' : 'فرضيتك:';
    const hypothesis = document.createElement('textarea');
    hypothesis.rows = 2;
    hypothesis.maxLength = 500;
    hypothesis.placeholder = isFrench ? 'Si…, alors…, parce que…' : 'إذا… فإن… لأن…';
    const fields = [
      { label: isFrench ? 'Facteur à faire varier' : 'العامل الذي ستغيّره', correct:0, choices:[values[0], isFrench?'La couleur du matériel':'لون الأدوات', isFrench?'Le nom de l’échantillon':'اسم العينة'] },
      { label: isFrench ? 'Résultat à mesurer' : 'النتيجة التي ستقيسها', correct:0, choices:[values[1], isFrench?'La taille de la photo':'حجم الصورة', isFrench?'La préférence de l’observateur':'تفضيل الملاحظ'] },
      { label: isFrench ? 'Facteurs à maintenir constants' : 'العوامل التي ستثبتها', correct:0, choices:[values[2], isFrench?'Changer plusieurs facteurs ensemble':'تغيير عدة عوامل معاً', isFrench?'Ne noter aucune condition':'عدم تسجيل أي شرط'] },
      { label: isFrench ? 'Témoin ou référence' : 'الشاهد أو المجموعة المرجعية', correct:0, choices:[values[3], isFrench?'Supprimer toute comparaison':'إلغاء المقارنة', isFrench?'Choisir un résultat après mesure':'اختيار النتيجة بعد القياس'] }
    ];
    const selects = [];
    fields.forEach(function(field,index){
      const wrap=document.createElement('label');
      wrap.className='ri-experiment-field';
      const caption=document.createElement('span');
      caption.textContent=(index+1)+'. '+field.label;
      const select=document.createElement('select');
      select.className='ri-experiment-select';
      const empty=document.createElement('option');
      empty.value='';
      empty.textContent=isFrench?'Choisissez…':'اختر…';
      select.appendChild(empty);
      field.choices.forEach(function(choice,i){
        const option=document.createElement('option');
        option.value=String(i);
        option.textContent=choice;
        select.appendChild(option);
      });
      wrap.append(caption,select);
      selects.push(select);
      panel.appendChild(wrap);
    });
    const check=document.createElement('button');
    check.type='button';
    check.className='ri-experiment-check';
    check.textContent=isFrench?'Évaluer mon protocole':'قيّم تصميم تجربتي';
    const feedback=document.createElement('div');
    feedback.className='ri-experiment-feedback';
    feedback.hidden=true;
    feedback.setAttribute('aria-live','polite');
    check.addEventListener('click',function(){
      const missing=selects.some(select=>select.value==='');
      feedback.hidden=false;
      if(missing){
        feedback.textContent=isFrench?'Complétez les quatre choix avant l’analyse.':'أكمل الاختيارات الأربعة قبل تحليل البروتوكول.';
        return;
      }
      const score=selects.reduce((sum,select,index)=>sum+(Number(select.value)===fields[index].correct?1:0),0);
      const details=fields.map(function(field,index){
        const chosen=field.choices[Number(selects[index].value)];
        return (index+1)+'. '+field.label+': '+chosen+(Number(selects[index].value)===0?' ✓':' — '+(isFrench?'proposition conseillée : ':'الاقتراح الأنسب: ')+field.choices[0]);
      });
      feedback.textContent=(isFrench?'Analyse formative : '+score+'/4 choix cohérents. ':'تحليل تكويني: '+score+' من 4 اختيارات مناسبة. ')+details.join(' | ')+(isFrench?' Rappelez-vous : une expérience rigoureuse modifie un facteur à la fois, mesure un résultat défini et compare à un témoin.':' تذكّر: التجربة المنضبطة تغيّر عاملاً واحداً، وتقيس نتيجة محددة، وتقارنها بشاهد أو مرجع.');
    });
    const note=document.createElement('p');
    note.className='ri-experiment-note';
    note.textContent=isFrench?'Activité pédagogique sans manipulation de matériel : les réponses ne sont ni notées ni enregistrées.':'نشاط تعليمي للتخطيط فقط، دون استعمال مواد مخبرية؛ لا تُمنح عنه نقاط ولا تُحفظ الإجابات.';
    panel.prepend(title,intro,scenario,hypothesisLabel,hypothesis);
    panel.append(check,feedback,note);
    return panel;
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
    const reasoningMap = document.createElement('div');
    reasoningMap.className = 'ri-reasoning-map';
    reasoningMap.setAttribute('aria-label', isFrench ? 'Schéma des étapes du raisonnement' : 'مخطط مراحل بناء الاستنتاج');
    const reasoningCards = [];
    const reasoningLabels = isFrench
      ? [{ title: 'OBSERVER', hint: 'Un indice visible', empty: 'Votre observation apparaîtra ici.' }, { title: 'INTERPRÉTER', hint: 'Une notion scientifique', empty: 'Votre interprétation apparaîtra ici.' }, { title: 'CONCLURE', hint: 'Une réponse argumentée', empty: 'Votre conclusion apparaîtra ici.' }]
      : [{ title: 'ألاحظ', hint: 'دليل مرئي', empty: 'ستظهر ملاحظتك هنا.' }, { title: 'أفسّر', hint: 'مفهوم علمي', empty: 'سيظهر تفسيرك هنا.' }, { title: 'أستنتج', hint: 'خلاصة معللة', empty: 'سيظهر استنتاجك هنا.' }];
    guidedFields.forEach(function (step, index) {
      const card = document.createElement('div');
      card.className = 'ri-reasoning-node';
      const title = document.createElement('strong');
      title.textContent = reasoningLabels[index].title;
      const hint = document.createElement('small');
      hint.textContent = reasoningLabels[index].hint;
      const preview = document.createElement('p');
      preview.textContent = reasoningLabels[index].empty;
      card.append(title, hint, preview);
      reasoningMap.appendChild(card);
      reasoningCards.push({ preview: preview, empty: reasoningLabels[index].empty });
      guidedInputs[step.key].addEventListener('input', function () {
        reasoningCards[index].preview.textContent = guidedInputs[step.key].value.trim() || reasoningCards[index].empty;
        card.classList.toggle('has-content', Boolean(guidedInputs[step.key].value.trim()));
      });
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
    guidePanel.append(reasoningMap, compose, composeStatus);
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
    const compareButton = document.createElement('button');
    compareButton.type = 'button';
    compareButton.className = 'ri-conclusion-compare';
    compareButton.setAttribute('aria-expanded', 'false');
    compareButton.textContent = isFrench ? 'Comparer avec un modèle scientifique' : 'قارن استنتاجك بنموذج علمي';
    const comparison = document.createElement('section');
    comparison.className = 'ri-conclusion-comparison';
    comparison.hidden = true;
    const comparisonTitle = document.createElement('strong');
    comparisonTitle.textContent = isFrench ? 'Exemple de conclusion scientifique' : 'مثال على استنتاج علمي';
    const modelText = document.createElement('p');
    const model = SCIENCE_CONCLUSION_MODELS[categoryKey];
    modelText.textContent = model ? model[isFrench ? 'fr' : 'ar'] : '';
    const checklistTitle = document.createElement('strong');
    checklistTitle.textContent = isFrench ? 'Ma vérification personnelle' : 'قائمة التحقق الذاتية';
    const checklistItems = isFrench
      ? ['Ai-je décrit un indice réellement visible ?', 'Ai-je relié cet indice à une notion scientifique ?', 'Ma conclusion répond-elle à la question posée ?', 'Ai-je évité une affirmation que l’image ne permet pas de prouver ?']
      : ['هل وصفت دليلاً ظاهراً فعلاً في الصورة؟', 'هل ربطت هذا الدليل بمفهوم علمي؟', 'هل يجيب استنتاجي عن السؤال المطروح؟', 'هل تجنبت الجزم بما لا تثبته الصورة؟'];
    const checklist = document.createElement('div');
    checklist.className = 'ri-conclusion-checklist';
    checklistItems.forEach(function (itemText) {
      const itemLabel = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      const itemTextNode = document.createElement('span');
      itemTextNode.textContent = itemText;
      itemLabel.append(checkbox, itemTextNode);
      checklist.appendChild(itemLabel);
    });
    const comparisonNote = document.createElement('p');
    comparisonNote.className = 'ri-conclusion-note';
    comparisonNote.textContent = isFrench
      ? 'Ce modèle est un exemple à adapter à l’image étudiée. Les cases servent à votre autoévaluation ; elles ne constituent pas une correction automatique.'
      : 'هذا نموذج توضيحي ينبغي تكييفه مع الصورة المدروسة. خانات التأشير للتقييم الذاتي فقط ولا تمثل تصحيحاً آلياً لإجابتك.';
    comparison.append(comparisonTitle, modelText, checklistTitle, checklist, comparisonNote);
    compareButton.addEventListener('click', function () {
      comparison.hidden = !comparison.hidden;
      compareButton.setAttribute('aria-expanded', String(!comparison.hidden));
      compareButton.textContent = comparison.hidden
        ? (isFrench ? 'Comparer avec un modèle scientifique' : 'قارن استنتاجك بنموذج علمي')
        : (isFrench ? 'Masquer le modèle' : 'إخفاء النموذج');
    });
    const repairActivity = createReasoningRepairActivity(categoryKey, isFrench);
    const hypothesisWorkshop = createHypothesisWorkshop(categoryKey, isFrench);
    const dataAnalysisWorkshop = createDataAnalysisWorkshop(categoryKey, isFrench);
    const simulationWorkshop = createScienceSimulationWorkshop(categoryKey, isFrench);\n    const experimentDesignWorkshop = createExperimentDesignWorkshop(categoryKey, isFrench);
    const privacy = document.createElement('p');
    privacy.className = 'ri-observation-privacy';
    privacy.textContent = isFrench ? 'Enregistrement local uniquement : votre réponse n’est pas envoyée au serveur.' : 'يُحفظ الجواب على هذا الجهاز فقط ولا يُرسل إلى الخادم.';
    const journal = createScienceJournal(isFrench);
    const challenge = createScienceChallenge(categoryKey, function () { journal.refresh(); });

    // Ordre pédagogique : observer et formuler, s'entraîner, puis suivre ses acquis.
    const stageOne = document.createElement('p');
    stageOne.className = 'ri-learning-stage';
    stageOne.textContent = isFrench ? 'ÉTAPE 1 · OBSERVER ET EXPLIQUER' : 'المرحلة 1 · الملاحظة والتفسير';
    guidePanel.insertBefore(stageOne, guideTitle);

    const stageTwo = document.createElement('p');
    stageTwo.className = 'ri-learning-stage';
    stageTwo.textContent = isFrench ? 'ÉTAPE 2 · VÉRIFIER SA COMPRÉHENSION' : 'المرحلة 2 · اختبار الفهم والتطبيق';

    const stageThree = document.createElement('p');
    stageThree.className = 'ri-learning-stage';
    stageThree.textContent = isFrench ? 'ÉTAPE 3 · SUIVRE SA PROGRESSION' : 'المرحلة 3 · تتبع التقدم والإنجازات';

    activity.append(guidePanel, label, textarea, actions, review, feedback, compareButton, comparison, repairActivity, hypothesisWorkshop, dataAnalysisWorkshop, simulationWorkshop, experimentDesignWorkshop, status, privacy);
    if (challenge) {
      challenge.insertBefore(stageTwo, challenge.firstChild);
      activity.appendChild(challenge);
    }
    journal.insertBefore(stageThree, journal.firstChild);
    activity.appendChild(journal);
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
