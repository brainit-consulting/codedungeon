import { useMemo, useState } from 'react';
import { api } from '../api';
import { agentsOnRepo, kanbanFor, useStore, type Agent, type KanbanCard } from '../store';
import { confirmDialog } from './Confirm';
import { Panel } from './Overlays';
import { Icon, IconText } from './Icon';
import { BrowserNotice } from './BrowserNotice';
import { NoMainNotice } from './NoMainNotice';
import { stillFailedCommit } from '../../../shared/sendBack';

function AgentChip({ agent }: { agent?: Agent }) {
  if (!agent) return null;
  return (
    <span className="agent-chip">
      <span className="dot" style={{ background: agent.color }} />
      {agent.name}
      {agent.role === 'qa' && <span className="chip">QA</span>}
    </span>
  );
}

/** A stuck PR back to a coder with the Overlord's note: a fix round on its own branch (shared/sendBack.ts). */
function SendBackForm({ repoId, pr, agents, onDone }: { repoId: string; pr: number; agents: Agent[]; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const coders = agents.filter((a) => a.role === 'dev');
  return (
    <form
      className="issue-form sendback-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        setBusy(true);
        try {
          await api.sendBack(repoId, pr, note, to || undefined);
          onDone();
        } catch {
          // toasted
        } finally {
          setBusy(false);
        }
      }}
    >
      <textarea
        autoFocus
        rows={4}
        placeholder={`What should the coder change on PR #${pr}, and how should they check it? It comes before QA's suggestions.`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="row">
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Coder">
          <option value="">The next free coder</option>
          {coders.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button type="button" className="btn btn-small btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-small btn-good" disabled={busy || !note.trim()}>
          Send back
        </button>
      </div>
    </form>
  );
}

export function IssueForm({ repoId, agents, onDone }: { repoId: string; agents: Agent[]; onDone?: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [busy, setBusy] = useState(false);
  const free = agents.filter((a) => a.role === 'dev' && a.status !== 'working' && a.status !== 'preparing');
  return (
    <form
      className="issue-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        try {
          await api.createIssue(repoId, title, body, assignTo || undefined);
          setTitle('');
          setBody('');
          setAssignTo('');
          onDone?.();
        } catch {
          // toasted
        } finally {
          setBusy(false);
        }
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Issue title, e.g. Add a dark mode toggle" autoFocus />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe what you want. Acceptance criteria help the coder and the tester a lot." rows={5} />
      <div className="row">
        <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
          <option value="">Leave in backlog (auto-assign picks it up if enabled)</option>
          {free.map((a) => (
            <option key={a.id} value={a.id}>
              Give it to {a.name} right away
            </option>
          ))}
        </select>
        <button className="btn btn-good" disabled={busy || !title.trim()}>
          {busy ? 'Filing…' : 'File issue on GitHub'}
        </button>
      </div>
    </form>
  );
}

function QaLink({ card }: { card: KanbanCard }) {
  if (!card.qa?.commentUrl) return null;
  return (
    <a className="small" href={card.qa.commentUrl} target="_blank" rel="noreferrer" title={card.qa.summary ?? ''}>
      QA report ↗
    </a>
  );
}

export function KanbanView({ repoId }: { repoId: string }) {
  const repo = useStore((s) => s.repos.find((r) => r.id === repoId));
  const allAgents = useStore((s) => s.agents);
  const qaRecords = useStore((s) => s.qa);
  const openOverlay = useStore((s) => s.openOverlay);
  const agents = useMemo(() => agentsOnRepo(allAgents, repoId), [allAgents, repoId]);
  const cols = useMemo(() => (repo ? kanbanFor(repo, agents, qaRecords) : null), [repo, agents, qaRecords]);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState<number | null>(null);

  if (!repo || !cols) {
    return (
      <Panel title="Notice board">
        <p className="muted">This chamber no longer exists.</p>
      </Panel>
    );
  }

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setPending(key);
    try {
      await fn();
    } catch {
      // toasted
    } finally {
      setPending(null);
    }
  };
  const devs = agents.filter((a) => a.role === 'dev');
  const free = devs.filter((a) => a.status === 'idle' || a.status === 'done' || a.status === 'stopped' || a.status === 'error');
  const merge = async (c: KanbanCard) => {
    const passed = c.qa?.status === 'passed';
    const ok = await confirmDialog(
      passed
        ? { icon: '🎉', title: `Merge PR #${c.number}?`, body: `“${c.title}” passed QA. It will be squash-merged into ${repo.defaultBranch}.`, confirm: 'Squash & merge' }
        : {
            tone: 'warn',
            title: `Merge PR #${c.number} without QA?`,
            body: `“${c.title}” has not passed QA yet. Merge it into ${repo.defaultBranch} anyway?`,
            confirm: 'Merge anyway',
          },
    );
    if (ok) void act(c.key, () => api.mergePull(repo.id, c.number));
  };
  // Retry QA on the commit QA already failed tests the same code again: ask first, and offer Send back instead
  const retryQa = async (c: KanbanCard) => {
    const head = repo.pulls.find((p) => p.number === c.number)?.headSha ?? null;
    const same = stillFailedCommit(c.qa?.testedSha ?? null, head, c.qa?.status ?? null);
    if (same) {
      const ok = await confirmDialog({
        tone: 'warn',
        title: `Retry QA on the same commit?`,
        body: `PR #${c.number} is still on ${head!.slice(0, 7)}, the commit QA failed, so another round tests the same code. Send it back to a coder with a note instead, unless you think the failure was a fluke.`,
        confirm: 'Retry anyway',
      });
      if (!ok) return;
    }
    void act(c.key, () => api.sendToQa(repo.id, c.number, same));
  };
  const previewButton = (c: KanbanCard) => (
    <button
      className="btn btn-small"
      title={`Run PR #${c.number} and open it in the app viewer`}
      onClick={() => {
        openOverlay({ kind: 'app', repoId: repo.id });
        const already = repo.preview.pr === c.number && repo.preview.status !== 'stopped' && repo.preview.status !== 'error' && repo.preview.status !== 'unconfigured';
        if (!already) void api.startPreview(repo.id, c.number).catch(() => undefined);
      }}
    >
      Preview
    </button>
  );
  const terminalButton = (c: KanbanCard) =>
    c.agent && (
      <button className="btn btn-small" onClick={() => openOverlay({ kind: 'terminal', agentId: c.agent!.id })}>
        Terminal
      </button>
    );

  const column = (title: string, cls: string, cards: KanbanCard[], render: (c: KanbanCard) => React.ReactNode, empty: string) => (
    <div className={`kcol ${cls}`}>
      <div className="kcol-head">
        <IconText text={title} /> <span className="count">{cards.length}</span>
      </div>
      <div className="kcol-body">
        {cards.length === 0 && <div className="muted small kempty">{empty}</div>}
        {cards.map((c) => (
          <div key={c.key} className={`kcard ${c.tone ? `kcard-${c.tone}` : ''}`}>
            <div className="kcard-title">
              {c.url ? (
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.prNumber ? 'PR ' : ''}#{c.number}
                </a>
              ) : (
                <b>#{c.number}</b>
              )}{' '}
              {c.title}
            </div>
            {render(c)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Panel
      wide
      className="panel-kanban"
      accent={repo.color}
      title={
        <span>
          <Icon name="board" /> {repo.fullName}{' '}
          <a className="small" href={repo.url} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          {repo.private && (
            <span className="small" title="This repository is private: its issues, pull requests and QA reports open only when your browser is signed in to GitHub with an account that has access. Signed in as anyone else, GitHub says the page isn't found.">
              {' '}🔒 private
            </span>
          )}
        </span>
      }
    >
      <div className="kanban-toolbar">
        <button className="btn btn-good" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New issue'}
        </button>
        <label className="toggle">
          <input type="checkbox" checked={repo.autoAssign} onChange={(e) => void api.updateRepo(repo.id, { autoAssign: e.target.checked }).catch(() => undefined)} />
          <Icon name="bolt" /> Auto-assign backlog to idle coders
        </label>
        <label className="toggle" title="Merge a PR as soon as QA has signed off on its latest commit and GitHub's checks are green">
          <input type="checkbox" checked={repo.autoMerge} onChange={(e) => void api.updateRepo(repo.id, { autoMerge: e.target.checked }).catch(() => undefined)} />
          <Icon name="fork" /> Auto-merge when QA and checks pass
        </label>
        <span className="spacer" />
        <button className="btn" onClick={() => openOverlay({ kind: 'app', repoId: repo.id })} title="Open this chamber's running app">
          <Icon name="slate" /> View app
        </button>
        <span className="muted small">{repo.lastSync ? `Synced ${new Date(repo.lastSync).toLocaleTimeString()}` : 'Syncing…'}</span>
        <button className="btn" disabled={pending === 'sync'} onClick={() => act('sync', () => api.syncRepo(repo.id))}>
          ⟳ Sync
        </button>
      </div>
      {repo.syncError && <div className="term-error"><Icon name="warning" /> {repo.syncError}</div>}
      <NoMainNotice repo={repo} />
      <BrowserNotice repo={repo} />
      {showForm && <IssueForm repoId={repo.id} agents={devs} onDone={() => setShowForm(false)} />}

      <div className="kanban kanban-5">
        {column(
          '📋 Backlog',
          'kcol-backlog',
          cols.backlog,
          (c) => (
            <div className="kcard-foot">
              {c.note && <span className="muted small">
                <IconText text={c.note} />
              </span>}
              {!c.stranger && <select
                value=""
                disabled={pending === c.key || free.length === 0}
                onChange={(e) => e.target.value && act(c.key, () => api.assign(e.target.value, c.number))}
              >
                <option value="">{free.length ? 'Assign to…' : 'Everyone is busy'}</option>
                {free.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>}
            </div>
          ),
          'No open issues. File one above.',
        )}
        {column(
          '🔨 In progress',
          'kcol-progress',
          cols.progress,
          (c) => (
            <div className="kcard-foot">
              <AgentChip agent={c.agent} />
              <span className="muted small">
                <IconText text={c.note} />
              </span>
              <span className="spacer" />
              {terminalButton(c)}
            </div>
          ),
          'Nobody is coding right now.',
        )}
        {column(
          '🔍 In QA',
          'kcol-qa',
          cols.qa,
          (c) => {
            const st = c.qa?.status;
            return (
              <div className="kcard-foot kcard-foot-wrap">
                <AgentChip agent={c.agent} />
                <span className="muted small">
                <IconText text={c.note} />
              </span>
                <span className="spacer" />
                <QaLink card={c} />
                <span className="kcard-actions">
                  {!c.stranger && previewButton(c)}
                  {(st === 'testing' || st === 'fixing') && terminalButton(c)}
                  {!c.stranger && (!st || st === 'needs-human') && (
                    <button className="btn btn-small btn-good" disabled={pending === c.key} onClick={() => (st ? retryQa(c) : act(c.key, () => api.sendToQa(repo.id, c.number)))}>
                      {st === 'needs-human' ? 'Retry QA' : 'Send to QA'}
                    </button>
                  )}
                  {(st === 'needs-human' || st === 'failed') && (
                    <button className="btn btn-small" disabled={pending === c.key} onClick={() => setSendingBack(sendingBack === c.number ? null : c.number)}>
                      Send back
                    </button>
                  )}
                  {st === 'needs-human' && (
                    <button className="btn btn-small btn-ghost" disabled={pending === c.key} onClick={() => merge(c)}>
                      Merge anyway
                    </button>
                  )}
                </span>
                {sendingBack === c.number && <SendBackForm repoId={repo.id} pr={c.number} agents={agents} onDone={() => setSendingBack(null)} />}
              </div>
            );
          },
          'Nothing waiting for testing.',
        )}
        {column(
          '✅ Ready to merge',
          'kcol-review',
          cols.ready,
          (c) => {
            const pr = repo.pulls.find((p) => p.number === c.prNumber);
            return (
              <div className="kcard-foot kcard-foot-wrap">
                <AgentChip agent={c.agent} />
                <span className="muted small">
                  <IconText text={c.note} />
                  {pr ? ` · +${pr.additions} −${pr.deletions}` : ''}
                </span>
                <span className="spacer" />
                <QaLink card={c} />
                <span className="kcard-actions">
                  {previewButton(c)}
                  <button className="btn btn-small btn-good" disabled={pending === c.key || pr?.isDraft} onClick={() => merge(c)}>
                    Merge
                  </button>
                  <button
                    className="btn btn-small btn-ghost"
                    disabled={pending === c.key}
                    onClick={async () => {
                      const ok = await confirmDialog({ tone: 'danger', title: `Close PR #${c.number}?`, body: `“${c.title}” will be closed without merging. The branch stays on GitHub.`, confirm: 'Close PR' });
                      if (ok) void act(c.key, () => api.closePull(repo.id, c.number));
                    }}
                  >
                    Close
                  </button>
                </span>
              </div>
            );
          },
          'No tested pull requests yet.',
        )}
        {column(
          '🎉 Merged',
          'kcol-merged',
          cols.merged,
          (c) => (
            <div className="kcard-foot">
              <AgentChip agent={c.agent} />
            </div>
          ),
          'Nothing merged yet.',
        )}
      </div>
    </Panel>
  );
}
