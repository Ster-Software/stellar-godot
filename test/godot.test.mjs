import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
// The Godot extension's commands, scenes and project facts.
import { exportCommand, godotCommand, listedScenes, olderGodot, sceneParts } from '../shared/scenes.js';
import { findGodot, findScenes, isGodotProject, projectInfo } from '../lib/godot.mjs';
import { addons, exportPresets, parseGodotConfig, projectFacts } from '../lib/project.mjs';
import i18n from '../i18n.js';

const DIR = path.resolve(import.meta.dirname, '..');

test('the game or one scene starts with godot --path .', () => {
  assert.equal(godotCommand('/opt/homebrew/bin/godot'), '/opt/homebrew/bin/godot --path .');
  assert.equal(godotCommand('/opt/homebrew/bin/godot', 'res://scenes/main.tscn'), '/opt/homebrew/bin/godot --path . res://scenes/main.tscn');
  assert.equal(godotCommand('/Apps/My Godot.app/Godot'), '"/Apps/My Godot.app/Godot" --path .');
  assert.equal(godotCommand(null, 'res://a b.tscn'), 'godot --path . "res://a b.tscn"');
});

test('scenes list the main scene first, then the game\'s own, then the rest', () => {
  const scenes = ['res://assets/fx/boom.tscn', 'res://scenes/menu.tscn', 'res://scenes/main.tscn', 'res://levels/1.tscn'];
  assert.deepEqual(listedScenes(scenes, 'res://scenes/menu.tscn'), [
    'res://scenes/menu.tscn', 'res://levels/1.tscn', 'res://scenes/main.tscn', 'res://assets/fx/boom.tscn',
  ]);
  assert.deepEqual(listedScenes(scenes, '', 'BOOM'), ['res://assets/fx/boom.tscn']);
  assert.deepEqual(sceneParts('res://scenes/levels/1.tscn'), { name: '1', folder: 'scenes/levels' });
  assert.deepEqual(sceneParts('res://main.tscn'), { name: 'main', folder: '' });
});

test('project.godot gives the name and main scene; scenes skip the cache and nested projects', async () => {
  const text = '[application]\n\nconfig/name="Hex \\"Kingdom\\""\nrun/main_scene="res://scenes/main.tscn"\n';

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'godot-'));
  const put = async (rel, body = '') => {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await fs.writeFile(path.join(root, rel), body);
  };
  await put('project.godot', text);
  await put('scenes/main.tscn');
  await put('.godot/imported/x.tscn');
  await put('tools/plugin/project.godot');
  await put('tools/plugin/test.tscn');
  assert.deepEqual(await findScenes(root), ['res://scenes/main.tscn']);
  const info = await projectInfo(root);
  assert.equal(info.exists, true);
  assert.equal(info.name, 'Hex "Kingdom"');
  assert.equal(info.mainScene, 'res://scenes/main.tscn');
  assert.deepEqual(info.scripts, { gd: 0, cs: 0 });
  assert.equal(await isGodotProject(root), true);
  assert.equal(await isGodotProject(path.join(root, 'scenes')), false);
  assert.deepEqual(await projectInfo(path.join(root, 'scenes')), { exists: false });
  await fs.rm(root, { recursive: true, force: true });
});

test('Godot is found where it is installed, or not at all', () => {
  assert.equal(findGodot(() => false), null);
  assert.match(findGodot((file) => /godot$/i.test(file)), /godot$/i);
});

test('project.godot, export presets and addons tell what the project is', async () => {
  const config = parseGodotConfig([
    '; Engine configuration file.', 'config_version=5', '',
    '[application]', 'config/name="Hex"', 'config/features=PackedStringArray("4.7", "Mobile")', '',
    '[autoload]', 'Profiles="*res://scripts/profiles.gd"', '',
    '[display]', 'window/size/viewport_width=390', 'window/size/viewport_height=844', 'window/handheld/orientation=1', '',
    '[editor_plugins]', 'enabled=PackedStringArray("res://addons/tool/plugin.cfg")', '',
    '[input]', 'jump={', '"deadzone": 0.2,', '"events": [Object(InputEventKey,"keycode":32)]', '}', 'fire={', '"events": []', '}', '',
    '[rendering]', 'renderer/rendering_method="mobile"',
  ].join('\n'));
  const facts = projectFacts(config);
  assert.equal(facts.engine, '4.7');
  assert.equal(facts.renderer, 'Mobile');
  assert.deepEqual(facts.window, { width: 390, height: 844, orientation: 'staand' });
  assert.deepEqual(facts.autoloads, [{ name: 'Profiles', path: 'res://scripts/profiles.gd' }]);
  assert.equal(facts.inputActions, 2);
  assert.equal(projectFacts({}).renderer, 'Forward+', "Godot 4's default");
  assert.deepEqual(projectFacts({}).window, { width: 1152, height: 648, orientation: 'liggend' });

  const presets = exportPresets(parseGodotConfig('[preset.0]\nname="iOS"\nplatform="iOS"\nexport_path="build/ios/A.ipa"\n\n[preset.0.options]\nx=1'));
  assert.deepEqual(presets, [{ name: 'iOS', platform: 'iOS', exportPath: 'build/ios/A.ipa' }]);

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'godot-addons-'));
  await fs.mkdir(path.join(root, 'addons', 'tool'), { recursive: true });
  await fs.mkdir(path.join(root, 'addons', 'haptics'), { recursive: true });
  await fs.writeFile(path.join(root, 'addons', 'tool', 'plugin.cfg'), '[plugin]\nname="Mijn tool"\nversion="1.2"');
  const found = (await addons(root, facts.enabledPlugins)).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(found, [
    { id: 'haptics', name: 'haptics', version: '', enabled: true },
    { id: 'tool', name: 'Mijn tool', version: '1.2', enabled: true },
  ]);
  assert.equal((await addons(root, [])).find((a) => a.id === 'tool').enabled, false, 'an editor plugin is off until enabled');
  await fs.rm(root, { recursive: true, force: true });
});

