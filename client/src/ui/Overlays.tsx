import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useStore } from '../store';
import { SENSITIVITY_MAX, SENSITIVITY_MIN, useLookPrefs } from '../world/look';
import { CEO_ID } from '../../../shared/types';
import { AppViewer } from './AppViewer';
import { ElevatorPanel } from './ElevatorPanel';
import { KanbanView } from './KanbanView';
import { ManagerConsole } from './ManagerConsole';
import { Phone } from './Phone';
import { SystemPanel } from './SystemPanel';
import { TerminalView } from './TerminalView';
import { getAudioPrefs, setAudioPrefs, subscribeAudio } from './sfx';

// Closing a panel grabs the mouse again right away (world/lookLock.ts; "Grab the mouse when panels
// close" in help turns that off), and mouse presses are swallowed for a moment so a double click on
// ✕ or the backdrop can't act on whatever the crosshair lands on.
export function closeOverlay() {
  useStore.getState().openOverlay(null);
}

export function Panel({
  title,
  children,
  wide,
  accent,
  className,
  onClose,
}: {
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  accent?: string;
  className?: string;
  onClose?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose ? onClose() : closeOverlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <div className={`panel ${wide ? 'panel-wide' : ''} ${className ?? ''}`} style={{ ['--accent' as string]: accent ?? '#a0441c' }}>
        <div className="panel-head">
          <div className="panel-title">{title}</div>
          <button className="panel-x" onClick={() => (onClose ? onClose() : closeOverlay())} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}

/** Office volume and mute; saved in this browser. */
export function SoundControls() {
  const { volume, muted } = useSyncExternalStore(subscribeAudio, getAudioPrefs);
  return (
    <div className="row wrap sound">
      <label className="toggle">
        <input type="checkbox" checked={!muted} onChange={(e) => setAudioPrefs({ muted: !e.target.checked })} /> {muted ? '🔇' : '🔊'} Sound
      </label>
      <label className="sound-volume">
        <span className="muted small">Volume</span>
        <input type="range" min={0} max={100} step={5} value={volume} disabled={muted} aria-label="Volume" onChange={(e) => setAudioPrefs({ volume: Number(e.target.value) })} />
        <span className="small sound-pct">{volume}%</span>
      </label>
    </div>
  );
}

function MouseSettings() {
  const { sensitivity, invertY, grabOnClose, set } = useLookPrefs();
  return (
    <div className="mouse-settings">
      <label className="mouse-sens">
        <span>Mouse sensitivity</span>
        <input type="range" min={SENSITIVITY_MIN} max={SENSITIVITY_MAX} step={0.05} value={sensitivity} onChange={(e) => set({ sensitivity: Number(e.target.value) })} />
        <b>{sensitivity.toFixed(2)}×</b>
        {sensitivity !== 1 && (
          <button className="btn btn-ghost btn-small" onClick={() => set({ sensitivity: 1 })}>
            Reset
          </button>
        )}
      </label>
      <label className="toggle">
        <input type="checkbox" checked={invertY} onChange={(e) => set({ invertY: e.target.checked })} /> Invert Y (push the mouse forward to look down)
      </label>
      <label className="toggle">
        <input type="checkbox" checked={grabOnClose} onChange={(e) => set({ grabOnClose: e.target.checked })} /> Grab the mouse when panels close
      </label>
    </div>
  );
}

function Help() {
  return (
    <Panel title="How the dungeon works">
      <div className="help">
        <h3>Moving around</h3>
        <p>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> walk · <kbd>Shift</kbd> run · mouse to look · <kbd>E</kbd> or left click interacts with whatever the crosshair is on (the first click only grabs the mouse) · <kbd>Esc</kbd> frees the mouse. Closing a panel grabs it again.
        </p>
        <MouseSettings />
        <h3>The cat</h3>
        <p>
          A black cat lives in the dungeon and thinks she runs it. She sleeps by the hearth, sits on the bar, keeps the coders company and takes the DungeonMaster's desk when he isn't looking. Press <kbd>C</kbd> to call her: she'll ignore you for a moment, then follow you about. She never gets in your way.
        </p>
        <h3>Darts</h3>
        <p>
          The dart board hangs on the great hall's south wall, at the west end. Aim at it and press <kbd>E</kbd> to take the three darts. Click or press <kbd>F</kbd> to throw one: a tap lobs it, holding throws harder.
          Darts stick only in the board; a round is three darts, scored like the real game (doubles, trebles, 25 and the bull), and the chalk tally beside it keeps the best round. Press <kbd>E</kbd> on the board again to collect them. <kbd>G</kbd> puts the darts back on the ledge.
        </p>
        <h3>Sound</h3>
        <p>
          The dungeon's bell tolls when a PR is ready to merge, fails QA or gets merged, when someone hits an error and when a new recruit arrives. <kbd>M</kbd> mutes or unmutes anywhere.
        </p>
        <SoundControls />
        <h3>The dungeon</h3>
        <p>
          The great hall: your study is the room at the back left, the DungeonMaster's quarters are at the back right, and recruits wait on the chairs along the east wall. Every connected GitHub repo gets its own
          chamber off the gallery: walk through the archway in the middle of the south wall, or use the directory beside it to walk straight in.
        </p>
        <h3>Your scroll</h3>
        <p>
          Press <kbd>P</kbd> anywhere to take out your scroll. Write to the DungeonMaster, approve or decline the recruits they put forward, and see every project at a glance. The red badge counts decisions and messages waiting for you. In the chat, and in a coder's
          terminal, <kbd>Enter</kbd> sends and <kbd>Shift</kbd>+<kbd>Enter</kbd> starts a new line.
        </p>
        <h3>Who's working</h3>
        <p>
          The list at the top right shows everyone who is working right now (in this chamber, or in every chamber from the hall) with their latest thought, reply or tool call. Click someone to watch their terminal. <kbd>Tab</kbd>{' '}
          shows or hides it.
        </p>
        <h3>The DungeonMaster</h3>
        <p>
          The DungeonMaster studies every new chamber, writes its QA brief, gives each coder a job that fits the project, turns your project briefs into issues and puts forward recruits. Recruits wait for your approval unless you switch
          recruiting to auto in the Overlord's ledger.
        </p>
        <h3>Your guild</h3>
        <p>
          Each coder is a real coding agent running in its own terminal, working in its own git worktree. Walk up behind them to read their slate, or press <kbd>E</kbd> (or click) on a bench to open their terminal: watch it live, type into it, send them instructions, stop them or hand them another issue. Aim at an empty bench and press <kbd>E</kbd> to recruit, or click it and confirm.
        </p>
        <h3>The assay room</h3>
        <p>
          The testers in aprons along the east wall check every pull request before it can be merged. They run the tests, click through the change in a real browser, and post a report with screenshots on the PR. If a PR
          fails, it goes back to the coder who wrote it, who fixes it and sends it back to QA.
        </p>
        <h3>The notice board</h3>
        <p>
          <b>Backlog</b>: open issues nobody has picked up. <b>In progress</b>: coders at work. <b>In QA</b>: being tested or fixed. <b>Ready to merge</b>: QA passed, waiting for you. Press <kbd>E</kbd> or click the board to
          assign, send to QA, merge and file new issues.
        </p>
      </div>
    </Panel>
  );
}

export function Overlays() {
  const overlay = useStore((s) => s.overlay);
  if (!overlay) return null;
  switch (overlay.kind) {
    case 'terminal':
      return overlay.agentId === CEO_ID ? <ManagerConsole initialTab="ceo" /> : <TerminalView agentId={overlay.agentId} />;
    case 'phone':
      return <Phone tab={overlay.tab} requestId={overlay.requestId} />;
    case 'kanban':
      return <KanbanView repoId={overlay.repoId} />;
    case 'app':
      return <AppViewer repoId={overlay.repoId} />;
    case 'elevator':
      return <ElevatorPanel />;
    case 'manager':
      return <ManagerConsole initialTab={overlay.tab} initialRepo={overlay.repoId} />;
    case 'help':
      return <Help />;
    case 'system':
      return <SystemPanel />;
  }
}
