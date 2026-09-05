/**
 * Background Service Worker / Script for browser-browser
 */

/**
 * Open dedicated manager tab or focus the most recently used existing one
 */
async function openOrFocusManager(pathParam = '') {
  if (typeof browser === 'undefined' || !browser.tabs) return;

  try {
    const managerUrlBase = browser.runtime.getURL('src/app/manager.html');
    const tabs = await browser.tabs.query({});
    
    // Find open manager tabs
    const managerTabs = tabs.filter(t => t.url && t.url.startsWith(managerUrlBase));

    if (managerTabs.length > 0) {
      // Pick the last used / highest index tab
      const targetTab = managerTabs[managerTabs.length - 1];
      
      // Update URL if path specified
      if (pathParam) {
        const fullUrl = `${managerUrlBase}?path=${encodeURIComponent(pathParam)}`;
        await browser.tabs.update(targetTab.id, { active: true, url: fullUrl });
      } else {
        await browser.tabs.update(targetTab.id, { active: true });
      }

      if (targetTab.windowId && browser.windows) {
        await browser.windows.update(targetTab.windowId, { focused: true });
      }
      return targetTab;
    } else {
      // Create new manager tab
      const fullUrl = pathParam ? `${managerUrlBase}?path=${encodeURIComponent(pathParam)}` : managerUrlBase;
      return await browser.tabs.create({ url: fullUrl });
    }
  } catch (err) {
    console.error('Failed to open or focus manager:', err);
  }
}

// Global navigation, directory fetch, & tab management message handlers
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;

    if (message.action === 'navigate') {
      const targetTabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : undefined;
      
      // In Firefox, browser.tabs.update throws 'Illegal URL' on file:/// URLs from background scripts.
      // If the target is already a content script or page, it should use native DOM navigation.
      if (message.url && message.url.startsWith('file://')) {
        sendResponse({ success: false, reason: 'file_url_direct_nav_required' });
        return true;
      }

      if (targetTabId !== undefined) {
        browser.tabs.update(targetTabId, { url: message.url })
          .then(() => sendResponse({ success: true }))
          .catch(err => {
            sendResponse({ success: false, error: err.message });
          });
      } else {
        browser.tabs.query({ active: true, currentWindow: true })
          .then(tabs => {
            if (tabs && tabs.length > 0) {
              return browser.tabs.update(tabs[0].id, { url: message.url });
            } else {
              return browser.tabs.create({ url: message.url });
            }
          })
          .then(() => sendResponse({ success: true }))
          .catch(err => {
            sendResponse({ success: false, error: err.message });
          });
      }
      return true;
    }

    if (message.action === 'openTab') {
      browser.tabs.create({ url: message.url })
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'openManager') {
      openOrFocusManager(message.path || '')
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // Native Messaging Host Handlers
    if (message.action === 'nativePing') {
      callNativeHost({ action: 'ping', id: Date.now() })
        .then(resp => sendResponse(resp))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'nativeGetDrives') {
      callNativeHost({ action: 'get_drives', id: Date.now() })
        .then(resp => sendResponse(resp))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'nativeListDir') {
      callNativeHost({ action: 'list_dir', path: message.path || '', id: Date.now() })
        .then(resp => sendResponse(resp))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'nativeOpenFile') {
      callNativeHost({ action: 'open_file', path: message.path || '', id: Date.now() })
        .then(resp => sendResponse(resp))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'nativeReveal') {
      callNativeHost({ action: 'reveal', path: message.path || '', id: Date.now() })
        .then(resp => sendResponse(resp))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'nativeSearch') {
      callNativeHost({ action: 'search', query: message.query || '', maxResults: message.maxResults || 100, id: Date.now() })
        .then(resp => sendResponse(resp))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
}

/**
 * Persistent Native Messaging Connection Management
 */
let nativePort = null;
const pendingNativeRequests = new Map(); // id -> { resolve, reject, timer }
let nextNativeMsgId = 1;

function getNativePort() {
  if (nativePort) return nativePort;
  if (typeof browser === 'undefined' || !browser.runtime || !browser.runtime.connectNative) {
    return null;
  }

  try {
    const port = browser.runtime.connectNative('browser_browser_host');
    nativePort = port;

    port.onMessage.addListener((msg) => {
      if (msg && msg.id !== undefined && pendingNativeRequests.has(msg.id)) {
        const req = pendingNativeRequests.get(msg.id);
        clearTimeout(req.timer);
        pendingNativeRequests.delete(msg.id);
        req.resolve(msg);
      }
    });

    port.onDisconnect.addListener((p) => {
      const err = p && p.error ? p.error.message : 'Native host disconnected';
      console.warn('[browser-browser] Native host port disconnected:', err);
      nativePort = null;
      for (const [id, req] of pendingNativeRequests) {
        clearTimeout(req.timer);
        req.reject(new Error(err));
      }
      pendingNativeRequests.clear();
    });

    return nativePort;
  } catch (err) {
    console.warn('[browser-browser] connectNative error:', err);
    nativePort = null;
    return null;
  }
}

/**
 * Send request to C++ Native Messaging Host (browser_browser_host)
 * Uses persistent connectNative port to keep HTTP server alive continuously,
 * falling back to sendNativeMessage if connectNative fails.
 */
async function callNativeHost(msg) {
  const port = getNativePort();
  if (port) {
    return new Promise((resolve, reject) => {
      const id = ++nextNativeMsgId;
      msg.id = id;

      const timer = setTimeout(() => {
        if (pendingNativeRequests.has(id)) {
          pendingNativeRequests.delete(id);
          reject(new Error('Native message timeout'));
        }
      }, 15000);

      pendingNativeRequests.set(id, { resolve, reject, timer });
      try {
        port.postMessage(msg);
      } catch (err) {
        clearTimeout(timer);
        pendingNativeRequests.delete(id);
        nativePort = null;
        reject(err);
      }
    });
  }

  // Fallback if connectNative is unsupported
  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendNativeMessage) {
    try {
      const response = await browser.runtime.sendNativeMessage('browser_browser_host', msg);
      return response;
    } catch (err) {
      console.warn('[browser-browser] sendNativeMessage fallback error:', err);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Native messaging not available' };
}

// Install / Startup Handler
if (typeof browser !== 'undefined' && browser.runtime) {
  browser.runtime.onInstalled.addListener(() => {
    console.log('[browser-browser] Extension initialized');

    // Create Context Menus
    if (browser.contextMenus) {
      try {
        browser.contextMenus.create({
          id: 'vwsq-open-manager',
          title: 'Open in browser² Manager',
          contexts: ['all']
        });
      } catch (e) {
        console.warn('Context menu creation note:', e);
      }
    }
  });

  // Handle Context Menu clicks
  if (browser.contextMenus && browser.contextMenus.onClicked) {
    browser.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'vwsq-open-manager') {
        const targetPath = tab && tab.url && tab.url.startsWith('file://') ? tab.url : '';
        openOrFocusManager(targetPath);
      }
    });
  }
}
