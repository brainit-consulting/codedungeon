// Phone-ready QA: the sizes the tester measures, the lines the tester, coders and the DungeonMaster are given, and
// the rule the dungeon applies to the tester's report. The measuring itself is window.__phoneCheck() in
// browser-init.js; QA sessions run it in a touch browser (Playwright MCP --mobile).
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

export function phoneQaStep(): string {
  const sizes = PHONE_SIZES.map((s) => `${s.width}x${s.height}`).join(', ');
  return `Phone check: for every page this PR changes, browser_resize to each of ${sizes} and run browser_evaluate with () => window.__phoneCheck(). Report one check named "${PHONE_CHECK}": pass only if it returned ok at every size; otherwise fail, with each size's problems in details. Problems on pages this PR didn't change go in details as "elsewhere" and don't fail it.`;
}

export function phoneCoderLine(skill = SKILL_PATH): string {
  return `UI work must work from 375px wide and on touch screens: follow ${skill} (dvh, not vh or h-screen; controls 44px on touch; fields 16px on phones).`;
}

export const PHONE_PLAN_CLAUSE = 'For issues that add or change screens, "Done when" includes: works at phone size (375px) and on a tablet.';

interface ReportLike {
  verdict: 'pass' | 'fail';
  checks: { name: string; result: 'pass' | 'fail' | 'skip'; details: string }[];
  fixInstructions?: string;
}

/** The dungeon's rule on the tester's report: a missing phone check shows as not checked; a failed one fails the round. */
export function enforcePhoneCheck<R extends ReportLike>(report: R, on: boolean): R {
  if (!on) return report;
  const check = report.checks.find((c) => c.name === PHONE_CHECK);
  if (!check) return { ...report, checks: [...report.checks, { name: PHONE_CHECK, result: 'skip', details: 'Not checked: the tester left the phone check out.' }] };
  if (check.result !== 'fail') return report;
  const fix = [report.fixInstructions, `${PHONE_CHECK}: ${check.details}`].filter(Boolean).join('\n');
  return { ...report, verdict: 'fail', fixInstructions: fix };
}
