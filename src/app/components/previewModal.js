/**
 * Quick Look & Multi-Format Inspector Modal
 * Optimized with explicit media pipeline teardown, memory leak prevention,
 * and chunked preview safety for large text/code files.
 */

import { ICONS, getFileIcon } from '../../common/icons.js';
import { escapeHtml, formatBytes, copyToClipboard, showToast } from '../../common/utils.js';
import { CodeViewer } from './codeViewer.js';
import { MarkdownViewer } from './markdownViewer.js';
import { AudioPlayerComponent } from './audioPlayer.js';

export class PreviewModal {
  constructor(options = {}) {
    this.options = options;
    this.activeItem = null;
    this.items = [];
    this.currentIndex = -1;
    this.modalEl = null;
  }

  /**
   * Release media decoders, PDF iframes, and image buffers
   */
  cleanupMedia() {
    if (!this.modalEl) return;

    this.modalEl.querySelectorAll('video, audio').forEach(media => {
      try {
        media.pause();
        media.removeAttribute('src');
        media.load();
      } catch (e) {}
    });

    this.modalEl.querySelectorAll('iframe').forEach(iframe => {
      try {
        iframe.src = 'about:blank';
      } catch (e) {}
    });

    this.modalEl.querySelectorAll('img').forEach(img => {
      try {
        img.removeAttribute('src');
      } catch (e) {}
    });
  }

  /**
   * Open the preview modal for a given file item
   * @param {Object} item 
   * @param {Array<Object>} allItems 
   * @param {Object} [options]
   */
  async open(item, allItems = [], options = {}) {
    this.cleanupMedia();
    this.options = { ...this.options, ...options };
    this.items = allItems.filter(i => !i.isDirectory && !i.isParent);
    this.currentIndex = this.items.findIndex(i => i.url === item.url);
    this.activeItem = item;

    await this.render();
  }

  close() {
    if (this.modalEl) {
      this.cleanupMedia();
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
      this.cleanupMedia();
      this.currentIndex++;
      this.activeItem = this.items[this.currentIndex];
      await this.render();
    }
  }

  async prev() {
    if (this.currentIndex > 0) {
      this.cleanupMedia();
      this.currentIndex--;
      this.activeItem = this.items[this.currentIndex];
      await this.render();
    }
  }

