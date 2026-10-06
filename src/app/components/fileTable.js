/**
 * File Table View Component with Column Sorting
 * Optimized for progressive chunking and media cleanup.
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, copyToClipboard, showToast } from '../../common/utils.js';

export class FileTableView {
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
   * Render table into container
   * @param {HTMLElement} container 
   * @param {Array<Object>} items 
   * @param {Object} options
   */
  static render(container, items, options = {}) {
    FileTableView.cleanup(container);
    container.innerHTML = '';

    const { onOpenItem, onQuickLook, onSort, sortField = 'name', sortAsc = true, selectedIndex = -1, onContextMenu } = options;

    const table = document.createElement('table');
    table.className = 'vwsq-table';

    const sortIndicator = (field) => {
      if (sortField !== field) return '';
      return sortAsc ? ' ↑' : ' ↓';
    };

    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort="name" style="width: 50%;">Name${sortIndicator('name')}</th>
          <th data-sort="size" style="width: 15%;">Size${sortIndicator('size')}</th>
          <th data-sort="date" style="width: 25%;">Modified${sortIndicator('date')}</th>
          <th style="width: 10%; text-align: right;">Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const thead = table.querySelector('thead');
    thead.addEventListener('click', (e) => {
      const th = e.target.closest('th');
      if (th && th.dataset.sort && onSort) {
        onSort(th.dataset.sort);
      }
    });

    const tbody = table.querySelector('tbody');

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 36px; color: var(--vwsq-console-text-dim);">
            No items in this directory matching filter
          </td>
        </tr>
      `;
      container.appendChild(table);
      return;
    }

    const createRow = (item, index) => {
      const tr = document.createElement('tr');
      tr.className = `vwsq-table-row ${index === selectedIndex ? 'selected' : ''}`;
      tr.dataset.index = index;

      tr.innerHTML = `
        <td>
          <div class="vwsq-table-name-cell">
            <div style="width: 20px; height: 20px; display: flex; align-items: center;">${getFileIcon(item.name, item.isDirectory, item.isParent)}</div>
            <span>${escapeHtml(item.name)}</span>
          </div>
        </td>
        <td style="font-family: var(--vwsq-font-mono); font-size: 12px;">${escapeHtml(item.sizeFormatted)}</td>
        <td style="font-family: var(--vwsq-font-mono); font-size: 12px; color: var(--vwsq-console-text-dim);">${escapeHtml(item.dateModified)}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            ${!item.isDirectory ? `
              <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-table-quicklook-btn" title="Quick Look">
                <div style="width: 14px; height: 14px;">${ICONS.eye}</div>
              </button>
            ` : ''}
            <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-table-copy-btn" title="Copy Path">
              <div style="width: 14px; height: 14px;">${ICONS.copy}</div>
            </button>
          </div>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.closest('.vwsq-table-quicklook-btn')) {
          e.stopPropagation();
          if (onQuickLook) onQuickLook(item, items);
          return;
        }
        if (e.target.closest('.vwsq-table-copy-btn')) {
          e.stopPropagation();
          copyToClipboard(item.url).then(ok => {
            if (ok) showToast('Copied path to clipboard', 'success');
          });
          return;
        }

        if (onOpenItem) onOpenItem(item);
      });

      tr.addEventListener('contextmenu', (e) => {
        if (onContextMenu) onContextMenu(e, item);
      });

      return tr;
    };

    const BATCH_SIZE = 100;
    const initialBatch = items.slice(0, BATCH_SIZE);
    const fragment = document.createDocumentFragment();

    initialBatch.forEach((item, index) => {
      fragment.appendChild(createRow(item, index));
    });
    tbody.appendChild(fragment);
    container.appendChild(table);

    if (items.length > BATCH_SIZE) {
      let currentIndex = BATCH_SIZE;
      const renderNextBatch = () => {
        if (currentIndex >= items.length || !container.contains(table)) return;
        const nextBatch = items.slice(currentIndex, currentIndex + BATCH_SIZE);
        const nextFragment = document.createDocumentFragment();
        nextBatch.forEach((item, offset) => {
          nextFragment.appendChild(createRow(item, currentIndex + offset));
        });
        tbody.appendChild(nextFragment);
        currentIndex += BATCH_SIZE;

        if (currentIndex < items.length) {
          requestAnimationFrame(renderNextBatch);
        }
      };

      requestAnimationFrame(renderNextBatch);
    }
  }
}
