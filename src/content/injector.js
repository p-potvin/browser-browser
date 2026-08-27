/**
 * DOM Injector for transforming native Firefox directory listings
 */

import { FirefoxDirectoryParser } from './parser.js';
import { NavbarComponent } from '../app/components/navbar.js';
import { SidebarComponent } from '../app/components/sidebar.js';
import { FileGridView } from '../app/components/fileGrid.js';
import { FileTableView } from '../app/components/fileTable.js';
import { FileListView } from '../app/components/fileList.js';
import { PreviewModal } from '../app/components/previewModal.js';
import { ZipperWidget } from '../app/components/zipperWidget.js';
import { KeybindingsController } from '../common/keybindings.js';
import { getSettings, saveSettings } from '../common/storage.js';
import { navigateTo } from '../common/utils.js';

export class DirectoryInjector {
  constructor() {
    this.parsedData = null;
    this.filteredItems = [];
    this.currentView = 'grid'; // 'grid' | 'table' | 'list'
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.sortField = 'name';
    this.sortAsc = true;
    this.selectedIndex = 0;
    this.previewModal = new PreviewModal();
    this.keybindings = null;
  }

  async init() {
    if (!FirefoxDirectoryParser.isDirectoryListing()) {
      return;
    }

    this.parsedData = FirefoxDirectoryParser.parse();
    const settings = await getSettings();
    this.currentView = settings.defaultView || 'grid';

    // Hide native body content cleanly
    document.body.style.display = 'none';

    // Create root UI
    this.createRoot();
    this.applyFilters();
    this.render();
    this.initKeybindings();

    ZipperWidget.init();
  }

  createRoot() {
    let root = document.getElementById('vwsq-browser-root');
    if (root) root.remove();

    root = document.createElement('div');
    root.id = 'vwsq-browser-root';
    root.className = 'vwsq-console-shell';

    root.innerHTML = `
      <header id="vwsq-topbar" class="vwsq-topbar"></header>
      <div class="vwsq-body">
        <aside id="vwsq-sidebar" class="vwsq-warm-rail-sidebar"></aside>
        <main class="vwsq-main-content">
          <div class="vwsq-toolbar">
            <div id="vwsq-stats" class="vwsq-stats">Loading items...</div>
          </div>
          <div id="vwsq-file-container" class="vwsq-file-container"></div>
        </main>
      </div>
    `;

    document.documentElement.appendChild(root);
  }

  applyFilters() {
    let items = [...(this.parsedData?.items || [])];

    // Category filter
    if (this.currentCategory !== 'all') {
      items = items.filter(item => item.category === this.currentCategory || (this.currentCategory === 'directory' && item.isDirectory));
    }

    // Search query filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      items = items.filter(item => item.name.toLowerCase().includes(q));
    }

    // Sorting
    items.sort((a, b) => {
      // Parent directory always first
      if (a.isParent) return -1;
      if (b.isParent) return 1;

      // Folders before files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let valA = a[this.sortField] || a.name;
      let valB = b[this.sortField] || b.name;

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return this.sortAsc ? comp : -comp;
      }

      return this.sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    this.filteredItems = items;
    if (this.selectedIndex >= items.length) {
      this.selectedIndex = Math.max(0, items.length - 1);
    }
  }

  async render() {
    const topbar = document.getElementById('vwsq-topbar');
    const sidebar = document.getElementById('vwsq-sidebar');
    const fileContainer = document.getElementById('vwsq-file-container');
    const statsEl = document.getElementById('vwsq-stats');

    if (!topbar || !sidebar || !fileContainer) return;

    // Render Navbar
    await NavbarComponent.render(topbar, {
      currentUrl: this.parsedData.currentUrl,
      currentView: this.currentView,
      onNavigate: (url) => { navigateTo(url); },
      onSearch: (q) => {
        this.searchQuery = q;
        this.applyFilters();
        this.renderFiles();
      },
      onViewChange: async (view) => {
        this.currentView = view;
        await saveSettings({ defaultView: view });
        this.renderFiles();
      },
      onRefresh: () => { window.location.reload(); }
    });

    // Render Sidebar
    await SidebarComponent.render(sidebar, {
      currentUrl: this.parsedData.currentUrl,
      activeCategory: this.currentCategory,
      onNavigate: (url) => { navigateTo(url); },
      onFilterCategory: (cat) => {
        this.currentCategory = cat;
        this.applyFilters();
        this.renderFiles();
      }
    });

    this.renderFiles();
  }

