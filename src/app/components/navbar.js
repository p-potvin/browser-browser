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
    const {
      currentUrl,
      onNavigate,
      onSearch,
      currentView = 'grid',
      onViewChange,
      onRefresh,
      sortField = 'name',
      sortAsc = true,
      onSortChange,
      onOpenSettings
    } = options;
    const breadcrumbs = parsePathBreadcrumbs(currentUrl);
    const bookmarked = await isBookmarked(currentUrl);

    // Resolving logo URL
    let logoUrl = '../../assets/logo.svg';
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
          <div style="width: 14px; height: 14px;">${bookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}</div>
        </button>
      </div>

      <div class="vwsq-topbar-actions">
        <!-- Search bar -->
        <div class="vwsq-input-wrapper" style="width: 200px;">
          <div class="vwsq-input-icon">${ICONS.search}</div>
          <input type="text" class="vwsq-input vwsq-input--with-icon vwsq-search-input" placeholder="Search files... (/)" />
        </div>

        <!-- Sorting Options -->
        <div class="vwsq-sort-control" style="display: flex; align-items: center; gap: 2px; background: var(--vwsq-console-input-bg, rgba(255,255,255,0.04)); border: 1px solid var(--vwsq-console-border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 2px 4px;">
          <div style="width: 14px; height: 14px; opacity: 0.6; margin-left: 4px; display: flex; align-items: center;">${ICONS.sort}</div>
          <select class="vwsq-sort-select" style="background: transparent; border: none; color: var(--vwsq-console-text-bright); font-size: 12px; outline: none; cursor: pointer; padding: 4px 6px;">
            <option value="name" ${sortField === 'name' ? 'selected' : ''} style="background: var(--vwsq-console-surface, #1e1e2e);">Name</option>
            <option value="dateModified" ${sortField === 'dateModified' ? 'selected' : ''} style="background: var(--vwsq-console-surface, #1e1e2e);">Date Modified</option>
            <option value="size" ${sortField === 'size' ? 'selected' : ''} style="background: var(--vwsq-console-surface, #1e1e2e);">Size</option>
            <option value="category" ${sortField === 'category' ? 'selected' : ''} style="background: var(--vwsq-console-surface, #1e1e2e);">Type</option>
          </select>
          <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-sort-direction-btn" style="padding: 4px;" title="${sortAsc ? 'Ascending (click for Descending)' : 'Descending (click for Ascending)'}">
            <div style="width: 14px; height: 14px;">${sortAsc ? ICONS.sortAsc : ICONS.sortDesc}</div>
          </button>
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

        <!-- Refresh Button -->
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-refresh-btn" title="Refresh Directory (r)">
          <div style="width: 14px; height: 14px;">${ICONS.refresh}</div>
        </button>

        <!-- Settings Button -->
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-settings-btn" title="Settings & Glob Exclusions">
          <div style="width: 15px; height: 15px;">${ICONS.settings}</div>
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

    // Search input with 150ms debounce
    const searchInput = container.querySelector('.vwsq-search-input');
    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        if (onSearch) onSearch(e.target.value);
      }, 150);
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

    // Sorting field
    const sortSelect = container.querySelector('.vwsq-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        if (onSortChange) onSortChange(e.target.value, sortAsc);
      });
    }

    // Sorting direction
    const sortDirBtn = container.querySelector('.vwsq-sort-direction-btn');
    if (sortDirBtn) {
      sortDirBtn.addEventListener('click', () => {
        if (onSortChange) onSortChange(sortField, !sortAsc);
      });
    }

    // Settings modal trigger
    const settingsBtn = container.querySelector('.vwsq-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (onOpenSettings) onOpenSettings();
      });
    }
  }
}
