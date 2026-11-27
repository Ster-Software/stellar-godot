// Godot projects (a project.godot in the project folder): its name and main scene, the scenes in it, and where the
// Godot program is. The extension's sidebar (sidebar/) starts the game and scenes in a terminal with it (main.mjs).
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { addons, exportPresets, iconDataUrl, parseGodotConfig, projectFacts } from './project.mjs';

const MAX_SCENES = 500;
const MAX_DEPTH = 8;
// Never scenes of the project itself: Godot's cache, version control, packages.
const SKIP_DIRS = new Set(['.godot', '.import', '.git', 'node_modules', 'build', 'export']);

/**
 * Every .tscn under `root` as res:// paths, sorted, and how many scripts there are ({ scenes, scripts: { gd, cs } });
 * not in skipped folders or in a nested Godot project.
 */
export async function scanProject(root) {
  const scenes = [];
  const scripts = { gd: 0, cs: 0 };
  const walk = async (dir, depth) => {
    if (depth > MAX_DEPTH || scenes.length >= MAX_SCENES) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Another project.godot below the root is a project of its own (a test project of a plugin).
    if (depth > 0 && entries.some((e) => e.isFile() && e.name === 'project.godot')) return;
    for (const entry of entries) {
      if (scenes.length >= MAX_SCENES) return;
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (!entry.isFile()) continue;
      else if (entry.name.endsWith('.tscn')) scenes.push(`res://${path.relative(root, full).split(path.sep).join('/')}`);
      else if (entry.name.endsWith('.gd')) scripts.gd += 1;
      else if (entry.name.endsWith('.cs')) scripts.cs += 1;
    }
  };
  await walk(root, 0);
  return { scenes: scenes.sort((a, b) => a.localeCompare(b)), scripts };
}

/** Only the scenes (scanProject). */
export const findScenes = async (root) => (await scanProject(root)).scenes;

const VERSION_TIMEOUT_MS = 5000;
const versions = new Map();

/** "4.7.1.stable.official.a13da4feb" → "4.7.1"; asked once per Godot program, '' when it doesn't answer. */
export function godotVersion(godot) {
  if (!godot) return Promise.resolve('');
  if (!versions.has(godot)) {
    versions.set(godot, new Promise((resolve) => {
      execFile(godot, ['--version'], { timeout: VERSION_TIMEOUT_MS }, (err, stdout) => {
        const match = /^(\d+\.\d+(?:\.\d+)?)/.exec(String(stdout || '').trim());
        if (err || !match) versions.delete(godot);
        resolve(match ? match[1] : '');
      });
    }));
  }
  return versions.get(godot);
}

/** Where Godot can be: on the PATH (Homebrew, Scoop, a package), else the app itself. */
function candidates() {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extra = process.platform === 'win32' ? [] : ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin')];
  const names = process.platform === 'win32' ? ['godot.exe', 'godot.cmd'] : ['godot', 'godot4'];
  const onPath = [...new Set([...dirs, ...extra])].flatMap((dir) => names.map((name) => path.join(dir, name)));
  const apps = process.platform === 'darwin'
    ? ['/Applications', path.join(os.homedir(), 'Applications')].flatMap((dir) => ['Godot', 'Godot_mono', 'Godot_v4'].map((app) => path.join(dir, `${app}.app`, 'Contents', 'MacOS', 'Godot')))
    : [];
  return [...onPath, ...apps];
}

/** The Godot program, or null when it isn't on this computer. */
export function findGodot(exists = existsSync) {
  return candidates().find((file) => exists(file)) || null;
}

/** Whether `cwd` is a Godot project: only that, for the check on every window focus. */
export const isGodotProject = (cwd) => (cwd ? fs.access(path.join(cwd, 'project.godot')).then(() => true, () => false) : Promise.resolve(false));

/** { exists } without a project.godot; else its name, main scene, scenes and the Godot program. */
export async function projectInfo(cwd) {
  if (!cwd) return { exists: false };
  let text;
  try {
    text = await fs.readFile(path.join(cwd, 'project.godot'), 'utf8');
  } catch {
    return { exists: false };
  }
  const facts = projectFacts(parseGodotConfig(text));
  const godot = findGodot();
  const [scan, presets, plugins, icon, installed] = await Promise.all([
    scanProject(cwd),
    fs.readFile(path.join(cwd, 'export_presets.cfg'), 'utf8').then((t) => exportPresets(parseGodotConfig(t)), () => []),
    addons(cwd, facts.enabledPlugins),
    iconDataUrl(cwd, facts.icon),
    godotVersion(godot),
  ]);
  return {
    exists: true,
    ...facts,
    name: facts.name || path.basename(cwd),
    icon,
    scenes: scan.scenes,
    scripts: scan.scripts,
    exportPresets: presets,
    addons: plugins,
    godot,
    godotVersion: installed,
  };
}

/**
 * Opens the project in the Godot editor, on its own (not in a terminal: it lives on after Stellar). `missing`: the
 * message when Godot isn't on this computer.
 */
export function openEditor(cwd, missing = 'Godot is not on this computer.') {
  const godot = findGodot();
  if (!godot) throw new Error(missing);
  const child = spawn(godot, ['--path', cwd, '--editor'], { cwd, detached: true, stdio: 'ignore' });
  child.on('error', (err) => console.error('[godot] editor openen', err));
  child.unref();
  return true;
}
