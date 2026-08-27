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
      
      if (targetTabId !== undefined) {
        browser.tabs.update(targetTabId, { url: message.url })
          .then(() => sendResponse({ success: true }))
          .catch(err => {
            console.error('Failed to update tab URL:', err);
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
            console.error('Failed to update active tab:', err);
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

    if (message.action === 'fetchDirectory') {
      fetch(message.url)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then(html => sendResponse({ success: true, html }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
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

        browser.contextMenus.create({
          id: 'vwsq-send-zipper',
          title: 'Send Link to Python-Zipper',
          contexts: ['link', 'image', 'video', 'audio']
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
      } else if (info.menuItemId === 'vwsq-send-zipper') {
        const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl;
        if (targetUrl) {
          fetch('http://127.0.0.1:5171/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, links: [targetUrl], batch_size: 100 })
          }).catch(err => console.error('Failed to send to zipper:', err));
        }
      }
    });
  }
}
