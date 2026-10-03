import { useEffect, useState } from 'react';
import { LAUNCH_PARENT, splitTicks, suggestDomain, type ShipMethod, type ShipView } from '../../../shared/ship';
import { api } from '../api';
import { useStore } from '../store';
import { confirmDialog } from './Confirm';
import { Panel } from './Overlays';
import './shipPanel.css';

// SHIP IT, opened from a chamber's sign (or its row in the ledger): what's live, what's waiting, and the buttons that
// put work live, take it back, and give the app its own address. The server decides what's allowed (shared/ship.ts);
// this shows it. Spec: docs/superpowers/specs/2026-10-03-ship-it-design.md

const METHODS: { id: Exclude<ShipMethod, 'none'>; name: string; what: string }[] = [
  { id: 'git-auto', name: 'Every merge goes live', what: 'GitHub builds it on Vercel and each merge to main goes live on its own. For building something new on its free vercel.app address.' },
  { id: 'git-promote', name: 'GitHub builds, you ship', what: 'GitHub builds every merge on Vercel, held back; Ship it puts the newest build of main live in seconds.' },
  { id: 'cli', name: 'Deploy from the dungeon', what: 'The dungeon deploys main with the Vercel CLI when you press Ship it. Works without the GitHub connection; has Preview.' },
];

/** A message with its `code` spans shown as code. */
const Msg = ({ text }: { text: string }) => (
  <>
    {splitTicks(text).map((p, i) => (p.code ? <code key={i}>{p.text}</code> : <span key={i}>{p.text}</span>))}
  </>
);

