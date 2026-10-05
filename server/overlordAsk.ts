// A coder or tester who can't go on without the Overlord (a decision, a password or key, an account, access) ends
// their turn with a line starting "Overlord:" that says what they need. Pure, so it can be tested; Swarm.onFinished
// puts it on the Overlord's scroll and halts them until they're answered (Carry on, or a reply, resumes them).

/** The line in their instructions that says how to ask. */
export const ASK_RULE =
  'If you are blocked on something only the Overlord can give (a decision you must not make yourself, a password or key, an account, access), stop and end your final message with a line starting "Overlord:" that says exactly what you need.';

/** Only the end of their message counts: an ask is the last thing they say. */
const TAIL_LINES = 12;
const MAX = 600;

/** What they asked the Overlord for at the end of their last message, or null. */
export function overlordAsk(text: string): string | null {
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - TAIL_LINES); i--) {
    const m = lines[i].match(/^[\s>*_#-]*\**overlord\**\s*:\**\s*(.*)$/i);
    if (!m) continue;
    const ask = [m[1], ...lines.slice(i + 1)].join('\n').trim();
    return ask ? ask.slice(0, MAX) : null;
  }
  return null;
}
