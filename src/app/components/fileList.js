/**
 * File Compact List View Component
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, copyToClipboard, showToast } from '../../common/utils.js';

export class FileListView {
  /**
   * Render compact list into container
   * @param {HTMLElement} container 
   * @param {Array<Object>} items 
   * @param {Object} options
   */
  static render(container, items, options = {}) {
    const { onOpenItem, onQuickLook, selectedIndex = -1 } = options;
    container.innerHTML = '';

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

    items.forEach((item, index) => {
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

      list.appendChild(row);
    });

    container.appendChild(list);
  }
}
