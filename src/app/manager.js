/**
 * Dedicated Full-Tab Local Files Manager Application
 * Supports hierarchical virtual file system browsing, Windows Explorer-style address bar,
 * Back/Forward/Up navigation, bottom status bar, and .thumbs previews.
 */

import { NavbarComponent } from './components/navbar.js';
import { SidebarComponent } from './components/sidebar.js';
import { FileGridView } from './components/fileGrid.js';
import { FileTableView } from './components/fileTable.js';
import { FileListView } from './components/fileList.js';
import { PreviewModal } from './components/previewModal.js';
import { PropertiesModal } from './components/propertiesModal.js';
import { ContextMenuComponent } from './components/contextMenu.js';
import { SettingsModal } from './components/settingsModal.js';
import { KeybindingsController } from '../common/keybindings.js';
import { getSettings, saveSettings } from '../common/storage.js';
import { getFileTypeCategory, formatBytes, formatDate, showToast, navigateTo, matchesAnyGlob } from '../common/utils.js';
import { FirefoxDirectoryParser } from '../content/parser.js';
import { VirtualFileSystem } from './vfs.js';

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
    this.propertiesModal = new PropertiesModal();
    this.contextMenu = new ContextMenuComponent();
    this.settingsModal = new SettingsModal();
    this.settings = {};
    this.keybindings = null;
    this.currentDirHandle = null;
    this.dirStack = [];
    this.sidebarCollapsed = false;

    // Virtual File System & Navigation History
    this.vfs = new VirtualFileSystem();
    this.currentVfsPath = '';
    this.navHistory = [''];
    this.navHistoryIndex = 0;

    // Native Messaging Host State
    this.isNativeMode = false;
    this.httpPort = 45123;
    this.everythingAvailable = false;
    this.drives = [];
    this.currentParentPath = null;
  }

  async init() {
    this.settings = await getSettings();
    this.currentView = this.settings.defaultView || 'grid';
    this.sidebarCollapsed = this.settings.sidebarCollapsed || false;
    this.sortField = this.settings.sortField || 'name';
    this.sortAsc = this.settings.sortAsc !== false;

    // Check if C++ Native Messaging Host is available
    await this.checkNativeHost();

    this.bindEvents();
    await this.render();
    this.initKeybindings();

    // Check if URL query contains a folder path
    const params = new URLSearchParams(window.location.search);
    const pathParam = params.get('path');
    if (pathParam) {
      await this.loadFolder(pathParam);
    } else if (this.isNativeMode) {
      // Default to C:\ in native mode
      await this.loadFolder('C:\\');
    }
  }

  async checkNativeHost() {
    try {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        const pingResp = await browser.runtime.sendMessage({ action: 'nativePing' });
        if (pingResp && pingResp.success) {
          this.isNativeMode = true;
          this.httpPort = pingResp.httpPort || 45123;
          this.everythingAvailable = pingResp.everythingAvailable || false;

          // Fetch real physical drives
          const drivesResp = await browser.runtime.sendMessage({ action: 'nativeGetDrives' });
          if (drivesResp && drivesResp.drives) {
            this.drives = drivesResp.drives;
          }

          console.log('[browser-browser] Native Host connected:', pingResp);
          showToast(`Native Mode: C++ Host active on port ${this.httpPort}`, 'success');
          return true;
        }
      }
    } catch (e) {
      console.warn('Native host check note:', e);
    }
    this.isNativeMode = false;
    return false;
  }

  bindEvents() {
    // Open Folder buttons (header, dropzone, etc.)
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

    // Navigation Controls
    const backBtn = document.getElementById('vwsq-nav-back');
    if (backBtn) backBtn.addEventListener('click', () => this.goBack());

    const fwdBtn = document.getElementById('vwsq-nav-forward');
    if (fwdBtn) fwdBtn.addEventListener('click', () => this.goForward());

    const upBtn = document.getElementById('vwsq-nav-up');
    if (upBtn) upBtn.addEventListener('click', () => this.goUp());

    const refreshBtn = document.getElementById('vwsq-nav-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refresh());

    // Prominent Explorer Address Bar
    const addressInput = document.getElementById('vwsq-address-input');
    if (addressInput) {
      addressInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAddressSubmit();
        }
      });
      addressInput.addEventListener('focus', () => {
        addressInput.select();
      });
    }

    const goBtn = document.getElementById('vwsq-address-go-btn');
    if (goBtn) {
      goBtn.addEventListener('click', () => this.handleAddressSubmit());
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
    if (this.isNativeMode) {
      const addressInput = document.getElementById('vwsq-address-input');
      if (addressInput) {
        addressInput.focus();
        addressInput.select();
        showToast('Type or paste any path (e.g. C:\\ or D:\\) and press Enter', 'info', 3500);
      }
      return;
    }

    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        this.dirStack = [];
        await this.loadDirectoryHandle(dirHandle);
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('showDirectoryPicker failed, falling back to input:', err);
        }
      }
    }

    // Fallback to webkitdirectory input
    const folderInput = document.getElementById('vwsq-folder-input');
    if (folderInput) {
      folderInput.value = '';
      folderInput.click();
    }
  }

  handleFileInput(fileList) {
    if (!fileList || fileList.length === 0) return;

    // Load into hierarchical Virtual File System
    this.vfs.loadFromFileList(fileList);
    this.currentVfsPath = '';
    this.navHistory = [''];
    this.navHistoryIndex = 0;

    // Update tab title
    const tabTitle = document.getElementById('vwsq-tab-title');
    if (tabTitle) {
      tabTitle.textContent = this.vfs.rootName;
    }

    this.loadVfsPath('', false);
    showToast(`Loaded "${this.vfs.rootName}" (${this.vfs.allFilesCount} files)`, 'success');
  }

  loadVfsPath(normPath, pushHistory = true) {
    if (pushHistory) {
      this.navHistory = this.navHistory.slice(0, this.navHistoryIndex + 1);
      this.navHistory.push(normPath);
      this.navHistoryIndex = this.navHistory.length - 1;
    }

    this.currentVfsPath = normPath;
    this.items = this.vfs.getItems(normPath);
    this.currentPath = this.vfs.getDisplayPath(normPath);

    this.updateAddressBar();
    this.updateNavButtons();
    this.applyFilters();
    this.renderFiles();
  }

  navigateVfs(targetPath) {
    this.loadVfsPath(targetPath, true);
  }

  goBack() {
    if (this.navHistoryIndex > 0) {
      this.navHistoryIndex--;
      const targetPath = this.navHistory[this.navHistoryIndex];
      if (this.isNativeMode) {
        this.loadNativeFolder(targetPath, false);
      } else {
        this.loadVfsPath(targetPath, false);
      }
    }
  }

  goForward() {
    if (this.navHistoryIndex < this.navHistory.length - 1) {
      this.navHistoryIndex++;
      const targetPath = this.navHistory[this.navHistoryIndex];
      if (this.isNativeMode) {
        this.loadNativeFolder(targetPath, false);
      } else {
        this.loadVfsPath(targetPath, false);
      }
    }
  }

  goUp() {
    if (this.isNativeMode) {
      if (this.currentParentPath) {
        this.loadNativeFolder(this.currentParentPath);
      } else {
        showToast('Already at drive root', 'info');
      }
      return;
    }

    if (this.vfs.allFilesCount > 0) {
      if (this.currentVfsPath !== '') {
        const folder = this.vfs.folders.get(this.currentVfsPath);
        const parentPath = folder ? folder.parentPath : '';
        this.navigateVfs(parentPath);
      } else {
        showToast('Already at the top level of this workspace', 'info');
      }
      return;
    }

    // Direct URL navigation fallback
    const parent = this.filteredItems.find(i => i.isParent);
    if (parent) {
      this.loadFolder(parent.url);
    } else {
      const url = this.currentPath.replace(/\/+$/, '');
      const lastSlash = url.lastIndexOf('/');
      if (lastSlash > 8) {
        this.loadFolder(url.substring(0, lastSlash + 1));
      }
    }
  }

  refresh() {
    if (this.isNativeMode) {
      this.loadNativeFolder(this.currentPath, false);
      showToast('Refreshed via Native Host', 'info');
      return;
    }

    if (this.vfs.allFilesCount > 0) {
      this.loadVfsPath(this.currentVfsPath, false);
      showToast('Directory view refreshed', 'info');
    } else if (this.currentDirHandle) {
      this.loadDirectoryHandle(this.currentDirHandle, false);
    } else {
      this.loadFolder(this.currentPath);
    }
  }

  updateNavButtons() {
    const backBtn = document.getElementById('vwsq-nav-back');
    const fwdBtn = document.getElementById('vwsq-nav-forward');
    if (backBtn) backBtn.disabled = (this.navHistoryIndex <= 0);
    if (fwdBtn) fwdBtn.disabled = (this.navHistoryIndex >= this.navHistory.length - 1);
  }

  updateAddressBar() {
    const addressInput = document.getElementById('vwsq-address-input');
    if (addressInput) {
      if (this.isNativeMode) {
        addressInput.value = this.currentPath;
      } else if (this.vfs.allFilesCount > 0) {
        addressInput.value = this.vfs.getDisplayPath(this.currentVfsPath);
      } else {
        addressInput.value = this.currentPath;
      }
    }
  }

  handleAddressSubmit() {
    const addressInput = document.getElementById('vwsq-address-input');
    if (!addressInput) return;

    let typed = addressInput.value.trim();
    if (!typed) return;

    // 0. Native Host navigation
    if (this.isNativeMode) {
      this.loadNativeFolder(typed);
      return;
    }

    // 1. Try matching inside current VFS
    if (this.vfs.allFilesCount > 0) {
      const resolved = this.vfs.resolvePath(typed);
      if (resolved !== null) {
        this.navigateVfs(resolved);
        return;
      }
    }

    // 2. Try file:/// or Windows drive path
    if (typed.startsWith('file://') || /^[A-Za-z]:[\\/]/.test(typed)) {
      let fullUrl = typed;
      if (/^[A-Za-z]:[\\/]/.test(typed)) {
        fullUrl = 'file:///' + typed.replace(/\\/g, '/');
      }
      this.loadFolder(fullUrl);
      return;
    }

    showToast(`Path "${typed}" not found in current workspace`, 'warning');
  }

  async loadDirectoryHandle(dirHandle, clearStack = true) {
    this.currentDirHandle = dirHandle;
    if (clearStack) this.dirStack = [];
    this.currentPath = `file:///${dirHandle.name}/`;
    const items = [];

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
    this.updateAddressBar();
    this.applyFilters();
    this.render();
  }

  async loadSampleItems() {
    if (this.isNativeMode) {
      await this.loadNativeFolder('C:\\Users\\Administrator\\Desktop\\Github Repos\\');
    } else {
      await this.loadFolder('file:///C:/Users/Administrator/Desktop/Github%20Repos/');
    }
  }

  async loadNativeFolder(targetPath, pushHistory = true) {
    let clean = targetPath;
    if (clean.startsWith('file:///')) {
      clean = decodeURIComponent(clean.substring(8)).replace(/\//g, '\\');
    } else if (clean.startsWith('file://')) {
      clean = decodeURIComponent(clean.substring(7)).replace(/\//g, '\\');
    }
    if (clean.length === 2 && clean[1] === ':') {
      clean += '\\';
    }

    if (pushHistory) {
      this.navHistory = this.navHistory.slice(0, this.navHistoryIndex + 1);
      this.navHistory.push(clean);
      this.navHistoryIndex = this.navHistory.length - 1;
    }

    this.currentPath = clean;
    this.updateAddressBar();
    this.updateNavButtons();

    // Update tab title
    const parts = clean.split('\\').filter(Boolean);
    const folderName = parts.length > 0 ? parts[parts.length - 1] : clean;
    const tabTitle = document.getElementById('vwsq-tab-title');
    if (tabTitle) tabTitle.textContent = folderName;

    try {
      const response = await browser.runtime.sendMessage({
        action: 'nativeListDir',
        path: clean
      });

      if (response && response.success) {
        this.currentParentPath = response.parent_path;
        let items = [];

        if (response.parent_path) {
          items.push({
            name: '..',
            path: response.parent_path,
            url: response.parent_path,
            isDirectory: true,
            isParent: true,
            sizeFormatted: '--',
            dateModified: '--',
            extension: '',
            category: 'directory'
          });
        }

        if (response.items && response.items.length > 0) {
          items.push(...response.items.map(it => ({
            ...it,
            url: it.path
          })));
        }

        this.items = items;
        this.applyFilters();
        await this.render();
        return;
      } else {
        showToast(response?.error || 'Failed to list directory', 'error');
      }
    } catch (err) {
      console.error('loadNativeFolder error:', err);
      showToast(`Error accessing ${clean}: ${err.message}`, 'error');
    }
  }

  async loadFolder(folderUrl) {
    if (this.isNativeMode) {
      await this.loadNativeFolder(folderUrl);
      return;
    }

    this.currentPath = folderUrl;
    this.updateAddressBar();

    // 1. Direct fetch attempt
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

    // 2. Standalone browser test demo simulation
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
        { name: 'vaultwares-api', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/vaultwares-api/', isDirectory: true, isParent: false, sizeFormatted: '--', dateModified: formatDate(Date.now() - 3600000), category: 'directory', extension: '' },
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

    // Glob exclusions (Folder exclusions & File exclusions)
    const folderEx = this.settings?.folderExclusions || [];
    const fileEx = this.settings?.fileExclusions || [];
    const hideSidecars = this.settings?.hideSidecars !== false;

    items = items.filter(item => {
      if (item.isParent) return true;

      // Folder exclusions
      if (item.isDirectory) {
        if (matchesAnyGlob(item.name, folderEx)) return false;
        return true;
      }

      // Hide sidecars if enabled
      if (hideSidecars && item.isSidecar) {
        return false;
      }

      // File exclusions
      if (matchesAnyGlob(item.name, fileEx)) {
        return false;
      }

      return true;
    });

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

      let valA = a[this.sortField] !== undefined ? a[this.sortField] : a.name;
      let valB = b[this.sortField] !== undefined ? b[this.sortField] : b.name;

      if (typeof valA === 'string' && typeof valB === 'string') {
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
        sortField: this.sortField,
        sortAsc: this.sortAsc,
        onSortChange: async (field, asc) => {
          this.sortField = field;
          this.sortAsc = asc;
          await saveSettings({ sortField: field, sortAsc: asc });
          this.applyFilters();
          await this.render();
        },
        onOpenSettings: () => {
          this.settingsModal.open(async (newSettings) => {
            this.settings = newSettings;
            if (newSettings.defaultView && newSettings.defaultView !== this.currentView) {
              this.currentView = newSettings.defaultView;
            }
            this.applyFilters();
            await this.render();
          });
        },
        onNavigate: (url) => {
          if (this.isNativeMode) {
            this.loadNativeFolder(url);
            return;
          }
          if (this.vfs.allFilesCount > 0) {
            const resolved = this.vfs.resolvePath(url);
            if (resolved !== null) {
              this.navigateVfs(resolved);
              return;
            }
          }
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
          this.refresh();
        }
      });
    }

    if (sidebar) {
      await SidebarComponent.render(sidebar, {
        currentUrl: this.currentPath,
        drives: this.drives,
        activeCategory: this.currentCategory,
        isCollapsed: this.sidebarCollapsed,
        onToggleCollapse: async (collapsed) => {
          this.sidebarCollapsed = collapsed;
          await saveSettings({ sidebarCollapsed: collapsed });
          this.render();
        },
        onNavigate: (url) => {
          if (this.isNativeMode) {
            this.loadNativeFolder(url);
            return;
          }
          if (this.vfs.allFilesCount > 0) {
            const resolved = this.vfs.resolvePath(url);
            if (resolved !== null) {
              this.navigateVfs(resolved);
              return;
            }
          }
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
    const statusCountEl = document.getElementById('vwsq-status-item-count');
    const statusSummaryEl = document.getElementById('vwsq-status-summary');
    const statusSelectionEl = document.getElementById('vwsq-status-selection');
    const statusSelectedInfoEl = document.getElementById('vwsq-status-selected-info');

    if (!fileContainer) return;

    if (this.items.length === 0) {
      if (statusCountEl) statusCountEl.textContent = '0 items';
      if (statusSummaryEl) statusSummaryEl.textContent = 'Workspace empty';
      return;
    }

    const total = this.filteredItems.length;
    const dirs = this.filteredItems.filter(i => i.isDirectory && !i.isParent).length;
    const files = this.filteredItems.filter(i => !i.isDirectory).length;

    // Update bottom status bar
    if (statusCountEl) {
      statusCountEl.textContent = `${total} items (${dirs} folders, ${files} files)`;
    }
    if (statusSummaryEl) {
      if (this.isNativeMode) {
        const ev = this.everythingAvailable ? ' • Everything IPC active' : '';
        statusSummaryEl.textContent = `NATIVE HOST (Port ${this.httpPort}${ev}) • ${this.currentPath}`;
      } else if (this.vfs.allFilesCount > 0) {
        statusSummaryEl.textContent = `${formatBytes(this.vfs.totalSizeBytes)} total • ${this.vfs.rootName}`;
      } else {
        statusSummaryEl.textContent = `${this.currentView.toUpperCase()} VIEW`;
      }
    }

    // Selected item status
    const selectedItem = this.filteredItems[this.selectedIndex];
    if (selectedItem && statusSelectionEl && statusSelectedInfoEl && !selectedItem.isParent) {
      statusSelectionEl.style.display = 'flex';
      statusSelectedInfoEl.textContent = `Selected: ${selectedItem.name} (${selectedItem.sizeFormatted})`;
    } else if (statusSelectionEl) {
      statusSelectionEl.style.display = 'none';
    }

    const options = {
      selectedIndex: this.selectedIndex,
      onOpenItem: async (item) => {
        await this.openItem(item);
      },
      onQuickLook: (item, allItems) => {
        this.previewModal.open(item, allItems);
      },
      onContextMenu: (e, item) => {
        this.contextMenu.open(e, item, {
          onOpen: (it) => this.openItem(it),
          onProperties: (it) => this.propertiesModal.open(it)
        });
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

  async openItem(item) {
    if (!item) return;

    this.selectedIndex = this.filteredItems.indexOf(item);
    const statusSelectionEl = document.getElementById('vwsq-status-selection');
    const statusSelectedInfoEl = document.getElementById('vwsq-status-selected-info');
    if (statusSelectionEl && statusSelectedInfoEl && !item.isParent) {
      statusSelectionEl.style.display = 'flex';
      statusSelectedInfoEl.textContent = `Selected: ${item.name} (${item.sizeFormatted})`;
    }

    if (item.isDirectory) {
      if (this.isNativeMode) {
        this.loadNativeFolder(item.path || item.url);
        return;
      }

      if (this.vfs.allFilesCount > 0) {
        this.navigateVfs(item.targetPath || '');
        return;
      }

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

      this.loadFolder(item.url);
    } else {
      this.previewModal.open(item, this.filteredItems);
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
            if (this.vfs.allFilesCount > 0) {
              this.navigateVfs(item.targetPath || '');
            } else if (this.currentDirHandle) {
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
        this.goUp();
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
