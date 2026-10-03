import { useMemo } from 'react';
import { repoOnFloor, usePhoneBadge, useStore } from '../store';
import { CEO_ID } from '../../../shared/types';
import { HeldHint } from './HeldHint';
import { WorkersPanel } from './WorkersPanel';
import { officeUpdateChip } from '../officeUpdate';
import { Icon, IconText } from './Icon';

/** While the office is on its way to updating itself (or restarting to do it); opens the console's Office row. */
function OfficeUpdateChip() {
  const text = useStore((s) => (s.restarting ? '⟳ Dungeon restarting…' : officeUpdateChip(s.officeUpdate)));
  const overlay = useStore((s) => s.overlay);
  const openOverlay = useStore((s) => s.openOverlay);
  if (!text || overlay?.kind === 'manager') return null;
  return (
    <button className="office-chip" onClick={() => openOverlay({ kind: 'manager', tab: 'floors' })} title="The dungeon is updating itself. Open the Overlord's ledger">
      {text}
    </button>
  );
}

/** The phone in your pocket: always one key (or click) away, with a badge when the CEO is waiting on you. */
function PhoneButton() {
  const badge = usePhoneBadge();
  const started = useStore((s) => s.started);
  const overlay = useStore((s) => s.overlay);
  const openOverlay = useStore((s) => s.openOverlay);
  const ceo = useStore((s) => s.agents[CEO_ID]);
  if (!started || overlay?.kind === 'phone') return null;
  const busy = ceo?.status === 'working';
  return (
    <button className={`phone-btn ${badge ? 'phone-btn-ring' : ''}`} onClick={() => openOverlay({ kind: 'phone' })} title="Your scroll (P)">
      <span className="phone-btn-icon">
        <Icon name="scroll" />
      </span>
      {badge > 0 && <span className="badge phone-btn-badge">{badge}</span>}
      <span className="phone-btn-label">
        <kbd>P</kbd> {badge ? `${badge} waiting` : busy ? `${ceo.name} is working` : 'Scroll'}
      </span>
    </button>
  );
}

export function HUD() {
  const floor = useStore((s) => s.floor);
  const repos = useStore((s) => s.repos);
  const agents = useStore((s) => s.agents);
  const settings = useStore((s) => s.settings);
  const connected = useStore((s) => s.connected);
  const restarting = useStore((s) => s.restarting);
  const demo = useStore((s) => s.demo);
  const user = useStore((s) => s.user);
  const ghReady = useStore((s) => s.ghReady);
  const ghError = useStore((s) => s.ghError);
  const focus = useStore((s) => s.focus);
  const held = useStore((s) => s.held);
  const overlay = useStore((s) => s.overlay);
  const locked = useStore((s) => s.locked);
  const dragLook = useStore((s) => s.dragLook);
  const started = useStore((s) => s.started);
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  const repo = floor === 0 ? null : repoOnFloor(repos, floor);
  const running = useMemo(() => Object.values(agents).filter((a) => a.status === 'working' || a.status === 'preparing').length, [agents]);
  const floorAgents = repo ? Object.values(agents).filter((a) => a.repoId === repo.id) : [];
  const qa = useStore((s) => s.qa);
  const floorQa = repo ? Object.values(qa).filter((q) => q.repoId === repo.id) : [];

  return (
    <div className="hud">
      <div className="hud-floor" style={{ ['--accent' as string]: repo?.color ?? '#a0441c' }}>
        <div className="floor-num">{repo ? repo.floor : 'G'}</div>
        <div>
          <div className="floor-name">{repo ? repo.fullName : `${settings.companyName || 'Code Dungeon'} · Great hall`}</div>
          <div className="floor-sub">
            {repo
              ? `${floorAgents.length} in the guild · ${floorAgents.filter((a) => a.status === 'working' || a.status === 'preparing').length} working · ${floorQa.filter((q) => q.status !== 'passed').length} in QA · ${floorQa.filter((q) => q.status === 'passed').length} ready to merge`
              : `${repos.length} chamber${repos.length === 1 ? '' : 's'} off the gallery`}
          </div>
        </div>
      </div>

      <div className="hud-status">
        {demo && <span className="pill pill-demo">DEMO</span>}
        <span className={`pill ${connected ? 'pill-ok' : restarting ? 'pill-demo' : 'pill-bad'}`}>{connected ? '● live' : restarting ? '○ restarting' : '○ reconnecting'}</span>
        <span className="pill">
          <Icon name="gear" /> {settings.sessionLimit ? `${running}/${settings.sessionLimit}` : running} sessions
        </span>
        {user && (
          <span className="pill">
            <Icon name="hood" /> {user}
          </span>
        )}
      </div>

      <WorkersPanel />
      <OfficeUpdateChip />

      {!ghReady && ghError && <div className="hud-banner">
          <Icon name="warning" /> {ghError}
        </div>}

      {started && !overlay && <div className={`crosshair ${focus ? 'crosshair-hot' : ''}`} />}
      {started && !overlay && focus && (
        <div className="hud-hint">
          <kbd>E</kbd> {!held && <>/ <kbd>Click</kbd> </>}
          {focus.label}
        </div>
      )}
      {started && !overlay && <HeldHint />}
      {started && !overlay && !locked && !dragLook && <div className="hud-resume">Click to look around</div>}
      {started && !(settings.setupDone && settings.tutorialStep >= 0) && (
        <div className="hud-help">
          <kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>E</kbd> / <kbd>Click</kbd> interact · <kbd>P</kbd> scroll · <kbd>Tab</kbd> who's working · <kbd>C</kbd> call the cat · <kbd>H</kbd> help · <kbd>B</kbd> guide · <kbd>Esc</kbd> free mouse
        </div>
      )}

      <PhoneButton />
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.level}`} onClick={() => dismiss(t.id)}>
            <IconText text={t.text} />
          </div>
        ))}
      </div>
    </div>
  );
}
