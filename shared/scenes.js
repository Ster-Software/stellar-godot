// The Godot extension's commands that start the game, one scene or an export in a terminal, and the scenes in the
// order its sidebar lists them. Pure: the main code (main.mjs) and the sidebar both use it.

/** The program as the terminal's shell types it: as is when it has no spaces, else in double quotes. */
const program = (godot) => (/\s/.test(godot) ? `"${godot.replace(/"/g, '\\"')}"` : godot);

/** `godot --path .` (the project's main scene), or with a scene after it: that scene alone. */
export function godotCommand(godot, scene = '') {
  const base = `${program(godot || 'godot')} --path .`;
  return scene ? `${base} ${/\s/.test(scene) ? `"${scene}"` : scene}` : base;
}

/** "res://scenes/levels/1.tscn" → { name: '1', folder: 'scenes/levels' }. */
export function sceneParts(scene) {
  const rel = String(scene || '').replace(/^res:\/\//, '');
  const at = rel.lastIndexOf('/');
  return { name: rel.slice(at + 1).replace(/\.tscn$/, ''), folder: at < 0 ? '' : rel.slice(0, at) };
}

// Scenes in these folders are the game's own, the rest (assets, addons) mostly parts of it: they come after.
const OWN = /^res:\/\/(scenes?|levels?|maps?|ui|screens?)\//i;

/**
 * The scenes that match `query` (name or folder), in the tab's order: the main scene first, then the game's own
 * scenes, then the rest; each group alphabetical.
 */
export function listedScenes(scenes = [], mainScene = '', query = '') {
  const q = query.trim().toLowerCase();
  const rank = (s) => (s === mainScene ? 0 : OWN.test(s) ? 1 : 2);
  return scenes
    .filter((s) => !q || s.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const quoted = (value) => `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`;

/**
 * An export preset built without the editor: its folder made first (Godot doesn't), then
 * `godot --headless --path . --export-release "iOS" "build/ios/App.ipa"`. Null without an export path.
 */
export function exportCommand(godot, preset) {
  if (!preset?.exportPath) return null;
  const folder = preset.exportPath.includes('/') ? preset.exportPath.slice(0, preset.exportPath.lastIndexOf('/')) : '';
  const run = `${program(godot || 'godot')} --headless --path . --export-release ${quoted(preset.name)} ${quoted(preset.exportPath)}`;
  return folder ? `mkdir -p ${quoted(folder)} && ${run}` : run;
}

const minor = (version) => String(version || '').split('.').slice(0, 2).map(Number);

/** Whether the installed Godot is older than the one the project was made with ("4.7" vs "4.6.2"). */
export function olderGodot(engine, installed) {
  if (!engine || !installed) return false;
  const [want, have] = [minor(engine), minor(installed)];
  return have[0] < want[0] || (have[0] === want[0] && have[1] < want[1]);
}
