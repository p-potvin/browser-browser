/**
 * Python-Zipper Widget & Diagnostic Popover
 */

import { zipperClient } from '../../services/pythonZipperClient.js';
import { ICONS } from '../../common/icons.js';
import { escapeHtml, showToast } from '../../common/utils.js';

export class ZipperWidget {
  /**
   * Bind Python-Zipper status indicators across header and sidebar
   */
  static init() {
    zipperClient.init();

    zipperClient.subscribe(({ status, latencyMs, baseUrl }) => {
      this.updateIndicators(status, latencyMs, baseUrl);
    });

    // Attach click on navbar zipper badge
    document.addEventListener('click', (e) => {
      const target = e.target.closest('#vwsq-navbar-zipper-status, #vwsq-sidebar-zipper-box');
      if (target) {
        this.openModal();
      }
    });
  }

  static updateIndicators(status, latencyMs, baseUrl) {
    const navBadge = document.getElementById('vwsq-navbar-zipper-status');
    const sideLed = document.getElementById('vwsq-sidebar-zipper-led');

    let ledClass = 'vwsq-led--online';
    let badgeClass = 'vwsq-badge--online';
    let statusText = 'ONLINE';

    if (status === 'offline') {
      ledClass = 'vwsq-led--alert';
      badgeClass = 'vwsq-badge--alert';
      statusText = 'OFFLINE';
    } else if (status === 'checking') {
      ledClass = 'vwsq-led--sync';
      badgeClass = 'vwsq-badge--iris';
      statusText = 'SYNCING';
    }

    if (navBadge) {
      navBadge.className = `vwsq-badge ${badgeClass}`;
      navBadge.innerHTML = `
        <span class="vwsq-led ${ledClass} vwsq-led--live"></span>
        <span style="font-size: 11px; font-weight: 600;">ZIPPER ${latencyMs ? `(${latencyMs}ms)` : ''}</span>
      `;
      navBadge.title = `Python-Zipper: ${statusText} @ ${baseUrl} ${latencyMs ? `(${latencyMs}ms)` : ''}`;
    }

    if (sideLed) {
      sideLed.className = `vwsq-led ${ledClass} vwsq-led--live`;
    }
  }

  static openModal() {
    let existing = document.getElementById('vwsq-zipper-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'vwsq-modal-backdrop';
    backdrop.id = 'vwsq-zipper-modal';

    backdrop.innerHTML = `
      <div class="vwsq-modal" style="width: 520px;">
        <div class="vwsq-modal-header">
          <div class="vwsq-modal-title">
            <div style="width: 20px; height: 20px; color: var(--vwsq-coral-500);">${ICONS.zipper}</div>
            <span>Python-Zipper Daemon</span>
          </div>
          <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-close-btn" style="padding: 6px;">
            <div style="width: 16px; height: 16px;">${ICONS.close}</div>
          </button>
        </div>

        <div class="vwsq-modal-body" style="align-items: stretch; gap: 16px; padding: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--vwsq-console-sunken, #070810); border-radius: 12px; border: 1px solid var(--vwsq-console-border);">
            <div>
              <div style="font-size: 12px; color: var(--vwsq-console-text-dim);">Daemon Endpoint</div>
              <div style="font-family: var(--vwsq-font-mono); font-size: 13px; color: var(--vwsq-console-text-bright); font-weight: 600;">${escapeHtml(zipperClient.baseUrl)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--vwsq-console-text-dim);">Status</div>
              <span class="vwsq-badge ${zipperClient.status === 'online' ? 'vwsq-badge--online' : 'vwsq-badge--alert'}">
                <span class="vwsq-led ${zipperClient.status === 'online' ? 'vwsq-led--online' : 'vwsq-led--alert'} vwsq-led--live"></span>
                ${zipperClient.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--vwsq-console-text-bright);">Quick Download & Zip URL:</label>
            <div class="vwsq-input-wrapper">
              <input type="text" id="vwsq-zipper-url-input" class="vwsq-input" placeholder="https://example.com/gallery" />
            </div>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <button id="vwsq-zipper-scrape-btn" class="vwsq-btn vwsq-btn--primary" style="flex: 1;">
                <div style="width: 14px; height: 14px;">${ICONS.download}</div>
                <span>Scrape & Zip</span>
              </button>
              <button id="vwsq-zipper-ping-btn" class="vwsq-btn vwsq-btn--ghost">
                <div style="width: 14px; height: 14px;">${ICONS.refresh}</div>
                <span>Ping Server</span>
              </button>
            </div>
          </div>
        </div>

        <div class="vwsq-modal-footer">
          <span style="font-size: 11px; color: var(--vwsq-console-text-dim);">Background daemon on 127.0.0.1:5171</span>
          <button class="vwsq-btn vwsq-btn--sm vwsq-btn--primary vwsq-modal-close-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    backdrop.querySelectorAll('.vwsq-modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => backdrop.remove());
    });

    const pingBtn = backdrop.querySelector('#vwsq-zipper-ping-btn');
    pingBtn.addEventListener('click', async () => {
      showToast('Pinging Python-Zipper...', 'info');
      const res = await zipperClient.checkHealth();
      if (res.status === 'online') {
        showToast(`Python-Zipper is ONLINE (${res.latencyMs}ms)`, 'success');
      } else {
        showToast('Python-Zipper daemon is OFFLINE', 'error');
      }
      backdrop.remove();
    });

    const scrapeBtn = backdrop.querySelector('#vwsq-zipper-scrape-btn');
    scrapeBtn.addEventListener('click', async () => {
      const input = backdrop.querySelector('#vwsq-zipper-url-input');
      const url = input.value.trim();
      if (!url) {
        showToast('Please enter a valid URL', 'warning');
        return;
      }
      try {
        await zipperClient.queueScrape(url);
        showToast('Scrape task sent to Python-Zipper', 'success');
        backdrop.remove();
      } catch (e) {
        showToast('Failed to contact Python-Zipper daemon', 'error');
      }
    });
  }
}
