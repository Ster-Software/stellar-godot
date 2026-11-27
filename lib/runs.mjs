// The terminal the game last ran in, per project, like the Run bar of VS Code's Godot extension: a new start takes
// over that same terminal (what runs there is stopped first), Herstarten runs the last command again and Stoppen
// stops it. A terminal the user closed is forgotten, and the next start opens a new one. `terminal` is the
// extension API's (terminal.run, rerun and stop).
export function createRuns(terminal) {
  const runs = new Map(); // project root → { id, command, title }

  /** Runs `command` in `root`'s game terminal, or in a new one when there is none (any more). */
  async function start(root, command, title) {
    const run = runs.get(root);
    if (run && await terminal.rerun(run.id, command, { title })) {
      runs.set(root, { ...run, command, title });
      return run.id;
    }
    const { terminal: id } = await terminal.run(command, { title, cwd: root });
    runs.set(root, { id, command, title });
    return id;
  }

  /** `act(run)` on `root`'s game terminal; false (and forgotten) when it is closed. */
  async function withRun(root, act) {
    const run = runs.get(root);
    if (!run) return false;
    if (await act(run)) return true;
    runs.delete(root);
    return false;
  }

  return {
    start,
    restart: (root) => withRun(root, (run) => terminal.rerun(run.id, run.command, { title: run.title })),
    stop: (root) => withRun(root, (run) => terminal.stop(run.id)),
    /** Whether `root` has a game terminal (for Herstarten and Stoppen). */
    running: (root) => runs.has(root),
    /** Terminal `id` ended: whichever project ran in it has none any more. */
    forget(id) {
      for (const [root, run] of runs) if (run.id === id) runs.delete(root);
    },
  };
}
