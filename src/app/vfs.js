/**
 * Virtual File System (VFS) for in-memory folder navigation
 * Handles directory hierarchies from FileList (webkitdirectory) or drop events.
 */

import { formatBytes, formatDate, getFileTypeCategory } from '../common/utils.js';

export class VirtualFileSystem {
  constructor() {
    this.rootName = 'Local Workspace';
    this.rootFullPath = '';
    // Map of normalized folderPath -> { name, path, parentPath, subdirs: Map, files: Map, thumbs: Map }
    this.folders = new Map();
    this.allFilesCount = 0;
    this.totalSizeBytes = 0;
    this.objectUrls = [];
    this.fileUrlMap = new WeakMap();
  }

  /**
   * Release created object URLs to prevent memory leaks
   */
  destroy() {
    for (const url of this.objectUrls) {
      try { URL.revokeObjectURL(url); } catch (e) {}
    }
    this.objectUrls = [];
    this.fileUrlMap = new WeakMap();
    this.folders.clear();
  }

  /**
   * Build virtual directory tree from a FileList
   * @param {FileList|Array<File>} fileList 
   * @param {string} [customRootPath='']
   */
  loadFromFileList(fileList, customRootPath = '') {
    this.destroy();
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    this.allFilesCount = filesArray.length;

    // Detect root name
    const firstFile = filesArray[0];
    const firstRel = firstFile.webkitRelativePath || firstFile.name;
    const parts = firstRel.split(/[/\\]/);
    this.rootName = parts[0] || 'Local Folder';
    this.rootFullPath = customRootPath || `file:///${this.rootName}/`;

    // Initialize root folder
    this.ensureFolder('');

    let totalBytes = 0;

    for (const file of filesArray) {
      totalBytes += (file.size || 0);
      const relPath = file.webkitRelativePath || file.name;
      const segments = relPath.split(/[/\\]/).filter(Boolean);

      // Remove root segment if it matches this.rootName
      let pathSegments = segments;
      if (pathSegments.length > 1 && pathSegments[0] === this.rootName) {
        pathSegments = pathSegments.slice(1);
      }

      if (pathSegments.length === 0) continue;

      const fileName = pathSegments[pathSegments.length - 1];
      const dirSegments = pathSegments.slice(0, -1);

      // Check if this file is inside a .thumbs directory
      const isThumbsFile = dirSegments.length > 0 && dirSegments[dirSegments.length - 1].toLowerCase() === '.thumbs';

      if (isThumbsFile) {
        // Belongs to the parent folder of .thumbs
        const parentOfThumbsSegments = dirSegments.slice(0, -1);
        const parentFolderPath = parentOfThumbsSegments.join('/').toLowerCase();
        const parentFolder = this.ensureFolder(parentFolderPath);
        parentFolder.thumbs.set(fileName.toLowerCase(), file);
        continue;
      }

      // Ensure all ancestor folders exist
      let currentAcc = '';
      for (let i = 0; i < dirSegments.length; i++) {
        const seg = dirSegments[i];
        const nextAcc = currentAcc ? `${currentAcc}/${seg}` : seg;
        this.ensureFolder(nextAcc.toLowerCase(), seg, currentAcc.toLowerCase());
        currentAcc = nextAcc;
      }

      const folderPath = dirSegments.join('/').toLowerCase();
      const folder = this.ensureFolder(folderPath);
      folder.files.set(fileName, file);
    }

    this.totalSizeBytes = totalBytes;
  }

  /**
   * Ensure a folder node exists in the tree
   */
  ensureFolder(normPath, displayName = '', parentNormPath = '') {
    if (this.folders.has(normPath)) {
      return this.folders.get(normPath);
    }

    if (!displayName) {
      if (!normPath) {
        displayName = this.rootName;
      } else {
        const parts = normPath.split('/');
        displayName = parts[parts.length - 1];
      }
    }

    if (normPath && parentNormPath === '' && normPath.includes('/')) {
      const idx = normPath.lastIndexOf('/');
      parentNormPath = normPath.substring(0, idx);
    }

    const folderNode = {
      name: displayName,
      path: normPath,
      parentPath: parentNormPath,
      subdirs: new Map(), // subdirNorm -> displayName
      files: new Map(),   // fileName -> File
      thumbs: new Map()   // lowerFileName -> File
    };

    this.folders.set(normPath, folderNode);

    // Register with parent if not root
    if (normPath !== '') {
      const parent = this.ensureFolder(parentNormPath);
      parent.subdirs.set(normPath, displayName);
    }

    return folderNode;
  }

  createTrackedUrl(file) {
    if (!file) return null;
    if (this.fileUrlMap && this.fileUrlMap.has(file)) {
      return this.fileUrlMap.get(file);
    }
    const url = URL.createObjectURL(file);
    if (!this.fileUrlMap) {
      this.fileUrlMap = new WeakMap();
    }
    this.fileUrlMap.set(file, url);
    this.objectUrls.push(url);
    return url;
  }

