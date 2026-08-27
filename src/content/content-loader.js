/**
 * Content script loader for Firefox / WebExtension environment
 * Dynamically loads the ES Module injector into the file:/// page context
 */

(async () => {
  if (window.location.protocol !== 'file:') return;

  try {
    const runtime = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : chrome.runtime;
    if (!runtime || !runtime.getURL) return;

    const injectorUrl = runtime.getURL('src/content/injector.js');
    const { DirectoryInjector } = await import(injectorUrl);
    
    const injector = new DirectoryInjector();
    await injector.init();
  } catch (err) {
    console.error('[browser-browser] Failed to initialize DirectoryInjector:', err);
  }
})();
