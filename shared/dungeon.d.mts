// Types for dungeon.mjs (plain JavaScript, so the launcher runs without a build or tsx).
export const SERVER_PORT: number;
export const CLIENT_PORT: number;
export function defaultHome(repoRoot: string): string;
export function liveOfficeConflict(o: { ports: number[]; home: string; userHome: string; platform?: string }): string | null;
