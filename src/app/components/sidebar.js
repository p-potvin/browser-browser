/**
 * Warm Rail Sidebar Component with Real Windows Drives, Collapsible Rail & Collapsible Sections
 */

import { ICONS } from '../../common/icons.js';
import { CATPPUCCIN_ICONS } from '../../common/catppuccinIcons.js';
import { escapeHtml, showToast } from '../../common/utils.js';
import { getBookmarks, removeBookmark, addBookmark, getSettings, saveSettings } from '../../common/storage.js';

// Real Windows Drives detected on system
export const SYSTEM_DRIVES = [
  { letter: 'C:', name: 'Clopeux-Desktop C drive', size: '479 GB', free: '64 GB', type: 'System NVMe', url: 'file:///C:/' },
  { letter: 'D:', name: 'Clopeux-Desktop D drive', size: '999 GB', free: '214 GB', type: 'Data SSD', url: 'file:///D:/' },
  { letter: 'E:', name: 'Clopeux-Desktop E drive', size: '240 GB', free: '148 GB', type: 'Fast SSD', url: 'file:///E:/' },
  { letter: 'F:', name: 'Clopeux-Desktop F drive', size: '1024 GB', free: '155 GB', type: 'Storage HDD', url: 'file:///F:/' },
  { letter: 'G:', name: '1TB Drive', size: '1000 GB', free: '317 GB', type: 'Backup', url: 'file:///G:/' },
  { letter: 'I:', name: '1TB SSD USB3 to SATA', size: '998 GB', free: '155 GB', type: 'External SSD', url: 'file:///I:/' },
  { letter: 'U:', name: 'Network Share', size: '254 GB', free: '65 GB', type: 'Network', url: 'file:///U:/' }
];

