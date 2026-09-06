/**
 * Contextual Right-Click Menu Component
 */

import { ICONS } from '../../common/icons.js';
import { copyToClipboard, showToast } from '../../common/utils.js';

export class ContextMenuComponent {
  constructor(options = {}) {
    this.options = options;
    this.menuEl = null;
    this.activeItem = null;
    this.boundClose = this.close.bind(this);
  }

  /**
   * Open context menu at mouse coordinates
   * @param {MouseEvent} e 
   * @param {Object} item 
   * @param {Object} callbacks 
   */
  open(e, item, callbacks = {}) {
    e.preventDefault();
    e.stopPropagation();

    this.close();
    this.activeItem = item;

    const menu = document.createElement('div');
    menu.className = 'vwsq-context-menu';
    menu.id = 'vwsq-active-context-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '9999';
    menu.style.background = 'var(--vwsq-console-surface, #1e1e2e)';
    menu.style.border = '1px solid var(--vwsq-console-border, rgba(255,255,255,0.1))';
    menu.style.borderRadius = '10px';
    menu.style.boxShadow = '0 12px 32px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3)';
    menu.style.padding = '6px';
    menu.style.minWidth = '210px';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '2px';
    menu.style.backdropFilter = 'blur(16px)';

    const isDir = item.isDirectory;
    const hasSidecars = item.sidecars && item.sidecars.length > 0;

    menu.innerHTML = `
      <div style="padding: 6px 10px 8px; font-size: 11px; font-family: var(--vwsq-font-mono); color: var(--vwsq-console-text-dim); border-bottom: 1px solid var(--vwsq-console-border, rgba(255,255,255,0.06)); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${item.name}
      </div>

      <button class="vwsq-ctx-item" data-action="open" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px; font-size: 13px; color: var(--vwsq-console-text-bright); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left;">
        <div style="width: 15px; height: 15px; opacity: 0.8;">${isDir ? ICONS.folder : ICONS.eye}</div>
        <span>${isDir ? 'Open Folder' : 'Quick Look (Preview)'}</span>
      </button>

      ${!isDir ? `
        <button class="vwsq-ctx-item" data-action="open-default" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px; font-size: 13px; color: var(--vwsq-console-text-bright); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left;">
          <div style="width: 15px; height: 15px; opacity: 0.8;">${ICONS.external}</div>
          <span>Open with Default App</span>
        </button>
      ` : ''}

      <button class="vwsq-ctx-item" data-action="reveal" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px; font-size: 13px; color: var(--vwsq-console-text-bright); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left;">
        <div style="width: 15px; height: 15px; opacity: 0.8;">${ICONS.folder}</div>
        <span>Reveal in File Explorer</span>
      </button>

      <div style="height: 1px; background: var(--vwsq-console-border, rgba(255,255,255,0.06)); margin: 4px 0;"></div>

      <button class="vwsq-ctx-item" data-action="copy-path" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px; font-size: 13px; color: var(--vwsq-console-text-bright); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left;">
        <div style="width: 15px; height: 15px; opacity: 0.8;">${ICONS.copy}</div>
        <span>Copy Full Path</span>
      </button>

      <button class="vwsq-ctx-item" data-action="properties" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px; font-size: 13px; color: var(--vwsq-iris-400, #cba6f7); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left;">
        <div style="width: 15px; height: 15px; opacity: 0.9;">${ICONS.info || ICONS.search}</div>
        <span>Properties ${hasSidecars ? `(${item.sidecars.length} sidecars)` : ''}</span>
      </button>
    `;

    document.body.appendChild(menu);
    this.menuEl = menu;

    // Position menu and ensure it stays within viewport
    const menuWidth = menu.offsetWidth || 210;
    const menuHeight = menu.offsetHeight || 190;
    let left = e.clientX;
    let top = e.clientY;

    if (left + menuWidth > window.innerWidth) {
      left = Math.max(10, window.innerWidth - menuWidth - 12);
    }
    if (top + menuHeight > window.innerHeight) {
      top = Math.max(10, window.innerHeight - menuHeight - 12);
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Hover styling on buttons
    menu.querySelectorAll('.vwsq-ctx-item').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255,255,255,0.08)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });

      btn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const action = btn.dataset.action;
        this.close();

        if (action === 'open') {
          if (callbacks.onOpen) callbacks.onOpen(item);
        } else if (action === 'open-default') {
          if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            await browser.runtime.sendMessage({ action: 'nativeOpenFile', path: item.path || item.url });
          }
        } else if (action === 'reveal') {
          if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            await browser.runtime.sendMessage({ action: 'nativeReveal', path: item.path || item.url });
          }
        } else if (action === 'copy-path') {
          const ok = await copyToClipboard(item.path || item.url);
          if (ok) showToast('Path copied to clipboard', 'success');
        } else if (action === 'properties') {
          if (callbacks.onProperties) callbacks.onProperties(item);
        }
      });
    });

    // Dismiss listeners
    setTimeout(() => {
      document.addEventListener('click', this.boundClose, { once: true });
      document.addEventListener('contextmenu', this.boundClose, { once: true });
      document.addEventListener('keydown', (ke) => {
        if (ke.key === 'Escape') this.close();
      }, { once: true });
    }, 10);
  }

  close() {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
      this.activeItem = null;
    }
  }
}
