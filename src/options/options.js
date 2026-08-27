/**
 * Settings & Options Controller
 */

import { getSettings, saveSettings } from '../common/storage.js';
import { zipperClient } from '../services/pythonZipperClient.js';
import { showToast } from '../common/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  const zipperUrlInput = document.getElementById('zipper-url');
  const defaultViewSelect = document.getElementById('default-view');
  const quicklookCheckbox = document.getElementById('enable-quicklook');
  const maxSizeInput = document.getElementById('max-preview-size');
  const testZipperBtn = document.getElementById('test-zipper-btn');
  const testResult = document.getElementById('zipper-test-result');
  const saveBtn = document.getElementById('save-settings-btn');
  const saveStatus = document.getElementById('save-status');

  // Load existing settings
  const settings = await getSettings();
  zipperUrlInput.value = settings.zipperUrl || 'http://127.0.0.1:5171';
  defaultViewSelect.value = settings.defaultView || 'grid';
  quicklookCheckbox.checked = settings.enableQuickLook !== false;
  maxSizeInput.value = Math.round((settings.maxPreviewSizeBytes || (50 * 1024 * 1024)) / (1024 * 1024));

  // Test Python-Zipper connection
  testZipperBtn.addEventListener('click', async () => {
    const url = zipperUrlInput.value.trim().replace(/\/+$/, '');
    zipperClient.baseUrl = url;
    testResult.style.display = 'block';
    testResult.innerHTML = '<span style="color: var(--vwsq-signal-sync);">Pinging daemon...</span>';

    const res = await zipperClient.checkHealth();
    if (res.status === 'online') {
      testResult.innerHTML = `<span style="color: var(--vwsq-signal-online); font-weight: 600;">✓ Connected to Python-Zipper (${res.latencyMs}ms latency)</span>`;
    } else {
      testResult.innerHTML = `<span style="color: var(--vwsq-signal-alert); font-weight: 600;">✗ Failed to connect to Python-Zipper at ${url}</span>`;
    }
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const newSettings = {
      zipperUrl: zipperUrlInput.value.trim().replace(/\/+$/, ''),
      defaultView: defaultViewSelect.value,
      enableQuickLook: quicklookCheckbox.checked,
      maxPreviewSizeBytes: parseInt(maxSizeInput.value, 10) * 1024 * 1024
    };

    await saveSettings(newSettings);
    zipperClient.baseUrl = newSettings.zipperUrl;
    showToast('Preferences saved successfully', 'success');

    saveStatus.style.display = 'inline';
    setTimeout(() => {
      saveStatus.style.display = 'none';
    }, 3000);
  });
});
