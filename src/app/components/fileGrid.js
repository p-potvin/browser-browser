/**
 * File Grid Cards View Component
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, copyToClipboard, showToast } from '../../common/utils.js';

export class FileGridView {
  /**
   * Render grid cards into container
   * @param {HTMLElement} container 
   * @param {Array<Object>} items 
   * @param {Object} options
   */
  static render(container, items, options = {}) {
    const { onOpenItem, onQuickLook, selectedIndex = -1, onContextMenu } = options;
    container.innerHTML = '';

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

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `vwsq-grid-card ${index === selectedIndex ? 'selected' : ''}`;
      card.dataset.index = index;
      card.style.animationDelay = `${Math.min(index * 20, 200)}ms`;

      // Resolve preview thumbnail or icon
      let previewContent = '';
      const thumbJpg = item.thumbJpgUrl || item.thumbUrl;
      const thumbWebm = item.thumbWebmUrl || item.videoPreviewUrl;
      const hasThumb = Boolean(thumbJpg);
      const isNativeImage = !hasThumb && item.category === 'image';
      const showThumbnail = hasThumb || isNativeImage;
      const mediaSrc = item.streamUrl || item.url;

      if (hasThumb) {
        previewContent = `
          <img class="vwsq-thumb-img" src="${escapeHtml(thumbJpg)}" alt="${escapeHtml(item.name)}" loading="lazy" />
          ${thumbWebm ? `<video class="vwsq-thumb-video" src="${escapeHtml(thumbWebm)}" loop playsinline preload="none"></video>` : ''}
          <div class="vwsq-type-badge" title="${escapeHtml(item.extension || item.category)}">
            ${getFileIcon(item.name, item.isDirectory, item.isParent)}
          </div>
        `;
      } else if (isNativeImage) {
        previewContent = `
          <img class="vwsq-thumb-img" src="${escapeHtml(mediaSrc)}" alt="${escapeHtml(item.name)}" loading="lazy" />
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

      // WebM video hover playback with audio
      if (thumbWebm) {
        const video = card.querySelector('video.vwsq-thumb-video');
        const img = card.querySelector('img.vwsq-thumb-img');
        if (video && img) {
          card.addEventListener('mouseenter', () => {
            video.style.display = 'block';
            img.style.display = 'none';
            video.muted = false;
            video.volume = 1.0;
            video.play().catch(() => {
              // If browser autoplay policy blocks unmuted audio on first hover
              video.muted = true;
              video.play().catch(() => {});
            });
          });

          card.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
            video.style.display = 'none';
            img.style.display = 'block';
          });
        }
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

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }
}
