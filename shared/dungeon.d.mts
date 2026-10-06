// Types for dungeon.mjs (plain JavaScript, so the launcher runs without a build or tsx).
export const SERVER_PORT: number;
export const CLIENT_PORT: number;
export function installedAsPackage(root: string): boolean;
export function defaultHome(repoRoot: string, home?: string): string;
export function parseLocalRules(text: string | null): { forbidCDrive: boolean };
export function localRules(repoRoot: string): { forbidCDrive: boolean };
export function liveOfficeConflict(o: { ports: number[]; home: string; userHome: string; platform?: string; forbidCDrive?: boolean }): string | null;
