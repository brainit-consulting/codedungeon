// Phone-ready QA: the sizes the tester measures, the lines the tester, coders and the DungeonMaster are given, and
// the rule the dungeon applies to the tester's report. The measuring itself is window.__phoneCheck() in
// browser-init.js; QA sessions run it in a second, touch-only browser (the MCP server named phone), so the tester's
// usual browser keeps hover, its own user agent and pixel density (all measured: a --mobile browser changes all three).
import path from 'node:path';

export const PHONE_CHECK = 'Phone-ready';
export const PHONE_SIZES = [
  { width: 375, height: 667, name: 'phone' },
  { width: 844, height: 390, name: 'phone on its side' },
  { width: 810, height: 1080, name: 'tablet' },
  { width: 1280, height: 800, name: 'laptop' },
] as const;
/** The Overlord's mobile-web-polish skill, shipped beside this module (copied into dist-server by the build). */
export const SKILL_PATH = path.join(import.meta.dirname, 'skills', 'mobile-web-polish', 'SKILL.md');
/** Playwright MCP config for the phone browser: touch only (pointer: coarse), the desktop user agent and density. */
export const PHONE_BROWSER_CONFIG = path.join(import.meta.dirname, 'phone-browser.json');

export function phoneQaStep(): string {
  const sizes = PHONE_SIZES.map((s) => `${s.width}x${s.height}`).join(', ');
  return `Phone check, in the touch browser of the MCP server named phone (your usual browser stays as it is for everything else): for every page this PR changes, open it there, browser_resize to each of ${sizes} and run browser_evaluate with () => window.__phoneCheck(). Report one check named "${PHONE_CHECK}" with each size's result in details. Fail only for problems this PR causes (judge by the diff: problems in code it doesn't touch were already there); those go in details as "already there" and don't fail it.`;
}

export function phoneCoderLine(skill = SKILL_PATH): string {
  return `UI work must work from 375px wide and on touch screens: follow ${skill} (dvh, not vh or h-screen; controls 44px on touch; fields 16px on phones).`;
}

export const PHONE_PLAN_CLAUSE =
  'In chambers with phoneReadyChecks on (company_status), issues that add or change screens include in "Done when": works at phone size (375px) and on a tablet.';

interface ReportLike {
  verdict: 'pass' | 'fail';
  checks: { name: string; result: 'pass' | 'fail' | 'skip'; details: string }[];
  fixInstructions?: string;
}

const isPhoneCheck = (name: string) => /^phone[- ]?ready\b/i.test(name.trim());

/** The dungeon's rule on the tester's report: a missing phone check shows as not checked; any failed one fails the round. */
export function enforcePhoneCheck<R extends ReportLike>(report: R, on: boolean): R {
  if (!on) return report;
  const checks = report.checks.filter((c) => isPhoneCheck(c.name));
  if (!checks.length) return { ...report, checks: [...report.checks, { name: PHONE_CHECK, result: 'skip', details: 'Not checked: the tester left the phone check out.' }] };
  const failed = checks.filter((c) => c.result === 'fail');
  if (!failed.length) return report;
  const fix = [report.fixInstructions, ...failed.map((c) => `${PHONE_CHECK}: ${c.details}`)].filter(Boolean).join('\n');
  return { ...report, verdict: 'fail', fixInstructions: fix };
}
