import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { isBusy, pendingRequests, qaKey, unreadMessages, useStore, type PhoneTab } from '../store';
import { CEO_ID, type HireRequestView, type PhoneMessage } from '../../../shared/types';
import { Markdown } from './Markdown';
import { MessageBox } from './MessageBox';
import { closeOverlay } from './Overlays';
import { effectiveModel } from '../../../shared/models';
import { letterProblem } from '../../../shared/letters';
import { Icon, IconText } from './Icon';
import type { IconName } from './icons';
import { canonicalHour, presenceText, sealInitial, waxOutline } from './scroll';

// The Overlord's scroll: write to the DungeonMaster, decide on recruits and see the whole realm at a glance
// without walking anywhere. Press P anywhere in the dungeon. (Its code and classes still say "phone".)

async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined; // api() already toasted the error
  }
}

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** A woodcut initial in ink on parchment, framed by a printer's double rule, with the bearer's tincture in a lozenge. */
export function Seal({ name, color, size = 34 }: { name: string; color: string; size?: number }) {
  return (
    <span className="seal-mark" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.55, ['--tincture' as string]: color }}>
      {sealInitial(name)}
    </span>
  );
}

const WAX = waxOutline(15, 27, 2.6);

/** The rust wax seal on the scroll's head, pressed with the hold's initial. */
function WaxSeal({ initial }: { initial: string }) {
  return (
    <svg className="wax-seal" viewBox="0 0 64 64" aria-hidden="true">
      <path d={WAX} fill="#a0441c" stroke="#2a1d14" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="18.5" fill="none" stroke="#5e2410" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="15.5" fill="none" stroke="#5e2410" strokeWidth="0.8" strokeDasharray="1.4 2.2" />
      <path d="M14 22C17 16 22 12 28 10" fill="none" stroke="#d98a5a" strokeWidth="1.4" strokeLinecap="round" />
      <text x="32" y="33" textAnchor="middle" dominantBaseline="central" className="wax-seal-letter">
        {initial}
      </text>
    </svg>
  );
}

// ---------- resumes ----------

export function Resume({ req, highlight }: { req: HireRequestView; highlight?: boolean }) {
  const repo = useStore((s) => s.repos.find((r) => r.id === req.repoId));
  const settings = useStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center' });
  }, [highlight]);
  const pending = req.status === 'pending';
  const hire = req.kind === 'hire';
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await attempt(fn);
    setBusy(false);
  };
  return (
    <div ref={ref} className={`resume ${hire ? '' : 'resume-letgo'} ${highlight ? 'resume-hot' : ''} ${pending ? '' : 'resume-done'}`}>
      <div className="resume-head">
        <Seal name={req.name} color={req.color} size={42} />
        <div className="grow">
          <div className="resume-name">{hire ? req.name : `Let ${req.name} go?`}</div>
          <div className="resume-title">{req.title}</div>
        </div>
        {!pending && <span className={`chip ${req.status === 'approved' ? 'chip-good' : ''}`}><IconText text={req.status === 'approved' ? (hire ? '✅ recruited' : '👋 left') : '✋ declined'} /></span>}
      </div>
      <div className="resume-meta">
        <span className="chip" style={{ background: repo?.color }}>
          Chamber {repo?.floor ?? '?'}
        </span>
        <span className="muted small">{repo?.fullName.split('/')[1] ?? 'removed chamber'}</span>
        <span className="chip"><IconText text={req.role === 'qa' ? '🔍 QA' : '⚒️ Coder'} /></span>
        {req.specialty && <span className="chip"><IconText text="🎯" /> {req.specialty}</span>}
      </div>
      {req.reason && <Markdown className="resume-reason" text={req.reason} />}
      {hire && req.brief && (
        <button className="linkish small" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '▾ Duties' : '▸ Duties'}
        </button>
      )}
      {open && <Markdown className="resume-brief" text={req.brief} />}
      {hire && pending && (
        <div className="muted small">
          {effectiveModel(req.model, settings.runtime === 'terminal' ? settings.defaultCli : 'claude', settings, 'claude-opus-5-5') || 'default model'} · {req.effort || settings.defaultEffort} effort
        </div>
      )}
      {!pending && req.note && <div className="muted small">Your note: “{req.note}”</div>}
      {pending && !declining && (
        <div className="row">
          <button className="btn btn-small btn-ghost" disabled={busy} onClick={() => setDeclining(true)}>
            {hire ? 'Decline' : 'Keep them'}
          </button>
          <span className="spacer" />
          <button className="btn btn-small btn-good" disabled={busy} onClick={() => act(() => api.approveRequest(req.id))}>
            {hire ? `Recruit ${req.name}` : `Let ${req.name} go`}
          </button>
        </div>
      )}
      {pending && declining && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api.rejectRequest(req.id, note));
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why not? (optional, the DungeonMaster reads it)" autoFocus />
          <button className="btn btn-small btn-bad" disabled={busy}>
            {hire ? 'Decline' : 'Keep'}
          </button>
        </form>
      )}
    </div>
  );
}

