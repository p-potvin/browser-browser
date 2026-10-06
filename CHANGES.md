# Changelog: browser-browser

All notable changes to this project will be documented in this file.
The format is based on Keep a Changelog, using timestamps formatted as `DDD, dd MMM YYYY HH:mm`.

## [1.3.2] - Tue, 06 Oct 2026 15:58

### Fixed
- **Unbounded Blob URL Retention**: Implemented `WeakMap` memoization for `URL.createObjectURL(file)` in `vfs.js`. Replaces unbounded URL allocations with file-lifecycle-bound URLs and explicit `vfs.destroy()` revocation, eliminating RAM accumulation across directory transitions and repetitive searches.
- **Media Decoder Engine Leaks**: Implemented deep DOM cleanup (`cleanup(container)`) across `fileGrid.js`, `fileList.js`, `fileTable.js`, `previewModal.js`, and `audioPlayer.js`. Explicitly pauses media, strips source attributes, and invokes `.load()` to release underlying Gecko/WebKit codec decoder contexts and Winsock connections.
- **Static DOM Video Deck Saturation**: Replaced eager thumbnail card video elements in `fileGrid.js` with dynamic on-hover mounting and unmounting, preventing hundreds of dormant video decoders from consuming hundreds of megabytes of process memory.
- **Firefox Image Compositor RAM Bloat**: Integrated `IntersectionObserver` viewport unmounting in `fileGrid.js` for catalogs exceeding 60 items, unmounting off-screen images to keep decoded RGBA memory bounded. Added progressive rendering (60 items/frame) to prevent UI thread freezes during massive folder loads.
- **Zombie Winsock Connections & HTTP Cache Strategy**: Added 5-second socket receive/send timeouts (`SO_RCVTIMEO`/`SO_SNDTIMEO`) to native C++ HTTP server (`http_server.cpp`). Injected `Cache-Control: public, max-age=86400, immutable` for `.thumbs` directory requests and `Cache-Control: no-cache, no-store, must-revalidate` for video/audio media streams.
- **Large File Syntax Buffer Bloat**: Enforced `maxPreviewSizeBytes` checks and 256KB Range chunking in `previewModal.js` to prevent huge files from freezing syntax highlighting engines. Added 150ms debounce to the search input in `navbar.js`.

## [1.3.1] - Sat, 05 Sep 2026 07:51

### Fixed
- **Persistent Native Messaging Connection**: Resolved video playback and thumbnail streaming regressions where `sendNativeMessage` terminated host processes after each request. Switched to persistent `connectNative` connection in `background.js`, keeping the native host and its local HTTP streaming server alive continuously.
- **Unsupported Video Container / Codec Fallback**: Added graceful error handling in `previewModal.js` when Firefox HTML5 player encounters unsupported video codecs (MKV/AVI/AC3/DTS), displaying an intuitive fallback card with direct "Open in Default Player" and "Reveal in Explorer" buttons.
- **Everything Search Directory Batch Sizing**: Fixed folder listing slowness caused by sequential Win32 `WM_COPYDATA` IPC calls. Implemented a single `parent:"<dir>"` batch search query in `everything_client.cpp`, fetching all immediate subfolder sizes in 1 IPC roundtrip (< 5ms) instead of N blocking roundtrips.
- **In-Memory Thumbnail Pre-indexing**: Enhanced `.thumbs` scanning into an in-memory hash set, matching both `${stem}.jpg/.webm` and `${filename}.jpg/.webm`, `.png`, and `.webp`.

### Added
- **Top Bar Sorting Controls**: Added interactive sorting dropdown (Name, Date Modified, Size, Type) and Ascending/Descending direction toggle in `navbar.js` with instant re-sorting.
- **In-App Preferences & Glob Exclusions Modal**: Created `settingsModal.js` supporting custom folder glob exclusions (`.thumbs`, `.git`, `node_modules`, etc.), file glob exclusions (`*.nfo`, `*.srt`, `*.vsmeta`, etc.), and sidecar toggles.
- **Contextual Right-Click Menu**: Created `contextMenu.js` for files and folders with Open, Open in Default App, Reveal in File Explorer, Copy Full Path, and Properties.
- **File Properties & Sidecar Inspector**: Created `propertiesModal.js` providing full file metadata inspection and live reading of associated `.nfo`, `.json`, `.srt`, and `.vsmeta` sidecar files with syntax highlighting.

## [1.3.0] - Fri, 04 Sep 2026 17:05

