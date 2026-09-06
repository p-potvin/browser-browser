/**
 * Storage manager for browser-browser
 * Handles bookmarks, pinned directories, recent history, and extension settings.
 */

const DEFAULT_SETTINGS = {
  defaultView: 'grid', // 'grid' | 'table' | 'list'
  showHiddenFiles: true,
  enableQuickLook: true,
  enablePreviewThumbnails: true,
  maxPreviewSizeBytes: 50 * 1024 * 1024, // 50MB
  themeVariant: 'vaultsqware',
  customDrives: ['C:', 'D:', 'E:', 'Z:'],
  folderExclusions: ['.thumbs', '.git', 'node_modules', '$RECYCLE.BIN', 'System Volume Information'],
  fileExclusions: ['*.nfo', '*.vsmeta', '*.json.sidecar', '*.srt', '*.sub', '*.idx'],
  hideSidecars: true,
  sortField: 'name',
  sortAsc: true
};

/**
 * Storage API compatibility layer
 */
function getStorageBackend() {
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    return browser.storage.local;
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return {
      get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
      set: (items) => new Promise((resolve) => chrome.storage.local.set(items, resolve)),
      remove: (keys) => new Promise((resolve) => chrome.storage.local.remove(keys, resolve))
    };
  }
  // LocalStorage fallback
  return {
    get: async (keys) => {
      const result = {};
      if (typeof keys === 'string') keys = [keys];
      if (Array.isArray(keys)) {
        for (const k of keys) {
          const val = localStorage.getItem('vwsq_' + k);
          if (val !== null) {
            try { result[k] = JSON.parse(val); } catch (e) { result[k] = val; }
          }
        }
      }
      return result;
    },
    set: async (items) => {
      for (const [k, v] of Object.entries(items)) {
        localStorage.setItem('vwsq_' + k, JSON.stringify(v));
      }
    },
    remove: async (keys) => {
      if (typeof keys === 'string') keys = [keys];
      for (const k of keys) {
        localStorage.removeItem('vwsq_' + k);
      }
    }
  };
}

const storage = getStorageBackend();

/**
 * Load application settings
 */
export async function getSettings() {
  try {
    const res = await storage.get('settings');
    return { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
  } catch (err) {
    console.error('Error fetching settings:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save application settings
 */
export async function saveSettings(newSettings) {
  try {
    const current = await getSettings();
    const updated = { ...current, ...newSettings };
    await storage.set({ settings: updated });
    return updated;
  } catch (err) {
    console.error('Error saving settings:', err);
    return null;
  }
}

/**
 * Get pinned directory bookmarks
 */
export async function getBookmarks() {
  try {
    const res = await storage.get('bookmarks');
    return res.bookmarks || [
      { name: 'Desktop', url: 'file:///C:/Users/Administrator/Desktop/', icon: 'drive' },
      { name: 'Downloads', url: 'file:///C:/Users/Administrator/Downloads/', icon: 'download' },
      { name: 'Github Repos', url: 'file:///C:/Users/Administrator/Desktop/Github%20Repos/', icon: 'code' }
    ];
  } catch (err) {
    console.error('Error fetching bookmarks:', err);
    return [];
  }
}

/**
 * Add a new bookmark
 */
export async function addBookmark(name, url, icon = 'folder') {
  try {
    const bookmarks = await getBookmarks();
    if (bookmarks.some(b => b.url === url)) return bookmarks;
    bookmarks.push({ name, url, icon, createdAt: Date.now() });
    await storage.set({ bookmarks });
    return bookmarks;
  } catch (err) {
    console.error('Error adding bookmark:', err);
    return [];
  }
}

/**
 * Remove a bookmark by URL
 */
export async function removeBookmark(url) {
  try {
    let bookmarks = await getBookmarks();
    bookmarks = bookmarks.filter(b => b.url !== url);
    await storage.set({ bookmarks });
    return bookmarks;
  } catch (err) {
    console.error('Error removing bookmark:', err);
    return [];
  }
}

/**
 * Check if a directory URL is bookmarked
 */
export async function isBookmarked(url) {
  try {
    const bookmarks = await getBookmarks();
    return bookmarks.some(b => b.url === url);
  } catch (err) {
    return false;
  }
}

/**
 * Get recent directory history
 */
export async function getRecentHistory() {
  try {
    const res = await storage.get('recentHistory');
    return res.recentHistory || [];
  } catch (err) {
    return [];
  }
}

/**
 * Add path to recent directory history
 */
export async function addRecentHistory(url, name) {
  try {
    let history = await getRecentHistory();
    history = history.filter(h => h.url !== url);
    history.unshift({ url, name, timestamp: Date.now() });
    if (history.length > 25) history = history.slice(0, 25);
    await storage.set({ recentHistory: history });
    return history;
  } catch (err) {
    console.error('Error adding recent history:', err);
    return [];
  }
}
