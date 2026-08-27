/**
 * Toolbar Action Popup Controller
 */

import { zipperClient } from '../services/pythonZipperClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Zipper status
  zipperClient.init();
  zipperClient.subscribe(({ status, latencyMs }) => {
    const badge = document.getElementById('vwsq-popup-zipper-led');
    const text = document.getElementById('vwsq-popup-zipper-text');
    if (!badge || !text) return;

    if (status === 'online') {
      badge.className = 'vwsq-badge vwsq-badge--online';
      badge.querySelector('.vwsq-led').className = 'vwsq-led vwsq-led--online vwsq-led--live';
      text.textContent = latencyMs ? `ZIPPER ${latencyMs}ms` : 'ONLINE';
    } else {
      badge.className = 'vwsq-badge vwsq-badge--alert';
      badge.querySelector('.vwsq-led').className = 'vwsq-led vwsq-led--alert';
      text.textContent = 'OFFLINE';
    }
  });

  // Open drive/location buttons
  document.querySelectorAll('.vwsq-popup-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (typeof browser !== 'undefined' && browser.tabs) {
        browser.tabs.create({ url });
      } else if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
      window.close();
    });
  });

  // Open or focus full file manager tab
  const openManagerBtn = document.getElementById('vwsq-popup-open-manager');
  if (openManagerBtn) {
    openManagerBtn.addEventListener('click', async () => {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        try {
          await browser.runtime.sendMessage({ action: 'openManager' });
          window.close();
          return;
        } catch (e) {}
      }
      
      let url = 'src/app/manager.html';
      if (typeof browser !== 'undefined' && browser.runtime) {
        url = browser.runtime.getURL('src/app/manager.html');
        browser.tabs.create({ url });
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        url = chrome.runtime.getURL('src/app/manager.html');
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
      window.close();
    });
  }

  // Open settings
  const settingsBtn = document.getElementById('vwsq-popup-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.openOptionsPage) {
        browser.runtime.openOptionsPage();
      } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open('../options/options.html', '_blank');
      }
      window.close();
    });
  }
});
