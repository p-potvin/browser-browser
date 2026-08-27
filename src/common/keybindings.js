/**
 * Keyboard shortcuts controller for browser-browser
 */

export class KeybindingsController {
  /**
   * @param {Object} handlers
   * @param {Function} [handlers.onQuickLook]
   * @param {Function} [handlers.onNavigateNext]
   * @param {Function} [handlers.onNavigatePrev]
   * @param {Function} [handlers.onNavigateUp]
   * @param {Function} [handlers.onNavigateDown]
   * @param {Function} [handlers.onOpenSelected]
   * @param {Function} [handlers.onParentDirectory]
   * @param {Function} [handlers.onFocusSearch]
   * @param {Function} [handlers.onEscape]
   * @param {Function} [handlers.onCycleView]
   * @param {Function} [handlers.onToggleBookmark]
   * @param {Function} [handlers.onRefresh]
   */
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.boundKeydown = this.handleKeydown.bind(this);
    this.enabled = true;
  }

  attach() {
    window.addEventListener('keydown', this.boundKeydown);
  }

  detach() {
    window.removeEventListener('keydown', this.boundKeydown);
  }

  handleKeydown(e) {
    if (!this.enabled) return;

    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Escape always triggers regardless of focus
    if (e.key === 'Escape') {
      if (this.handlers.onEscape) {
        this.handlers.onEscape(e);
      }
      return;
    }

    // Don't intercept other keys if user is actively typing in an input
    if (isInput) {
      if (e.key === 'Enter' && target.classList.contains('vwsq-input') && this.handlers.onSearchEnter) {
        this.handlers.onSearchEnter(target.value);
      }
      return;
    }

    // Spacebar -> Quick Look
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (this.handlers.onQuickLook) {
        this.handlers.onQuickLook();
      }
      return;
    }

    // Arrow keys & Vim keys navigation
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      if (this.handlers.onNavigateDown) this.handlers.onNavigateDown();
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      if (this.handlers.onNavigateUp) this.handlers.onNavigateUp();
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      if (this.handlers.onNavigateNext) this.handlers.onNavigateNext();
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'h') {
      e.preventDefault();
      if (this.handlers.onNavigatePrev) this.handlers.onNavigatePrev();
      return;
    }

    // Enter -> Open item
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.handlers.onOpenSelected) this.handlers.onOpenSelected();
      return;
    }

    // Backspace -> Parent folder
    if (e.key === 'Backspace' && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      if (this.handlers.onParentDirectory) this.handlers.onParentDirectory();
      return;
    }

    // / -> Focus Search
    if (e.key === '/') {
      e.preventDefault();
      if (this.handlers.onFocusSearch) this.handlers.onFocusSearch();
      return;
    }

    // v -> Cycle View
    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      if (this.handlers.onCycleView) this.handlers.onCycleView();
      return;
    }

    // b -> Toggle Bookmark
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      if (this.handlers.onToggleBookmark) this.handlers.onToggleBookmark();
      return;
    }

    // [ or Ctrl+B -> Toggle Sidebar Collapse
    if (e.key === '[' || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
      e.preventDefault();
      if (this.handlers.onToggleSidebar) this.handlers.onToggleSidebar();
      return;
    }

    // Refresh -> r
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (this.handlers.onRefresh) this.handlers.onRefresh();
      return;
    }
  }
}
