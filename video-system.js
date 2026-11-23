/**
 * Go SVT Maroc - Video Learning System
 */
(() => {
  'use strict';

  class VideoSystem {
    constructor() {
      this.videos = {};
      this.currentVideo = null;
      this.watchedVideos = JSON.parse(localStorage.getItem('gsvt_watched_videos') || '[]');
      this.loadVideos();
    }

    async loadVideos() {
      try {
        const response = await fetch('videos.json');
        this.videos = await response.json();
        this.renderVideoLibrary();
        this.attachVideoHandlers();
      } catch (error) {
        console.error('Error loading videos:', error);
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

    isVideoWatched(videoId) {
      return this.watchedVideos.includes(videoId);
    }

    markAsWatched(videoId) {
      if (!this.watchedVideos.includes(videoId)) {
        this.watchedVideos.push(videoId);
        localStorage.setItem('gsvt_watched_videos', JSON.stringify(this.watchedVideos));
        this.updateVideoCard(videoId);
      }
    }

    renderVideoLibrary() {
      const container = document.getElementById('video-library');
      if (!container) return;

      const allVideos = this.getAllVideos();
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
      const watched = this.isVideoWatched(video.id);
      return `
        <div class="video-card ${watched ? 'watched' : ''}" data-video-id="${video.id}">
          <div class="video-thumbnail">
            <img src="${video.thumbnail}" alt="${video.title.ar}" loading="lazy">
            <div class="video-duration">${video.duration}</div>
            ${watched ? '<div class="watched-badge">✓ تمت المشاهدة</div>' : ''}
          </div>
          
          <div class="video-info">
            <h3>${video.title.ar}</h3>
            <p>${video.description.ar}</p>
            <button class="watch-video-btn" data-video-url="${video.url}" data-video-id="${video.id}">
              ▶ مشاهدة الفيديو
            </button>
          </div>
        </div>
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

      const filtered = level 
        ? this.getVideosByLevel(level, subject || undefined)
        : this.getAllVideos();

      container.innerHTML = filtered.map(video => this.renderVideoCard(video)).join('');
      this.attachVideoHandlers();
    }

    attachVideoHandlers() {
      document.querySelectorAll('.watch-video-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const url = e.target.dataset.videoUrl;
          const id = e.target.dataset.videoId;
          this.openVideoPlayer(url, id);
        });
      });
    }

    openVideoPlayer(url, videoId) {
      const player = document.createElement('div');
      player.className = 'video-player-modal';
      player.innerHTML = `
        <div class="video-player-container">
          <button class="close-player" aria-label="إغلاق">×</button>
          <iframe 
            src="${url}?autoplay=1" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
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
