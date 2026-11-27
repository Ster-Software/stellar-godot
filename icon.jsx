// The Godot extension's icon in the activity bar: Stellar's own Godot icon, in the bar's colours. It only shows in
// windows whose project has a project.godot (main.mjs).
import { Icon } from 'stellar/ui';

export default function GodotIcon({ active, hover }) {
  return (
    <span style={{ display: 'inline-flex', color: active || hover ? 'var(--text)' : 'var(--muted)' }}>
      <Icon name="Godot" size={21} />
    </span>
  );
}
