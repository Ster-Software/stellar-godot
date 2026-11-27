// The Godot sidebar (was Stellar's own Godot tab): the project on top with Starten / Herstarten / Stoppen and the
// Godot editor, then its facts, scenes (each to start alone), autoloads, export presets and plug-ins as sections. The
// main code (main.mjs) does the work and says when something changed.
import { useCallback, useEffect, useState } from 'react';
import { useExtension, useStellar, useT } from 'stellar';
import { Button, Icon, IconButton, Section, Sections } from 'stellar/ui';
import { listedScenes, olderGodot, sceneParts } from '../shared/scenes.js';
import { ProjectFacts, SceneRows, AutoloadRows, ExportRows, PluginRows } from './parts.jsx';

const SEARCH_FROM = 7;
const INSTALL_POLL_MS = 3000;
const IS_MAC = /Mac/.test(navigator.platform);

/** The main code's project info, as a state; loaded again with `reload()` and when main.mjs says something changed. */
function useInfo(extension) {
  const [state, setState] = useState({ data: null, error: '' });
  const reload = useCallback(() => extension.call('info').then(
    (data) => setState({ data, error: '' }), (e) => setState((s) => ({ ...s, error: e.message })),
  ), [extension]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => extension.on('changed', reload), [extension, reload]);
  return { ...state, reload };
}

/** Godot isn't on this computer: what to do, and on a Mac the button that installs it (looked for until it is there). */
function MissingGodot({ onInstall, onInstalled }) {
  const t = useT();
  const [installing, setInstalling] = useState(false);
  useEffect(() => {
    if (!installing) return undefined;
    const timer = setInterval(onInstalled, INSTALL_POLL_MS);
    return () => clearInterval(timer);
  }, [installing, onInstalled]);
  return (
    <div className="mt-3 flex gap-[9px] rounded-lg bg-muted px-[11px] py-2.5 text-[12px]">
      <Icon name="Godot" size={14} className="mt-px shrink-0 text-foreground" />
      <div className="flex min-w-0 flex-col items-start gap-1 [&_p]:mb-1.5 [&_p]:text-muted-foreground [&_p]:leading-[1.45]">
        <strong>{t('notFound')}</strong>
        <p>{t('lookBefore')} <code>godot</code> {t(IS_MAC ? 'lookAfterMac' : 'lookAfter')}</p>
        {IS_MAC && (
          <Button variant="default" onClick={() => { onInstall(); setInstalling(true); }}>
            <Icon name="Download" size={12} /> {installing ? t('reinstall') : t('install')}
          </Button>
        )}
      </div>
    </div>
  );
}

function Header({ info, act, onReload }) {
  const t = useT();
  const { name, mainScene, godot, icon, running } = info;
  const main = mainScene ? sceneParts(mainScene).name : '';
  return (
    <div className="shrink-0 p-4">
      <div className="flex items-center gap-2.5 [&>div]:min-w-0 [&>div]:flex-1">
        {icon ? <img className="size-8 shrink-0 rounded-[7px] object-cover" src={icon} alt="" /> : <Icon name="Godot" size={18} />}
        <div>
          <div className="font-semibold">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{main ? t('mainSceneIs', { name: main }) : t('noMainScene')}</div>
        </div>
        <IconButton size="sm" icon="ExternalLink" title={t('openEditor')} disabled={!godot} onClick={() => act('openEditor', {}, t('editorFailed'))} />
      </div>
      {godot ? (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <Button variant="default" title={main ? t('startFrom', { name: main }) : t('startGame')} onClick={() => act('start', {}, t('startFailed'))}>
            <Icon name="Play" size={11} /> {t('start')}
          </Button>
          <Button variant="outline" disabled={!running} onClick={() => act('restart', {}, t('startFailed'))}>
            <Icon name="RotateCw" size={12} /> {t('restart')}
          </Button>
          <Button variant="outline" disabled={!running} onClick={() => act('stop', {}, t('stop'))}>
            <Icon name="Stop" size={11} /> {t('stop')}
          </Button>
        </div>
      ) : <MissingGodot onInstall={() => act('install', {}, t('installing'))} onInstalled={onReload} />}
    </div>
  );
}

function ScenesToolbar({ query, onQuery }) {
  const t = useT();
  return (
    <div className="flex h-9 items-center gap-2.5 rounded-lg border border-input bg-card pr-1.5 pl-3 text-muted-foreground focus-within:border-ring [&>svg]:shrink-0 [&_input]:h-full [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-sm [&_input]:text-foreground h-8">
      <Icon name="Search" size={15} />
      <input value={query} placeholder={t('searchScenes')} spellCheck={false} aria-label={t('searchScenesLabel')} onChange={(e) => onQuery(e.target.value)} />
    </div>
  );
}

export default function GodotSidebar() {
  const extension = useExtension();
  const stellar = useStellar();
  const t = useT();
  const info = useInfo(extension);
  const [query, setQuery] = useState('');

  // A call to main.mjs; what goes wrong is a toast titled `title`.
  const act = (method, args, title) => extension.call(method, args)
    .catch((e) => extension.call('failed', { title, message: e.message }).catch(() => {}));

  if (info.error && !info.data) return <div className="p-4 text-center text-muted-foreground">{info.error.includes('project') ? t('openProject') : t('loadError')}</div>;
  if (!info.data) return null;
  if (!info.data.exists) return <div className="p-4 text-center text-muted-foreground">{t('none')}</div>;

  const data = info.data;
  const scenes = data.scenes || [];
  const shown = listedScenes(scenes, data.mainScene, query);
  const warning = olderGodot(data.engine, data.godotVersion) ? t('versionWarning', { engine: data.engine, installed: data.godotVersion }) : '';
  const run = (scene) => act('start', { scene }, t('startFailed'));
  const openScript = (res) => stellar.openFile(res.replace(/^res:\/\//, ''));
  const exportPreset = (preset) => act('export', { preset }, t('exportTitle', { name: preset.name }));

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header info={data} act={act} onReload={info.reload} />
      <Sections id="godot">
        <Section id="project" title={t('project')} fit>
          <ProjectFacts info={data} warning={warning} />
        </Section>
        <Section id="scenes" title={t('scenes')} count={scenes.length} flush weight={3}
          toolbar={scenes.length >= SEARCH_FROM && <ScenesToolbar query={query} onQuery={setQuery} />}>
          <SceneRows scenes={shown} mainScene={data.mainScene} any={scenes.length > 0} onRun={run} />
        </Section>
        {data.autoloads.length > 0 && (
          <Section id="autoloads" title="Autoloads" count={data.autoloads.length} flush weight={1} open={false}>
            <AutoloadRows autoloads={data.autoloads} onOpen={openScript} />
          </Section>
        )}
        {data.exportPresets.length > 0 && (
          <Section id="export" title={t('export')} count={data.exportPresets.length} flush weight={1}>
            <ExportRows presets={data.exportPresets} canBuild={Boolean(data.godot)} onExport={exportPreset} />
          </Section>
        )}
        {data.addons.length > 0 && (
          <Section id="plugins" title={t('plugins')} count={data.addons.length} flush weight={1} open={false}>
            <PluginRows addons={data.addons} />
          </Section>
        )}
      </Sections>
    </div>
  );
}
