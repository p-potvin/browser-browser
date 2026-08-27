/**
 * Background Service Worker / Script for browser-browser
 */

// Global navigation & tab management message handlers
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'navigate') {
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
      return true; // Keep asynchronous message channel open
    }

    if (message && message.action === 'openTab') {
      browser.tabs.create({ url: message.url })
        .then(() => sendResponse({ success: true }))
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
        const url = browser.runtime.getURL('src/app/manager.html');
        browser.tabs.create({ url });
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
