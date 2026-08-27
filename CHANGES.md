# Changelog: browser-browser

All notable changes to this project will be documented in this file.
The format is based on Keep a Changelog, using timestamps formatted as `DDD, dd MMM YYYY HH:mm`.

## [1.0.1] - Thu, 27 Aug 2026 14:41

### Fixed
- **Firefox `file:///` Navigation Security**: Added background script message routing (`navigate` and `openTab` actions via `browser.tabs.update`) to bypass Firefox content script security blocks on `window.location.href = 'file:///'`.
- **Directory Traversal in Dedicated Manager**: Enabled hierarchical folder traversal and directory handle navigation when opening subfolders in `manager.html`.
- **Keyboard Navigation**: Connected `Enter` and `Backspace` keys to `navigateTo` across the DOM injector and manager workspaces.
- **Brand Logo & Relative Assets**: Standardized relative fallback paths for `logo.svg` across standalone and extension environments.

## [1.0.0] - Thu, 27 Aug 2026 14:08

### Added
- **WebExtension Manifest**: Firefox MV3 compatibility with `file:///` content scripts, action popup, options page, context menus, and background service script.
- **VaultSqwares Theme Submodule**: Integrated `vaultwares-themes` as a git submodule referencing `vaultsqware.css` ("Obsidian & Iris" design palette).
- **Dual Mode Operation**:
  - In-place transformation of Firefox native `file:///` directory listings into a sleek VaultSqwares interface.
  - Dedicated full-tab File Manager workspace (`src/app/manager.html`) with drag-and-drop dropzone, local directory picker, and tab bar.
- **Multi-Format Instant Previews & Quick Look**:
  - Spacebar Quick Look modal for immediate file inspection.
  - Media previews: Images (with zoom and metadata), Video player with controls, and interactive Audio player.
  - Source Code & Text viewer with syntax highlighting and line numbers.
  - Markdown GFM renderer with task lists, tables, code blocks, and blockquotes.
  - JSON tree view and PDF inline frame.
- **Navigation & Layouts**:
  - Interactive breadcrumb navigation bar with path copying and drive switching (`C:`, `D:`, `E:`, `Z:`).
  - Multi-layout modes: Grid thumbnail cards, detailed sortable table, and compact list.
  - Pinned directory bookmarks stored in `browser.storage.local`.
- **Python-Zipper Integration**:
  - Live hardware LED indicator (`.vwsq-led--live`) monitoring local Python-Zipper daemon on `http://127.0.0.1:5171`.
  - Batch download and scrape trigger actions from context menus and toolbar widget.
- **Brand Assets & Vector Suite**:
  - Master vector logo `assets/logo.svg` representing the browser-inside-a-browser concept.
  - Complete icon suite: `assets/favicon.svg`, `icon-16.svg`, `icon-32.svg`, `icon-48.svg`, `icon-128.svg`, and custom SVG file type icons.
- **Packaging & Build System**:
  - Automated PowerShell packaging script `scripts/package.ps1` producing `.xpi` and `.zip` distribution bundles in `dist/`.
