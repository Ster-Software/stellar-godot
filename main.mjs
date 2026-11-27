// The Godot extension (was Stellar's own Godot tab): a project with a project.godot gets an icon with a sidebar to
// start the game or one scene, start it again or stop it (in one terminal, like the Run bar of VS Code's Godot
// extension), export a preset headless, and open the project in the Godot editor. The icon shows only in windows
// whose project is a Godot project.
import { activityBar, commands, i18n, notify, projects, sidebar, terminal, windows } from 'stellar/extension';
import { findGodot, isGodotProject, openEditor, projectInfo } from './lib/godot.mjs';
import { createRuns } from './lib/runs.mjs';
import { exportCommand, godotCommand, sceneParts } from './shared/scenes.js';

const INSTALL = 'brew install --cask godot';

/** The project of the window the sidebar or command is used in; an error without one. */
function rootOf(context) {
  const root = context?.project?.root;
  if (!root) throw new Error(i18n.t('openProject'));
  return root;
}

/** The Godot program; an error when it isn't on this computer. */
function godotOrFail() {
  const godot = findGodot();
  if (!godot) throw new Error(i18n.t('godotMissing'));
  return godot;
}

/** Shows the icon in window `window` only when project `root` is a Godot project. */
async function followProject(window, root) {
  const visible = Boolean(root) && await isGodotProject(root).catch(() => false);
  await activityBar.update({ visible }, { window }).catch(() => {});
}

export async function activate(context) {
  const runs = createRuns(terminal);
  const changed = () => sidebar.emit('changed', {});
  const watched = new Set(); // game terminals whose end is followed already

  // Hidden until a window's project turns out to be a Godot project.
  await activityBar.update({ visible: false }, { window: 'all' });
  for (const w of await windows.get()) followProject(w.id, w.project);

  /** The game (`scene` empty: from its main scene) or one scene, in the project's game terminal. */
  const start = async (root, scene = '') => {
    if (!(await isGodotProject(root))) throw new Error(i18n.t('noProject'));
    const name = scene ? sceneParts(scene).name : (await projectInfo(root)).name;
    const id = await runs.start(root, godotCommand(godotOrFail(), scene), i18n.t('game', { name }));
    if (!watched.has(id)) {
      watched.add(id);
      const ended = terminal.onExit(id, () => { ended.dispose(); watched.delete(id); runs.forget(id); changed(); });
    }
    changed();
    return true;
  };

  context.subscriptions.push(
    projects.onOpen(({ window, project }) => followProject(window, project?.root)),
    commands.register('godot.start', (args, ctx) => start(rootOf(ctx))),
    commands.register('godot.openEditor', (args, ctx) => openEditor(rootOf(ctx), i18n.t('godotMissing'))),
    // A .tscn right-clicked in the file tree (menus.explorer): that scene, as res:// of the project it is in.
    commands.register('godot.runScene', ({ paths = [] } = {}, ctx) => {
      const root = rootOf(ctx);
      const file = paths[0];
      if (!file || !file.startsWith(`${root}/`)) throw new Error(i18n.t('noProject'));
      return start(root, `res://${file.slice(root.length + 1)}`);
    }),
    sidebar.handle({
      info: async (args, ctx) => ({ ...(await projectInfo(rootOf(ctx))), running: runs.running(rootOf(ctx)) }),
      start: ({ scene = '' } = {}, ctx) => start(rootOf(ctx), scene),
      restart: async (args, ctx) => { const done = await runs.restart(rootOf(ctx)); changed(); return done; },
      stop: async (args, ctx) => { const done = await runs.stop(rootOf(ctx)); if (!done) changed(); return done; },
      // An export preset built without the editor, in a terminal of its own.
      export: async ({ preset }, ctx) => {
        const root = rootOf(ctx);
        const command = exportCommand(godotOrFail(), preset);
        if (!command) throw new Error(i18n.t('noExportPath'));
        await terminal.run(command, { title: i18n.t('exportTitle', { name: preset.name }), cwd: root });
        return true;
      },
      openEditor: (args, ctx) => openEditor(rootOf(ctx), i18n.t('godotMissing')),
      // Godot isn't there: Homebrew installs it in a terminal; the sidebar looks again until it is.
      install: async (args, ctx) => {
        await terminal.run(INSTALL, { title: i18n.t('installing'), cwd: rootOf(ctx) });
        return true;
      },
      // What went wrong in the sidebar, as a toast in its window (THEME.md: errors are toasts).
      failed: ({ title, message }) => notify.error({ title, body: String(message || '').slice(-400) }),
    }),
  );
}

export async function deactivate() {}
