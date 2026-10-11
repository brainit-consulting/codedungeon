import { beforeEach, describe, expect, it, vi } from 'vitest';

// No real gh: each call is recorded, and the stub answers like GitHub would for the case under test.
const calls: { args: string[]; input?: string }[] = [];
let has = { branch: true, vercelJson: true };
vi.mock('./exec.ts', () => ({
  gh: vi.fn(async (args: string[], opts?: { input?: string }) => {
    calls.push({ args, input: opts?.input });
    const path = args.find((a) => a.startsWith('repos/')) ?? '';
    if (path.includes('/git/ref/heads/') && !has.branch) throw new Error('HTTP 404');
    if (path.includes('/contents/vercel.json?ref=') && !has.vercelJson) throw new Error('HTTP 404');
    if (path.endsWith('/git/trees') || path.endsWith('/git/commits')) return JSON.stringify({ sha: 'sha1' });
    return '{}';
  }),
  ghJson: vi.fn(),
}));
const { EVIDENCE_BRANCH, EVIDENCE_VERCEL_JSON, uploadEvidence } = await import('./github.ts');

const writes = () => calls.filter((c) => c.args.includes('-X'));
const body = (c: { input?: string }) => JSON.parse(c.input ?? '{}');

describe('the QA evidence branch', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('tells Vercel not to deploy it, by its own name', () => {
    expect(JSON.parse(EVIDENCE_VERCEL_JSON)).toEqual({ $schema: 'https://openapi.vercel.sh/vercel.json', git: { deploymentEnabled: { [EVIDENCE_BRANCH]: false } } });
  });

  it('a new branch starts with the README and vercel.json in its first commit', async () => {
    has = { branch: false, vercelJson: false };
    await uploadEvidence('o/new', 'pr-1/round-1-x/01.png', Buffer.from('png'));
    const tree = writes().find((c) => c.args.some((a) => a.endsWith('/git/trees')))!;
    expect(body(tree).tree.map((t: { path: string }) => t.path)).toEqual(['README.md', 'vercel.json']);
    expect(body(tree).tree[1].content).toBe(EVIDENCE_VERCEL_JSON);
    // the README and vercel.json come in the one first commit, then the screenshot: no separate vercel.json write
    expect(writes().filter((c) => c.args.some((a) => a.includes('/contents/vercel.json')))).toHaveLength(0);
  });

  it('an existing branch without vercel.json gets it once, before the screenshot', async () => {
    has = { branch: true, vercelJson: false };
    await uploadEvidence('o/old', 'pr-2/round-1-x/01.png', Buffer.from('png'));
    const puts = writes().map((c) => c.args.find((a) => a.startsWith('repos/')));
    expect(puts).toEqual(['repos/o/old/contents/vercel.json', 'repos/o/old/contents/pr-2/round-1-x/01.png']);
    expect(Buffer.from(body(writes()[0]).content, 'base64').toString()).toBe(EVIDENCE_VERCEL_JSON);
    expect(body(writes()[0]).branch).toBe(EVIDENCE_BRANCH);
    calls.length = 0;
    await uploadEvidence('o/old', 'pr-2/round-1-x/02.png', Buffer.from('png'));
    expect(writes().map((c) => c.args.find((a) => a.startsWith('repos/')))).toEqual(['repos/o/old/contents/pr-2/round-1-x/02.png']);
  });

  it('an existing branch that has it is left alone', async () => {
    has = { branch: true, vercelJson: true };
    await uploadEvidence('o/done', 'pr-3/round-1-x/01.png', Buffer.from('png'));
    expect(writes().map((c) => c.args.find((a) => a.startsWith('repos/')))).toEqual(['repos/o/done/contents/pr-3/round-1-x/01.png']);
  });

  it('a screenshot still uploads when vercel.json cannot be written', async () => {
    has = { branch: true, vercelJson: false };
    const { gh } = await import('./exec.ts');
    vi.mocked(gh).mockImplementationOnce(async () => '{}') // the branch is there
      .mockImplementationOnce(async () => { throw new Error('HTTP 404'); }) // no vercel.json
      .mockImplementationOnce(async () => { throw new Error('HTTP 403'); }); // writing it is refused
    const url = await uploadEvidence('o/locked', 'pr-4/round-1-x/01.png', Buffer.from('png'));
    expect(url).toBe(`https://github.com/o/locked/raw/${EVIDENCE_BRANCH}/pr-4/round-1-x/01.png`);
  });
});
