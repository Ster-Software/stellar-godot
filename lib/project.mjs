// What a Godot project says about itself, for the Godot tab's Project section: project.godot (engine version,
// renderer, window, autoloads, input actions), export_presets.cfg and the addons folder.
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Godot's config format (project.godot, export_presets.cfg, plugin.cfg) as { section: { key: raw value } }. A value
 * spanning lines (an input action's `{ … }`) is kept whole; keys before the first [section] go under ''.
 */
export function parseGodotConfig(text) {
  const sections = { '': {} };
  let current = sections[''];
  let pending = null;
  let depth = 0;
  String(text || '').split('\n').forEach((line) => {
    if (pending) {
      pending.value += `\n${line}`;
      depth += (line.match(/[{[(]/g) || []).length - (line.match(/[}\])]/g) || []).length;
      if (depth <= 0) pending = null;
      return;
    }
    if (!line.trim() || line.startsWith(';')) return;
    const section = /^\[([^\]]+)\]\s*$/.exec(line);
    if (section) {
      current = sections[section[1]] || (sections[section[1]] = {});
      return;
    }
    const at = line.indexOf('=');
    if (at < 0) return;
    const entry = { value: line.slice(at + 1) };
    current[line.slice(0, at).trim()] = entry;
    depth = (entry.value.match(/[{[(]/g) || []).length - (entry.value.match(/[}\])]/g) || []).length;
    if (depth > 0) pending = entry;
  });
  return Object.fromEntries(Object.entries(sections).map(([name, keys]) => [name, Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, v.value]))]));
}

/** A raw value as text: "x" unquoted, PackedStringArray("a", "b") as its strings joined, numbers as they are. */
export function stringsOf(raw) {
  return [...String(raw ?? '').matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
}
const str = (raw) => stringsOf(raw)[0] ?? (raw === undefined ? '' : String(raw).trim());
const num = (raw, fallback) => (raw === undefined || Number.isNaN(Number(raw)) ? fallback : Number(raw));

const RENDERERS = { forward_plus: 'Forward+', mobile: 'Mobile', gl_compatibility: 'Compatibility' };
const ORIENTATIONS = ['liggend', 'staand', 'liggend (omgekeerd)', 'staand (omgekeerd)', 'liggend (draait mee)', 'staand (draait mee)', 'draait mee'];

/** The [application]/[display]/[rendering]/[autoload]/[input]/[editor_plugins] facts of project.godot. */
export function projectFacts(config) {
  const app = config.application || {};
  const features = stringsOf(app['config/features']);
  const display = config.display || {};
  const rendering = config.rendering || {};
  return {
    name: str(app['config/name']),
    description: str(app['config/description']),
    mainScene: str(app['run/main_scene']),
    icon: str(app['config/icon']),
    engine: features.find((f) => /^\d+\.\d+/.test(f)) || '',
    csharp: features.includes('C#') || Boolean(config.dotnet),
    renderer: RENDERERS[str(rendering['renderer/rendering_method'])] || 'Forward+',
    window: {
      width: num(display['window/size/viewport_width'], 1152),
      height: num(display['window/size/viewport_height'], 648),
      orientation: ORIENTATIONS[num(display['window/handheld/orientation'], 0)] || '',
    },
    autoloads: Object.entries(config.autoload || {}).map(([name, raw]) => ({ name, path: str(raw).replace(/^\*/, '') })),
    inputActions: Object.keys(config.input || {}).length,
    enabledPlugins: stringsOf((config.editor_plugins || {}).enabled),
  };
}

/** export_presets.cfg's presets: { name, platform, exportPath }. */
export function exportPresets(config) {
  return Object.entries(config)
    .filter(([section]) => /^preset\.\d+$/.test(section))
    .map(([, keys]) => ({ name: str(keys.name), platform: str(keys.platform), exportPath: str(keys.export_path) }))
    .filter((p) => p.name);
}

const readText = (file) => fs.readFile(file, 'utf8').catch(() => '');

/** The folders in addons/: { id, name, version, enabled }; a plugin.cfg gives its name and version. */
export async function addons(root, enabledPlugins = []) {
  const dir = path.join(root, 'addons');
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return Promise.all(entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map(async (e) => {
    const plugin = parseGodotConfig(await readText(path.join(dir, e.name, 'plugin.cfg'))).plugin || {};
    return {
      id: e.name,
      name: str(plugin.name) || e.name,
      version: str(plugin.version),
      // A GDExtension (no plugin.cfg) is always on; an editor plugin only when project.godot enables it.
      enabled: !plugin.name || enabledPlugins.includes(`res://addons/${e.name}/plugin.cfg`),
    };
  }));
}

const ICON_TYPES = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const MAX_ICON_BYTES = 2 * 1024 * 1024;

/** The project's icon (res://…) as a data URL, or '' when it isn't there or too big. */
export async function iconDataUrl(root, icon) {
  const type = ICON_TYPES[path.extname(icon || '').toLowerCase()];
  if (!type || !icon.startsWith('res://')) return '';
  const file = path.join(root, ...icon.slice('res://'.length).split('/'));
  if (!file.startsWith(root + path.sep)) return '';
  try {
    const data = await fs.readFile(file);
    return data.length > MAX_ICON_BYTES ? '' : `data:${type};base64,${data.toString('base64')}`;
  } catch {
    return '';
  }
}
