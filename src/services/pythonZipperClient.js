/**
 * Python-Zipper Client Service
 * Bridges browser-browser to the local Python-Zipper daemon (http://127.0.0.1:5171)
 */

import { getSettings } from '../common/storage.js';

export class PythonZipperClient {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:5171';
    this.status = 'idle'; // 'idle' | 'checking' | 'online' | 'offline'
    this.latencyMs = null;
    this.listeners = new Set();
    this.pollInterval = null;
    this.lastChecked = null;
  }

  /**
   * Subscribe to status updates
   * @param {Function} callback 
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback({ status: this.status, latencyMs: this.latencyMs, baseUrl: this.baseUrl, lastChecked: this.lastChecked });
    return () => this.listeners.delete(callback);
  }

  notify() {
    const data = {
      status: this.status,
      latencyMs: this.latencyMs,
      baseUrl: this.baseUrl,
      lastChecked: this.lastChecked
    };
    for (const cb of this.listeners) {
      try { cb(data); } catch (e) { console.error(e); }
    }
  }

  /**
   * Initialize and start health monitoring
   */
  async init() {
    const settings = await getSettings();
    if (settings.zipperUrl) {
      this.baseUrl = settings.zipperUrl.replace(/\/+$/, '');
    }
    await this.checkHealth();
    this.startPolling(10000); // Check every 10s
  }

  startPolling(intervalMs = 10000) {
    this.stopPolling();
    this.pollInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Ping /health endpoint
   */
  async checkHealth() {
    this.status = 'checking';
    this.notify();

    // 1. Prioritize background script proxy (uses extension host_permissions without CORS errors)
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        const res = await browser.runtime.sendMessage({
          action: 'checkZipperHealth',
          baseUrl: this.baseUrl
        });
        if (res && typeof res.online === 'boolean') {
          this.status = res.online ? 'online' : 'offline';
          this.latencyMs = res.latencyMs || null;
          this.lastChecked = Date.now();
          this.notify();
          return { status: this.status, latencyMs: this.latencyMs };
        }
      } catch (e) {
        // Fallback to direct fetch
      }
    }

    // 2. Direct fetch fallback with silent error catching
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const resp = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      this.latencyMs = Math.round(performance.now() - start);
      this.lastChecked = Date.now();
      this.status = resp.ok ? 'online' : 'offline';
    } catch (err) {
      this.status = 'offline';
      this.latencyMs = null;
      this.lastChecked = Date.now();
    }
    this.notify();
    return { status: this.status, latencyMs: this.latencyMs };
  }

  /**
   * Send links to /download
   */
  async queueDownload(url, links = [], batchSize = 100) {
    try {
      const resp = await fetch(`${this.baseUrl}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, links, batch_size: batchSize })
      });
      return await resp.json();
    } catch (err) {
      console.error('Python-Zipper download queue failed:', err);
      throw err;
    }
  }

  /**
   * Send scrape request to /scrape
   */
  async queueScrape(url, selector = '', playwright = false, batchSize = 100) {
    try {
      const resp = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, selector, playwright, batch_size: batchSize })
      });
      return await resp.json();
    } catch (err) {
      console.error('Python-Zipper scrape queue failed:', err);
      throw err;
    }
  }

  /**
   * Fetch recent QA logs from Python-Zipper
   */
  async fetchQALogs() {
    try {
      const resp = await fetch(`${this.baseUrl}/qa-logs`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.error('Failed to fetch QA logs:', err);
      return [];
    }
  }
}

// Export singleton instance
export const zipperClient = new PythonZipperClient();
