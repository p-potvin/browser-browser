/**
 * Dedicated Full-Tab Local Files Manager Application
 */

import { NavbarComponent } from './components/navbar.js';
import { SidebarComponent } from './components/sidebar.js';
import { FileGridView } from './components/fileGrid.js';
import { FileTableView } from './components/fileTable.js';
import { FileListView } from './components/fileList.js';
import { PreviewModal } from './components/previewModal.js';
import { ZipperWidget } from './components/zipperWidget.js';
import { KeybindingsController } from '../common/keybindings.js';
import { getSettings, saveSettings } from '../common/storage.js';
import { getFileTypeCategory, formatBytes, formatDate, showToast, navigateTo } from '../common/utils.js';
import { FirefoxDirectoryParser } from '../content/parser.js';

export class AppManager {
  constructor() {
    this.currentPath = 'file:///C:/Users/Administrator/Desktop/Github%20Repos/';
    this.items = [];
    this.filteredItems = [];
    this.currentView = 'grid';
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.sortField = 'name';
    this.sortAsc = true;
    this.selectedIndex = 0;
    this.previewModal = new PreviewModal();
    this.keybindings = null;
    this.currentDirHandle = null;
    this.dirStack = [];
    this.sidebarCollapsed = false;
  }

  async init() {
    const settings = await getSettings();
    this.currentView = settings.defaultView || 'grid';
    this.sidebarCollapsed = settings.sidebarCollapsed || false;

    this.bindEvents();
    await this.render();
    this.initKeybindings();
    ZipperWidget.init();

    // Check if URL query contains a folder path
    const params = new URLSearchParams(window.location.search);
    const pathParam = params.get('path');
    if (pathParam) {
      this.currentPath = pathParam;
      await this.loadFolder(pathParam);
    }
  }

