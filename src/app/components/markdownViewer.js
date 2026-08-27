/**
 * Pure ES Markdown Viewer for browser-browser
 */

import { escapeHtml } from '../../common/utils.js';
import { CodeViewer } from './codeViewer.js';

export class MarkdownViewer {
  /**
   * Render raw markdown text to sanitized HTML
   * @param {string} md 
   * @returns {string} HTML string
   */
  static render(md) {
    if (!md) return '<p>Empty markdown document</p>';

    let html = '';
    const lines = md.split('\n');
    let inCodeBlock = false;
    let codeBuffer = [];
    let codeLang = '';
    let inList = false;
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fenced Code Block Check
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // Close code block
          html += CodeViewer.highlight(codeBuffer.join('\n'), codeLang);
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          codeLang = line.trim().slice(3).trim();
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Close list if line doesn't start with list bullet
      if (inList && !line.trim().startsWith('- ') && !line.trim().startsWith('* ') && !/^\d+\.\s/.test(line.trim())) {
        html += '</ul>';
        inList = false;
      }

      // Headings
      if (line.startsWith('# ')) {
        html += `<h1 style="font-size: 20px; border-bottom: 1px solid var(--vwsq-console-border, rgba(255,255,255,0.06)); padding-bottom: 6px; margin: 16px 0 10px 0;">${this.inlineFormat(line.slice(2))}</h1>`;
        continue;
      }
      if (line.startsWith('## ')) {
        html += `<h2 style="font-size: 17px; margin: 14px 0 8px 0; color: var(--vwsq-iris-300, #98a1f7);">${this.inlineFormat(line.slice(3))}</h2>`;
        continue;
      }
      if (line.startsWith('### ')) {
        html += `<h3 style="font-size: 15px; margin: 12px 0 6px 0; color: var(--vwsq-coral-300, #ffa88b);">${this.inlineFormat(line.slice(4))}</h3>`;
        continue;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        html += `<blockquote style="border-left: 3px solid var(--vwsq-iris-500, #6e7bf2); background: var(--vwsq-console-sunken, #070810); padding: 8px 14px; margin: 8px 0; border-radius: 0 8px 8px 0;">${this.inlineFormat(line.slice(2))}</blockquote>`;
        continue;
      }

      // Unordered Lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList) {
          html += '<ul style="padding-left: 20px; margin: 8px 0;">';
          inList = true;
        }
        const content = line.trim().slice(2);
        // Checkbox check
        if (content.startsWith('[ ] ')) {
          html += `<li style="list-style: none; margin-left: -14px;">☐ ${this.inlineFormat(content.slice(4))}</li>`;
        } else if (content.startsWith('[x] ') || content.startsWith('[X] ')) {
          html += `<li style="list-style: none; margin-left: -14px; color: var(--vwsq-signal-online, #56d98d);">☑ ${this.inlineFormat(content.slice(4))}</li>`;
        } else {
          html += `<li>${this.inlineFormat(content)}</li>`;
        }
        continue;
      }

      // Horizontal Rule
      if (line.trim() === '---' || line.trim() === '***') {
        html += `<hr style="border: none; border-top: 1px solid var(--vwsq-console-border, rgba(255,255,255,0.06)); margin: 16px 0;" />`;
        continue;
      }

      // Empty line
      if (!line.trim()) {
        continue;
      }

      // Paragraph
      html += `<p style="margin: 6px 0; line-height: 1.6;">${this.inlineFormat(line)}</p>`;
    }

    if (inList) html += '</ul>';
    if (inCodeBlock) html += CodeViewer.highlight(codeBuffer.join('\n'), codeLang);

    return `<div class="vwsq-markdown-rendered">${html}</div>`;
  }

  static inlineFormat(text) {
    let out = escapeHtml(text);
    // Bold
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    out = out.replace(/`(.*?)`/g, '<code style="background: var(--vwsq-console-sunken, #070810); color: var(--vwsq-iris-300, #98a1f7); padding: 2px 6px; border-radius: 4px; font-family: var(--vwsq-font-mono, monospace); font-size: 12px;">$1</code>');
    // Links
    out = out.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--vwsq-iris-400, #8189f5); text-decoration: underline;">$1</a>');
    return out;
  }
}