  /**
   * Get items (subdirs and files) for a given normalized path
   * @param {string} rawPath 
   * @returns {Array<Object>}
   */
  getItems(rawPath = '') {
    const normPath = this.normalizePath(rawPath);
    const folder = this.folders.get(normPath);
    if (!folder) return [];

    const items = [];

    // 1. Parent folder navigation entry
    if (normPath !== '') {
      items.push({
        name: '..',
        url: '#up',
        targetPath: folder.parentPath,
        isDirectory: true,
        isParent: true,
        sizeFormatted: '--',
        dateModified: '--',
        extension: '',
        category: 'directory'
      });
    }

    // 2. Subdirectories
    for (const [subNorm, subName] of folder.subdirs.entries()) {
      items.push({
        name: subName,
        url: `#${subNorm}`,
        targetPath: subNorm,
        isDirectory: true,
        isParent: false,
        sizeFormatted: '--',
        dateModified: '--',
        extension: '',
        category: 'directory'
      });
    }

    // 3. Files with thumbnail & webm resolution
    for (const [fileName, file] of folder.files.entries()) {
      const isDir = false;
      const ext = (fileName.split('.').pop() || '').toLowerCase();
      const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      const lowerBase = baseName.toLowerCase();
      const lowerFull = fileName.toLowerCase();

      // Look up thumbnails in .thumbs map
      let thumbJpgUrl = null;
      let thumbWebmUrl = null;

      // Check image thumbnail candidates
      const imgCandidates = [
        `${lowerBase}.jpg`,
        `${lowerFull}.jpg`,
        `${lowerBase}.jpeg`,
        `${lowerFull}.jpeg`,
        `${lowerBase}.png`,
        `${lowerFull}.png`,
        `${lowerBase}.webp`
      ];
      for (const cand of imgCandidates) {
        if (folder.thumbs.has(cand)) {
          thumbJpgUrl = this.createTrackedUrl(folder.thumbs.get(cand));
          break;
        }
      }

      // Check video preview candidates (.webm / .mp4)
      const vidCandidates = [
        `${lowerBase}.webm`,
        `${lowerFull}.webm`,
        `${lowerBase}.mp4`,
        `${lowerFull}.mp4`
      ];
      for (const cand of vidCandidates) {
        if (folder.thumbs.has(cand)) {
          thumbWebmUrl = this.createTrackedUrl(folder.thumbs.get(cand));
          break;
        }
      }

      // Fallback for native images if no .thumbs exists
      const category = getFileTypeCategory(fileName, isDir);
      const mainUrl = this.createTrackedUrl(file);

      items.push({
        name: fileName,
        url: mainUrl,
        targetPath: normPath ? `${normPath}/${fileName}` : fileName,
        isDirectory: false,
        isParent: false,
        size: file.size,
        sizeFormatted: formatBytes(file.size),
        dateModified: formatDate(file.lastModified),
        extension: ext,
        category,
        file,
        thumbJpgUrl,
        thumbWebmUrl
      });
    }

    return items;
  }

  /**
   * Normalize path string (trims slashes, lowercases, handles Windows backslashes)
   */
  normalizePath(p) {
    if (!p) return '';
    let clean = p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').trim().toLowerCase();
    // Strip root prefix if present
    if (clean.startsWith('file:///')) clean = clean.slice(8);
    const rootLower = this.rootName.toLowerCase();
    if (clean === rootLower) return '';
    if (clean.startsWith(`${rootLower}/`)) {
      clean = clean.slice(rootLower.length + 1);
    }
    return clean;
  }

  /**
   * Search or resolve a typed / pasted path to a valid folder in the VFS
   * @param {string} inputPath 
   * @returns {string|null} normalized folder path or null
   */
  resolvePath(inputPath) {
    if (!inputPath || inputPath.trim() === '' || inputPath.trim() === '/' || inputPath.trim() === '\\') {
      return '';
    }

    const norm = this.normalizePath(inputPath);
    if (this.folders.has(norm)) {
      return norm;
    }

    // Try matching end segment or folder name
    for (const [key, node] of this.folders.entries()) {
      if (key === norm || node.name.toLowerCase() === norm || key.endsWith(`/${norm}`)) {
        return key;
      }
    }

    return null;
  }

  /**
   * Get display path for address bar
   * @param {string} normPath 
   * @returns {string}
   */
  getDisplayPath(normPath) {
    if (!normPath) return `${this.rootName}\\`;
    const parts = normPath.split('/');
    const capitalized = parts.map(p => {
      const node = this.folders.get(p);
      return node ? node.name : p;
    });
    return `${this.rootName}\\${capitalized.join('\\')}\\`;
  }
}