  bindEvents() {
    // Open Folder buttons
    document.querySelectorAll('.vwsq-open-folder-btn').forEach(btn => {
      btn.addEventListener('click', () => this.promptOpenFolder());
    });

    // Sample Repo loader button
    document.querySelectorAll('.vwsq-load-sample-btn').forEach(btn => {
      btn.addEventListener('click', () => this.loadSampleItems());
    });

    // Folder input fallback
    const folderInput = document.getElementById('vwsq-folder-input');
    if (folderInput) {
      folderInput.addEventListener('change', (e) => {
        this.handleFileInput(e.target.files);
      });
    }

    // Drag and drop zone
    const dropzone = document.getElementById('vwsq-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFileInput(e.dataTransfer.files);
        }
      });
    }
  }

  async promptOpenFolder() {
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        this.dirStack = [];
        await this.loadDirectoryHandle(dirHandle);
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('showDirectoryPicker failed, falling back:', err);
        }
      }
    }

    // Fallback to webkitdirectory input
    const folderInput = document.getElementById('vwsq-folder-input');
    if (folderInput) folderInput.click();
  }

  async loadDirectoryHandle(dirHandle, clearStack = true) {
    this.currentDirHandle = dirHandle;
    if (clearStack) this.dirStack = [];
    this.currentPath = `file:///${dirHandle.name}/`;
    const items = [];

    // Parent folder entry if we have history
    if (this.dirStack.length > 0) {
      items.push({
        name: '..',
        url: '..',
        isDirectory: true,
        isParent: true,
        sizeFormatted: '--',
        dateModified: '--',
        extension: '',
        category: 'directory'
      });
    }

    for await (const entry of dirHandle.values()) {
      const isDir = entry.kind === 'directory';
      let sizeFormatted = '--';
      let dateModified = '--';
      let ext = isDir ? '' : (entry.name.split('.').pop() || '').toLowerCase();

      if (!isDir) {
        try {
          const file = await entry.getFile();
          sizeFormatted = formatBytes(file.size);
          dateModified = formatDate(file.lastModified);
        } catch (e) {}
      }

      items.push({
        name: entry.name,
        url: `${this.currentPath}${entry.name}`,
        isDirectory: isDir,
        isParent: false,
        sizeFormatted,
        dateModified,
        extension: ext,
        category: getFileTypeCategory(entry.name, isDir)
      });
    }

    this.items = items;
    this.applyFilters();
    this.render();
  }

  handleFileInput(fileList) {
    if (!fileList || fileList.length === 0) return;

    const items = [];
    const firstFile = fileList[0];
    const pathParts = (firstFile.webkitRelativePath || '').split('/');
    const rootName = pathParts[0] || 'Local Folder';
    this.currentPath = `file:///${rootName}/`;

    Array.from(fileList).forEach(file => {
      const rel = file.webkitRelativePath || file.name;
      const parts = rel.split('/');
      const name = parts.length > 1 ? parts[1] : parts[0];
      const isDir = parts.length > 2;

      if (!items.some(i => i.name === name)) {
        const ext = isDir ? '' : (name.split('.').pop() || '').toLowerCase();
        items.push({
          name,
          url: URL.createObjectURL(file),
          isDirectory: isDir,
          isParent: false,
          sizeFormatted: isDir ? '--' : formatBytes(file.size),
          dateModified: formatDate(file.lastModified),
          extension: ext,
          category: getFileTypeCategory(name, isDir)
        });
      }
    });

    this.items = items;
    this.applyFilters();
    this.render();
  }

  async loadSampleItems() {
    await this.loadFolder('file:///C:/Users/Administrator/Desktop/Github%20Repos/');
  }

  async loadFolder(folderUrl) {
    this.currentPath = folderUrl;

    // 1. Attempt to fetch real directory listing via extension background script
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        const res = await browser.runtime.sendMessage({ action: 'fetchDirectory', url: folderUrl });
        if (res && res.success && res.html) {
          const parsed = FirefoxDirectoryParser.parseHtml(res.html, folderUrl);
          if (parsed && parsed.items && parsed.items.length > 0) {
            this.items = parsed.items;
            this.applyFilters();
            this.render();
            return;
          }
        }
      } catch (err) {
        console.warn('Extension background fetchDirectory note:', err);
      }
    }

    // 2. Direct fetch attempt
    try {
      const resp = await fetch(folderUrl);
      if (resp.ok) {
        const html = await resp.text();
        const parsed = FirefoxDirectoryParser.parseHtml(html, folderUrl);
        if (parsed && parsed.items && parsed.items.length > 0) {
          this.items = parsed.items;
          this.applyFilters();
          this.render();
          return;
        }
      }
    } catch (e) {}

    // 3. If in extension tab and fetch failed, navigate tab to real file:/// path
    if (typeof browser !== 'undefined' && browser.runtime && folderUrl.startsWith('file:///')) {
      navigateTo(folderUrl);
      return;
    }

    // 4. Standalone browser test demo simulation
    let clean = folderUrl.replace(/file:\/\/\/?/, '').replace(/\/+$/, '');
    const parts = clean.split('/').filter(Boolean);
    const folderName = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : 'Root';

    if (folderName === 'vaultwares-themes') {
      this.items = [
        { name: '..', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/', isDirectory: true, isParent: true, sizeFormatted: '--', dateModified: '--', category: 'directory', extension: '' },
        { name: 'vaultsqware', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/vaultsqware/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now()), category: 'directory', extension: '' },
        { name: 'vaultwares-revisited', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/vaultwares-revisited/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now()), category: 'directory', extension: '' },
        { name: 'README.md', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/README.md', isDirectory: false, isParent: false, sizeFormatted: '8.0 KB', dateModified: formatDate(Date.now()), category: 'markdown', extension: 'md' },
        { name: 'PQC_PROTOCOL_IMPLEMENTATION.md', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/PQC_PROTOCOL_IMPLEMENTATION.md', isDirectory: false, isParent: false, sizeFormatted: '4.4 KB', dateModified: formatDate(Date.now()), category: 'markdown', extension: 'md' }
      ];
    } else if (folderName === 'vaultsqware') {
      this.items = [
        { name: '..', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/', isDirectory: true, isParent: true, sizeFormatted: '--', dateModified: '--', category: 'directory', extension: '' },
        { name: 'vaultsqware.css', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/vaultsqware/vaultsqware.css', isDirectory: false, isParent: false, sizeFormatted: '10.5 KB', dateModified: formatDate(Date.now()), category: 'code', extension: 'css' },
        { name: 'TOKENS.md', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/vaultsqware/TOKENS.md', isDirectory: false, isParent: false, sizeFormatted: '4.8 KB', dateModified: formatDate(Date.now()), category: 'markdown', extension: 'md' },
        { name: 'COMPONENTS.md', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/vaultsqware/COMPONENTS.md', isDirectory: false, isParent: false, sizeFormatted: '2.2 KB', dateModified: formatDate(Date.now()), category: 'markdown', extension: 'md' }
      ];
    } else if (folderName === 'Desktop' || folderName === 'C:') {
      this.items = [
        { name: '..', url: 'file:///C:/', isDirectory: true, isParent: true, sizeFormatted: '--', dateModified: '--', category: 'directory', extension: '' },
        { name: 'Github Repos', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now()), category: 'directory', extension: '' },
        { name: 'Prom-King', url: 'file:///C:/Users/Administrator/Desktop/Prom-King/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now()), category: 'directory', extension: '' },
        { name: 'Downloads', url: 'file:///C:/Users/Administrator/Downloads/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now()), category: 'directory', extension: '' }
      ];
    } else if (folderName === 'Downloads') {
      this.items = [
        { name: '..', url: 'file:///C:/Users/Administrator/', isDirectory: true, isParent: true, sizeFormatted: '--', dateModified: '--', category: 'directory', extension: '' },
        { name: 'archive_sample.zip', url: 'file:///C:/Users/Administrator/Downloads/archive_sample.zip', isDirectory: false, isParent: false, sizeFormatted: '18.5 MB', dateModified: formatDate(Date.now()), category: 'archive', extension: 'zip' },
        { name: 'installer.exe', url: 'file:///C:/Users/Administrator/Downloads/installer.exe', isDirectory: false, isParent: false, sizeFormatted: '45.2 MB', dateModified: formatDate(Date.now()), category: 'file', extension: 'exe' }
      ];
    } else {
      this.items = [
        { name: '..', url: 'file:///C:/Users/Administrator/Desktop/', isDirectory: true, isParent: true, sizeFormatted: '--', dateModified: '--', category: 'directory', extension: '' },
        { name: 'browser-browser', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/browser-browser/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now()), category: 'directory', extension: '' },
        { name: 'python-zipper', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/python-zipper/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now() - 3600000), category: 'directory', extension: '' },
        { name: 'vaultwares-themes', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-themes/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now() - 7200000), category: 'directory', extension: '' },
        { name: 'agent-ledger', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/agent-ledger/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now() - 18000000), category: 'directory', extension: '' },
        { name: 'vaultwares-docs', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-docs/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now() - 86400000), category: 'directory', extension: '' },
        { name: 'CHANGES.md', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/CHANGES.md', isDirectory: false, isParent: false, sizeFormatted: '4.2 KB', dateModified: formatDate(Date.now() - 100000), category: 'markdown', extension: 'md' },
        { name: 'package.json', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/package.json', isDirectory: false, isParent: false, sizeFormatted: '1.8 KB', dateModified: formatDate(Date.now() - 200000), category: 'json', extension: 'json' },
        { name: 'logo.svg', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/browser-browser/assets/logo.svg', isDirectory: false, isParent: false, sizeFormatted: '12.4 KB', dateModified: formatDate(Date.now() - 50000), category: 'image', extension: 'svg' }
      ];
    }

    this.applyFilters();
    this.render();
  }

  applyFilters() {
    let items = [...this.items];

    if (this.currentCategory !== 'all') {
      items = items.filter(item => item.category === this.currentCategory || (this.currentCategory === 'directory' && item.isDirectory));
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      items = items.filter(item => item.name.toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      if (a.isParent) return -1;
      if (b.isParent) return 1;
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

    if (topbar) {
      await NavbarComponent.render(topbar, {
        currentUrl: this.currentPath,
        currentView: this.currentView,
        onNavigate: (url) => {
          if (this.currentDirHandle) {
            this.loadFolder(url);
          } else {
            navigateTo(url);
          }
        },
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
        onRefresh: () => {
          if (this.currentDirHandle) {
            this.loadFolder(this.currentPath);
          } else {
            navigateTo(this.currentPath);
          }
        }
      });
    }

    if (sidebar) {
      await SidebarComponent.render(sidebar, {
        currentUrl: this.currentPath,
        activeCategory: this.currentCategory,
        isCollapsed: this.sidebarCollapsed,
        onToggleCollapse: async (collapsed) => {
          this.sidebarCollapsed = collapsed;
          await saveSettings({ sidebarCollapsed: collapsed });
          this.render();
        },
        onNavigate: (url) => {
          if (this.currentDirHandle) {
            this.loadFolder(url);
          } else {
            navigateTo(url);
          }
        },
        onFilterCategory: (cat) => {
          this.currentCategory = cat;
          this.applyFilters();
          this.renderFiles();
        }
      });
    }

    this.renderFiles();
  }

  renderFiles() {
    const fileContainer = document.getElementById('vwsq-file-container');
    const statsEl = document.getElementById('vwsq-stats');
    if (!fileContainer) return;

    if (this.items.length === 0) {
      return; // Keep dropzone visible
    }

    const total = this.filteredItems.length;
    const dirs = this.filteredItems.filter(i => i.isDirectory && !i.isParent).length;
    const files = this.filteredItems.filter(i => !i.isDirectory).length;
    if (statsEl) {
      statsEl.textContent = `${total} items (${dirs} folders, ${files} files)`;
    }

    const options = {
      selectedIndex: this.selectedIndex,
      onOpenItem: async (item) => {
        if (item.isDirectory) {
          if (this.currentDirHandle) {
            try {
              if (item.isParent && this.dirStack && this.dirStack.length > 0) {
                const prev = this.dirStack.pop();
                await this.loadDirectoryHandle(prev, false);
                return;
              } else {
                const subHandle = await this.currentDirHandle.getDirectoryHandle(item.name);
                if (!this.dirStack) this.dirStack = [];
                this.dirStack.push(this.currentDirHandle);
                await this.loadDirectoryHandle(subHandle, false);
                return;
              }
            } catch (e) {
              console.warn('Subdirectory handle resolution fallback:', e);
            }
          }
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
            if (this.currentDirHandle) {
              this.loadFolder(item.url);
            } else {
              navigateTo(item.url);
            }
          } else {
            this.previewModal.open(item, this.filteredItems);
          }
        }
      },
      onParentDirectory: () => {
        const parent = this.filteredItems.find(i => i.isParent);
        if (parent) {
          navigateTo(parent.url);
        } else {
          const url = this.currentPath.replace(/\/+$/, '');
          const lastSlash = url.lastIndexOf('/');
          if (lastSlash > 8) {
            navigateTo(url.substring(0, lastSlash + 1));
          }
        }
      },
      onToggleSidebar: async () => {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        await saveSettings({ sidebarCollapsed: this.sidebarCollapsed });
        this.render();
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
      }
    });

    this.keybindings.attach();
  }
}

// Instantiate and start
const app = new AppManager();
document.addEventListener('DOMContentLoaded', () => app.init());
