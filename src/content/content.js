/**
 * Content Script entrypoint for browser-browser
 */

import { DirectoryInjector } from './injector.js';

async function bootstrap() {
  if (window.location.protocol !== 'file:') return;

  const injector = new DirectoryInjector();
  await injector.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
