// A CLI running in a recruit's Upstash Box, behind the same Pty interface as one on this computer (ptyClient.ts), so
// the session code (cliRunner.ts) drives both alike.
// The CLI runs in tmux in the box, so a dropped connection costs nothing: the office attaches to it with a terminal
// session over the Box API and reattaches when that drops. Its hooks write to an events file in the box, which a second
// session follows (tail -F) and hands to the same hook handler local CLIs reach over HTTP.
import type { Box } from '@upstash/box';
import { BOX_DIR, boxRun, eventLines, getBox, launchScript, shq } from './boxes.ts';
import type { Pty } from './ptyClient.ts';

/** tmux for a recruit's CLI: no status line, no prefix key, its own scrollback off (the office keeps one). */
export const TMUX_CONF = ['set -g status off', 'set -g prefix None', 'unbind-key C-b', 'set -g escape-time 0', 'set -g history-limit 1', 'set -g default-terminal xterm-256color', 'setw -g alternate-screen off', ''].join('\n');

export interface BoxCliOptions {
  boxId: string;
  /** The session's folder in the box (cliRunner writes its files there). */
  dir: string;
  cwd: string;
  file: string;
  args: string[];
  env: Record<string, string>;
  cols: number;
  rows: number;
  /** Each event the CLI's hooks wrote (the events file in `dir`). */
  onEvent: (body: Record<string, unknown>) => void;
  /** Something the office should tell the Overlord about the connection (reconnecting, lost). */
  onNotice?: (text: string) => void;
}

/** Stops every recruit CLI's tmux in the box (their sockets are all named cd-…). */
export const STOP_STRAY_TMUX = `pkill -f -- '^tmux -L cd-' 2>/dev/null; true`;

/** How long to wait before the n-th reconnection: 1, 2, 4… up to 30 seconds. */
export const backoff = (n: number) => Math.min(30_000, 1000 * 2 ** Math.max(0, n));

type Session = Awaited<ReturnType<Box['exec']['session']>>;

/** A recruit's CLI in their box. Starts at once; output and exit arrive through the callbacks. */
export class BoxPty implements Pty {
  readonly pid = 0;
  private dataCbs: ((d: string) => void)[] = [];
  private exitCbs: ((code: number) => void)[] = [];
  private box: Box | null = null;
  private term: Session | null = null;
  private tail: Session | null = null;
  private queued: string[] = [];
  private cols: number;
  private rows: number;
  private ended = false;
  private killed = false;
  private offset = 0; // bytes of the events file already read
  private pending = '';
  private decoder = new TextDecoder();
  private tailDecoder = new TextDecoder();
  private readonly sock: string;
  private readonly o: BoxCliOptions;

  constructor(o: BoxCliOptions) {
    this.o = o;
    this.cols = o.cols;
    this.rows = o.rows;
    this.sock = `cd-${o.dir.split('/').pop()!.slice(0, 12)}`;
    void this.start().catch((err) => this.fail(`Could not start in the box: ${(err as Error).message}`));
  }

  get events() {
    return `${this.o.dir}/events.jsonl`;
  }

  private get exitFile() {
    return `${this.o.dir}/exit`;
  }

  private tmux(...args: string[]) {
    return ['tmux', '-L', this.sock, '-f', `${BOX_DIR}/tmux.conf`, ...args];
  }

  private async start() {
    this.box = await getBox(this.o.boxId);
    if ((await this.box.getStatus()).status === 'paused') await this.box.resume();
    await boxRun(this.box, `mkdir -p ${shq(this.o.dir)}`);
    await this.box.files.write({ path: `${BOX_DIR}/tmux.conf`, content: TMUX_CONF });
    const script = `${this.o.dir}/launch.sh`;
    await this.box.files.write({ path: script, content: launchScript({ cwd: this.o.cwd, file: this.o.file, args: this.o.args, env: { ...this.o.env, CD_EVENTS_FILE: this.events }, exitFile: this.exitFile }) });
    // One recruit per box: a CLI the office lost track of (a restart) is stopped before a new one starts. tmux's server
    // is named "tmux: server", so it's found by its command line (measured: `pkill -x tmux` matched nothing).
    const started = await boxRun(
      this.box,
      [`${STOP_STRAY_TMUX}; rm -f ${shq(this.exitFile)}; : > ${shq(this.events)}`, this.tmux('new-session', '-d', '-s', 'main', '-x', String(this.cols), '-y', String(this.rows), `bash ${shq(script)}`).map(shq).join(' ')].join(' && '),
    );
    if (!started.ok) throw new Error(started.out.trim() || 'tmux would not start');
    if (this.killed) return void this.stopBox();
    await Promise.all([this.attach(0), this.follow(0)]);
  }

