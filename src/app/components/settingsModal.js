/**
 * In-App Settings & Glob Exclusions Modal Component
 */

import { ICONS } from '../../common/icons.js';
import { getSettings, saveSettings } from '../../common/storage.js';
import { escapeHtml, showToast } from '../../common/utils.js';

export class SettingsModal {
  constructor(options = {}) {
    this.options = options;
    this.modalEl = null;
  }

  /**
   * Open the settings modal
   * @param {Function} onSaveCallback 
   */
  async open(onSaveCallback) {
    this.onSave = onSaveCallback;
    const settings = await getSettings();
    this.render(settings);
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }

  isOpen() {
    return !!this.modalEl;
  }

  render(settings) {
    if (this.modalEl) {
      this.modalEl.remove();
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'vwsq-modal-backdrop';
    backdrop.id = 'vwsq-settings-modal';

    const modal = document.createElement('div');
    modal.className = 'vwsq-modal';
    modal.style.maxWidth = '600px';
    modal.style.width = '90%';

    const folderExclusionsStr = (settings.folderExclusions || []).join(', ');
    const fileExclusionsStr = (settings.fileExclusions || []).join(', ');

    // Header
    const header = document.createElement('div');
    header.className = 'vwsq-modal-header';
    header.innerHTML = `
      <div class="vwsq-modal-title" style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 20px; height: 20px; color: var(--vwsq-iris-400);">${ICONS.settings}</div>
        <span style="font-size: 16px; font-weight: 600; color: var(--vwsq-console-text-bright);">browser² Preferences</span>
        <span class="vwsq-badge vwsq-badge--iris">SETTINGS</span>
      </div>
      <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-close-btn" style="padding: 6px;" title="Close (Escape)">
        <div style="width: 16px; height: 16px;">${ICONS.close}</div>
      </button>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'vwsq-modal-body';
    body.style.padding = '20px 24px';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '20px';
    body.style.maxHeight = '70vh';
    body.style.overflowY = 'auto';

    body.innerHTML = `
      <!-- Folder Glob Exclusions -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 13px; font-weight: 600; color: var(--vwsq-console-text-bright);">
          Folder Glob Exclusions
        </label>
        <div style="font-size: 12px; color: var(--vwsq-console-text-dim);">
          Comma-separated folder names or patterns to hide from directory listings (e.g. <code>.thumbs, .git, node_modules, $RECYCLE.BIN</code>).
        </div>
        <input type="text" id="vwsq-setting-folder-exclusions" class="vwsq-input" value="${escapeHtml(folderExclusionsStr)}" placeholder=".thumbs, .git, node_modules" />
      </div>

      <!-- File Glob Exclusions (Sidecars & Hidden Files) -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 13px; font-weight: 600; color: var(--vwsq-console-text-bright);">
          File Glob Exclusions (Sidecars & Metadata)
        </label>
        <div style="font-size: 12px; color: var(--vwsq-console-text-dim);">
          Comma-separated file patterns to filter out from the main grid/list (e.g. <code>*.nfo, *.vsmeta, *.srt, *.sub</code>). Sidecar information remains readable in File Properties.
        </div>
        <input type="text" id="vwsq-setting-file-exclusions" class="vwsq-input" value="${escapeHtml(fileExclusionsStr)}" placeholder="*.nfo, *.vsmeta, *.json.sidecar, *.srt" />
      </div>

      <!-- Hide Sidecars Toggle -->
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
        <input type="checkbox" id="vwsq-setting-hide-sidecars" ${settings.hideSidecars !== false ? 'checked' : ''} style="accent-color: var(--vwsq-iris-500); width: 16px; height: 16px;" />
        <div>
          <div style="font-size: 13px; font-weight: 500; color: var(--vwsq-console-text-bright);">Hide Sidecars from Main Grid / Table</div>
          <div style="font-size: 11px; color: var(--vwsq-console-text-dim);">When enabled, sidecar files (.nfo, .json, .srt) are hidden and linked directly to their parent media files.</div>
        </div>
      </label>

      <!-- Everything IPC Folder Sizing -->
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
        <input type="checkbox" id="vwsq-setting-everything-size" ${settings.enableEverythingFolderSize !== false ? 'checked' : ''} style="accent-color: var(--vwsq-iris-500); width: 16px; height: 16px;" />
        <div>
          <div style="font-size: 13px; font-weight: 500; color: var(--vwsq-console-text-bright);">Everything Search Instant Folder Sizing</div>
          <div style="font-size: 11px; color: var(--vwsq-console-text-dim);">Fetches instant directory sizes in a single batch IPC query from Everything Search index.</div>
        </div>
      </label>

      <!-- Default View -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 13px; font-weight: 600; color: var(--vwsq-console-text-bright);">
          Default Layout View
        </label>
        <select id="vwsq-setting-default-view" class="vwsq-select" style="max-width: 220px;">
          <option value="grid" ${settings.defaultView === 'grid' ? 'selected' : ''}>Grid Thumbnail Cards</option>
          <option value="table" ${settings.defaultView === 'table' ? 'selected' : ''}>Detailed Table</option>
          <option value="list" ${settings.defaultView === 'list' ? 'selected' : ''}>Compact List</option>
        </select>
      </div>
    `;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'vwsq-modal-footer';
    footer.innerHTML = `
      <button class="vwsq-btn vwsq-btn--ghost vwsq-modal-cancel-btn">Cancel</button>
      <button class="vwsq-btn vwsq-btn--primary vwsq-modal-save-btn">
        <span>Save Preferences</span>
      </button>
    `;

    modal.appendChild(header);
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
    footer.querySelector('.vwsq-modal-cancel-btn').addEventListener('click', () => this.close());

    footer.querySelector('.vwsq-modal-save-btn').addEventListener('click', async () => {
      const folderRaw = body.querySelector('#vwsq-setting-folder-exclusions').value;
      const fileRaw = body.querySelector('#vwsq-setting-file-exclusions').value;
      const hideSidecars = body.querySelector('#vwsq-setting-hide-sidecars').checked;
      const everythingSize = body.querySelector('#vwsq-setting-everything-size').checked;
      const defaultView = body.querySelector('#vwsq-setting-default-view').value;

      const folderExclusions = folderRaw.split(',').map(s => s.trim()).filter(Boolean);
      const fileExclusions = fileRaw.split(',').map(s => s.trim()).filter(Boolean);

      const updated = await saveSettings({
        folderExclusions,
        fileExclusions,
        hideSidecars,
        enableEverythingFolderSize: everythingSize,
        defaultView
      });

      this.close();
      showToast('Settings saved successfully', 'success');
      if (this.onSave) {
        this.onSave(updated);
      }
    });
  }
}
