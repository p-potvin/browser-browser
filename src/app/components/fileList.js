/**
 * File Compact List View Component
 * Optimized for progressive chunking and media cleanup.
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, copyToClipboard, showToast } from '../../common/utils.js';

export class FileListView {
  /**
   * Clean up any active media or observers in container
   * @param {HTMLElement} container 
   */
  static cleanup(container) {
    if (!container) return;
    container.querySelectorAll('video, audio').forEach(media => {
      try {
        media.pause();
        media.removeAttribute('src');
        media.load();
      } catch (e) {}
    });
  }

  /**
   * Render compact list into container
   * @param {HTMLElement} container 
   * @param {Array<Object>} items 
   * @param {Object} options
   */
  static render(container, items, options = {}) {
    FileListView.cleanup(container);
    container.innerHTML = '';

    const { onOpenItem, onQuickLook, selectedIndex = -1, onContextMenu } = options;

    const list = document.createElement('div');
    list.className = 'vwsq-list';

    if (items.length === 0) {
      list.innerHTML = `
        <div style="padding: 36px; text-align: center; color: var(--vwsq-console-text-dim);">
          No items found
        </div>
      `;
      container.appendChild(list);
      return;
    }

    const createRow = (item, index) => {
      const row = document.createElement('div');
      row.className = `vwsq-list-item ${index === selectedIndex ? 'selected' : ''}`;
      row.dataset.index = index;

      row.innerHTML = `
        <div class="vwsq-list-left">
          <div style="width: 18px; height: 18px; display: flex; align-items: center;">${getFileIcon(item.name, item.isDirectory, item.isParent)}</div>
          <span>${escapeHtml(item.name)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-family: var(--vwsq-font-mono); font-size: 11.5px; color: var(--vwsq-console-text-dim);">${escapeHtml(item.sizeFormatted)}</span>
          ${!item.isDirectory ? `
            <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-list-quicklook-btn" title="Quick Look">
              <div style="width: 12px; height: 12px;">${ICONS.eye}</div>
            </button>
          ` : ''}
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.vwsq-list-quicklook-btn')) {
          e.stopPropagation();
          if (onQuickLook) onQuickLook(item, items);
          return;
        }

        if (onOpenItem) onOpenItem(item);
      });

      row.addEventListener('contextmenu', (e) => {
        if (onContextMenu) onContextMenu(e, item);
      });

      return row;
    };

    const BATCH_SIZE = 100;
    const initialBatch = items.slice(0, BATCH_SIZE);
    const fragment = document.createDocumentFragment();

    initialBatch.forEach((item, index) => {
      fragment.appendChild(createRow(item, index));
    });
    list.appendChild(fragment);
    container.appendChild(list);

    if (items.length > BATCH_SIZE) {
      let currentIndex = BATCH_SIZE;
      const renderNextBatch = () => {
        if (currentIndex >= items.length || !container.contains(list)) return;
        const nextBatch = items.slice(currentIndex, currentIndex + BATCH_SIZE);
        const nextFragment = document.createDocumentFragment();
        nextBatch.forEach((item, offset) => {
          nextFragment.appendChild(createRow(item, currentIndex + offset));
        });
        list.appendChild(nextFragment);
        currentIndex += BATCH_SIZE;

        if (currentIndex < items.length) {
          requestAnimationFrame(renderNextBatch);
        }
      };

      requestAnimationFrame(renderNextBatch);
    }
  }
}
