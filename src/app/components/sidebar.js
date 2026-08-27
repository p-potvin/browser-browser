/**
 * Warm Rail Sidebar Component
 */

import { ICONS } from '../../common/icons.js';
import { escapeHtml, showToast } from '../../common/utils.js';
import { getBookmarks, removeBookmark, addBookmark } from '../../common/storage.js';

export class SidebarComponent {
  /**
   * Render sidebar into container
   * @param {HTMLElement} container 
   * @param {Object} options
   */
  static async render(container, options = {}) {
    const { onNavigate, onFilterCategory, activeCategory = 'all', currentUrl = '' } = options;
    const bookmarks = await getBookmarks();

    container.innerHTML = `
      <div class="vwsq-sidebar-section">
        <div class="vwsq-sidebar-heading">Local Drives</div>
        <div class="vwsq-sidebar-drive-grid">
          <button class="vwsq-drive-btn" data-url="file:///C:/">
            <div style="width: 14px; height: 14px;">${ICONS.drive}</div>
            <span>Drive (C:)</span>
          </button>
          <button class="vwsq-drive-btn" data-url="file:///D:/">
            <div style="width: 14px; height: 14px;">${ICONS.drive}</div>
            <span>Drive (D:)</span>
          </button>
          <button class="vwsq-drive-btn" data-url="file:///E:/">
            <div style="width: 14px; height: 14px;">${ICONS.drive}</div>
            <span>Drive (E:)</span>
          </button>
          <button class="vwsq-drive-btn" data-url="file:///Z:/">
            <div style="width: 14px; height: 14px;">${ICONS.drive}</div>
            <span>Drive (Z:)</span>
          </button>
        </div>
      </div>

      <div class="vwsq-sidebar-section">
        <div style="display: flex; align-items: center; justify-content: space-between; padding-right: 6px;">
          <div class="vwsq-sidebar-heading" style="margin: 0;">Bookmarks</div>
          <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-pin-current-btn" title="Pin Current Folder" style="padding: 2px 6px;">
            <div style="width: 12px; height: 12px;">${ICONS.pin}</div>
          </button>
        </div>
        <div class="vwsq-bookmarks-list" style="display: flex; flex-direction: column; gap: 2px;">
          ${bookmarks.map(bm => `
            <div class="vwsq-sidebar-item ${currentUrl.startsWith(bm.url) ? 'active' : ''}" data-url="${escapeHtml(bm.url)}" title="${escapeHtml(bm.url)}">
              <div style="width: 16px; height: 16px;">${ICONS.folder}</div>
              <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(bm.name)}</span>
              <button class="vwsq-btn vwsq-btn--ghost vwsq-remove-bookmark-btn" data-url="${escapeHtml(bm.url)}" style="padding: 2px; opacity: 0.4;" title="Unpin">
                <div style="width: 10px; height: 10px;">${ICONS.close}</div>
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="vwsq-sidebar-section">
        <div class="vwsq-sidebar-heading">Filter View</div>
        <div class="vwsq-sidebar-item ${activeCategory === 'all' ? 'active' : ''}" data-category="all">
          <div style="width: 16px; height: 16px;">${ICONS.grid}</div>
          <span>All Items</span>
        </div>
        <div class="vwsq-sidebar-item ${activeCategory === 'directory' ? 'active' : ''}" data-category="directory">
          <div style="width: 16px; height: 16px;">${ICONS.folder}</div>
          <span>Folders Only</span>
        </div>
        <div class="vwsq-sidebar-item ${activeCategory === 'image' ? 'active' : ''}" data-category="image">
          <div style="width: 16px; height: 16px;">${ICONS.image}</div>
          <span>Images</span>
        </div>
        <div class="vwsq-sidebar-item ${activeCategory === 'video' ? 'active' : ''}" data-category="video">
          <div style="width: 16px; height: 16px;">${ICONS.video}</div>
          <span>Videos</span>
        </div>
        <div class="vwsq-sidebar-item ${activeCategory === 'audio' ? 'active' : ''}" data-category="audio">
          <div style="width: 16px; height: 16px;">${ICONS.audio}</div>
          <span>Audio</span>
        </div>
        <div class="vwsq-sidebar-item ${activeCategory === 'code' ? 'active' : ''}" data-category="code">
          <div style="width: 16px; height: 16px;">${ICONS.code}</div>
          <span>Source Code</span>
        </div>
        <div class="vwsq-sidebar-item ${activeCategory === 'archive' ? 'active' : ''}" data-category="archive">
          <div style="width: 16px; height: 16px;">${ICONS.archive}</div>
          <span>Archives</span>
        </div>
      </div>

      <div class="vwsq-sidebar-section" style="margin-top: auto; padding-top: 12px; border-top: 1px solid var(--vwsq-warm-border, rgba(15,17,22,0.1));">
        <div id="vwsq-sidebar-zipper-box" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--vwsq-warm-raised, #f8f7f4); border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 16px; height: 16px; color: var(--vwsq-coral-500, #ff8a6b);">${ICONS.zipper}</div>
            <span style="font-size: 12px; font-weight: 600;">Python-Zipper</span>
          </div>
          <span id="vwsq-sidebar-zipper-led" class="vwsq-led vwsq-led--online vwsq-led--live"></span>
        </div>
      </div>
    `;

    // Attach drive buttons
    container.querySelectorAll('.vwsq-drive-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (onNavigate) onNavigate(btn.dataset.url);
      });
    });

    // Attach bookmark click
    container.querySelectorAll('.vwsq-bookmarks-list .vwsq-sidebar-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.vwsq-remove-bookmark-btn')) return;
        if (onNavigate) onNavigate(item.dataset.url);
      });
    });

    // Attach remove bookmark button
    container.querySelectorAll('.vwsq-remove-bookmark-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeBookmark(btn.dataset.url);
        showToast('Bookmark removed', 'info');
        SidebarComponent.render(container, options);
      });
    });

    // Attach pin current button
    const pinCurrentBtn = container.querySelector('.vwsq-pin-current-btn');
    if (pinCurrentBtn) {
      pinCurrentBtn.addEventListener('click', async () => {
        if (currentUrl) {
          const parts = currentUrl.replace(/file:\/\/\/?/, '').split('/').filter(Boolean);
          const name = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : 'Folder';
          await addBookmark(name, currentUrl);
          showToast(`Pinned "${name}" to bookmarks`, 'success');
          SidebarComponent.render(container, options);
        }
      });
    }

    // Attach category filters
    container.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onFilterCategory) onFilterCategory(btn.dataset.category);
      });
    });
  }
}