### Added
- **C++20 Native Messaging Host (`native-host/`)**: High-performance modular C++ host connecting the WebExtension directly to Windows APIs via stdio binary framing. Structured for direct future integration with `ggml` / `llama.cpp` for local inference.
- **Unrestricted Disk & Drive Access**: Direct Win32 integration (`GetLogicalDriveStringsW`, `GetDiskFreeSpaceExW`, `GetVolumeInformationW`) discovering all system drives and their real-time free/total capacity with zero browser upload prompts.
- **Everything Search IPC Integration**: Connects directly to Everything Search via Windows IPC message window to query instant directory sizes indexed with `index_folder_size=1`.
- **Winsock HTTP Streaming Server (`127.0.0.1:45123`)**: Multithreaded HTTP server with full HTTP Range request support (`206 Partial Content`), allowing high-definition video seeking, scrubbing, and audio playback directly in Firefox without loading files into memory or hitting `moz-extension://` security limits.
- **Host Registration Scripts**: Added `register-host.ps1` and `unregister-host.ps1` to configure `HKCU\Software\Mozilla\NativeMessagingHosts\browser_browser_host`.
- **Automated Native Verification Suite**: Added `tests/verify-native-host.ps1` for real-condition testing of registry persistence, stdio messaging, drive enumeration, directory traversal, and HTTP Range streaming.

### Fixed
- **Video Player Modal Header Overflow**: Fixed long filenames overflowing header boundaries and pushing navigation controls offscreen; resolved counter wrapping into 3 lines by setting `flex-shrink: 0`, `white-space: nowrap`, and proper ellipsis truncation.

## [1.2.0] - Fri, 04 Sep 2026 09:15

### Added
- **Hierarchical Virtual File System (`vfs.js`)**: Full in-memory directory tree parser from `FileList` (webkitdirectory/drag-and-drop). Enables deep folder traversal, subfolder opening, parent directory navigation (`..`), and typed path resolution.
- **`.thumbs` Previews & Hover WebM Audio**: Automatically detects `.thumbs` directories, maps base filenames to static `.jpg` and `.webm` video previews, and plays WebM previews with audio on hover.
- **Windows Explorer-Style Badges**: Displays tiny Catppuccin file type icon badges overlaying the bottom-right corner of thumbnail previews.
- **Windows Explorer-Style Address Bar & Navigation**: Prominent full-width address bar on the top row alongside "Local Workspace" supporting path pasting/typing and Enter navigation; Back (`←`), Forward (`→`), Up (`↑`), and Refresh (`↻`) navigation controls with full history stack.
- **Bottom Status Bar**: Windows Explorer-style status bar reporting item count, folder/file metrics, and active selection details.
- **Lucide Bookmark Icons**: Replaced distorted pushpin icons with crisp Lucide bookmark vector icons.

### Removed
- **Python-Zipper Connectivity**: Completely purged `pythonZipperClient.js`, `zipperWidget.js`, health check background polling, context menus, and zipper manifest permissions (`http://127.0.0.1:5171/*`).

### Performance
- **Instant Popup Open**: Removed blocking zipper daemon health check timeout from toolbar popup; popup now renders detected system drives instantly (< 10ms).

## [1.1.1] - Thu, 27 Aug 2026 15:13

### Fixed
- **Content Script Execution on `file:///` Pages**: Created `src/content/content-loader.js` using dynamic module imports to resolve `SyntaxError: import declarations may only appear at top level of a module` in Firefox content scripts.
- **Direct Live Tab Routing**: Fixed `manager.js` to route all drive (`C:`, `D:`, `E:`, `F:`, `G:`, `I:`, `U:`) and folder clicks directly through `navigateTo(url)`, eliminating mock fallback data and loading 100% live filesystem directories across the entire computer.
- **Single Instance Manager**: Added background tab querying to bring existing manager tab to focus instead of opening redundant tabs.

## [1.1.0] - Thu, 27 Aug 2026 14:57

### Added
- **Catppuccin Mocha Icon Suite**: Integrated full Catppuccin vector icon pack in `src/common/catppuccinIcons.js` for 50+ file types, specialized folders (Git, Downloads, Desktop, Media), and archives.
- **Real Windows System Drives**: Detected and rendered all physical logical drives (`C:`, `D:`, `E:`, `F:`, `G:`, `I:`, `U:`) with volume labels, disk capacity, and real-time free space metrics in both the Warm Rail sidebar and quick popup.
- **Collapsible Warm Rail Sidebar**: Added smooth collapsible sidebar toggle button and keyboard shortcut (`[` or `Ctrl+B`) with compact icon rail mode and persisted state.

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
