/**
 * Background Service Worker / Script for browser-browser
 */

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