export class SidebarComponent {
  /**
   * Render sidebar into container
   * @param {HTMLElement} container 
   * @param {Object} options
   */
  static async render(container, options = {}) {
    const { onNavigate, onFilterCategory, activeCategory = 'all', currentUrl = '', onToggleCollapse, isCollapsed = false } = options;
    const bookmarks = await getBookmarks();
    const settings = await getSettings();
    const collapsed = isCollapsed || settings.sidebarCollapsed || false;
    const sections = settings.collapsedSections || { drives: false, bookmarks: false, categories: false, zipper: false };

    const drivesList = (options.drives && options.drives.length > 0) ? options.drives.map(d => ({
      letter: d.letter,
      name: d.name,
      size: d.total_formatted || d.size || '--',
      free: d.free_formatted || d.free || '--',
      type: d.type || 'Drive',
      path: d.path || d.url || (d.letter + '\\'),
      url: d.path || d.url || (d.letter + '\\')
    })) : SYSTEM_DRIVES;

    if (collapsed) {
      container.classList.add('collapsed');
    } else {
      container.classList.remove('collapsed');
    }

    container.innerHTML = `
      <!-- Sidebar Header / Full Collapse Toggle -->
      <div style="display: flex; align-items: center; justify-content: ${collapsed ? 'center' : 'space-between'}; padding-bottom: 8px; border-bottom: 1px solid var(--vwsq-warm-border, rgba(15,17,22,0.1));">
        ${!collapsed ? `
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 18px; height: 18px; color: var(--vwsq-coral-600);">${CATPPUCCIN_ICONS.drive}</div>
            <span style="font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vwsq-warm-ink);">Explorer</span>
          </div>
        ` : ''}
        <button id="vwsq-sidebar-toggle-btn" class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost" title="${collapsed ? 'Expand Sidebar ([)' : 'Collapse Sidebar ([)'}" style="padding: 4px 6px;">
          <div style="width: 14px; height: 14px; transform: ${collapsed ? 'rotate(180deg)' : 'none'}; transition: transform 200ms;">
            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <polyline points="15 9 12 12 15 15"/>
            </svg>
          </div>
        </button>
      </div>

      <!-- Real Logical Drives Section -->
      <div class="vwsq-sidebar-section ${sections.drives ? 'section-collapsed' : ''}" data-section="drives">
        ${!collapsed ? `
          <div class="vwsq-sidebar-heading vwsq-section-header" title="Click to collapse/expand drives">
            <span class="vwsq-section-title">Physical Drives (${drivesList.length})</span>
            <span class="vwsq-section-chevron">${sections.drives ? '▶' : '▼'}</span>
          </div>
        ` : ''}
        <div class="vwsq-section-body" style="${sections.drives && !collapsed ? 'display: none;' : ''}">
          <div class="vwsq-sidebar-drives-list" style="display: flex; flex-direction: column; gap: 4px;">
            ${drivesList.map(d => `
              <button class="vwsq-drive-btn ${currentUrl.startsWith(d.path) || currentUrl.startsWith(d.url) ? 'active' : ''}" data-path="${escapeHtml(d.path)}" data-url="${escapeHtml(d.url)}" title="${escapeHtml(d.name)} (${d.free} free of ${d.size})">
                <div style="width: 18px; height: 18px; flex-shrink: 0; color: var(--vwsq-iris-500);">${CATPPUCCIN_ICONS.drive}</div>
                ${!collapsed ? `
                  <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: 0; flex: 1; text-align: left;">
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--vwsq-warm-ink); display: flex; align-items: center; justify-content: space-between; width: 100%;">
                      <span>Drive (${d.letter})</span>
                      <span style="font-size: 10.5px; font-family: var(--vwsq-font-mono); color: var(--vwsq-warm-ink-dim);">${d.free} free</span>
                    </div>
                    <div style="font-size: 10.5px; color: var(--vwsq-warm-ink-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${escapeHtml(d.name)}</div>
                  </div>
                ` : ''}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Pinned Bookmarks Section -->
      <div class="vwsq-sidebar-section ${sections.bookmarks ? 'section-collapsed' : ''}" data-section="bookmarks">
        ${!collapsed ? `
          <div class="vwsq-sidebar-heading vwsq-section-header" title="Click to collapse/expand bookmarks">
            <span class="vwsq-section-title">Bookmarks (${bookmarks.length})</span>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-pin-current-btn" title="Pin Current Folder" style="padding: 2px 4px;">
                <div style="width: 12px; height: 12px;">${ICONS.bookmark}</div>
              </button>
              <span class="vwsq-section-chevron">${sections.bookmarks ? '▶' : '▼'}</span>
            </div>
          </div>
        ` : ''}
        <div class="vwsq-section-body" style="${sections.bookmarks && !collapsed ? 'display: none;' : ''}">
          <div class="vwsq-bookmarks-list" style="display: flex; flex-direction: column; gap: 2px;">
            ${bookmarks.length === 0 && !collapsed ? `
              <div style="font-size: 11px; color: var(--vwsq-warm-ink-dim); padding: 6px 10px; font-style: italic;">No pinned folders</div>
            ` : ''}
            ${bookmarks.map(bm => `
              <div class="vwsq-sidebar-item ${currentUrl.startsWith(bm.url) ? 'active' : ''}" data-url="${escapeHtml(bm.url)}" title="${escapeHtml(bm.name)} (${escapeHtml(bm.url)})">
                <div style="width: 18px; height: 18px; flex-shrink: 0;">${CATPPUCCIN_ICONS.folder}</div>
                ${!collapsed ? `
                  <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px;">${escapeHtml(bm.name)}</span>
                  <button class="vwsq-btn vwsq-btn--ghost vwsq-remove-bookmark-btn" data-url="${escapeHtml(bm.url)}" style="padding: 2px; opacity: 0.4;" title="Unpin">
                    <div style="width: 10px; height: 10px;">${ICONS.close}</div>
                  </button>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Category Filter View Section -->
      <div class="vwsq-sidebar-section ${sections.categories ? 'section-collapsed' : ''}" data-section="categories">
        ${!collapsed ? `
          <div class="vwsq-sidebar-heading vwsq-section-header" title="Click to collapse/expand filters">
            <span class="vwsq-section-title">Filter Category</span>
            <span class="vwsq-section-chevron">${sections.categories ? '▶' : '▼'}</span>
          </div>
        ` : ''}
        <div class="vwsq-section-body" style="${sections.categories && !collapsed ? 'display: none;' : ''}">
          <div class="vwsq-sidebar-item ${activeCategory === 'all' ? 'active' : ''}" data-category="all" title="All Files">
            <div style="width: 16px; height: 16px; flex-shrink: 0;">${ICONS.grid}</div>
            ${!collapsed ? `<span>All Items</span>` : ''}
          </div>
          <div class="vwsq-sidebar-item ${activeCategory === 'directory' ? 'active' : ''}" data-category="directory" title="Folders Only">
            <div style="width: 16px; height: 16px; flex-shrink: 0;">${CATPPUCCIN_ICONS.folder}</div>
            ${!collapsed ? `<span>Folders Only</span>` : ''}
          </div>
          <div class="vwsq-sidebar-item ${activeCategory === 'image' ? 'active' : ''}" data-category="image" title="Images">
            <div style="width: 16px; height: 16px; flex-shrink: 0;">${CATPPUCCIN_ICONS.image}</div>
            ${!collapsed ? `<span>Images</span>` : ''}
          </div>
          <div class="vwsq-sidebar-item ${activeCategory === 'code' ? 'active' : ''}" data-category="code" title="Code">
            <div style="width: 16px; height: 16px; flex-shrink: 0;">${CATPPUCCIN_ICONS.code}</div>
            ${!collapsed ? `<span>Source Code</span>` : ''}
          </div>
          <div class="vwsq-sidebar-item ${activeCategory === 'audio' ? 'active' : ''}" data-category="audio" title="Audio">
            <div style="width: 16px; height: 16px; flex-shrink: 0;">${CATPPUCCIN_ICONS.audio}</div>
            ${!collapsed ? `<span>Audio</span>` : ''}
          </div>
          <div class="vwsq-sidebar-item ${activeCategory === 'video' ? 'active' : ''}" data-category="video" title="Video">
            <div style="width: 16px; height: 16px; flex-shrink: 0;">${CATPPUCCIN_ICONS.video}</div>
            ${!collapsed ? `<span>Video</span>` : ''}
          </div>
          <div class="vwsq-sidebar-item ${activeCategory === 'archive' ? 'active' : ''}" data-category="archive" title="Archives">
            <div style="width: 16px; height: 16px; flex-shrink: 0;">${CATPPUCCIN_ICONS.archive}</div>
            ${!collapsed ? `<span>Archives</span>` : ''}
          </div>
        </div>
      </div>
    `;

    // Section collapse click handlers
    container.querySelectorAll('.vwsq-section-header').forEach(header => {
      header.addEventListener('click', async (e) => {
        if (e.target.closest('.vwsq-pin-current-btn')) return;
        const sectionEl = header.closest('.vwsq-sidebar-section');
        if (!sectionEl) return;
        const sectionKey = sectionEl.dataset.section;
        if (!sectionKey) return;

        const currentSettings = await getSettings();
        const currentSections = currentSettings.collapsedSections || { drives: false, bookmarks: false, categories: false, zipper: false };
        currentSections[sectionKey] = !currentSections[sectionKey];
        await saveSettings({ collapsedSections: currentSections });
        SidebarComponent.render(container, options);
      });
    });

    // Full sidebar collapse toggle button
    const toggleBtn = container.querySelector('#vwsq-sidebar-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        const isNowCollapsed = !container.classList.contains('collapsed');
        await saveSettings({ sidebarCollapsed: isNowCollapsed });
        if (onToggleCollapse) {
          onToggleCollapse(isNowCollapsed);
        } else {
          SidebarComponent.render(container, { ...options, isCollapsed: isNowCollapsed });
        }
      });
    }

    // Drive clicks
    container.querySelectorAll('.vwsq-drive-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (onNavigate) onNavigate(btn.dataset.path || btn.dataset.url);
      });
    });

    // Bookmark clicks
    container.querySelectorAll('.vwsq-bookmarks-list .vwsq-sidebar-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.vwsq-remove-bookmark-btn')) return;
        if (onNavigate) onNavigate(item.dataset.url);
      });
    });

    // Remove bookmark
    container.querySelectorAll('.vwsq-remove-bookmark-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeBookmark(btn.dataset.url);
        showToast('Bookmark removed', 'info');
        SidebarComponent.render(container, options);
      });
    });

    // Pin current
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

    // Category filters
    container.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onFilterCategory) onFilterCategory(btn.dataset.category);
      });
    });
  }
}