  async render() {
    if (this.modalEl) {
      this.cleanupMedia();
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
      <div class="vwsq-modal-title" style="min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; overflow: hidden; margin-right: 16px;">
        <div style="width: 22px; height: 22px; display: flex; align-items: center; flex-shrink: 0;">${getFileIcon(item.name, item.isDirectory)}</div>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 600;">${escapeHtml(item.name)}</span>
        <span class="vwsq-badge vwsq-badge--iris" style="flex-shrink: 0;">${escapeHtml(item.extension ? item.extension.toUpperCase() : 'FILE')}</span>
      </div>
      <div class="vwsq-modal-nav-controls" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-prev-btn" title="Previous item" ${this.currentIndex <= 0 ? 'disabled style="opacity: 0.3;"' : ''}>←</button>
        <span class="vwsq-modal-counter" style="font-size: 12px; font-family: var(--vwsq-font-mono); color: var(--vwsq-console-text-dim); white-space: nowrap; flex-shrink: 0; min-width: 48px; text-align: center; line-height: 1;">${this.currentIndex + 1} / ${this.items.length || 1}</span>
        <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-next-btn" title="Next item" ${this.currentIndex >= this.items.length - 1 ? 'disabled style="opacity: 0.3;"' : ''}>→</button>
        <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-close-btn" style="padding: 6px;" title="Close (Escape)">
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

    // Render file content into body based on category
    await this.loadContent(item, body);
  }

  async loadContent(item, bodyEl) {
    const cat = item.category;
    const mediaSrc = item.streamUrl || item.url;
    const maxPreviewSizeBytes = this.options.maxPreviewSizeBytes || (50 * 1024 * 1024);

    if (cat === 'image') {
      bodyEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <img src="${escapeHtml(mediaSrc)}" alt="${escapeHtml(item.name)}" class="vwsq-preview-image" style="max-height: 65vh; max-width: 100%; border-radius: 8px; object-fit: contain;" />
          <span class="vwsq-badge vwsq-badge--online">Image Preview</span>
        </div>
      `;
      return;
    }

    if (cat === 'video') {
      bodyEl.innerHTML = `
        <div class="vwsq-video-container" style="position: relative; width: 100%; display: flex; justify-content: center; align-items: center;">
          <video src="${escapeHtml(mediaSrc)}" controls autoplay class="vwsq-preview-video" style="max-height: 65vh; border-radius: 8px;"></video>
          <div class="vwsq-video-error-fallback" style="display: none; flex-direction: column; align-items: center; gap: 14px; padding: 36px 24px; text-align: center; background: rgba(0,0,0,0.35); border-radius: 12px; border: 1px dashed var(--vwsq-console-border, rgba(255,255,255,0.1));">
            <div style="font-size: 32px; opacity: 0.85;">🎬</div>
            <div style="font-weight: 600; font-size: 15px; color: var(--vwsq-console-text-bright);">${escapeHtml(item.name)}</div>
            <div style="font-size: 13px; color: var(--vwsq-console-text-dim); max-width: 440px; line-height: 1.4;">
              This video container or codec (e.g. MKV, AVI, AC3/DTS audio) is not natively playable in Firefox's HTML5 video decoder.
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
              <button class="vwsq-btn vwsq-btn--primary vwsq-open-default-btn">
                <span>Open in Default Player</span>
              </button>
              <button class="vwsq-btn vwsq-btn--ghost vwsq-reveal-btn">
                <span>Reveal in Explorer</span>
              </button>
            </div>
          </div>
        </div>
      `;

      const video = bodyEl.querySelector('video');
      const fallback = bodyEl.querySelector('.vwsq-video-error-fallback');
      const openBtn = bodyEl.querySelector('.vwsq-open-default-btn');
      const revealBtn = bodyEl.querySelector('.vwsq-reveal-btn');

      if (video && fallback) {
        video.onerror = () => {
          video.style.display = 'none';
          fallback.style.display = 'flex';
        };
      }

      if (openBtn) {
        openBtn.addEventListener('click', async () => {
          if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            await browser.runtime.sendMessage({ action: 'nativeOpenFile', path: item.path || item.url });
          }
        });
      }

      if (revealBtn) {
        revealBtn.addEventListener('click', async () => {
          if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            await browser.runtime.sendMessage({ action: 'nativeReveal', path: item.path || item.url });
          }
        });
      }
      return;
    }

    if (cat === 'audio') {
      bodyEl.innerHTML = '';
      const player = AudioPlayerComponent.create(mediaSrc, item.name);
      bodyEl.appendChild(player);
      return;
    }

    if (cat === 'pdf') {
      bodyEl.innerHTML = `
        <iframe src="${escapeHtml(mediaSrc)}" style="width: 100%; height: 60vh; border: none; border-radius: 12px;"></iframe>
      `;
      return;
    }

    // Safety check for large files before fetching text into JavaScript heap
    const fileSize = item.size || 0;
    if (fileSize > maxPreviewSizeBytes) {
      bodyEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; color: var(--vwsq-console-text-dim); padding: 32px 16px;">
          <div style="width: 56px; height: 56px;">${getFileIcon(item.name)}</div>
          <div>
            <div style="font-weight: 600; font-size: 15px; color: var(--vwsq-console-text-bright);">${escapeHtml(item.name)}</div>
            <div style="font-size: 13px; margin-top: 6px;">File size (${item.sizeFormatted}) exceeds inline preview limit (${formatBytes(maxPreviewSizeBytes)}).</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 2px;">Skipping syntax highlighting to keep browser responsive.</div>
          </div>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="vwsq-btn vwsq-btn--primary">
            <div style="width: 16px; height: 16px;">${ICONS.external}</div>
            <span>Open in New Tab</span>
          </a>
        </div>
      `;
      return;
    }

    // Text, Markdown, JSON, Code fetch with chunk truncation safety
    try {
      // For large text files (> 2MB), only request the first 256KB to avoid freezing the main thread
      const isLargeText = fileSize > (2 * 1024 * 1024);
      const headers = isLargeText ? { 'Range': 'bytes=0-262143' } : {};

      const resp = await fetch(mediaSrc, { headers });
      if (!resp.ok && resp.status !== 206) throw new Error(`HTTP ${resp.status}`);
      let text = await resp.text();

      let truncatedNotice = '';
      if (isLargeText || text.length > 262144) {
        text = text.slice(0, 262144);
        truncatedNotice = `<div style="background: rgba(233, 176, 84, 0.15); border: 1px solid var(--vwsq-signal-warning); border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; font-size: 12px; color: var(--vwsq-signal-warning); display: flex; align-items: center; gap: 8px;">
          <span>Showing first 256 KB of large file (${item.sizeFormatted}). Truncated to maintain smooth browser performance.</span>
        </div>`;
      }

      if (cat === 'markdown') {
        bodyEl.innerHTML = `${truncatedNotice}<div class="vwsq-preview-markdown">${MarkdownViewer.render(text)}</div>`;
      } else if (cat === 'json') {
        let formatted = text;
        try {
          formatted = JSON.stringify(JSON.parse(text), null, 2);
        } catch (e) {}
        bodyEl.innerHTML = `${truncatedNotice}<div class="vwsq-preview-code">${CodeViewer.highlight(formatted, 'json')}</div>`;
      } else if (cat === 'code' || cat === 'text') {
        bodyEl.innerHTML = `${truncatedNotice}<div class="vwsq-preview-code">${CodeViewer.highlight(text, item.extension)}</div>`;
      } else {
        bodyEl.innerHTML = `${truncatedNotice}<div class="vwsq-preview-code">${CodeViewer.highlight(text, 'text')}</div>`;
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
