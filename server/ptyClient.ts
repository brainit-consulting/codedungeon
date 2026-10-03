import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { IPty } from '@lydell/node-pty';
import { encode, hostSocket, PTY_PROTOCOL, readMessages, type FromHost, type HeldPty } from './ptyProtocol.ts';

// The office's side of its terminal keeper (ptyHost.ts): CLIs start in terminals the keeper holds, so they outlive an
// office restart, and the office picks them up again when it comes back. If the keeper can't start, terminals run in
// the office's own process and stop with it.

const nodePty = await import('@lydell/node-pty').catch((err: unknown) => {
  console.warn(`  terminals unavailable: ${(err as Error).message}`);
  return null;
});

/** The native terminal module loaded, so the terminal runtime can run. */
export const terminalsAvailable = nodePty !== null;

/** A CLI's pseudo-terminal, held by the keeper or by this process. */
export interface Pty {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  /** Stop the CLI and everything it started. */
  kill(): void;
  /** Kept with the terminal, for the office that picks it up after a restart. */
  setMeta(meta: unknown): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (code: number) => void): void;
}

export interface PtyOptions {
  cols: number;
  rows: number;
  cwd: string;
  env: Record<string, string>;
}

let conn: net.Socket | null = null;
let leaving = false; // the office is closing its connection on purpose (a restart): the terminals carry on
let hookPort = 0;
let hostPid = 0;
let found: HeldPty[] = [];
const remote = new Map<string, RemotePty>();
let hookHandler: (token: string, body: unknown) => unknown = () => ({});

const send = (m: Parameters<typeof encode>[0]) => {
  if (conn && !conn.destroyed) conn.write(encode(m));
};

class RemotePty implements Pty {
  pid = 0;
  private dataFns: ((data: string) => void)[] = [];
  private exitFns: ((code: number) => void)[] = [];
  private done = false;
  constructor(readonly id: string) {
    remote.set(id, this);
  }
  write(data: string) {
    send({ op: 'write', id: this.id, data });
  }
  resize(cols: number, rows: number) {
    send({ op: 'resize', id: this.id, cols, rows });
  }
  kill() {
    send({ op: 'kill', id: this.id });
  }
  setMeta(meta: unknown) {
    send({ op: 'meta', id: this.id, meta });
  }
  onData(cb: (data: string) => void) {
    this.dataFns.push(cb);
  }
  onExit(cb: (code: number) => void) {
    this.exitFns.push(cb);
  }
  data(data: string) {
    for (const fn of this.dataFns) fn(data);
  }
  exit(code: number) {
    if (this.done) return;
    this.done = true;
    remote.delete(this.id);
    for (const fn of this.exitFns) fn(code);
  }
}

function onMessage(m: FromHost) {
  switch (m.op) {
    case 'spawned': {
      const p = remote.get(m.id);
      if (p) p.pid = m.pid;
      return;
    }
    case 'failed':
      console.warn(`  could not start a terminal: ${m.error}`);
      return remote.get(m.id)?.exit(-1);
    case 'data':
      return remote.get(m.id)?.data(m.data);
    case 'exit':
      return remote.get(m.id)?.exit(m.code);
    case 'hook':
      void Promise.resolve()
        .then(() => hookHandler(m.token, m.body))
        .catch(() => ({}))
        .then((answer) => send({ op: 'hookReply', rid: m.rid, answer }));
      return;
  }
}

// ---------- connecting ----------

type Ready = Extract<FromHost, { op: 'ready' }>;

/** Say hello to a keeper: its answer and the open socket, or null when none answers. */
function connect(socket: string, secret: string): Promise<{ ready: Ready; sock: net.Socket } | null> {
  return new Promise((resolve) => {
    const sock = net.connect(socket);
    let ready = false;
    const fail = () => {
      clearTimeout(timer);
      sock.destroy();
      resolve(null);
    };
    const timer = setTimeout(fail, 2000);
    sock.once('error', fail);
    sock.once('connect', () => sock.write(encode({ op: 'hello', secret, version: PTY_PROTOCOL })));
    readMessages<FromHost>(sock, (m) => {
      if (ready) return onMessage(m);
      if (m.op !== 'ready') return;
      ready = true;
      clearTimeout(timer);
      sock.removeListener('error', fail);
      sock.on('error', () => undefined);
      resolve({ ready: m, sock });
    });
    sock.on('close', () => {
      if (conn !== sock) return;
      conn = null;
      if (leaving) return;
      // The keeper is gone, and its terminals with it.
      console.warn('  the terminal keeper stopped; running agents lost their terminals');
      for (const p of [...remote.values()]) p.exit(-1);
    });
  });
}

/** Node flags the office runs with that the keeper needs too (tsx in development), not debugging or watching. */
const runtimeFlags = () => process.execArgv.filter((a, i, all) => !/^--(inspect|watch|debug)/.test(a) && !/^--(inspect|watch|debug)/.test(all[i - 1] ?? ''));

