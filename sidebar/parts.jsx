// The rows of the Godot sidebar's sections (index.jsx), in the look of Stellar's own lists: the project's facts, its
// scenes (each to start alone), autoloads (a click opens the script), export presets and plug-ins.
import { useT } from 'stellar';
import { Icon } from 'stellar/ui';
import { sceneParts } from '../shared/scenes.js';

const PLATFORM_ICONS = { iOS: 'Apple', macOS: 'Apple', Android: 'Android', Web: 'Globe', 'Windows Desktop': 'Windows', Linux: 'Terminal' };

function Fact({ label, children, warn }) {
  return (
    <div className={`contents [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:truncate ${warn ? '[&_dd]:text-destructive' : '[&_dd]:text-foreground'}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** What the project is made with: Godot version, renderer, screen, scripts, input actions, its description. */
export function ProjectFacts({ info, warning }) {
  const t = useT();
  const { engine, godotVersion, renderer, window: screen, scripts, inputActions, csharp, description } = info;
  const code = [scripts.gd && `${scripts.gd} GDScript`, (scripts.cs || csharp) && `${scripts.cs} C#`].filter(Boolean).join(' · ');
  return (
    <>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        <Fact label="Godot" warn={Boolean(warning)}>
          <span title={warning || undefined}>{engine || t('unknown')}{godotVersion ? ` · ${t('installedVersion', { version: godotVersion })}` : ''}</span>
        </Fact>
        <Fact label="Renderer">{renderer}</Fact>
        <Fact label={t('screen')}>{screen.width} × {screen.height}{screen.orientation ? ` · ${screen.orientation}` : ''}</Fact>
        {code && <Fact label="Scripts">{code}</Fact>}
        {inputActions > 0 && <Fact label={t('input')}>{t('actions', { count: inputActions })}</Fact>}
      </dl>
      {warning && <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><Icon name="ShieldAlert" size={12} /> {warning}</p>}
      {description && <p className="mt-2 text-pretty text-[12px] leading-[1.45] text-muted-foreground">{description}</p>}
    </>
  );
}

/** A row with an icon, a name and a line under it, and optionally one row action. */
function Row({ icon, name, sub, action }) {
  return (
    <div className="group/row relative flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-accent [--row-bg:var(--color-accent)] min-h-0 gap-2.5 py-[5px]">
      <span className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-muted text-muted-foreground text-muted-foreground"><Icon name={icon} size={14} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[12.5px] font-medium text-foreground">{name}</span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{sub}</span>
      </span>
      {action && <span className="pointer-events-none absolute inset-y-0 right-0 z-2 flex items-center gap-0.5 rounded-r-md bg-accent py-0 pr-1.5 pl-2 opacity-0 group-hover/row:opacity-100 group-hover/row:*:pointer-events-auto has-[:focus-visible]:opacity-100 has-[:focus-visible]:*:pointer-events-auto">{action}</span>}
    </div>
  );
}

const RowAction = ({ icon, label, ariaLabel, onClick }) => (
  <button type="button" className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-[5px] rounded-sm border-0 bg-input/60 px-2 text-xs font-medium text-foreground hover:bg-input" onClick={onClick} aria-label={ariaLabel}>
    <Icon name={icon} size={10} /> {label}
  </button>
);

/** The scenes in the sidebar's order (listedScenes), each with Starten. */
export function SceneRows({ scenes, mainScene, any, onRun }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-px">
      {scenes.map((scene) => {
        const { name, folder } = sceneParts(scene);
        return (
          <Row key={scene} icon="Godot" sub={folder || 'res://'}
            name={<>{name} {scene === mainScene && <span className="rounded-sm bg-muted px-[5px] text-[10px] font-medium text-muted-foreground">{t('mainScene')}</span>}</>}
            action={<RowAction icon="Play" label={t('run')} ariaLabel={t('runScene', { name })} onClick={() => onRun(scene)} />} />
        );
      })}
      {!scenes.length && <div className="flex items-center gap-1.5 px-2 py-2.5 text-[12px] text-muted-foreground">{any ? t('noSceneMatch') : t('noScenes')}</div>}
    </div>
  );
}

/** Scripts Godot loads at start (singletons); a click opens one in the editor. */
export function AutoloadRows({ autoloads, onOpen }) {
  return (
    <div className="flex flex-col gap-px">
      {autoloads.map((a) => (
        <button type="button" key={a.name} className="group/row relative flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-accent [--row-bg:var(--color-accent)] min-h-0 gap-2.5 py-[5px] w-full cursor-pointer border-0 bg-transparent text-left text-inherit" onClick={() => onOpen(a.path)}>
          <span className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-muted text-muted-foreground text-muted-foreground"><Icon name="Code" size={14} /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[12.5px] font-medium text-foreground">{a.name}</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{a.path.replace(/^res:\/\//, '')}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** The export presets; Exporteren builds one without the editor, in a terminal. */
export function ExportRows({ presets, canBuild, onExport }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-px">
      {presets.map((preset) => (
        <Row key={preset.name} icon={PLATFORM_ICONS[preset.platform] || 'Package'} name={preset.name}
          sub={preset.exportPath || t('noExportPath')}
          action={canBuild && preset.exportPath && (
            <RowAction icon="Upload" label={t('export')} ariaLabel={t('exportPreset', { name: preset.name })} onClick={() => onExport(preset)} />
          )} />
      ))}
    </div>
  );
}

/** The addons folder: editor plug-ins (on or off in Projectinstellingen) and extensions. */
export function PluginRows({ addons }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-px">
      {addons.map((addon) => (
        <Row key={addon.id} icon="Puzzle"
          name={<>{addon.name} {!addon.enabled && <span className="rounded-sm bg-muted px-[5px] text-[10px] font-medium text-muted-foreground">{t('pluginOff')}</span>}</>}
          sub={[addon.version && t('version', { version: addon.version }), `addons/${addon.id}`].filter(Boolean).join(' · ')} />
      ))}
    </div>
  );
}
