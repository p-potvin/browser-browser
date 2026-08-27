/**
 * Syntax-highlighted code & text viewer with line numbers
 */

import { escapeHtml } from '../../common/utils.js';

export class CodeViewer {
  /**
   * Highlights code text into HTML with line numbers
   * @param {string} code 
   * @param {string} ext 
   * @returns {string} HTML string
   */
  static highlight(code, ext = 'js') {
    const lines = code.split('\n');
    const highlightedLines = lines.map((line, index) => {
      let formatted = escapeHtml(line);

      // Basic regex-based token highlighting
      // Comments
      formatted = formatted.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*)/g, '<span style="color: var(--vwsq-console-text-dim, #6b7385); font-style: italic;">$1</span>');

      // Strings
      formatted = formatted.replace(/(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;|`[\s\S]*?`)/g, '<span style="color: var(--vwsq-signal-online, #56d98d);">$1</span>');

      // Keywords
      const keywords = /\b(const|let|var|function|return|import|export|from|default|class|extends|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|async|await|typeof|instanceof|public|private|protected|static|interface|type|def|fn|pub|impl|struct|enum|match|package|use)\b/g;
      formatted = formatted.replace(keywords, '<span style="color: var(--vwsq-iris-400, #8189f5); font-weight: 600;">$1</span>');

      // Numbers & Booleans
      formatted = formatted.replace(/\b(\d+(\.\d+)?|true|false|null|undefined|None|True|False|nil)\b/g, '<span style="color: var(--vwsq-coral-400, #ff9679);">$1</span>');

      const lineNum = index + 1;
      return `<div class="vwsq-code-line" style="display: flex; line-height: 1.6;">
        <span class="vwsq-line-num" style="width: 42px; user-select: none; color: var(--vwsq-console-text-dim, rgba(186, 194, 210, 0.46)); text-align: right; padding-right: 14px; flex-shrink: 0;">${lineNum}</span>
        <span class="vwsq-line-content" style="flex: 1; white-space: pre; font-family: var(--vwsq-font-mono, monospace);">${formatted || ' '}</span>
      </div>`;
    });

    return `<div class="vwsq-code-container" style="font-family: var(--vwsq-font-mono, monospace); font-size: 12.5px; width: 100%;">${highlightedLines.join('')}</div>`;
  }
}