  /** The terminal: a PTY session running `tmux attach`. When it ends, the CLI has exited or the connection dropped. */
  private async attach(tries: number) {
    if (this.ended || !this.box) return;
    let s: Session;
    try {
      s = await this.box.exec.session({ argv: this.tmux('attach', '-t', 'main'), tty: true, cols: this.cols, rows: this.rows, env: ['TERM=xterm-256color'], onStdout: (d) => this.emit(this.decoder.decode(d, { stream: true })) });
    } catch (err) {
      return this.lostTerminal(tries, err as Error);
    }
    this.term = s;
    for (const q of this.queued.splice(0)) s.write(q);
    await s.wait().catch(() => -1);
    if (this.term === s) this.term = null;
    if (this.ended) return;
    return this.lostTerminal(tries, null);
  }

  /** The attach ended: the CLI exited (tmux is gone), or the connection dropped (reattach). */
  private async lostTerminal(tries: number, err: Error | null) {
    if (this.ended || !this.box) return;
    const alive = await boxRun(this.box, `${this.tmux('has-session', '-t', 'main').map(shq).join(' ')} && echo alive || echo gone`).catch(() => null);
    if (alive && /gone/.test(alive.out)) return this.exited();
    if (tries === 0) this.o.onNotice?.(`🔌 The connection to the box dropped${err ? ` (${err.message})` : ''}; reconnecting. The recruit carries on in the box.`);
    setTimeout(() => void this.attach(tries + 1), backoff(tries));
  }

  /** The events file, followed from where the office last read it. */
  private async follow(tries: number) {
    if (this.ended || !this.box) return;
    try {
      const s = await this.box.exec.session({
        argv: ['tail', '-c', `+${this.offset + 1}`, '-F', this.events],
        onStdout: (d) => this.read(this.tailDecoder.decode(d, { stream: true }), d.byteLength),
      });
      this.tail = s;
      await s.wait().catch(() => -1);
      if (this.tail === s) this.tail = null;
    } catch {
      // reconnect below
    }
    if (!this.ended) setTimeout(() => void this.follow(tries + 1), backoff(tries));
  }

  private read(text: string, bytes: number) {
    this.offset += bytes;
    const { events, rest } = eventLines(this.pending + text);
    this.pending = rest;
    for (const e of events) {
      try {
        this.o.onEvent(e);
      } catch (err) {
        console.warn('box event failed', err);
      }
    }
  }

  private emit(data: string) {
    if (data) for (const cb of this.dataCbs) cb(data);
  }

  private async exited() {
    if (this.ended || !this.box) return;
    const code = await boxRun(this.box, `cat ${shq(this.exitFile)} 2>/dev/null || echo 1`).catch(() => ({ ok: false, out: '1' }));
    // The last events (Stop) can still be on their way down the tail.
    await new Promise((r) => setTimeout(r, 1500));
    this.finish(Number.parseInt(code.out.trim(), 10) || 0);
  }

  private fail(note: string) {
    this.o.onNotice?.(`✗ ${note}`);
    this.finish(1);
  }

  private finish(code: number) {
    if (this.ended) return;
    this.ended = true;
    this.term?.close();
    this.tail?.close();
    for (const cb of this.exitCbs) cb(code);
  }

  private stopBox() {
    if (!this.box) return;
    void boxRun(this.box, `${this.tmux('kill-server').map(shq).join(' ')} 2>/dev/null; true`).catch(() => undefined);
  }

  write(data: string) {
    if (this.term) this.term.write(data);
    else this.queued.push(data);
  }

  resize(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.term?.resize(rows, cols);
  }

  kill() {
    this.killed = true;
    this.stopBox();
    this.finish(130);
  }

  setMeta() {
    // a box's CLI isn't held by the terminal keeper: the office can't pick it up after a restart (yet)
  }

  onData(cb: (data: string) => void) {
    this.dataCbs.push(cb);
  }

  onExit(cb: (code: number) => void) {
    this.exitCbs.push(cb);
  }
}
