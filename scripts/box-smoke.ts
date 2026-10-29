// A real check of a CLI in an Upstash Box (server/boxRunner.ts), against a box the Overlord names:
//   node scripts/box-smoke.ts <box-id>
// Runs a small interactive program under tmux in the box, types into it, follows its events file, and reports the
// exit code. Needs UPSTASH_BOX_API_KEY. Uses no AI and changes nothing outside its session folder in the box.
import { BoxPty } from '../server/boxRunner.ts';
import { BOX_SESSIONS, boxRun, getBox } from '../server/boxes.ts';

const boxId = process.argv[2];
if (!boxId) throw new Error('usage: node scripts/box-smoke.ts <box-id>');
const dir = `${BOX_SESSIONS}/smoke-${Date.now()}`;
const box = await getBox(boxId);
await boxRun(box, `mkdir -p '${dir}'`);
const program = String.raw`echo "hello from $(hostname)"; echo '{"hook_event_name":"Stop","last_assistant_message":"first"}' >> "$CD_EVENTS_FILE"; read -r line; echo "you typed: $line"; echo "{\"hook_event_name\":\"Stop\",\"last_assistant_message\":\"$line\"}" >> "$CD_EVENTS_FILE"; sleep 1; exit 7`;
let screen = '';
const events: unknown[] = [];
const t0 = Date.now();
const p = new BoxPty({
  boxId,
  dir,
  cwd: '/home/boxuser',
  file: 'bash',
  args: ['-c', program],
  env: { TERM: 'xterm-256color' },
  cols: 100,
  rows: 20,
  onEvent: (e) => events.push(e),
  onNotice: (t) => console.log('notice:', t),
});
p.onData((d) => (screen += d));
const code = await new Promise<number>((resolve) => {
  p.onExit(resolve);
  const typeWhenReady = setInterval(() => {
    if (/hello from/.test(screen)) {
      clearInterval(typeWhenReady);
      p.write('fish cakes\r');
    }
  }, 300);
  setTimeout(() => resolve(-99), 90_000);
});
const plain = screen.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Z0-9]|\x1b[=>]|\r/g, '');
console.log(JSON.stringify({ code, seconds: ((Date.now() - t0) / 1000).toFixed(1), hello: /hello from/.test(plain), echoed: /you typed: fish cakes/.test(plain), events }, null, 1));
await boxRun(box, `rm -rf '${dir}'`);
process.exit(code === 7 && events.length === 2 ? 0 : 1);