test('an export runs headless into its folder; an older Godot gets a warning', () => {
  assert.equal(exportCommand('godot', { name: 'iOS', exportPath: 'build/ios/A.ipa' }),
    'mkdir -p "build/ios" && godot --headless --path . --export-release "iOS" "build/ios/A.ipa"');
  assert.equal(exportCommand('godot', { name: 'Web', exportPath: 'index.html' }), 'godot --headless --path . --export-release "Web" "index.html"');
  assert.equal(exportCommand('godot', { name: 'x', exportPath: '' }), null);
  assert.equal(olderGodot('4.7', '4.7.1'), false);
  assert.equal(olderGodot('4.7', '4.8.0'), false);
  assert.equal(olderGodot('4.7', '4.6.2'), true);
  assert.equal(olderGodot('', '4.6'), false);
});

test('the game\'s terminal per project: a start takes it over, restart and stop use it, a closed one is forgotten', async () => {
  const { createRuns } = await import('../lib/runs.mjs');
  const calls = [];
  let open = true;
  let next = 1;
  const terminal = {
    run: async (command, options) => { calls.push(['run', command, options.title, options.cwd]); return { terminal: `t${next++}` }; },
    rerun: async (id, command, options) => { calls.push(['rerun', id, command, options.title]); return open; },
    stop: async (id) => { calls.push(['stop', id]); return open; },
  };
  const runs = createRuns(terminal);
  assert.equal(runs.running('/p'), false);
  await runs.start('/p', 'godot --path .', 'Godot: spel');
  assert.equal(runs.running('/p'), true);
  await runs.start('/p', 'godot --path . res://a.tscn', 'Godot: a');
  assert.equal(await runs.restart('/p'), true);
  assert.equal(await runs.stop('/p'), true);
  assert.deepEqual(calls, [
    ['run', 'godot --path .', 'Godot: spel', '/p'],
    ['rerun', 't1', 'godot --path . res://a.tscn', 'Godot: a'],
    ['rerun', 't1', 'godot --path . res://a.tscn', 'Godot: a'],
    ['stop', 't1'],
  ]);
  // The user closed the tab: restart says so and forgets it; the next start opens a new terminal.
  open = false;
  calls.length = 0;
  assert.equal(await runs.restart('/p'), false);
  assert.equal(runs.running('/p'), false);
  await runs.start('/p', 'godot --path .', 'Godot: spel');
  assert.deepEqual(calls.map((c) => c[0]), ['rerun', 'run']);
  // Another project has a terminal of its own; forgetting by id (its process ended) only touches that one.
  open = true;
  await runs.start('/q', 'godot --path .', 'Godot: q');
  runs.forget('t2');
  assert.deepEqual([runs.running('/p'), runs.running('/q')], [false, true]);
});

test('the Godot extension: its manifest, icon, sidebar, and every text in both languages', () => {
  const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  assert.equal(`${manifest.publisher}.${manifest.name}`, 'ster-software.godot');
  assert.equal(manifest.repository, 'Ster-Software/stellar-godot');
  for (const file of ['icon.jsx', 'sidebar/index.jsx', 'main.mjs']) assert.ok(existsSync(path.join(DIR, file)), file);
  const used = new Set();
  for (const file of ['main.mjs', 'sidebar/index.jsx', 'sidebar/parts.jsx']) {
    for (const m of readFileSync(path.join(DIR, file), 'utf8').matchAll(/\bt\('([\w.]+)'/g)) used.add(m[1]);
  }
  for (const key of ['description', 'command.start', 'command.openEditor']) used.add(key);
  for (const ref of JSON.stringify(manifest).matchAll(/%([\w.]+)%/g)) used.add(ref[1]);
  const has = (lang, key) => key.split('.').reduce((node, part) => node?.[part], i18n[lang]) !== undefined;
  for (const key of used) for (const lang of ['nl', 'en']) assert.ok(has(lang, key), `${lang}.${key} ontbreekt in i18n.js`);
});
