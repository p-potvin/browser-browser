/**
 * File Properties & Sidecar Inspector Modal Component
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, copyToClipboard, showToast } from '../../common/utils.js';
import { CodeViewer } from './codeViewer.js';

export class PropertiesModal {
  constructor() {
    this.modalEl = null;
    this.item = null;
    this.activeSidecarIndex = 0;
  }

  /**
   * Open the properties modal
   * @param {Object} item 
   */
  async open(item) {
    this.item = item;
    this.activeSidecarIndex = 0;
    this.render();
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
      this.item = null;
    }
  }

  isOpen() {
    return !!this.modalEl;
  }

  async render() {
    if (this.modalEl) {
      this.modalEl.remove();
    }

    const item = this.item;
    if (!item) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'vwsq-modal-backdrop';
    backdrop.id = 'vwsq-properties-modal';

    const modal = document.createElement('div');
    modal.className = 'vwsq-modal';
    modal.style.maxWidth = '680px';
    modal.style.width = '90%';

    const sidecars = item.sidecars || [];
    const hasSidecars = sidecars.length > 0;

    // Header
    const header = document.createElement('div');
    header.className = 'vwsq-modal-header';
    header.innerHTML = `
      <div class="vwsq-modal-title" style="min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; overflow: hidden;">
        <div style="width: 24px; height: 24px; display: flex; align-items: center; flex-shrink: 0;">${getFileIcon(item.name, item.isDirectory)}</div>
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 600;">
          ${escapeHtml(item.name)}
        </div>
        <span class="vwsq-badge vwsq-badge--iris" style="flex-shrink: 0;">PROPERTIES</span>
      </div>
      <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-close-btn" style="padding: 6px;" title="Close (Escape)">
        <div style="width: 16px; height: 16px;">${ICONS.close}</div>
      </button>
    `;

    // Tabs
    const tabsBar = document.createElement('div');
    tabsBar.style.display = 'flex';
    tabsBar.style.gap = '8px';
    tabsBar.style.padding = '12px 24px 0';
    tabsBar.style.borderBottom = '1px solid var(--vwsq-console-border, rgba(255,255,255,0.06))';

    tabsBar.innerHTML = `
      <button class="vwsq-btn vwsq-btn--sm vwsq-prop-tab active" data-tab="general" style="border-radius: 6px 6px 0 0;">
        General Details
      </button>
      ${hasSidecars ? `
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-prop-tab" data-tab="sidecars" style="border-radius: 6px 6px 0 0;">
          Sidecars & Info (${sidecars.length})
        </button>
      ` : ''}
    `;

    // Body Container
    const body = document.createElement('div');
    body.className = 'vwsq-modal-body';
    body.style.padding = '20px 24px';
    body.style.maxHeight = '65vh';
    body.style.overflowY = 'auto';

    // General Panel HTML
    const renderGeneralPanel = () => `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: baseline;">
          <span style="color: var(--vwsq-console-text-dim);">Location:</span>
          <span style="font-family: var(--vwsq-font-mono); font-size: 12px; word-break: break-all; color: var(--vwsq-console-text-bright);">${escapeHtml(item.path || item.url || '--')}</span>
        </div>

        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: baseline;">
          <span style="color: var(--vwsq-console-text-dim);">Item Type:</span>
          <span>${escapeHtml(item.isDirectory ? 'Directory Folder' : (item.category ? item.category.toUpperCase() + ' file' : 'File'))} (${escapeHtml(item.extension ? '.' + item.extension : '--')})</span>
        </div>

        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: baseline;">
          <span style="color: var(--vwsq-console-text-dim);">Size:</span>
          <span><strong>${escapeHtml(item.sizeFormatted || '--')}</strong> ${item.size > 0 ? `<span style="color: var(--vwsq-console-text-dim); font-size: 12px;">(${item.size.toLocaleString()} bytes)</span>` : ''}</span>
        </div>

        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: baseline;">
          <span style="color: var(--vwsq-console-text-dim);">Modified:</span>
          <span>${escapeHtml(item.dateModified || '--')}</span>
        </div>

        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: baseline;">
          <span style="color: var(--vwsq-console-text-dim);">Created:</span>
          <span>${escapeHtml(item.dateCreated || '--')}</span>
        </div>

        ${hasSidecars ? `
          <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: baseline;">
            <span style="color: var(--vwsq-console-text-dim);">Detected Sidecars:</span>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${sidecars.map(sc => `<span class="vwsq-badge vwsq-badge--online">${escapeHtml(sc.name)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${item.streamUrl ? `
          <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: baseline;">
            <span style="color: var(--vwsq-console-text-dim);">Stream Endpoint:</span>
            <span style="font-family: var(--vwsq-font-mono); font-size: 11px; color: var(--vwsq-console-text-dim); word-break: break-all;">${escapeHtml(item.streamUrl)}</span>
          </div>
        ` : ''}
      </div>
    `;

    // Sidecars Panel HTML
    const renderSidecarsPanel = async () => {
      const activeSc = sidecars[this.activeSidecarIndex] || sidecars[0];
      if (!activeSc) {
        body.innerHTML = `<div style="color: var(--vwsq-console-text-dim); padding: 20px; text-align: center;">No sidecars associated with this item.</div>`;
        return;
      }

      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Sidecar Switcher Tabs -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${sidecars.map((sc, idx) => `
              <button class="vwsq-btn vwsq-btn--sm ${idx === this.activeSidecarIndex ? 'vwsq-btn--primary' : 'vwsq-btn--ghost'} vwsq-sc-btn" data-scindex="${idx}">
                ${escapeHtml(sc.name)}
              </button>
            `).join('')}
          </div>

          <!-- Loading state -->
          <div id="vwsq-sc-content-area" style="background: var(--vwsq-console-bg, rgba(0,0,0,0.4)); border-radius: 8px; padding: 14px; border: 1px solid var(--vwsq-console-border, rgba(255,255,255,0.06)); font-family: var(--vwsq-font-mono); font-size: 12px; max-height: 45vh; overflow: auto; white-space: pre-wrap; word-break: break-word;">
            Loading sidecar data...
          </div>
        </div>
      `;

      // Load sidecar text content
      const contentArea = body.querySelector('#vwsq-sc-content-area');
      try {
        const resp = await fetch(activeSc.streamUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();

        if (activeSc.name.endsWith('.json')) {
          try {
            const formatted = JSON.stringify(JSON.parse(text), null, 2);
            contentArea.innerHTML = CodeViewer.highlight(formatted, 'json');
          } catch (e) {
            contentArea.textContent = text;
          }
        } else {
          contentArea.textContent = text;
        }
      } catch (err) {
        if (contentArea) {
          contentArea.innerHTML = `<div style="color: var(--vwsq-signal-error);">Failed to read sidecar: ${escapeHtml(err.message)}</div>`;
        }
      }

      // Attach sidecar switchers
      body.querySelectorAll('.vwsq-sc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeSidecarIndex = parseInt(btn.dataset.scindex, 10);
          renderSidecarsPanel();
        });
      });
    };

    body.innerHTML = renderGeneralPanel();

    // Footer
    const footer = document.createElement('div');
    footer.className = 'vwsq-modal-footer';
    footer.innerHTML = `
      <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-prop-copy-btn">
        <div style="width: 14px; height: 14px;">${ICONS.copy}</div>
        <span>Copy Path</span>
      </button>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--ghost vwsq-prop-reveal-btn">
          <span>Reveal in Explorer</span>
        </button>
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn--primary vwsq-prop-open-btn">
          <span>Open in Default App</span>
        </button>
      </div>
    `;

    modal.appendChild(header);
    modal.appendChild(tabsBar);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.modalEl = backdrop;

    // Listeners
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });
    header.querySelector('.vwsq-modal-close-btn').addEventListener('click', () => this.close());

    // Tab switching
    tabsBar.querySelectorAll('.vwsq-prop-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        tabsBar.querySelectorAll('.vwsq-prop-tab').forEach(b => {
          b.classList.remove('active');
          b.classList.add('vwsq-btn--ghost');
        });
        tabBtn.classList.add('active');
        tabBtn.classList.remove('vwsq-btn--ghost');

        if (tabBtn.dataset.tab === 'general') {
          body.innerHTML = renderGeneralPanel();
        } else {
          renderSidecarsPanel();
        }
      });
    });

    // Copy Path
    footer.querySelector('.vwsq-prop-copy-btn').addEventListener('click', async () => {
      const ok = await copyToClipboard(item.path || item.url);
      if (ok) showToast('Path copied to clipboard', 'success');
    });

    // Reveal in Explorer
    footer.querySelector('.vwsq-prop-reveal-btn').addEventListener('click', async () => {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        await browser.runtime.sendMessage({ action: 'nativeReveal', path: item.path || item.url });
      }
    });

    // Open in Default App
    footer.querySelector('.vwsq-prop-open-btn').addEventListener('click', async () => {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        await browser.runtime.sendMessage({ action: 'nativeOpenFile', path: item.path || item.url });
      }
    });
  }
}
