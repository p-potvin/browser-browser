/**
 * Settings & Options Controller
 */

import { getSettings, saveSettings } from '../common/storage.js';
import { showToast } from '../common/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  const defaultViewSelect = document.getElementById('default-view');
  const quicklookCheckbox = document.getElementById('enable-quicklook');
  const maxSizeInput = document.getElementById('max-preview-size');
  const saveBtn = document.getElementById('save-settings-btn');
  const saveStatus = document.getElementById('save-status');

  // Load existing settings
  const settings = await getSettings();
  defaultViewSelect.value = settings.defaultView || 'grid';
  quicklookCheckbox.checked = settings.enableQuickLook !== false;
  maxSizeInput.value = Math.round((settings.maxPreviewSizeBytes || (50 * 1024 * 1024)) / (1024 * 1024));

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const newSettings = {
      defaultView: defaultViewSelect.value,
      enableQuickLook: quicklookCheckbox.checked,
      maxPreviewSizeBytes: parseInt(maxSizeInput.value, 10) * 1024 * 1024
    };

    await saveSettings(newSettings);
    showToast('Preferences saved successfully', 'success');

    saveStatus.style.display = 'inline';
    setTimeout(() => {
      saveStatus.style.display = 'none';
    }, 3000);
  });
});
