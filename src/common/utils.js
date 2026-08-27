/**
 * Utility functions for browser-browser
 */

/**
 * Format bytes into human-readable string
 * @param {number|string} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || bytes === '' || isNaN(Number(bytes))) {
    return '--';
  }
  const b = Number(bytes);
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)) + ' ' + sizes[i];
}

/**
 * Format a Date or date string to DDD, dd MMM YYYY HH:mm
 * @param {Date|string|number} dateInput 
 * @returns {string}
 */
export function formatDate(dateInput) {
  if (!dateInput) return '--';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${dayName}, ${day} ${monthName} ${year} ${hours}:${minutes}`;
}

/**
 * Determine file category by extension
 * @param {string} filename 
 * @param {boolean} isDirectory 
 * @returns {string}
 */
export function getFileTypeCategory(filename, isDirectory = false) {
  if (isDirectory) return 'directory';
  const ext = (filename.split('.').pop() || '').toLowerCase();
  
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif', 'tiff'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'flv', 'm4v'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'].includes(ext)) {
    return 'audio';
  }
  if (['md', 'markdown', 'mdx', 'mdown'].includes(ext)) {
    return 'markdown';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['json', 'json5', 'jsonc', 'geojson'].includes(ext)) {
    return 'json';
  }
  if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'iso', 'zst'].includes(ext)) {
    return 'archive';
  }
  if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'pyw', 'rs', 'go', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'c', 'cpp', 'h', 'hpp', 'java', 'kt', 'cs', 'php', 'rb', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'yaml', 'yml', 'toml', 'ini', 'sql', 'xml', 'dockerfile', 'lua', 'zig', 'graphql', 'env'].includes(ext)) {
    return 'code';
  }
  if (['txt', 'log', 'csv', 'tsv', 'rst', 'conf', 'cfg'].includes(ext)) {
    return 'text';
  }
  return 'file';
}

/**
 * Split a file URL or path into breadcrumb items
 * @param {string} rawUrl 
 * @returns {Array<{name: string, url: string, isLast: boolean}>}
 */
export function parsePathBreadcrumbs(rawUrl) {
  try {
    let clean = rawUrl;
    if (clean.startsWith('file:///')) {
      clean = clean.slice(8);
    } else if (clean.startsWith('file://')) {
      clean = clean.slice(7);
    }

    // Handle Windows drive like C:/
    const parts = clean.split('/').filter(Boolean);
    const breadcrumbs = [];

    // Root element
    let accumulated = 'file:///';
    breadcrumbs.push({
      name: 'file:///',
      url: 'file:///',
      isLast: parts.length === 0
    });

    parts.forEach((part, index) => {
      accumulated += part + '/';
      const isLast = index === parts.length - 1;
      // Decode URI component for display
      let displayName = part;
      try {
        displayName = decodeURIComponent(part);
      } catch (e) {
        displayName = part;
      }

      breadcrumbs.push({
        name: displayName,
        url: accumulated,
        isLast
      });
    });

    return breadcrumbs;
  } catch (err) {
    return [{ name: rawUrl, url: rawUrl, isLast: true }];
  }
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Display a floating toast message in the UI
 * @param {string} message 
 * @param {string} type 'info' | 'success' | 'warning' | 'error'
 * @param {number} durationMs 
 */
export function showToast(message, type = 'info', durationMs = 3000) {
  let container = document.getElementById('vwsq-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'vwsq-toast-container';
    container.className = 'vwsq-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'vwsq-toast';
  
  let ledClass = 'vwsq-led--online';
  if (type === 'error') ledClass = 'vwsq-led--alert';
  if (type === 'warning') ledClass = 'vwsq-led--warning';
  if (type === 'sync') ledClass = 'vwsq-led--sync';

  toast.innerHTML = `
    <span class="vwsq-led ${ledClass}"></span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 220);
  }, durationMs);
}

/**
 * Copy text to clipboard
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Safely navigate current tab or create new tab for local file:/// and extension URLs
 * Works across content scripts, extension pages, and standard web pages.
 * @param {string} url 
 * @param {Object} options 
 * @param {boolean} [options.inNewTab=false] 
 */
export async function navigateTo(url, options = {}) {
  const { inNewTab = false } = options;

  if (inNewTab) {
    if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.create) {
      try {
        await browser.tabs.create({ url });
        return;
      } catch (e) {}
    }
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        await browser.runtime.sendMessage({ action: 'openTab', url });
        return;
      } catch (e) {}
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openTab', url });
      return;
    }
    window.open(url, '_blank');
    return;
  }

  // Same tab navigation via WebExtension Background API
  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
    try {
      const response = await browser.runtime.sendMessage({ action: 'navigate', url });
      if (response && response.success) return;
    } catch (e) {
      // Fallback
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage({ action: 'navigate', url }, (res) => {
        if (chrome.runtime.lastError) {
          window.location.href = url;
        }
      });
      return;
    } catch (e) {}
  }

  // Fallback: create temporary hidden anchor with native click or assign window.location
  try {
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  } catch (err) {
    window.location.href = url;
  }
}

if (typeof window !== 'undefined') {
  window.navigateTo = navigateTo;
}


