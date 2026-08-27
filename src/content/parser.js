/**
 * Parser for Firefox's native directory listing pages (file:///)
 */

import { getFileTypeCategory } from '../common/utils.js';

export class FirefoxDirectoryParser {
  /**
   * Check if current document is a Firefox native directory listing
   * @returns {boolean}
   */
  static isDirectoryListing() {
    if (!window.location.href.startsWith('file://')) return false;

    // Check title or heading containing "Index of"
    const title = document.title || '';
    if (title.toLowerCase().startsWith('index of') || title.toLowerCase().includes('directory listing')) {
      return true;
    }

    // Check for native table structure
    if (document.querySelector('table#UI_rendered_table') || document.querySelector('table.dir') || document.querySelector('table')) {
      // If table contains links with relative or file:// paths
      const firstLink = document.querySelector('table a');
      if (firstLink && (firstLink.classList.contains('dir') || firstLink.classList.contains('file') || firstLink.href.startsWith('file://'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse directory information and items from the page
   */
  static parse() {
    const currentUrl = window.location.href;
    let path = currentUrl;
    
    // Extract heading or title
    const heading = document.querySelector('h1')?.textContent || document.title || '';
    let dirName = 'Directory';
    if (heading.includes('Index of')) {
      dirName = heading.replace(/Index of\s*/i, '').trim();
    } else {
      const parts = currentUrl.replace(/file:\/\/\/?/, '').split('/').filter(Boolean);
      dirName = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : 'Root';
    }

    const items = [];
    const table = document.querySelector('table#UI_rendered_table') || document.querySelector('table');

    if (table) {
      const rows = table.querySelectorAll('tr');
      rows.forEach((row) => {
        // Skip header rows
        if (row.querySelector('th') || row.classList.contains('header')) return;

        const link = row.querySelector('a');
        if (!link) return;

        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        const fullUrl = new URL(href, currentUrl).href;

        // Parent directory link detection
        const isParent = text === 'Up to higher level directory' || 
                         text === 'Parent Directory' || 
                         text === '..' || 
                         link.classList.contains('up') || 
                         link.classList.contains('parent');

        const isDir = isParent || link.classList.contains('dir') || href.endsWith('/') || link.getAttribute('type') === 'DIRECTORY';

        // Extract cells (Name, Size, Date Modified)
        const cells = Array.from(row.querySelectorAll('td'));
        let sizeFormatted = '';
        let dateModified = '';

        if (cells.length >= 2) {
          // Firefox native layout usually: [Icon/Name, Size, Last Modified]
          for (let i = 1; i < cells.length; i++) {
            const cellText = cells[i].textContent.trim();
            if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(cellText) || /AM|PM|\d{1,2}:\d{2}/.test(cellText)) {
              dateModified = cellText;
            } else if (/\d+\s*(B|KB|MB|GB|TB|bytes)/i.test(cellText) || /^\d+$/.test(cellText)) {
              sizeFormatted = cellText;
            }
          }
        }

        let name = isParent ? '..' : text;
        try {
          name = isParent ? '..' : decodeURIComponent(text);
        } catch (e) {
          name = text;
        }

        const ext = isDir ? '' : (name.split('.').pop() || '').toLowerCase();
        const category = getFileTypeCategory(name, isDir);

        items.push({
          name,
          url: fullUrl,
          isDirectory: isDir,
          isParent,
          sizeFormatted: isDir ? '--' : (sizeFormatted || '--'),
          dateModified: dateModified || '--',
          extension: ext,
          category
        });
      });
    } else {
      // Fallback: parse all anchor links on page
      const links = document.querySelectorAll('a');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const text = link.textContent.trim();
        const fullUrl = new URL(href, currentUrl).href;
        const isParent = text === '..' || text.includes('Parent');
        const isDir = isParent || href.endsWith('/');
        const name = isParent ? '..' : text;

        items.push({
          name,
          url: fullUrl,
          isDirectory: isDir,
          isParent,
          sizeFormatted: '--',
          dateModified: '--',
          extension: isDir ? '' : (name.split('.').pop() || '').toLowerCase(),
          category: getFileTypeCategory(name, isDir)
        });
      });
    }

    return {
      currentUrl,
      dirName,
      items
    };
  }

  /**
   * Parse directory HTML string (from fetch or background service) into structured items
   * @param {string} htmlText 
   * @param {string} currentUrl 
   * @returns {{ currentUrl: string, dirName: string, items: Array<Object> }}
   */
  static parseHtml(htmlText, currentUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    let dirName = 'Directory';
    const heading = doc.querySelector('h1')?.textContent || doc.title || '';
    if (heading.includes('Index of')) {
      dirName = heading.replace(/Index of\s*/i, '').trim();
    } else {
      const parts = currentUrl.replace(/file:\/\/\/?/, '').split('/').filter(Boolean);
      dirName = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : 'Root';
    }

    const items = [];
    const table = doc.querySelector('table#UI_rendered_table') || doc.querySelector('table.dir') || doc.querySelector('table');

    if (table) {
      const rows = table.querySelectorAll('tr');
      rows.forEach((row) => {
        if (row.querySelector('th') || row.classList.contains('header')) return;

        const link = row.querySelector('a');
        if (!link) return;

        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        let fullUrl = href;
        try {
          fullUrl = new URL(href, currentUrl).href;
        } catch (e) {
          fullUrl = `${currentUrl.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`;
        }

        const isParent = text === 'Up to higher level directory' || 
                         text === 'Parent Directory' || 
                         text === '..' || 
                         link.classList.contains('up') || 
                         link.classList.contains('parent');

        const isDir = isParent || link.classList.contains('dir') || href.endsWith('/') || link.getAttribute('type') === 'DIRECTORY';

        const cells = Array.from(row.querySelectorAll('td'));
        let sizeFormatted = '';
        let dateModified = '';

        if (cells.length >= 2) {
          for (let i = 1; i < cells.length; i++) {
            const cellText = cells[i].textContent.trim();
            if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(cellText) || /AM|PM|\d{1,2}:\d{2}/.test(cellText)) {
              dateModified = cellText;
            } else if (/\d+\s*(B|KB|MB|GB|TB|bytes)/i.test(cellText) || /^\d+$/.test(cellText)) {
              sizeFormatted = cellText;
            }
          }
        }

        let name = isParent ? '..' : text;
        try {
          name = isParent ? '..' : decodeURIComponent(text);
        } catch (e) {
          name = text;
        }

        const ext = isDir ? '' : (name.split('.').pop() || '').toLowerCase();
        const category = getFileTypeCategory(name, isDir);

        items.push({
          name,
          url: fullUrl,
          isDirectory: isDir,
          isParent,
          sizeFormatted: isDir ? '--' : (sizeFormatted || '--'),
          dateModified: dateModified || '--',
          extension: ext,
          category
        });
      });
    } else {
      const links = doc.querySelectorAll('a');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const text = link.textContent.trim();
        let fullUrl = href;
        try {
          fullUrl = new URL(href, currentUrl).href;
        } catch (e) {
          fullUrl = `${currentUrl.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`;
        }
        const isParent = text === '..' || text.includes('Parent');
        const isDir = isParent || href.endsWith('/');
        const name = isParent ? '..' : text;

        items.push({
          name,
          url: fullUrl,
          isDirectory: isDir,
          isParent,
          sizeFormatted: '--',
          dateModified: '--',
          extension: isDir ? '' : (name.split('.').pop() || '').toLowerCase(),
          category: getFileTypeCategory(name, isDir)
        });
      });
    }

    return {
      currentUrl,
      dirName,
      items
    };
  }
}

