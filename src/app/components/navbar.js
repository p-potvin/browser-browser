/**
 * Top Navigation Bar Component
 */

import { ICONS } from '../../common/icons.js';
import { escapeHtml, parsePathBreadcrumbs, copyToClipboard, showToast } from '../../common/utils.js';
import { isBookmarked, addBookmark, removeBookmark } from '../../common/storage.js';

export class NavbarComponent {
  /**
   * Render top navbar
   * @param {HTMLElement} container 
   * @param {Object} options
   */
  static async render(container, options = {}) {
    const { currentUrl, onNavigate, onSearch, currentView = 'grid', onViewChange, onRefresh } = options;
    const breadcrumbs = parsePathBreadcrumbs(currentUrl);
    const bookmarked = await isBookmarked(currentUrl);

    // Resolving logo URL
    let logoUrl = 'assets/logo.svg';
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
      logoUrl = browser.runtime.getURL('assets/logo.svg');
    }

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; min-width: 0;">
        <div class="vwsq-brand" title="browser-browser — Local Files Inside Firefox">
          <div class="vwsq-brand-logo">
            <img src="${logoUrl}" alt="logo" />
          </div>
          <div class="vwsq-brand-title">browser²</div>
        </div>

        <div class="vwsq-breadcrumbs-container">
          ${breadcrumbs.map((bc, idx) => `
            <span class="vwsq-breadcrumb-item ${bc.isLast ? 'active' : ''}" data-url="${escapeHtml(bc.url)}">
              ${escapeHtml(bc.name)}
            </span>
            ${!bc.isLast ? `<span class="vwsq-breadcrumb-separator">/</span>` : ''}
          `).join('')}
        </div>

        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-copy-path-btn" title="Copy Current Path">
          <div style="width: 14px; height: 14px;">${ICONS.copy}</div>
        </button>

        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-toggle-bookmark-btn" title="${bookmarked ? 'Remove Bookmark' : 'Bookmark Folder'}">
          <div style="width: 14px; height: 14px;">${bookmarked ? ICONS.pinFilled : ICONS.pin}</div>
        </button>
      </div>

      <div class="vwsq-topbar-actions">
        <!-- Search bar -->
        <div class="vwsq-input-wrapper" style="width: 220px;">
          <div class="vwsq-input-icon">${ICONS.search}</div>
          <input type="text" class="vwsq-input vwsq-input--with-icon vwsq-search-input" placeholder="Search files... (/)" />
        </div>

        <!-- View Segmented Switcher -->
        <div class="vwsq-segmented-control">
          <button class="vwsq-segmented-item ${currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View (v)">
            <div style="width: 15px; height: 15px;">${ICONS.grid}</div>
          </button>
          <button class="vwsq-segmented-item ${currentView === 'table' ? 'active' : ''}" data-view="table" title="Table View (v)">
            <div style="width: 15px; height: 15px;">${ICONS.table}</div>
          </button>
          <button class="vwsq-segmented-item ${currentView === 'list' ? 'active' : ''}" data-view="list" title="List View (v)">
            <div style="width: 15px; height: 15px;">${ICONS.list}</div>
          </button>
        </div>

        <!-- Zipper Status LED -->
        <div id="vwsq-navbar-zipper-status" class="vwsq-badge vwsq-badge--online" style="cursor: pointer;" title="Python-Zipper Status (127.0.0.1:5171)">
          <span class="vwsq-led vwsq-led--online vwsq-led--live"></span>
          <span style="font-size: 11px; font-weight: 600;">ZIPPER</span>
        </div>

        <!-- Refresh Button -->
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-refresh-btn" title="Refresh Directory (r)">
          <div style="width: 14px; height: 14px;">${ICONS.refresh}</div>
        </button>
      </div>
    `;

    // Breadcrumb clicks
    container.querySelectorAll('.vwsq-breadcrumb-item').forEach(el => {
      el.addEventListener('click', () => {
        if (onNavigate) onNavigate(el.dataset.url);
      });
    });

    // Copy path
    container.querySelector('.vwsq-copy-path-btn').addEventListener('click', async () => {
      const ok = await copyToClipboard(currentUrl);
      if (ok) showToast('Directory URL copied to clipboard', 'success');
    });

    // Toggle bookmark
    container.querySelector('.vwsq-toggle-bookmark-btn').addEventListener('click', async () => {
      const isBm = await isBookmarked(currentUrl);
      if (isBm) {
        await removeBookmark(currentUrl);
        showToast('Removed from bookmarks', 'info');
      } else {
        const parts = currentUrl.replace(/file:\/\/\/?/, '').split('/').filter(Boolean);
        const name = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : 'Folder';
        await addBookmark(name, currentUrl);
        showToast(`Pinned "${name}" to bookmarks`, 'success');
      }
      NavbarComponent.render(container, options);
    });

    // Search input
    const searchInput = container.querySelector('.vwsq-search-input');
    searchInput.addEventListener('input', (e) => {
      if (onSearch) onSearch(e.target.value);
    });

    // View changer
    container.querySelectorAll('.vwsq-segmented-item').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.vwsq-segmented-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onViewChange) onViewChange(btn.dataset.view);
      });
    });

    // Refresh
    container.querySelector('.vwsq-refresh-btn').addEventListener('click', () => {
      if (onRefresh) onRefresh();
    });
  }
}