const short = (sha: string | null) => (sha ? sha.slice(0, 7) : '–');
const when = (at: number) => new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function Setup({ repoId, fullName, onDone }: { repoId: string; fullName: string; onDone?: () => void }) {
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof api.shipOptions>> | null>(null);
  const [method, setMethod] = useState<Exclude<ShipMethod, 'none'>>('git-auto');
  const [project, setProject] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const name = fullName.split('/')[1] ?? fullName;
  useEffect(() => {
    void api.shipOptions().then(setOpts, () => setOpts({ loggedInAs: null, teams: [], scope: null, projects: [] }));
  }, []);
  if (!opts) return <p className="muted">Asking Vercel…</p>;
  if (!opts.loggedInAs)
    return (
      <div className="ship-note">
        <p>
          The Vercel CLI isn't logged in on this machine. Open a terminal, run <code>vercel login</code>, then press Check.
        </p>
        <button className="btn" onClick={() => void api.shipOptions().then(setOpts)}>
          Check
        </button>
      </div>
    );
  const existing = opts.projects.find((p) => p.name === name);
  const chosen = project || (existing ? existing.id : '__new');
  const go = async () => {
    setBusy(true);
    try {
      const p = opts.projects.find((x) => x.id === chosen);
      await api.shipSetup(repoId, { method, scope: opts.scope!, ...(p ? { project: p } : { create: name }) });
      onDone?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ship-setup">
      <p>
        Logged in to Vercel as <b>{opts.loggedInAs}</b>. How should this chamber ship?
      </p>
      <div className="ship-methods" role="radiogroup">
        {METHODS.map((m) => (
          <label key={m.id} className={`ship-method${method === m.id ? ' on' : ''}`}>
            <input type="radio" name="ship-method" checked={method === m.id} onChange={() => setMethod(m.id)} />
            <b>{m.name}</b>
            <span className="muted small">{m.what}</span>
          </label>
        ))}
      </div>
      <div className="row wrap">
        <label>
          <span className="muted small">Team</span>{' '}
          <select value={opts.scope ?? ''} onChange={(e) => void api.shipOptions(e.target.value).then(setOpts)}>
            {opts.teams.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted small">Vercel project</span>{' '}
          <select value={chosen} onChange={(e) => setProject(e.target.value)}>
            {!existing && <option value="__new">Create “{name}”</option>}
            {opts.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={() => void go()}>
        {busy ? 'Setting up…' : 'Set up'}
      </button>
    </div>
  );
}

export function ShipPanel({ repoId }: { repoId: string }) {
  const repo = useStore((s) => s.repos.find((r) => r.id === repoId));
  const [domain, setDomain] = useState('');
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    if (repo) void api.shipCheck(repo.id).catch(() => undefined);
  }, [repo?.id]);
  if (!repo) return <Panel title="SHIP IT">This chamber no longer exists.</Panel>;
  const s: ShipView = repo.ship;
  const name = repo.fullName;

  const ship = async () => {
    if (!s.firstShipDone) {
      const yes = await confirmDialog({
        title: `Put ${name} on the internet?`,
        body: <p>This is the first ship of this chamber: the app becomes public at {s.domains[0] ?? 'its Vercel address'}.</p>,
        confirm: 'Ship it',
        tone: 'warn',
      });
      if (!yes) return;
    }
    await api.shipIt(repo.id, true).catch(() => undefined);
  };
  const undo = async (id?: string) => {
    const to = id ? s.earlier.find((d) => d.id === id) : s.earlier[0];
    if (!to) return;
    const yes = await confirmDialog({ title: 'Take the live site back?', body: <p>The live site goes back to {short(to.sha)} from {when(to.createdAt)}. <code>main</code> keeps its changes.</p>, confirm: 'Go back', tone: 'danger' });
    if (yes) await api.shipUndo(repo.id, id).catch(() => undefined);
  };
  const launch = async () => {
    const d = (domain || suggestDomain(name, LAUNCH_PARENT)).trim();
    const yes = await confirmDialog({
      title: `Launch at ${d}?`,
      body: <p>The app gets this public address{s.method === 'git-auto' ? ', and from now on merges wait for Ship it instead of going live by themselves' : ''}.</p>,
      confirm: 'Launch',
      tone: 'warn',
    });
    if (yes) await api.shipLaunch(repo.id, d).catch(() => undefined);
  };
  const lastUndo = s.log.find((e) => e.action === 'undo');
  const paused = s.method === 'git-auto' && s.autoAssign === false;

  return (
    <Panel title={<>SHIP IT · {name}</>} className="ship-panel" wide>
      {s.method === 'none' || changing ? (
        <Setup repoId={repo.id} fullName={name} onDone={() => setChanging(false)} />
      ) : (
        <>
          {s.error && (
            <div className="term-error small">
              <Msg text={s.error} />
            </div>
          )}
          <section className="ship-live">
            <h3>Live now</h3>
            {s.live ? (
              <p>
                <a href={`https://${s.domains[0] ?? s.live.url}`} target="_blank" rel="noreferrer">
                  {s.domains[0] ?? s.live.url}
                </a>{' '}
                · <code>{short(s.live.sha)}</code> · since {when(s.live.createdAt)}
              </p>
            ) : (
              <p className="muted">Nothing is live yet.</p>
            )}
            <p className="muted small">
              {METHODS.find((m) => m.id === s.method)?.name} · Vercel project <b>{s.project?.name}</b> · <code>main</code> at <code>{short(s.mainSha)}</code>, checks {s.mainChecks}
            </p>
          </section>

          <section className="ship-waiting">
            <h3>Waiting to ship</h3>
            {s.waiting.length ? (
              <ul>
                {s.waiting.map((w) => (
                  <li key={w.number}>
                    <a href={`${repo.url}/pull/${w.number}`} target="_blank" rel="noreferrer">
                      #{w.number}
                    </a>{' '}
                    {w.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing: the live site is on <code>main</code>.</p>
            )}
          </section>

          {s.undoneSha && (
            <section className="ship-undone">
              <p>
                Undone: the live site went back. <code>main</code> still has the change that broke it.
              </p>
              <div className="row wrap">
                <button className="btn btn-small" onClick={() => void api.shipFollowUp(repo.id, 'revert').catch(() => undefined)}>
                  Revert those changes
                </button>
                <button className="btn btn-small" onClick={() => void api.shipFollowUp(repo.id, 'fix').catch(() => undefined)}>
                  Fix it forward
                </button>
              </div>
              {lastUndo && (
                <p className="muted small">
                  <Msg text={lastUndo.note} />
                </p>
              )}
            </section>
          )}

          <div className="ship-actions row wrap">
            {s.method !== 'git-auto' && (
              <button className="btn btn-primary ship-it" disabled={!!s.blocked} title={s.blocked?.replace(/`/g, '') ?? 'Put what is waiting live'} onClick={() => void ship()}>
                {s.busy === 'shipping' ? 'Shipping…' : 'Ship it'}
              </button>
            )}
            {s.method === 'cli' && (
              <button className="btn" disabled={!!s.busy} onClick={() => void api.shipPreview(repo.id).catch(() => undefined)}>
                {s.busy === 'previewing' ? 'Making a preview…' : 'Preview'}
              </button>
            )}
            {paused && (
              <button className="btn" disabled={!!s.busy} onClick={() => void api.shipResume(repo.id).catch(() => undefined)}>
                Resume going live with merges
              </button>
            )}
            <button className="btn" disabled={!!s.busy || !s.earlier.length} onClick={() => void undo()}>
              {s.busy === 'undoing' ? 'Going back…' : 'Undo last ship'}
            </button>
            {s.earlier.length > 1 && (
              <select aria-label="Go back to an earlier build" value="" onChange={(e) => e.target.value && void undo(e.target.value)}>
                <option value="">Go back to…</option>
                {s.earlier.map((d) => (
                  <option key={d.id} value={d.id}>
                    {short(d.sha)} · {when(d.createdAt)}
                  </option>
                ))}
              </select>
            )}
            <button className="btn btn-ghost" onClick={() => void api.shipCheck(repo.id).catch(() => undefined)}>
              Check
            </button>
            <button className="btn btn-ghost" disabled={!!s.busy} onClick={() => setChanging(true)}>
              Change how it ships
            </button>
          </div>
          {s.blocked && s.method !== 'git-auto' && (
            <p className="muted small">
              <Msg text={s.blocked} />
            </p>
          )}
          {s.previewUrl && (
            <p className="small">
              Preview:{' '}
              <a href={`https://${s.previewUrl}`} target="_blank" rel="noreferrer">
                {s.previewUrl}
              </a>
            </p>
          )}

          {!s.domains.some((d) => !d.endsWith('.vercel.app')) && (
            <section className="ship-launch">
              <h3>Launch</h3>
              <p className="muted small">When it's ready: give it its own address{s.method === 'git-auto' ? ' and make Ship it the way work goes live' : ''}.</p>
              <div className="row wrap">
                <input value={domain} placeholder={suggestDomain(name, LAUNCH_PARENT)} onChange={(e) => setDomain(e.target.value)} aria-label="Address" />
                <button className="btn" disabled={!!s.busy} onClick={() => void launch()}>
                  Launch
                </button>
              </div>
            </section>
          )}

          <section className="ship-log">
            <h3>Ship log</h3>
            {s.log.length ? (
              <ol>
                {s.log.slice(0, 12).map((e) => (
                  <li key={e.at} className={e.ok ? '' : 'bad'}>
                    <span className="muted small">{when(e.at)}</span> <Msg text={e.note} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Nothing shipped from the dungeon yet.</p>
            )}
            {s.project && (
              <p className="muted small">
                Environment variables and other settings:{' '}
                <a href={`https://vercel.com/${s.project.scope}/${s.project.name}/settings`} target="_blank" rel="noreferrer">
                  the project on Vercel
                </a>
              </p>
            )}
          </section>
        </>
      )}
    </Panel>
  );
}
