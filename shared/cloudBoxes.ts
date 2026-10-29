// Recruits in Upstash Boxes: the rules for who may work in a box, worded for the Overlord. Shared by the server, which
// enforces them, and the ledger, which greys out what can't be chosen and says why.
import type { AgentMachine, AgentRole, AgentStatus, CloudBoxesSettings } from './types.ts';

export const DEFAULT_CLOUD_BOXES: CloudBoxesSettings = { enabled: false, maxBoxes: 10, snapshotId: '' };

/** The settings as saved, with anything out of range brought back in. */
export function cleanCloudBoxes(patch: Partial<CloudBoxesSettings> | undefined, current: CloudBoxesSettings = DEFAULT_CLOUD_BOXES): CloudBoxesSettings {
  const next = { ...current };
  if (typeof patch?.enabled === 'boolean') next.enabled = patch.enabled;
  if (patch?.maxBoxes !== undefined) next.maxBoxes = Math.max(1, Math.min(100, Math.round(Number(patch.maxBoxes)) || 1));
  if (typeof patch?.snapshotId === 'string') next.snapshotId = patch.snapshotId.trim();
  return next;
}

export interface MachineFacts {
  role: AgentRole;
  status: AgentStatus;
  hasTask: boolean;
  current: AgentMachine;
  cloud: CloudBoxesSettings;
  keyPresent: boolean;
  githubTokenPresent: boolean;
  terminalRuntime: boolean;
  /** Recruits already given a box (this one excluded). */
  boxesInUse: number;
}

/** Why a recruit can't move to `to` right now, for the Overlord; null when they can. */
export function machineRefusal(to: AgentMachine, f: MachineFacts): string | null {
  if (to === f.current) return null;
  if (f.role === 'ceo') return 'The DungeonMaster always works on this computer.';
  if (f.role === 'qa' && to === 'box') return 'Testers work on this computer for now (they use its test browsers and screenshots).';
  if (f.hasTask || f.status === 'working' || f.status === 'preparing') return 'They can move once their current task is done.';
  if (to === 'local') return null;
  if (!f.cloud.enabled) return 'Cloud boxes are off: turn them on in Settings first.';
  if (!f.keyPresent) return 'No Upstash Box API key: set UPSTASH_BOX_API_KEY on this computer, then restart the dungeon.';
  if (!f.githubTokenPresent) return 'No GitHub token for the boxes: set CODEDUNGEON_BOX_GITHUB_TOKEN on this computer.';
  if (!f.cloud.snapshotId) return 'The base box isn\'t built yet: build it in Settings first.';
  if (!f.terminalRuntime) return 'Recruits in boxes need the terminal runtime (Settings).';
  if (f.boxesInUse >= f.cloud.maxBoxes) return `All ${f.cloud.maxBoxes} boxes are in use. Move someone back to this computer, or raise the limit.`;
  return null;
}
