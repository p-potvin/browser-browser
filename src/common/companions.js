/**
 * Sidecars and .thumbs companions, by vault-raggae's rules
 * (app/files/records/sidecar_names.py and scan.py COMPANION_RULES).
 * The native host applies the same rules in fs_ops.cpp list_dir; this copy serves the folder-picker VFS.
 */

import { getFileTypeCategory } from './utils.js';

const MEDIA_CATEGORIES = new Set(['video', 'image', 'audio']);

function splitName(lowerName) {
  const dot = lowerName.lastIndexOf('.');
  return dot > 0 ? [lowerName.slice(0, dot), lowerName.slice(dot + 1)] : [lowerName, ''];
}

/**
 * Link one folder's files to their media masters.
 * @param {string[]} fileNames names in the folder (files only)
 * @returns {{ companions: Map<string, Array<{name: string, role: string}>>, claimed: Set<string>, videoStems: Set<string> }}
 *   companions: master name -> its sidecars (record first); claimed: names that are someone's sidecar
 */
export function resolveCompanions(fileNames) {
  const byLower = new Map(fileNames.map(n => [n.toLowerCase(), n]));
  const masters = [];
  const mediaPerStem = new Map();
  const videoStems = new Set();

  for (const name of fileNames) {
    const lower = name.toLowerCase();
    const [stem] = splitName(lower);
    const category = getFileTypeCategory(name, false);
    if (!MEDIA_CATEGORIES.has(category)) continue;
    masters.push({ name, lower, stem, category });
    mediaPerStem.set(stem, (mediaPerStem.get(stem) || 0) + 1);
    if (category === 'video') videoStems.add(stem);
  }

  const companions = new Map();
  const claimed = new Set();
  const claim = (master, lowerName, role) => {
    const actual = byLower.get(lowerName);
    if (!actual || actual === master.name || claimed.has(actual)) return;
    claimed.add(actual);
    if (!companions.has(master.name)) companions.set(master.name, []);
    companions.get(master.name).push({ name: actual, role });
  };

  // Records in trust order; the stem forms only when no other media file shares the stem
  for (const m of masters) {
    const { lower: n, stem: s } = m;
    claim(m, `${n}.json`, 'record');
    claim(m, `${n}.meta.json`, 'record');
    if (mediaPerStem.get(s) === 1) {
      claim(m, `${s}.json`, 'record');
      claim(m, `${s}.meta.json`, 'record');
    }
    claim(m, `${s}.tags.json`, 'tags');
    claim(m, `${s}.identities.json`, 'identities');
    claim(m, `${s}.nfo`, 'nfo');
    claim(m, `${n}.vsmeta`, 'vsmeta');
    claim(m, `${s}.sub`, 'subtitle');
    claim(m, `${s}.idx`, 'subtitle');
  }

  // Subtitles: <stem>.srt or <stem>.<lang>.srt (and .vtt); a video owns them before any other master
  const masterByStem = new Map();
  for (const m of masters) {
    const prev = masterByStem.get(m.stem);
    if (!prev || (m.category === 'video' && prev.category !== 'video')) masterByStem.set(m.stem, m);
  }
  for (const name of fileNames) {
    if (claimed.has(name)) continue;
    const [base, ext] = splitName(name.toLowerCase());
    if (ext !== 'srt' && ext !== 'vtt') continue;
    const m = masterByStem.get(base) || masterByStem.get(splitName(base)[0]);
    if (m) claim(m, name.toLowerCase(), 'subtitle');
  }

  return { companions, claimed, videoStems };
}

/**
 * .thumbs names to try for a file, best first: { image: [...], video: [...] }.
 * Empty for a picture that shares its stem with a video (clip.jpg beside clip.mp4): the thumb is the video's.
 */
export function thumbCandidates(fileName, videoStems) {
  const lower = fileName.toLowerCase();
  const [s] = splitName(lower);
  if (getFileTypeCategory(fileName, false) === 'image' && videoStems.has(s)) {
    return { image: [], video: [] };
  }
  return {
    image: [`${s}.jpg`, `${s}_enhanced.jpg`, `${lower}.jpg`, `${s}.jpeg`, `${s}.png`, `${s}.webp`],
    video: [`${s}.webm`, `${lower}.webm`, `${s}.mp4`]
  };
}
