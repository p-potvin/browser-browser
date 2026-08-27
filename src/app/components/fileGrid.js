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
    const { onOpenItem, onQuickLook, selectedIndex = -1 } = options;
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

      // Live image thumbnail or SVG icon
      let previewContent = '';
      if (item.category === 'image') {
        previewContent = `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
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

        <div class="vwsq-card-preview">
          ${previewContent}
        </div>

        <div style="width: 100%;">
          <div class="vwsq-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="vwsq-card-meta">${escapeHtml(item.sizeFormatted)}</div>
        </div>
      `;

      // Click to open or navigate
      card.addEventListener('click', (e) => {
        if (e.target.closest('.vwsq-card-quicklook-btn')) {
          e.stopPropagation();
          if (onQuickLook) onQuickLook(item, items);
          return;
        }
        if (e.target.closest('.vwsq-card-copy-btn')) {
          e.stopPropagation();
          copyToClipboard(item.url).then(ok => {
            if (ok) showToast('Copied path to clipboard', 'success');
          });
          return;
        }

        if (onOpenItem) onOpenItem(item);
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }
}
