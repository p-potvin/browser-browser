/**
 * File Grid Cards View Component
 * Optimized for low RAM consumption, media pipeline cleanup, and high-performance scrolling.
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, copyToClipboard, showToast } from '../../common/utils.js';

export class FileGridView {
  static _observer = null;

  /**
   * Release media decoders and disconnect observers to prevent memory accumulation
   * @param {HTMLElement} container 
   */
  static cleanup(container) {
    if (FileGridView._observer) {
      FileGridView._observer.disconnect();
      FileGridView._observer = null;
    }

    if (!container) return;

    // Explicitly tear down any active video or audio decoders
    container.querySelectorAll('video, audio').forEach(media => {
      try {
        media.pause();
        media.removeAttribute('src');
        media.load();
      } catch (e) {}
    });

    // Clear img src attributes to assist browser GC on detached nodes
    container.querySelectorAll('img.vwsq-thumb-img').forEach(img => {
      try {
        img.removeAttribute('src');
      } catch (e) {}
    });
  }

  /**
   * Render grid cards into container
   * @param {HTMLElement} container 
   * @param {Array<Object>} items 
   * @param {Object} options
   */
  static render(container, items, options = {}) {
    FileGridView.cleanup(container);
    container.innerHTML = '';

    const {
      onOpenItem,
      onQuickLook,
      selectedIndex = -1,
      onContextMenu,
      enablePreviewThumbnails = true
    } = options;

    const grid = document.createElement('div');
    grid.className = 'vwsq-grid';

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--vwsq-console-text-dim);">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px; opacity: 0.5;">${ICONS.search}</div>
          <div style="font-size: 15px; font-weight: 500; color: var(--vwsq-console-text-bright);">No items found</div>
          <div style="font-size: 12px; margin-top: 4px;">Try refining your search filter</div>
        </div>
      `;
      container.appendChild(grid);
      return;
    }

    // Set up IntersectionObserver for memory-bounded viewport lazy-loading
    const shouldUnloadOffscreen = items.length > 60;
    if (typeof IntersectionObserver !== 'undefined') {
      FileGridView._observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const img = entry.target;
          if (entry.isIntersecting) {
            const dataSrc = img.dataset.src;
            if (dataSrc && img.src !== dataSrc) {
              img.src = dataSrc;
            }
          } else if (shouldUnloadOffscreen) {
            // Unload offscreen images to free decoded image bitmap RAM in Firefox
            if (img.src) {
              img.removeAttribute('src');
            }
          }
        });
      }, {
        root: null,
        rootMargin: '300px 0px',
        threshold: 0.01
      });
    }

    const createCard = (item, index) => {
      const card = document.createElement('div');
      card.className = `vwsq-grid-card ${index === selectedIndex ? 'selected' : ''}`;
      card.dataset.index = index;
      card.style.animationDelay = `${Math.min(index * 15, 150)}ms`;

      // Resolve preview thumbnail or icon
      let previewContent = '';
      const thumbJpg = item.thumbJpgUrl || item.thumbUrl;
      const thumbWebm = item.thumbWebmUrl || item.videoPreviewUrl;
      const hasThumb = Boolean(thumbJpg);
      const isNativeImage = !hasThumb && item.category === 'image';
      const showThumbnail = enablePreviewThumbnails && (hasThumb || isNativeImage);
      const mediaSrc = item.streamUrl || item.url;
      const thumbImgSrc = hasThumb ? thumbJpg : (isNativeImage ? mediaSrc : '');

      if (showThumbnail && thumbImgSrc) {
        // Use data-src with IntersectionObserver for lazy decode & memory unloading
        previewContent = `
          <img class="vwsq-thumb-img" data-src="${escapeHtml(thumbImgSrc)}" alt="${escapeHtml(item.name)}" />
          <div class="vwsq-type-badge" title="${escapeHtml(item.extension || item.category)}">
            ${getFileIcon(item.name, item.isDirectory, item.isParent)}
          </div>
        `;
      } else {
        previewContent = getFileIcon(item.name, item.isDirectory, item.isParent);
      }

      card.innerHTML = `
        <div class="vwsq-card-actions">
          ${!item.isDirectory ? `
            <button class="vwsq-card-action-btn vwsq-card-quicklook-btn" title="Quick Look (Spacebar)">
              <div style="width: 12px; height: 12px;">${ICONS.eye}</div>
            </button>
          ` : ''}
          <button class="vwsq-card-action-btn vwsq-card-copy-btn" title="Copy Path">
            <div style="width: 12px; height: 12px;">${ICONS.copy}</div>
          </button>
        </div>

        <div class="vwsq-card-preview ${showThumbnail ? 'has-thumbnail' : ''}">
          ${previewContent}
        </div>

        <div style="width: 100%;">
          <div class="vwsq-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="vwsq-card-meta">${escapeHtml(item.sizeFormatted)}</div>
        </div>
      `;

      // Attach image observer for lazy decoding
      const imgEl = card.querySelector('img.vwsq-thumb-img');
      if (imgEl) {
        if (FileGridView._observer) {
          FileGridView._observer.observe(imgEl);
        } else {
          imgEl.src = imgEl.dataset.src;
        }
      }

      // Memory-safe dynamic video hover playback:
      // Only instantiate <video> element on mouseenter, tear down on mouseleave.
      // This prevents allocating hundreds of background video decoder pipelines.
      if (enablePreviewThumbnails && thumbWebm) {
        const previewBox = card.querySelector('.vwsq-card-preview');

        card.addEventListener('mouseenter', () => {
          if (!previewBox) return;
          const currentImg = previewBox.querySelector('img.vwsq-thumb-img');
          let video = previewBox.querySelector('video.vwsq-thumb-video');

          if (!video) {
            video = document.createElement('video');
            video.className = 'vwsq-thumb-video';
            video.src = thumbWebm;
            video.loop = true;
            video.playsInline = true;
            video.style.display = 'block';
            video.muted = false;
            video.volume = 1.0;
            previewBox.appendChild(video);
          }

          if (currentImg) currentImg.style.display = 'none';

          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        });

        card.addEventListener('mouseleave', () => {
          if (!previewBox) return;
          const video = previewBox.querySelector('video.vwsq-thumb-video');
          const currentImg = previewBox.querySelector('img.vwsq-thumb-img');

          if (video) {
            try {
              video.pause();
              video.removeAttribute('src');
              video.load();
            } catch (e) {}
            video.remove();
          }

          if (currentImg) {
            currentImg.style.display = 'block';
          }
        });
      }

      // Click to open or navigate
      card.addEventListener('click', (e) => {
        if (e.target.closest('.vwsq-card-quicklook-btn')) {
          e.stopPropagation();
          if (onQuickLook) onQuickLook(item, items);
          return;
        }
        if (e.target.closest('.vwsq-card-copy-btn')) {
          e.stopPropagation();
          copyToClipboard(item.targetPath || item.url).then(ok => {
            if (ok) showToast('Copied path to clipboard', 'success');
          });
          return;
        }

        if (onOpenItem) onOpenItem(item);
      });

      // Right-click context menu
      card.addEventListener('contextmenu', (e) => {
        if (onContextMenu) onContextMenu(e, item);
      });

      return card;
    };

    // Progressive rendering for large directories (> 60 items)
    // Prevents UI freeze by rendering the visible batch first and chunking remainder
    const BATCH_SIZE = 60;
    const initialBatch = items.slice(0, BATCH_SIZE);
    const fragment = document.createDocumentFragment();

    initialBatch.forEach((item, index) => {
      fragment.appendChild(createCard(item, index));
    });
    grid.appendChild(fragment);
    container.appendChild(grid);

    if (items.length > BATCH_SIZE) {
      let currentIndex = BATCH_SIZE;
      const renderNextBatch = () => {
        if (currentIndex >= items.length || !container.contains(grid)) return;
        const nextBatch = items.slice(currentIndex, currentIndex + BATCH_SIZE);
        const nextFragment = document.createDocumentFragment();
        nextBatch.forEach((item, offset) => {
          nextFragment.appendChild(createCard(item, currentIndex + offset));
        });
        grid.appendChild(nextFragment);
        currentIndex += BATCH_SIZE;

        if (currentIndex < items.length) {
          requestAnimationFrame(renderNextBatch);
        }
      };

      requestAnimationFrame(renderNextBatch);
    }
  }
}