  renderFiles() {
    const fileContainer = document.getElementById('vwsq-file-container');
    const statsEl = document.getElementById('vwsq-stats');
    if (!fileContainer) return;

    const total = this.filteredItems.length;
    const dirs = this.filteredItems.filter(i => i.isDirectory && !i.isParent).length;
    const files = this.filteredItems.filter(i => !i.isDirectory).length;
    if (statsEl) {
      statsEl.textContent = `${total} items (${dirs} folders, ${files} files)`;
    }

    const options = {
      selectedIndex: this.selectedIndex,
      onOpenItem: (item) => {
        if (item.isDirectory) {
          navigateTo(item.url);
        } else {
          this.previewModal.open(item, this.filteredItems);
        }
      },
      onQuickLook: (item, allItems) => {
        this.previewModal.open(item, allItems);
      },
      onSort: (field) => {
        if (this.sortField === field) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortField = field;
          this.sortAsc = true;
        }
        this.applyFilters();
        this.renderFiles();
      },
      sortField: this.sortField,
      sortAsc: this.sortAsc
    };

    if (this.currentView === 'grid') {
      FileGridView.render(fileContainer, this.filteredItems, options);
    } else if (this.currentView === 'table') {
      FileTableView.render(fileContainer, this.filteredItems, options);
    } else {
      FileListView.render(fileContainer, this.filteredItems, options);
    }
  }

  initKeybindings() {
    this.keybindings = new KeybindingsController({
      onQuickLook: () => {
        if (this.previewModal.isOpen()) {
          this.previewModal.close();
        } else if (this.filteredItems[this.selectedIndex]) {
          const item = this.filteredItems[this.selectedIndex];
          if (!item.isDirectory) {
            this.previewModal.open(item, this.filteredItems);
          }
        }
      },
      onNavigateNext: () => {
        if (this.previewModal.isOpen()) {
          this.previewModal.next();
        } else if (this.selectedIndex < this.filteredItems.length - 1) {
          this.selectedIndex++;
          this.renderFiles();
        }
      },
      onNavigatePrev: () => {
        if (this.previewModal.isOpen()) {
          this.previewModal.prev();
        } else if (this.selectedIndex > 0) {
          this.selectedIndex--;
          this.renderFiles();
        }
      },
      onNavigateDown: () => {
        if (this.selectedIndex < this.filteredItems.length - 1) {
          this.selectedIndex++;
          this.renderFiles();
        }
      },
      onNavigateUp: () => {
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
          this.renderFiles();
        }
      },
      onOpenSelected: () => {
        const item = this.filteredItems[this.selectedIndex];
        if (item) {
          if (item.isDirectory) {
            navigateTo(item.url);
          } else {
            this.previewModal.open(item, this.filteredItems);
          }
        }
      },
      onParentDirectory: () => {
        const parent = this.parsedData.items.find(i => i.isParent);
        if (parent) {
          navigateTo(parent.url);
        } else {
          // Navigate up one folder segment
          const url = this.parsedData.currentUrl.replace(/\/+$/, '');
          const lastSlash = url.lastIndexOf('/');
          if (lastSlash > 8) {
            navigateTo(url.substring(0, lastSlash + 1));
          }
        }
      },
      onFocusSearch: () => {
        const searchInput = document.querySelector('.vwsq-search-input');
        if (searchInput) searchInput.focus();
      },
      onEscape: () => {
        if (this.previewModal.isOpen()) {
          this.previewModal.close();
        }
      },
      onCycleView: () => {
        const views = ['grid', 'table', 'list'];
        const next = views[(views.indexOf(this.currentView) + 1) % views.length];
        this.currentView = next;
        saveSettings({ defaultView: next });
        this.render();
      },
      onRefresh: () => {
        window.location.reload();
      }
    });

    this.keybindings.attach();
  }
}
