/**
 * Go SVT Maroc - Video Learning System
 */
(() => {
  'use strict';

  class VideoSystem {
    constructor() {
      this.videos = {};
      this.currentVideo = null;
      this.watchedVideos = this.readWatchedVideos();
      this.loadVideos();
    }

    readWatchedVideos() {
      try {
        const value = JSON.parse(localStorage.getItem('gsvt_watched_videos') || '[]');
        return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
      } catch (error) {
        console.warn('Invalid watched-video history; starting with an empty history.', error);
        return [];
      }
    }

    async loadVideos() {
      try {
        const response = await fetch('videos.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Invalid video catalogue structure');
        }
        this.videos = data;
        this.renderVideoLibrary();
        this.setupVideoFilters();
        this.attachVideoHandlers();
      } catch (error) {
        console.error('Error loading videos:', error);
        const container = document.getElementById('video-library');
        if (container) {
          container.innerHTML = '<section class="video-library-empty" role="alert"><h2>تعذر تحميل مكتبة الفيديوهات</h2><p>تحقق من الاتصال ثم أعد تحميل الصفحة.</p></section>';
        }
      }
    }

    getVideosByLevel(level, subject) {
      if (!this.videos[level]) return [];
      if (!subject) return Object.values(this.videos[level]).flat();
      return this.videos[level][subject] || [];
    }

    getAllVideos() {
      return Object.values(this.videos).flatMap(level => 
        Object.values(level).flat()
      );
    }

    escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[char]));
    }

    safeVideoUrl(value, allowThumbnail = false) {
      try {
        const url = new URL(String(value || ''), window.location.href);
        if (url.protocol !== 'https:') return '';
        const hosts = allowThumbnail
          ? ['img.youtube.com', 'i.ytimg.com', 'upload.wikimedia.org']
          : ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'];
        if (!hosts.includes(url.hostname)) return '';
        if (!allowThumbnail && !/^\/embed\/[A-Za-z0-9_-]{6,20}$/.test(url.pathname)) return '';
        return url.href;
      } catch (_) {
        return '';
      }
    }

    isVideoWatched(videoId) {
      return this.watchedVideos.includes(videoId);
    }

    markAsWatched(videoId) {
      if (!this.watchedVideos.includes(videoId)) {
        this.watchedVideos.push(videoId);
        try {
          localStorage.setItem('gsvt_watched_videos', JSON.stringify(this.watchedVideos));
        } catch (error) {
          console.warn('Could not save watched-video history.', error);
        }
        this.updateVideoCard(videoId);
      }
    }

    renderVideoLibrary() {
      const container = document.getElementById('video-library');
      if (!container) return;

      const allVideos = this.getAllVideos();
      if (!allVideos.length) {
        container.innerHTML = `
          <section class="video-library-empty" role="status" aria-live="polite">
            <h2>📹 مكتبة الفيديوهات التعليمية</h2>
            <p>لا تتوفر حالياً فيديوهات موثقة وجاهزة للنشر. ستظهر الموارد هنا بعد التحقق من روابطها ومحتواها.</p>
          </section>
        `;
        return;
      }
      container.innerHTML = `
        <div class="video-library-header">
          <h2>📹 مكتبة الفيديوهات التعليمية</h2>
          <p>شاهد ${allVideos.length} فيديو تعليمي في علوم الحياة والأرض</p>
        </div>
        
        <div class="video-filters">
          <select id="video-level-filter">
            <option value="">جميع المستويات</option>
            <option value="tc">جذع مشترك</option>
            <option value="1bac">أولى باكالوريا</option>
            <option value="2bac">ثانية باكالوريا</option>
          </select>
          
          <select id="video-subject-filter">
            <option value="">جميع المواضيع</option>
          </select>
        </div>

        <div class="video-grid">
          ${allVideos.map(video => this.renderVideoCard(video)).join('')}
        </div>
      `;
    }

    renderVideoCard(video) {
      const id = String(video?.id || '');
      const title = this.escapeHtml(video?.title?.ar || video?.title?.fr || 'فيديو تعليمي');
      const description = this.escapeHtml(video?.description?.ar || video?.description?.fr || '');
      const thumbnail = this.safeVideoUrl(video?.thumbnail, true);
      const url = this.safeVideoUrl(video?.url);
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !url) return '';
      const watched = this.isVideoWatched(id);
      return `
        <article class="video-card ${watched ? 'watched' : ''}" data-video-id="${this.escapeHtml(id)}">
          <div class="video-thumbnail">
            ${thumbnail ? `<img src="${thumbnail}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">` : '<div class="video-thumbnail-placeholder" aria-hidden="true">▶</div>'}
            <div class="video-duration">${this.escapeHtml(video?.duration || '')}</div>
            ${watched ? '<div class="watched-badge">✓ تمت المشاهدة</div>' : ''}
          </div>
          <div class="video-info">
            <h3>${title}</h3>
            <p>${description}</p>
            <button class="watch-video-btn" data-video-url="${url}" data-video-id="${this.escapeHtml(id)}" type="button">▶ مشاهدة الفيديو</button>
          </div>
        </article>
      `;
    }

    updateVideoCard(videoId) {
      const card = document.querySelector(`[data-video-id="${videoId}"]`);
      if (card && !card.classList.contains('watched')) {
        card.classList.add('watched');
        const badge = document.createElement('div');
        badge.className = 'watched-badge';
        badge.textContent = '✓ تمت المشاهدة';
        card.querySelector('.video-thumbnail').appendChild(badge);
      }
    }

    setupVideoFilters() {
      const levelFilter = document.getElementById('video-level-filter');
      const subjectFilter = document.getElementById('video-subject-filter');

      levelFilter?.addEventListener('change', (e) => {
        this.filterVideos(e.target.value, subjectFilter?.value);
      });

      subjectFilter?.addEventListener('change', (e) => {
        this.filterVideos(levelFilter?.value, e.target.value);
      });
    }

    filterVideos(level, subject) {
      const container = document.querySelector('.video-grid');
      if (!container) return;

      const source = level ? this.getVideosByLevel(level) : this.getAllVideos();
      const filtered = subject
        ? source.filter(video => video?.subject === subject || video?.category === subject)
        : source;
      container.innerHTML = filtered.map(video => this.renderVideoCard(video)).filter(Boolean).join('');
      this.attachVideoHandlers();
    }

    attachVideoHandlers() {
      document.querySelectorAll('.watch-video-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const button = e.currentTarget;
          const url = this.safeVideoUrl(button.dataset.videoUrl);
          const id = button.dataset.videoId;
          if (!url || !/^[A-Za-z0-9_-]{1,80}$/.test(id || '')) return;
          this.openVideoPlayer(url, id);
        });
      });
    }

    openVideoPlayer(url, videoId) {
      url = this.safeVideoUrl(url);
      if (!url) return;
      const player = document.createElement('div');
      player.className = 'video-player-modal';
      player.innerHTML = `
        <div class="video-player-container">
          <button class="close-player" aria-label="إغلاق">×</button>
          <iframe 
            src="${url}?autoplay=1" 
            title="مشغل فيديو تعليمي"
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            frameborder="0" 
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
      `;

      document.body.appendChild(player);

      player.querySelector('.close-player').addEventListener('click', () => {
        player.remove();
        this.markAsWatched(videoId);
      });

      player.addEventListener('click', (e) => {
        if (e.target === player) {
          player.remove();
          this.markAsWatched(videoId);
        }
      });
    }
  }

  // Initialize video system
  const videoSystem = new VideoSystem();
  window.GoSVTVideo = videoSystem;

})();
