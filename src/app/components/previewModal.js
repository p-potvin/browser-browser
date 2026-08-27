/**
 * Quick Look & Multi-Format Inspector Modal
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, formatBytes, copyToClipboard, showToast } from '../../common/utils.js';
import { CodeViewer } from './codeViewer.js';
import { MarkdownViewer } from './markdownViewer.js';
import { AudioPlayerComponent } from './audioPlayer.js';
import { zipperClient } from '../../services/pythonZipperClient.js';

export class PreviewModal {
  constructor() {
    this.activeItem = null;
    this.items = [];
    this.currentIndex = -1;
    this.modalEl = null;
  }

  /**
   * Open the preview modal for a given file item
   * @param {Object} item 
   * @param {Array<Object>} allItems 
   */
  async open(item, allItems = []) {
    this.items = allItems.filter(i => !i.isDirectory && !i.isParent);
    this.currentIndex = this.items.findIndex(i => i.url === item.url);
    this.activeItem = item;

    this.render();
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
      this.activeItem = null;
    }
  }

  isOpen() {
    return !!this.modalEl;
  }

  async next() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this.activeItem = this.items[this.currentIndex];
      this.render();
    }
  }

  async prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.activeItem = this.items[this.currentIndex];
      this.render();
    }
  }

  async render() {
    if (this.modalEl) {
      this.modalEl.remove();
    }

    const item = this.activeItem;
    if (!item) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'vwsq-modal-backdrop';
    backdrop.id = 'vwsq-preview-modal';

    const modal = document.createElement('div');
    modal.className = 'vwsq-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'vwsq-modal-header';
    header.innerHTML = `
      <div class="vwsq-modal-title">
        <div style="width: 22px; height: 22px; display: flex; align-items: center;">${getFileIcon(item.name, item.isDirectory)}</div>
        <span>${escapeHtml(item.name)}</span>
        <span class="vwsq-badge vwsq-badge--iris">${escapeHtml(item.extension ? item.extension.toUpperCase() : 'FILE')}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-prev-btn" title="Previous item" ${this.currentIndex <= 0 ? 'disabled style="opacity: 0.3;"' : ''}>←</button>
        <span style="font-size: 11px; font-family: var(--vwsq-font-mono); color: var(--vwsq-console-text-dim);">${this.currentIndex + 1} / ${this.items.length || 1}</span>
        <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-next-btn" title="Next item" ${this.currentIndex >= this.items.length - 1 ? 'disabled style="opacity: 0.3;"' : ''}>→</button>
        <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-close-btn" style="padding: 6px;">
          <div style="width: 16px; height: 16px;">${ICONS.close}</div>
        </button>
      </div>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'vwsq-modal-body';
    body.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; color: var(--vwsq-console-text-dim);"><span class="vwsq-led vwsq-led--sync vwsq-led--live"></span> Loading preview...</div>`;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'vwsq-modal-footer';
    footer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; font-family: var(--vwsq-font-mono); color: var(--vwsq-console-text-dim);">
        <span>Size: ${escapeHtml(item.sizeFormatted || '--')}</span>
        <span>•</span>
        <span>Modified: ${escapeHtml(item.dateModified || '--')}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn-copy-path">
          <div style="width: 14px; height: 14px;">${ICONS.copy}</div>
          <span>Copy Path</span>
        </button>
        <button class="vwsq-btn vwsq-btn--sm vwsq-btn-send-zipper" title="Send to Python-Zipper">
          <div style="width: 14px; height: 14px;">${ICONS.zipper}</div>
          <span>Send to Zipper</span>
        </button>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="vwsq-btn vwsq-btn--sm vwsq-btn--primary">
          <div style="width: 14px; height: 14px;">${ICONS.external}</div>
          <span>Open Full</span>
        </a>
      </div>
    `;

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.modalEl = backdrop;

    // Attach listeners
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });
    header.querySelector('.vwsq-modal-close-btn').addEventListener('click', () => this.close());

    const prevBtn = header.querySelector('.vwsq-modal-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prev());

    const nextBtn = header.querySelector('.vwsq-modal-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => this.next());

    footer.querySelector('.vwsq-btn-copy-path').addEventListener('click', async () => {
      const ok = await copyToClipboard(item.url);
      if (ok) showToast('File path copied to clipboard', 'success');
    });

    footer.querySelector('.vwsq-btn-send-zipper').addEventListener('click', async () => {
      try {
        await zipperClient.queueDownload(item.url, [item.url]);
        showToast('Sent to Python-Zipper queue', 'success');
      } catch (err) {
        showToast('Failed to connect to Python-Zipper', 'error');
      }
    });

    // Render file content into body based on category
    this.loadContent(item, body);
  }

  async loadContent(item, bodyEl) {
    const cat = item.category;

    if (cat === 'image') {
      bodyEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}" class="vwsq-preview-image" />
          <span class="vwsq-badge vwsq-badge--online">High-Resolution Image Preview</span>
        </div>
      `;
      return;
    }

    if (cat === 'video') {
      bodyEl.innerHTML = `
        <video src="${escapeHtml(item.url)}" controls autoplay class="vwsq-preview-video"></video>
      `;
      return;
    }

    if (cat === 'audio') {
      bodyEl.innerHTML = '';
      const player = AudioPlayerComponent.create(item.url, item.name);
      bodyEl.appendChild(player);
      return;
    }

    if (cat === 'pdf') {
      bodyEl.innerHTML = `
        <iframe src="${escapeHtml(item.url)}" style="width: 100%; height: 60vh; border: none; border-radius: 12px;"></iframe>
      `;
      return;
    }

    // Text, Markdown, JSON, Code fetch
    try {
      const resp = await fetch(item.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();

      if (cat === 'markdown') {
        bodyEl.innerHTML = `<div class="vwsq-preview-markdown">${MarkdownViewer.render(text)}</div>`;
      } else if (cat === 'json') {
        let formatted = text;
        try {
          formatted = JSON.stringify(JSON.parse(text), null, 2);
        } catch (e) {}
        bodyEl.innerHTML = `<div class="vwsq-preview-code">${CodeViewer.highlight(formatted, 'json')}</div>`;
      } else if (cat === 'code' || cat === 'text') {
        bodyEl.innerHTML = `<div class="vwsq-preview-code">${CodeViewer.highlight(text, item.extension)}</div>`;
      } else {
        bodyEl.innerHTML = `<div class="vwsq-preview-code">${CodeViewer.highlight(text, 'text')}</div>`;
      }
    } catch (err) {
      bodyEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; color: var(--vwsq-console-text-dim);">
          <div style="width: 64px; height: 64px;">${getFileIcon(item.name)}</div>
          <div>
            <div style="font-weight: 600; font-size: 15px; color: var(--vwsq-console-text-bright);">${escapeHtml(item.name)}</div>
            <div style="font-size: 12px; margin-top: 4px;">Direct preview unavailable or binary file</div>
          </div>
          <a href="${escapeHtml(item.url)}" download="${escapeHtml(item.name)}" class="vwsq-btn vwsq-btn--primary">
            <div style="width: 16px; height: 16px;">${ICONS.download}</div>
            <span>Download File</span>
          </a>
        </div>
      `;
    }
  }
}
