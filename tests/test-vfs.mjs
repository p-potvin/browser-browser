// Test suite for VirtualFileSystem and thumbnail resolution
import { VirtualFileSystem } from '../src/app/vfs.js';
import assert from 'assert';

console.log('--- Testing Virtual File System (VFS) ---');

// Mock File objects as provided by browser webkitdirectory
class MockFile extends Blob {
  constructor(name, webkitRelativePath, size = 1024, lastModified = Date.now()) {
    super(['mock-content-data']);
    this.name = name;
    this.webkitRelativePath = webkitRelativePath;
    this.customSize = size;
    this.lastModified = lastModified;
  }
  get size() {
    return this.customSize;
  }
}

const mockFiles = [
  new MockFile('photo.jpg', 'MyProject/photo.jpg', 204800),
  new MockFile('clip.mp4', 'MyProject/clip.mp4', 15000000),
  // .thumbs in root
  new MockFile('clip.jpg', 'MyProject/.thumbs/clip.jpg', 45000),
  new MockFile('clip.webm', 'MyProject/.thumbs/clip.webm', 850000),
  // Subfolder 1
  new MockFile('notes.txt', 'MyProject/docs/notes.txt', 1200),
  new MockFile('guide.md', 'MyProject/docs/guide.md', 3400),
  // Subfolder 2 (nested inside docs)
  new MockFile('diagram.png', 'MyProject/docs/assets/diagram.png', 55000),
  // .thumbs inside docs/assets
  new MockFile('diagram.jpg', 'MyProject/docs/assets/.thumbs/diagram.jpg', 12000),
  new MockFile('diagram.webm', 'MyProject/docs/assets/.thumbs/diagram.webm', 300000),
  // Another top-level subfolder
  new MockFile('track.mp3', 'MyProject/audio/track.mp3', 4000000)
];

const vfs = new VirtualFileSystem();
vfs.loadFromFileList(mockFiles);

console.log(`[PASS] VFS initialized with rootName: "${vfs.rootName}" and ${vfs.allFilesCount} files`);
assert.strictEqual(vfs.rootName, 'MyProject');
assert.strictEqual(vfs.allFilesCount, 10);

// Test 1: Root items
const rootItems = vfs.getItems('');
console.log(`[PASS] Root items count: ${rootItems.length}`);
const rootDirNames = rootItems.filter(i => i.isDirectory).map(i => i.name);
const rootFileNames = rootItems.filter(i => !i.isDirectory).map(i => i.name);

console.log('Root directories:', rootDirNames);
console.log('Root files:', rootFileNames);

assert.ok(rootDirNames.includes('docs'), 'Root must contain docs folder');
assert.ok(rootDirNames.includes('audio'), 'Root must contain audio folder');
assert.ok(!rootDirNames.includes('.thumbs'), '.thumbs must NOT appear as a regular directory');

assert.ok(rootFileNames.includes('photo.jpg'), 'Root must contain photo.jpg');
assert.ok(rootFileNames.includes('clip.mp4'), 'Root must contain clip.mp4');

// Test 2: Thumbnails resolution for clip.mp4
const clipItem = rootItems.find(i => i.name === 'clip.mp4');
assert.ok(clipItem, 'clip.mp4 must exist');
assert.ok(clipItem.thumbJpgUrl, 'clip.mp4 must have thumbJpgUrl resolved from .thumbs/clip.jpg');
assert.ok(clipItem.thumbWebmUrl, 'clip.mp4 must have thumbWebmUrl resolved from .thumbs/clip.webm');
console.log(`[PASS] clip.mp4 thumbnails resolved: jpg=${clipItem.thumbJpgUrl}, webm=${clipItem.thumbWebmUrl}`);

// Test 3: Subfolder docs
const docsItems = vfs.getItems('docs');
console.log(`[PASS] docs items count: ${docsItems.length}`);
const docsParent = docsItems.find(i => i.isParent);
assert.ok(docsParent, 'docs must have parent .. entry');
assert.strictEqual(docsParent.targetPath, '', 'docs parent targetPath must be root');

const docsSubdirs = docsItems.filter(i => i.isDirectory && !i.isParent).map(i => i.name);
assert.ok(docsSubdirs.includes('assets'), 'docs must contain assets subfolder');

// Test 4: Nested subfolder docs/assets with .thumbs
const assetsItems = vfs.getItems('docs/assets');
console.log(`[PASS] docs/assets items count: ${assetsItems.length}`);
const diagramItem = assetsItems.find(i => i.name === 'diagram.png');
assert.ok(diagramItem, 'diagram.png must exist');
assert.ok(diagramItem.thumbJpgUrl, 'diagram.png must have thumbJpgUrl');
assert.ok(diagramItem.thumbWebmUrl, 'diagram.png must have thumbWebmUrl');
console.log(`[PASS] Nested diagram.png thumbnails resolved: jpg=${diagramItem.thumbJpgUrl}, webm=${diagramItem.thumbWebmUrl}`);

// Test 5: Path resolution (Explorer address bar typing)
assert.strictEqual(vfs.resolvePath('docs'), 'docs');
assert.strictEqual(vfs.resolvePath('docs\\assets'), 'docs/assets');
assert.strictEqual(vfs.resolvePath('MyProject\\docs\\assets'), 'docs/assets');
assert.strictEqual(vfs.resolvePath('assets'), 'docs/assets');
assert.strictEqual(vfs.resolvePath('audio'), 'audio');
assert.strictEqual(vfs.resolvePath(''), '');
assert.strictEqual(vfs.resolvePath('nonexistent'), null);
console.log('[PASS] Path resolution for Windows/Unix address bar typing verified');

// Test 6: Display path
assert.strictEqual(vfs.getDisplayPath(''), 'MyProject\\');
assert.strictEqual(vfs.getDisplayPath('docs'), 'MyProject\\docs\\');
assert.strictEqual(vfs.getDisplayPath('docs/assets'), 'MyProject\\docs\\assets\\');
console.log('[PASS] Display paths verified');

console.log('\n>>> ALL 6 VFS TESTS PASSED SUCCESSFULLY! <<<\n');
