/**
 * Custom Audio Player Component
 */

import { ICONS } from '../../common/icons.js';
import { escapeHtml } from '../../common/utils.js';

export class AudioPlayerComponent {
  /**
   * Render an audio player UI for a given audio URL and filename
   * @param {string} audioUrl 
   * @param {string} filename 
   * @returns {HTMLElement}
   */
  static create(audioUrl, filename) {
    const container = document.createElement('div');
    container.className = 'vwsq-audio-player-container';
    container.style.cssText = `
      width: 100%;
      max-width: 540px;
      background: var(--vwsq-console-raised, #191d27);
      border: 1px solid var(--vwsq-console-border-strong, rgba(255,255,255,0.12));
      border-radius: var(--vwsq-radius-card, 28px);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--vwsq-console-sunken, #070810); display: flex; align-items: center; justify-content: center; color: var(--vwsq-signal-sync, #a585f5); flex-shrink: 0;">
          <div style="width: 28px; height: 28px;">${ICONS.audio}</div>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px; color: var(--vwsq-console-text-bright, #e6eaf2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(filename)}</div>
          <div style="font-size: 12px; color: var(--vwsq-console-text-dim, rgba(186, 194, 210, 0.46)); font-family: var(--vwsq-font-mono, monospace);">Local Audio Stream</div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="vwsq-audio-time-current" style="font-size: 11px; font-family: var(--vwsq-font-mono, monospace); color: var(--vwsq-console-text-dim); width: 36px;">00:00</span>
        <input type="range" class="vwsq-audio-seeker" min="0" max="100" value="0" style="flex: 1; accent-color: var(--vwsq-iris-500, #6e7bf2); cursor: pointer;" />
        <span class="vwsq-audio-time-total" style="font-size: 11px; font-family: var(--vwsq-font-mono, monospace); color: var(--vwsq-console-text-dim); width: 36px;">00:00</span>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
        <button class="vwsq-btn vwsq-btn--primary vwsq-audio-play-btn" style="width: 44px; height: 44px; border-radius: 50%; padding: 0;">
          <div style="width: 18px; height: 18px;">${ICONS.play}</div>
        </button>
      </div>
      <audio src="${escapeHtml(audioUrl)}" preload="metadata" style="display: none;"></audio>
    `;

    const audio = container.querySelector('audio');
    const playBtn = container.querySelector('.vwsq-audio-play-btn');
    const seeker = container.querySelector('.vwsq-audio-seeker');
    const timeCur = container.querySelector('.vwsq-audio-time-current');
    const timeTot = container.querySelector('.vwsq-audio-time-total');

    function formatTime(seconds) {
      if (isNaN(seconds)) return '00:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    audio.addEventListener('loadedmetadata', () => {
      timeTot.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        seeker.value = (audio.currentTime / audio.duration) * 100;
        timeCur.textContent = formatTime(audio.currentTime);
      }
    });

    seeker.addEventListener('input', () => {
      if (audio.duration) {
        audio.currentTime = (seeker.value / 100) * audio.duration;
      }
    });

    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playBtn.innerHTML = `<div style="width: 18px; height: 18px;">${ICONS.pause}</div>`;
      } else {
        audio.pause();
        playBtn.innerHTML = `<div style="width: 18px; height: 18px;">${ICONS.play}</div>`;
      }
    });

    audio.addEventListener('ended', () => {
      playBtn.innerHTML = `<div style="width: 18px; height: 18px;">${ICONS.play}</div>`;
    });

    return container;
  }
}
