import { formatBytes, formatDuration, percentOf } from '../../../shared/system';
import { formatTokens, formatUsd } from '../../../shared/usage';
import { useStore } from '../store';
import { HISTORY_MS, useSystemFeed, type SystemPoint } from '../systemFeed';
import { Panel } from './Overlays';
import './systemPanel.css';

// The gauges panel, opened from a chamber's gauge board: the computer's load in detail, read every 5 s while open,
// with the last two minutes of CPU and memory drawn as sparklines (the history lives in systemFeed.ts).

const HIGH = 85;
const pctText = (n: number | null) => (n === null ? '–' : `${Math.round(n)}%`);
const hms = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const hm = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** A 0-100 line over the last two minutes, ending at `now`. */
function Sparkline({ points, pick, now, label }: { points: SystemPoint[]; pick: (p: SystemPoint) => number | null; now: number; label: string }) {
  const W = 240;
  const H = 48;
  const xy = points
    .map((p) => ({ v: pick(p), t: p.at }))
    .filter((p): p is { v: number; t: number } => p.v !== null && now - p.t <= HISTORY_MS)
    .map((p) => [W - ((now - p.t) / HISTORY_MS) * W, H - (p.v / 100) * H] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <figure className="gauges-spark">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}, last two minutes`}>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} className="gauges-spark-mid" />
        {xy.length > 1 && <polygon points={`${xy[0][0]},${H} ${line} ${xy[xy.length - 1][0]},${H}`} className="gauges-spark-fill" />}
        {xy.length > 1 && <polyline points={line} className="gauges-spark-line" />}
        {xy.length === 1 && <circle cx={xy[0][0]} cy={xy[0][1]} r="2.5" className="gauges-spark-dot" />}
      </svg>
      <figcaption className="muted small">
        <span>2 min ago</span>
        <span>now</span>
      </figcaption>
    </figure>
  );
}

function Meter({ pct, label }: { pct: number | null; label: string }) {
  return (
    <div className="gauges-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct === null ? undefined : Math.round(pct)}>
      <span className={pct !== null && pct >= HIGH ? 'high' : ''} style={{ width: `${pct ?? 0}%` }} />
    </div>
  );
}

export function SystemPanel() {
  const { latest: v, history, failed } = useSystemFeed();
  const usage = useStore((s) => s.usage);
  const pacingSessions = useStore((s) => s.settings.pacingSessions);

  if (!v) {
    return (
      <Panel title="The Gauges" className="gauges-panel">
        <p className="muted">{failed ? 'The dungeon did not answer. Trying again every 5 seconds.' : 'Taking the first reading…'}</p>
      </Panel>
    );
  }

  const mem = percentOf(v.memory.used, v.memory.total);
  const disk = v.disk ? percentOf(v.disk.total - v.disk.free, v.disk.total) : null;
  const s = v.sessions;
  const until = usage.until ? ` until ${hm(usage.until)}` : '';
  const usageText =
    usage.state === 'paused'
      ? `Paused at the limit${until}. Nothing new starts; sessions already running carry on.`
      : usage.state === 'pacing'
        ? `Pacing${until}. New issues start only while fewer than ${pacingSessions} sessions run.`
        : 'Normal. No usage warning from Claude.';

  return (
    <Panel title="The Gauges" className="gauges-panel">
      <p className="gauges-host muted small">
        {v.host.cpuModel || 'CPU'} · {v.host.cores} cores · {v.host.platform} · read at {hms(v.at)}
        {failed && <b className="gauges-stale"> · the last reading failed</b>}
      </p>

      <section className="gauges-block">
        <header>
          <h3>CPU</h3>
          <b className={v.cpu.pct !== null && v.cpu.pct >= HIGH ? 'high' : ''}>{pctText(v.cpu.pct)}</b>
        </header>
        <Sparkline points={history} pick={(p) => p.cpu} now={v.at} label="CPU" />
        <div className="gauges-cores" aria-label="Each core">
          {v.cpu.cores.map((c, i) => (
            <div key={i} className="gauges-core" title={`Core ${i}: ${pctText(c)}`}>
              <span className={c !== null && c >= HIGH ? 'high' : ''} style={{ height: `${c ?? 0}%` }} />
            </div>
          ))}
        </div>
      </section>

      <section className="gauges-block">
        <header>
          <h3>Memory</h3>
          <b className={mem !== null && mem >= HIGH ? 'high' : ''}>{pctText(mem)}</b>
        </header>
        <Meter pct={mem} label="Memory used" />
        <p className="small">
          {formatBytes(v.memory.used)} used of {formatBytes(v.memory.total)}
        </p>
        <Sparkline points={history} pick={(p) => p.mem} now={v.at} label="Memory" />
      </section>

      <section className="gauges-block">
        <header>
          <h3>Disk</h3>
          <b className={disk !== null && disk >= HIGH ? 'high' : ''}>{pctText(disk)}</b>
        </header>
        {v.disk ? (
          <>
            <Meter pct={disk} label="Disk used" />
            <p className="small">
              {formatBytes(v.disk.free)} free of {formatBytes(v.disk.total)} <span className="muted">· the drive holding {v.disk.path}</span>
            </p>
          </>
        ) : (
          <p className="small muted">This computer doesn't report its disk space.</p>
        )}
      </section>

      <dl className="gauges-facts">
        <dt>Claude usage</dt>
        <dd className={usage.state === 'normal' ? 'good' : 'high'}>{usageText}</dd>
        <dt>Today at API prices</dt>
        <dd>
          {v.today.tokens > 0 || v.today.costUsd > 0 ? `${formatTokens(v.today.tokens)} tokens · ${formatUsd(v.today.costUsd)}` : 'Nothing yet'}
          <span className="muted"> · what today's work would cost at API list prices, not what your subscription costs. Codex and OpenCode report no figures.</span>
        </dd>
        <dt>Sessions</dt>
        <dd>
          {s.running} running{s.limit > 0 ? ` of ${s.limit} allowed` : ''} · {s.agents} in the guild
        </dd>
        <dt>Agent CLIs</dt>
        <dd>
          {s.clisWorking} working · {s.clisWaiting} waiting at their prompt
        </dd>
        <dt>Dungeon process</dt>
        <dd>
          {formatBytes(v.process.rss)} in memory · {formatBytes(v.process.heapUsed)} JavaScript heap
        </dd>
        <dt>Uptime</dt>
        <dd>
          computer {formatDuration(v.uptime.system)} · dungeon {formatDuration(v.uptime.office)}
        </dd>
      </dl>
    </Panel>
  );
}
