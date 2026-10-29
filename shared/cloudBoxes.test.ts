import { describe, expect, it } from 'vitest';
import { cleanCloudBoxes, DEFAULT_CLOUD_BOXES, machineRefusal, type MachineFacts } from './cloudBoxes.ts';

const ready: MachineFacts = {
  role: 'dev',
  status: 'idle',
  hasTask: false,
  current: 'local',
  cloud: { enabled: true, maxBoxes: 10, snapshotId: 'snap-1' },
  keyPresent: true,
  githubTokenPresent: true,
  terminalRuntime: true,
  boxesInUse: 2,
};

describe('machineRefusal', () => {
  it('lets an idle recruit move to a box when everything is set up', () => {
    expect(machineRefusal('box', ready)).toBeNull();
  });

  it('never moves the DungeonMaster, and keeps testers here for now', () => {
    expect(machineRefusal('box', { ...ready, role: 'ceo' })).toMatch(/always works on this computer/);
    expect(machineRefusal('box', { ...ready, role: 'qa' })).toMatch(/Testers work on this computer/);
    expect(machineRefusal('local', { ...ready, role: 'qa', current: 'box' })).toBeNull();
  });

  it('waits for the current task to finish', () => {
    expect(machineRefusal('box', { ...ready, status: 'working' })).toMatch(/once their current task is done/);
    expect(machineRefusal('local', { ...ready, current: 'box', hasTask: true })).toMatch(/once their current task is done/);
  });

  it('always lets an idle recruit come back to this computer', () => {
    expect(machineRefusal('local', { ...ready, current: 'box', cloud: { ...ready.cloud, enabled: false }, keyPresent: false })).toBeNull();
  });

  it('says what is missing for a box, one thing at a time', () => {
    expect(machineRefusal('box', { ...ready, cloud: { ...ready.cloud, enabled: false } })).toMatch(/Cloud boxes are off/);
    expect(machineRefusal('box', { ...ready, keyPresent: false })).toMatch(/UPSTASH_BOX_API_KEY/);
    expect(machineRefusal('box', { ...ready, githubTokenPresent: false })).toMatch(/CODEDUNGEON_BOX_GITHUB_TOKEN/);
    expect(machineRefusal('box', { ...ready, cloud: { ...ready.cloud, snapshotId: '' } })).toMatch(/base box/);
    expect(machineRefusal('box', { ...ready, terminalRuntime: false })).toMatch(/terminal runtime/);
  });

  it('keeps to the box limit', () => {
    expect(machineRefusal('box', { ...ready, boxesInUse: 10 })).toMatch(/All 10 boxes are in use/);
    expect(machineRefusal('box', { ...ready, boxesInUse: 9 })).toBeNull();
  });
});

describe('cleanCloudBoxes', () => {
  it('starts off, at the free plan limit', () => {
    expect(cleanCloudBoxes(undefined)).toEqual(DEFAULT_CLOUD_BOXES);
    expect(DEFAULT_CLOUD_BOXES).toMatchObject({ enabled: false, maxBoxes: 10 });
  });

  it('keeps the limit in range and the snapshot id tidy', () => {
    expect(cleanCloudBoxes({ maxBoxes: 0 }).maxBoxes).toBe(1);
    expect(cleanCloudBoxes({ maxBoxes: 1000 }).maxBoxes).toBe(100);
    expect(cleanCloudBoxes({ enabled: true, snapshotId: '  snap-2 ' })).toMatchObject({ enabled: true, snapshotId: 'snap-2' });
  });
});
