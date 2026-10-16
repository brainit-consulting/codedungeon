import { describe, expect, it } from 'vitest';
import { strangerRefusal, trustedAuthor, trustedPull } from './trust.ts';

describe('trusted authors', () => {
  it("trusts the repo's owner, org members and collaborators", () => {
    for (const a of ['OWNER', 'MEMBER', 'COLLABORATOR']) expect(trustedAuthor(a)).toBe(true);
  });

  it('trusts nobody else, including past contributors, and nobody unknown', () => {
    for (const a of ['CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'MANNEQUIN', 'NONE', '', 'owner']) expect(trustedAuthor(a)).toBe(false);
    expect(trustedAuthor(null)).toBe(false);
    expect(trustedAuthor(undefined)).toBe(false);
  });
});

describe('trusted pull requests', () => {
  it("takes a trusted author's PR from a branch of the repo", () => {
    expect(trustedPull('OWNER', false)).toBe(true);
    expect(trustedPull('COLLABORATOR', false)).toBe(true);
  });

  it("refuses a stranger's PR, and any PR from a fork, even one named like a swarm branch", () => {
    expect(trustedPull('NONE', false)).toBe(false);
    expect(trustedPull('CONTRIBUTOR', false)).toBe(false);
    expect(trustedPull('OWNER', true)).toBe(false);
    expect(trustedPull('NONE', true)).toBe(false);
  });

  it('refuses when GitHub did not say', () => {
    expect(trustedPull(undefined, false)).toBe(false);
    expect(trustedPull('OWNER', undefined)).toBe(false);
    expect(trustedPull('OWNER', null)).toBe(false);
  });
});

describe('the refusal', () => {
  it('says nothing for trusted work', () => {
    expect(strangerRefusal('Issue', 4, { trusted: true, author: 'emile' })).toBeNull();
  });

  it('names the stranger and what to do', () => {
    expect(strangerRefusal('Issue', 4, { trusted: false, author: 'mallory' })).toMatch(/#4 was opened by @mallory.*file it again yourself/);
    expect(strangerRefusal('PR', 9, { trusted: false, author: null })).toMatch(/#9 was opened by someone from a fork.*won't run, test or merge it/);
  });
});