function launch(socket: string, secretFile: string) {
  const entry = path.join(import.meta.dirname, `ptyHost${path.extname(import.meta.filename)}`);
  spawn(process.execPath, [...runtimeFlags(), entry, 'launch', socket, secretFile], { detached: true, stdio: 'ignore', windowsHide: true })
    .once('error', () => undefined)
    .unref();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Connect to the office's terminal keeper, starting one if there's none (or replacing one on another version).
 * Returns the terminals it still holds from before a restart. Without a keeper, terminals run in this process.
 */
export async function startKeeper(home: string, onHook: (token: string, body: unknown) => unknown): Promise<HeldPty[]> {
  hookHandler = onHook;
  if (!nodePty) return [];
  const socket = hostSocket(home);
  const secretFile = path.join(home, 'pty.secret');
  try {
    if (!fs.existsSync(secretFile)) {
      fs.mkdirSync(home, { recursive: true });
      fs.writeFileSync(secretFile, crypto.randomBytes(24).toString('hex'), { mode: 0o600 });
    }
  } catch (err) {
    console.warn(`  terminal keeper unavailable: ${(err as Error).message}`);
    return [];
  }
  const secret = fs.readFileSync(secretFile, 'utf8').trim();
  let hello = await connect(socket, secret);
  if (hello && hello.ready.version !== PTY_PROTOCOL) {
    // A keeper from another version of the office: its terminals can't be picked up, so they stop and it goes.
    console.log(`  replacing the terminal keeper (v${hello.ready.version}); the ${hello.ready.ptys.length} terminal(s) it held are stopped`);
    hello.sock.end(encode({ op: 'shutdown' }));
    hello = null;
    await sleep(3500);
  }
  if (!hello) {
    launch(socket, secretFile);
    for (let i = 0; i < 30 && !hello; i++) {
      await sleep(200);
      hello = await connect(socket, secret);
    }
  }
  if (!hello) {
    console.warn("  terminal keeper unavailable: agents' terminals run in the dungeon and stop when it restarts");
    return [];
  }
  conn = hello.sock;
  leaving = false;
  hookPort = hello.ready.hookPort;
  hostPid = hello.ready.pid ?? 0;
  found = hello.ready.ptys;
  return found;
}

/** The keeper's process (0 when there's none, or it didn't say): desk clean-ups must never stop it. */
export const keeperPid = () => (conn ? hostPid : 0);

// ---------- terminals ----------

/** Where the CLIs' hooks go: the keeper, which holds them while the office restarts. null: straight to the office. */
export function keeperHookUrl(): string | null {
  return conn ? `http://127.0.0.1:${hookPort}` : null;
}

/** A CLI in a new pseudo-terminal: in the keeper when there is one, else in this process (throws if it can't start). */
export function spawnPty(file: string, args: string[], o: PtyOptions, meta: unknown): Pty {
  if (conn) {
    const p = new RemotePty(crypto.randomUUID());
    send({ op: 'spawn', id: p.id, file, args, cwd: o.cwd, env: o.env, cols: o.cols, rows: o.rows, meta });
    return p;
  }
  if (!nodePty) throw new Error('the terminal module could not be loaded on this machine');
  // useConptyDll: Windows' own console host lingers after each CLI exits (one conhost.exe per terminal); the one
  // node-pty ships goes with its terminal. Ignored elsewhere.
  const p = nodePty.spawn(file, args, { name: 'xterm-256color', cols: o.cols, rows: o.rows, cwd: o.cwd, env: o.env, useConptyDll: true });
  return {
    get pid() {
      return p.pid;
    },
    write: (data) => p.write(data),
    resize: (cols, rows) => p.resize(cols, rows),
    kill: () => killTree(p),
    setMeta: () => undefined,
    onData: (cb) => void p.onData(cb),
    onExit: (cb) => void p.onExit(({ exitCode }) => cb(exitCode)),
  };
}

/** Take over a terminal the keeper held through a restart: what it printed meanwhile, then everything live. */
export function adoptPty(held: HeldPty): Pty {
  const p = new RemotePty(held.id);
  p.pid = held.pid;
  queueMicrotask(() => send({ op: 'attach', id: held.id })); // once the caller has its listeners on
  return p;
}

/** A held terminal nobody picks up: its CLI is stopped. */
export function discardPty(held: HeldPty) {
  send({ op: 'kill', id: held.id });
}

/** The office has picked up its terminals and their sessions: hooks that waited for it can come in. */
export function hooksReady() {
  send({ op: 'hooksReady' });
}

/** The office is restarting: its terminals stay with the keeper, which holds their output until it's back. */
export function leaveKeeper() {
  leaving = true;
  conn?.end();
}

function killTree(proc: IPty) {
  if (process.platform === 'win32') {
    const tk = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    tk.once('error', () => undefined);
    return;
  }
  try {
    process.kill(-proc.pid, 'SIGTERM'); // the CLI leads its own session: take its MCP servers and tools with it
  } catch {
    proc.kill();
  }
}