function Hires({ focusId }: { focusId?: string }) {
  const requests = useStore((s) => s.requests);
  const pending = pendingRequests(requests);
  const decided = requests.filter((r) => r.status !== 'pending').slice(-8).reverse();
  return (
    <div className="phone-scroll">
      <h3 className="phone-h"><IconText text="📄" /> Waiting on you {pending.length > 0 && <span className="badge">{pending.length}</span>}</h3>
      {pending.length === 0 && <p className="muted small phone-empty">Nobody's waiting. When the DungeonMaster wants to recruit someone, or let someone go, their credentials show up here.</p>}
      {pending.map((r) => (
        <Resume key={r.id} req={r} highlight={r.id === focusId} />
      ))}
      {decided.length > 0 && (
        <>
          <h3 className="phone-h">Earlier</h3>
          {decided.map((r) => (
            <Resume key={r.id} req={r} />
          ))}
        </>
      )}
    </div>
  );
}

// ---------- chat ----------

const QUICK = ["What's the guild working on?", 'Do we need anyone new?', 'Plan the next milestone for the busiest chamber.'];

function Bubble({ m, ceoName }: { m: PhoneMessage; ceoName: string }) {
  const req = useStore((s) => (m.requestId ? s.requests.find((r) => r.id === m.requestId) : undefined));
  // a coder or tester who needs you, still waiting: their panel is where you answer
  const asker = useStore((s) => (m.agentId && s.agents[m.agentId]?.asks ? s.agents[m.agentId] : undefined));
  const openOverlay = useStore((s) => s.openOverlay);
  if (m.from === 'office')
    return (
      <div className="bubble-office">
        <span>
          <IconText text={m.text} />
          {asker && (
            <button className="btn bubble-answer" onClick={() => openOverlay({ kind: 'terminal', agentId: asker.id })}>
              Answer {asker.name}
            </button>
          )}
        </span>
      </div>
    );
  const mine = m.from === 'manager';
  return (
    <div className={`bubble-row ${mine ? 'bubble-row-me' : ''}`}>
      <div className={`bubble ${mine ? 'bubble-me' : 'bubble-them'}`}>
        {!mine && <div className="bubble-from">{ceoName}</div>}
        {mine ? <div className="bubble-text">{m.text}</div> : <Markdown className="bubble-md" text={m.text} />}
        {req && req.status === 'pending' && m.from === 'ceo' && <Resume req={req} />}
        <div className="bubble-time">{clock(m.at)}</div>
      </div>
    </div>
  );
}

function Chat() {
  const messages = useStore((s) => s.messages);
  const readAt = useStore((s) => s.phoneReadAt);
  const ceo = useStore((s) => s.agents[CEO_ID]);
  const info = useStore((s) => s.ceo);
  const settings = useStore((s) => s.settings);
  const running = useStore((s) => Object.values(s.agents).filter(isBusy).length);
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // Reading the thread marks it read.
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.from === 'ceo');
    if (last && last.at > readAt) void attempt(() => api.phoneRead(last.at));
  }, [messages, readAt]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, info.job?.kind]);

  if (!ceo) return <p className="muted phone-empty">The DungeonMaster's quarters are empty.</p>;
  // a letter too long to go stays in the box, saying why, rather than being cut short or lost
  const tooLong = text.trim() ? letterProblem(text) : null;
  const send = (t: string) => {
    const body = t.trim();
    if (!body || letterProblem(body)) return;
    setText('');
    void attempt(() => api.messageCeo(body));
  };
  const replying = ceo.status === 'working' && info.job?.kind === 'chat';
  const chatQueued = info.queue.some((j) => j.kind === 'chat');
  const presence = presenceText({
    working: ceo.status === 'working',
    replying,
    jobLabel: info.job?.label,
    letterQueued: chatQueued,
    nextLabel: info.queue[0]?.label,
    running,
    sessionLimit: settings.sessionLimit,
  });

  return (
    <div className="phone-chat">
      <div className="chat-head">
        <Seal name={ceo.name} color={ceo.color} />
        <div className="grow">
          <b>{ceo.name}</b> <span className="muted small">DungeonMaster</span>
          <div className={`small ${ceo.status === 'working' ? 'presence-busy' : 'muted'}`}>{presence}</div>
        </div>
      </div>
      <div className="chat-log" ref={scroller}>
        {messages.length === 0 && (
          <p className="muted small phone-empty">
            Greet {ceo.name}. Ask how things are going, hand over a project brief, or ask who the guild should recruit. Replies land here, and your scroll shows a badge when {ceo.name} needs you.
          </p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} ceoName={ceo.name} />
        ))}
        {replying && (
          <div className="bubble-row">
            <div className="quill-line" role="status" aria-label={`${ceo.name} is penning a reply`}>
              <Icon name="quill" />
              <span className="ink-dot" />
              <span className="ink-dot" />
              <span className="ink-dot" />
            </div>
          </div>
        )}
      </div>
      <div className="quick">
        {QUICK.map((q) => (
          <button key={q} className="quick-chip" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <MessageBox value={text} onChange={setText} placeholder={`Write to ${ceo.name}…`} aria-label={`Write to ${ceo.name}`} title="Enter sends · Shift+Enter adds a new line" autoFocus />
        <button className="btn btn-small btn-good" disabled={!text.trim() || !!tooLong}>
          Send
        </button>
      </form>
      {tooLong && (
        <p className="chat-too-long" role="alert">
          {tooLong}
        </p>
      )}
    </div>
  );
}

// ---------- company at a glance ----------

function useCompany() {
  const repos = useStore((s) => s.repos);
  const agents = useStore((s) => s.agents);
  const qa = useStore((s) => s.qa);
  const requests = useStore((s) => s.requests);
  const settings = useStore((s) => s.settings);
  const info = useStore((s) => s.ceo);
  return useMemo(() => {
    const staff = Object.values(agents).filter((a) => a.role !== 'ceo');
    const ceo = agents[CEO_ID];
    const running = Object.values(agents).filter(isBusy).length;
    const floors = repos.map((r) => {
      const team = staff.filter((a) => a.repoId === r.id);
      const recs = r.pulls.filter((p) => p.state === 'OPEN').map((p) => qa[qaKey(r.id, p.number)]);
      return {
        repo: r,
        team: team.length,
        working: team.filter(isBusy).length,
        idleDevs: team.filter((a) => a.role === 'dev' && !isBusy(a)).length,
        issues: r.issues.length,
        prs: r.pulls.filter((p) => p.state === 'OPEN').length,
        inQa: recs.filter((q) => q && q.status !== 'passed' && q.status !== 'needs-human').length,
        ready: recs.filter((q) => q?.status === 'passed').length,
        stuck: recs.filter((q) => q?.status === 'needs-human').length,
        merged: r.pulls.filter((p) => p.state === 'MERGED').length,
      };
    });
    const sum = (k: 'issues' | 'prs' | 'ready' | 'stuck' | 'inQa') => floors.reduce((n, f) => n + f[k], 0);
    const pending = pendingRequests(requests).length;

    // The report: a few plain sentences, most urgent first.
    const report: { icon: string; text: string; tone?: 'good' | 'warn' }[] = [];
    const readyList = floors.filter((f) => f.ready > 0);
    if (readyList.length)
      report.push({
        icon: '✅',
        text: `${sum('ready')} pull request${sum('ready') === 1 ? ' passed' : 's passed'} QA and ${sum('ready') === 1 ? 'is' : 'are'} ready for you to merge (${readyList.map((f) => `${f.repo.fullName.split('/')[1]}: ${f.ready}`).join(', ')}).`,
        tone: 'good',
      });
    if (sum('stuck')) report.push({ icon: '⚠️', text: `${sum('stuck')} pull request${sum('stuck') === 1 ? '' : 's'} failed QA three times and need${sum('stuck') === 1 ? 's' : ''} your call.`, tone: 'warn' });
    if (pending) report.push({ icon: '📄', text: `${pending} recruiting decision${pending === 1 ? ' is' : 's are'} waiting in Recruits.`, tone: 'warn' });
    report.push({
      icon: '⚙️',
      text: settings.sessionLimit
        ? running
          ? `${running} of ${settings.sessionLimit} session slots are busy right now.`
          : `Nobody is working at the moment (${settings.sessionLimit} session slots free).`
        : running
          ? `${running} session${running === 1 ? ' is' : 's are'} running right now.`
          : 'Nobody is working at the moment.',
    });
    for (const f of floors) {
      if (f.issues > 0 && !f.repo.autoAssign && f.working === 0 && f.idleDevs > 0) {
        report.push({ icon: '💤', text: `${f.repo.fullName.split('/')[1]} has ${f.issues} open issue${f.issues === 1 ? '' : 's'} and idle coders, but auto-assign is off.` });
      }
    }
    const busiest = [...floors].sort((a, b) => b.issues + b.prs - (a.issues + a.prs))[0];
    if (busiest && busiest.issues + busiest.prs > 0 && floors.length > 1) {
      report.push({ icon: '🔥', text: `Most work in flight: ${busiest.repo.fullName.split('/')[1]} (${busiest.issues} issues, ${busiest.prs} PRs).` });
    }
    if (ceo) {
      report.push({
        icon: '🧠',
        text:
          ceo.status === 'working'
            ? `${ceo.name} is ${(info.job?.label ?? 'working').replace(/^\w/, (c) => c.toLowerCase())}.`
            : info.nextReviewAt
              ? `${ceo.name} reviews the dungeon next at ${clock(info.nextReviewAt)}.`
              : `${ceo.name}'s periodic reviews are off.`,
      });
    }
    if (floors.length === 0) report.splice(0, report.length, { icon: '👋', text: 'No projects yet. Connect a repo in your study (great hall, back left) and the DungeonMaster will staff it.' });
    return { floors, staff: staff.length, running, max: settings.sessionLimit, issues: sum('issues'), prs: sum('prs'), report };
  }, [repos, agents, qa, requests, settings, info]);
}

function Company() {
  const c = useCompany();
  const goToFloor = useStore((s) => s.goToFloor);
  const tiles: [string, string | number, string][] = [
    ['🏰', c.floors.length, c.floors.length === 1 ? 'project' : 'projects'],
    ['📋', c.issues, 'open issues'],
    ['🔀', c.prs, 'open PRs'],
    ['👥', c.staff, 'in the guild'],
    ['⚙️', c.max ? `${c.running}/${c.max}` : `${c.running}`, 'working now'],
  ];
  return (
    <div className="phone-scroll">
      <div className="tiles">
        {tiles.map(([icon, value, label]) => (
          <div key={label} className="tile">
            <div className="tile-value">
              <IconText text={icon} /> {value}
            </div>
            <div className="tile-label">{label}</div>
          </div>
        ))}
      </div>
      <h3 className="phone-h">Today's report</h3>
      <ul className="report">
        {c.report.map((r, i) => (
          <li key={i} className={r.tone ? `report-${r.tone}` : ''}>
            <span><IconText text={r.icon} /></span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      {c.floors.length > 0 && <h3 className="phone-h">Projects</h3>}
      {c.floors.map((f) => (
        <div key={f.repo.id} className="proj" style={{ ['--accent' as string]: f.repo.color }}>
          <div className="row">
            <span className="floor-badge">{f.repo.floor}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b className="proj-name">{f.repo.fullName.split('/')[1]}</b>
              <div className="muted small proj-sum">{f.repo.summary || f.repo.description || f.repo.fullName}</div>
            </div>
            <button className="btn btn-small" onClick={() => goToFloor(f.repo.floor)}>
              Go
            </button>
          </div>
          <div className="proj-stats small">
            <span title="in the guild here">
              <Icon name="hood" /> {f.team}
              {f.working ? ` (${f.working} busy)` : ''}
            </span>
            <span title="open issues">
              <Icon name="board" /> {f.issues}
            </span>
            <span title="in QA">
              <Icon name="lens" /> {f.inQa}
            </span>
            <span className={f.ready ? 'proj-ready' : ''} title="passed QA, ready to merge">
              <Icon name="check" /> {f.ready}
            </span>
            <span title="merged">
              <Icon name="banner" /> {f.merged}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- the phone ----------

export function Phone({ tab: initialTab, requestId }: { tab?: PhoneTab; requestId?: string }) {
  const [tab, setTab] = useState<PhoneTab>(() => initialTab ?? (requestId ? 'hires' : 'chat'));
  const openOverlay = useStore((s) => s.openOverlay);
  const requests = useStore((s) => s.requests);
  const messages = useStore((s) => s.messages);
  const readAt = useStore((s) => s.phoneReadAt);
  const ceoName = useStore((s) => s.agents[CEO_ID]?.name ?? 'DungeonMaster');
  const hold = useStore((s) => s.settings.companyName) || 'Code Dungeon';
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  // Keep the overlay's tab in sync so new messages know whether the chat is on screen.
  useEffect(() => {
    openOverlay({ kind: 'phone', tab, requestId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
      if (e.key === 'Escape' || (!typing && e.code === 'KeyP')) {
        e.preventDefault();
        closeOverlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pending = pendingRequests(requests).length;
  const unread = unreadMessages(messages, readAt);
  const tabs: [PhoneTab, IconName, string, number][] = [
    ['chat', 'quill', ceoName, tab === 'chat' ? 0 : unread],
    ['hires', 'letter', 'Recruits', pending],
    ['company', 'map', 'The Realm', 0],
  ];
  return (
    <div className="overlay phone-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <div className="phone">
        <div className="scroll-rod" aria-hidden="true" />
        <div className="scroll-sheet">
          <header className="scroll-head">
            <WaxSeal initial={sealInitial(hold)} />
            <span className="scroll-hold">{hold}</span>
            <span className="scroll-hour" title={clock(now)}>
              <Icon name="candle" /> {canonicalHour(new Date(now))}
            </span>
          </header>
          <nav className="phone-tabs">
            {tabs.map(([k, icon, label, badge]) => (
              <button key={k} className={`phone-tab ${tab === k ? 'phone-tab-on' : ''}`} onClick={() => setTab(k)}>
                <span className="phone-tab-icon">
                  <Icon name={icon} />
                  {badge > 0 && <span className="badge badge-dot">{badge}</span>}
                </span>
                <span className="phone-tab-label">{label}</span>
              </button>
            ))}
          </nav>
          <div className="phone-screen">
            {tab === 'chat' && <Chat />}
            {tab === 'hires' && <Hires focusId={requestId} />}
            {tab === 'company' && <Company />}
          </div>
          <div className="phone-hint">
            {tab === 'chat' && (
              <>
                <kbd>Shift</kbd>+<kbd>Enter</kbd> new line ·{' '}
              </>
            )}
            <kbd>P</kbd> or <kbd>Esc</kbd> to roll it up
          </div>
        </div>
        <div className="scroll-rod" aria-hidden="true" />
      </div>
    </div>
  );
}
