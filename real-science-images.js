/* Go SVT Maroc — unified, attribution-aware science image catalogue */
(function (window, document) {
  'use strict';

  const QUERY_BY_CATEGORY = Object.freeze({
    'cell/plant': 'plant cell microscopy chloroplast',
    'genetics/dna': 'DNA molecule model scientific photography',
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
    const query = QUERY_BY_CATEGORY[key];
    if (!query) return null;

    const items = await loadCatalogue();
    const item = items[query];
    if (!item || !item.image_url || !item.source_url || !item.license || !item.author) return null;
    if (/licence non indiquée|auteur non indiqué/i.test(item.license + ' ' + item.author)) return null;

    const url = safeImageUrl(item.image_url);
    if (!url) return null;

    return Object.assign({}, item, { url: url });
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
    'geology/rock': { ar: 'الصخور والتكوينات الجيولوجية', fr: 'Roches et formations géologiques', alt: 'صورة ميدانية لصخور جيولوجية' }
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
    if (scope.matches && scope.matches('.stat-icon')) icons.push(scope);
    icons.push.apply(icons, Array.from(scope.querySelectorAll('.stat-icon')));
    const categories = ['cell/plant', 'genetics/dna', 'ecology/ecosystem', 'geology/rock'];
    await Promise.all(icons.map(async function (icon, index) {
      if (processedIcons.has(icon)) return;
      processedIcons.add(icon);
      const parts = (icon.getAttribute('data-image-category') || categories[index % categories.length]).split('/');
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

  function start() {
    enhanceStatIcons(document);\n    enhanceGalleries(document);
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
