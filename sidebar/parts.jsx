// The rows of the Godot sidebar's sections (index.jsx), in the look of Stellar's own lists: the project's facts, its
// scenes (each to start alone), autoloads (a click opens the script), export presets and plug-ins.
import { useT } from 'stellar';
import { Icon } from 'stellar/ui';
import { sceneParts } from '../shared/scenes.js';

const PLATFORM_ICONS = { iOS: 'Apple', macOS: 'Apple', Android: 'Android', Web: 'Globe', 'Windows Desktop': 'Windows', Linux: 'Terminal' };

function Fact({ label, children, warn }) {
  return (
    <div className={`godot-fact${warn ? ' warn' : ''}`}>
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
      <dl className="godot-facts">
        <Fact label="Godot" warn={Boolean(warning)}>
          <span title={warning || undefined}>{engine || t('unknown')}{godotVersion ? ` · ${t('installedVersion', { version: godotVersion })}` : ''}</span>
        </Fact>
        <Fact label="Renderer">{renderer}</Fact>
        <Fact label={t('screen')}>{screen.width} × {screen.height}{screen.orientation ? ` · ${screen.orientation}` : ''}</Fact>
        {code && <Fact label="Scripts">{code}</Fact>}
        {inputActions > 0 && <Fact label={t('input')}>{t('actions', { count: inputActions })}</Fact>}
      </dl>
      {warning && <p className="godot-warning"><Icon name="ShieldAlert" size={12} /> {warning}</p>}
      {description && <p className="godot-description">{description}</p>}
    </>
  );
}

/** A row with an icon, a name and a line under it, and optionally one row action. */
function Row({ icon, name, sub, action }) {
  return (
    <div className="npm-row npm-script-row">
      <span className="npm-row-icon npm-script-icon"><Icon name={icon} size={14} /></span>
      <span className="npm-script-text">
        <span className="npm-script-name">{name}</span>
        <span className="npm-script-command">{sub}</span>
      </span>
      {action && <span className="row-actions">{action}</span>}
    </div>
  );
}

const RowAction = ({ icon, label, ariaLabel, onClick }) => (
  <button type="button" className="row-action" onClick={onClick} aria-label={ariaLabel}>
    <Icon name={icon} size={10} /> {label}
  </button>
);

/** The scenes in the sidebar's order (listedScenes), each with Starten. */
export function SceneRows({ scenes, mainScene, any, onRun }) {
  const t = useT();
  return (
    <div className="npm-list">
      {scenes.map((scene) => {
        const { name, folder } = sceneParts(scene);
        return (
          <Row key={scene} icon="Godot" sub={folder || 'res://'}
            name={<>{name} {scene === mainScene && <span className="npm-row-dev">{t('mainScene')}</span>}</>}
            action={<RowAction icon="Play" label={t('run')} ariaLabel={t('runScene', { name })} onClick={() => onRun(scene)} />} />
        );
      })}
      {!scenes.length && <div className="npm-empty">{any ? t('noSceneMatch') : t('noScenes')}</div>}
    </div>
  );
}

/** Scripts Godot loads at start (singletons); a click opens one in the editor. */
export function AutoloadRows({ autoloads, onOpen }) {
  return (
    <div className="npm-list">
      {autoloads.map((a) => (
        <button type="button" key={a.name} className="npm-row npm-script-row godot-row-button" onClick={() => onOpen(a.path)}>
          <span className="npm-row-icon npm-script-icon"><Icon name="Code" size={14} /></span>
          <span className="npm-script-text">
            <span className="npm-script-name">{a.name}</span>
            <span className="npm-script-command">{a.path.replace(/^res:\/\//, '')}</span>
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
    <div className="npm-list">
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
    <div className="npm-list">
      {addons.map((addon) => (
        <Row key={addon.id} icon="Puzzle"
          name={<>{addon.name} {!addon.enabled && <span className="npm-row-dev">{t('pluginOff')}</span>}</>}
          sub={[addon.version && t('version', { version: addon.version }), `addons/${addon.id}`].filter(Boolean).join(' · ')} />
      ))}
    </div>
  );
}
