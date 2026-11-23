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
    'cell/plant': { ar: 'خلايا نباتية تحت المجهر', fr: 'Cellules végétales au microscope', alt: 'صورة مجهرية حقيقية لخلايا نباتية' },
    'genetics/dna': { ar: 'الوراثة والحمض النووي', fr: 'Génétique et ADN', alt: 'صورة علمية للحمض النووي' },
    'ecology/ecosystem': { ar: 'الأنظمة البيئية والتنوع الحيوي', fr: 'Écosystèmes et biodiversité', alt: 'صورة ميدانية لنظام بيئي' },
    'geology/rock': { ar: 'الصخور والتكوينات الجيولوجية', fr: 'Roches et formations géologiques', alt: 'صورة ميدانية لصخور جيولوجية' },
    'cell/animal': { ar: 'الأنسجة الحيوانية تحت المجهر', fr: 'Tissus animaux au microscope', alt: 'صورة مجهرية لأنسجة حيوانية' },
    'cell/mitosis': { ar: 'الانقسام الخلوي', fr: 'Division cellulaire', alt: 'صورة مجهرية لمراحل الانقسام الخلوي' },
    'respiratory/alveoli': { ar: 'الحويصلات الرئوية', fr: 'Alvéoles pulmonaires', alt: 'صورة مجهرية للحويصلات الرئوية' }
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
      card.append(frame, info);
      container.replaceChildren(card);
      container.setAttribute('aria-busy', 'false');
    }).catch(function () {
      showGalleryFallback(container, labels);
    });
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
