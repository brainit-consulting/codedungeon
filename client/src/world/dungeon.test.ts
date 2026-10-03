import { describe, expect, it } from 'vitest';
import { GALLERY, chamber, chambersToDraw, doorLeafAt, doorsOpen, drawnFor, hallDrawn, dungeonColliders, galleryColliders, galleryEnd, inDungeon, roomAt, toLocal, toWorld, visitSpot } from './dungeon';
import { HALF_D, HALF_W, collide, officeColliders, rect } from './layout';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('chamber placement', () => {
  it('alternates west and east along the gallery, two chambers per row', () => {
    expect([1, 2, 3, 4].map((s) => chamber(s).side)).toEqual(['west', 'east', 'west', 'east']);
    expect(chamber(1).z).toBe(chamber(2).z);
    expect(chamber(3).z).toBeGreaterThan(chamber(1).z + HALF_W * 2);
  });

  it("puts each chamber's door (its local south wall) on the gallery wall", () => {
    for (const s of [1, 2, 3, 6]) {
      const c = chamber(s);
      const door = toWorld(c, 0, HALF_D);
      near(Math.abs(door.x), GALLERY.half + GALLERY.wall);
      near(door.z, c.z);
    }
  });

  it('round-trips local and world coordinates', () => {
    for (const s of [1, 2]) {
      const c = chamber(s);
      const w = toWorld(c, 3.5, -6.2);
      const l = toLocal(c, w.x, w.z);
      near(l.x, 3.5);
      near(l.z, -6.2);
    }
  });

  it('keeps chambers from overlapping each other, the gallery or the hall', () => {
    const boxes = [1, 2, 3, 4, 5, 6].map((s) => {
      const c = chamber(s);
      const a = toWorld(c, -HALF_W - 0.4, -HALF_D - 0.4);
      const b = toWorld(c, HALF_W + 0.4, HALF_D + 0.4);
      return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
    });
    const hall = { minX: -HALF_W - 0.4, maxX: HALF_W + 0.4, minZ: -HALF_D - 0.4, maxZ: HALF_D + 0.4 };
    const overlap = (p: typeof hall, q: typeof hall) => p.minX < q.maxX - 1e-6 && q.minX < p.maxX - 1e-6 && p.minZ < q.maxZ - 1e-6 && q.minZ < p.maxZ - 1e-6;
    for (let i = 0; i < boxes.length; i++) {
      expect(overlap(boxes[i], hall)).toBe(false);
      expect(boxes[i].maxX <= -GALLERY.half + 1e-6 || boxes[i].minX >= GALLERY.half - 1e-6).toBe(true);
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
    }
  });
});

describe('roomAt', () => {
  it('knows the hall, the gallery and every chamber', () => {
    expect(roomAt(0, 0, [1, 2])).toBe(0);
    expect(roomAt(0, HALF_D + 3, [1, 2])).toBe(0); // the gallery counts as the hall
    for (const s of [1, 2]) {
      const c = chamber(s);
      const inside = toWorld(c, 0, 0);
      expect(roomAt(inside.x, inside.z, [1, 2])).toBe(s);
    }
  });

  it('ignores chambers that no project uses', () => {
    const c = chamber(3);
    expect(roomAt(c.x, c.z, [1, 2])).toBe(0);
  });
});

describe('the gallery', () => {
  it('ends past the last row of chambers, and is short when there are none', () => {
    expect(galleryEnd([])).toBeLessThan(HALF_D + 10);
    expect(galleryEnd([1, 2, 3])).toBeGreaterThan(chamber(3).z + HALF_W);
  });

  it('leaves a doorway into every chamber and walls off the rest', () => {
    const walls = galleryColliders([1, 2, 4]);
    for (const s of [1, 2, 4]) {
      const c = chamber(s);
      const sign = c.side === 'west' ? -1 : 1;
      // walking from the gallery's middle straight through the door ends up inside the chamber
      let p = { x: 0, z: c.z };
      for (let i = 0; i < 60; i++) p = collide(p.x + sign * 0.1, p.z, walls);
      expect(Math.abs(p.x)).toBeGreaterThan(GALLERY.half + 2);
    }
    // where there is no chamber (chamber 3's spot, west of the second row) the wall is solid
    const c3 = chamber(3);
    let p = { x: 0, z: c3.z };
    for (let i = 0; i < 60; i++) p = collide(p.x - 0.1, p.z, walls);
    expect(p.x).toBeGreaterThan(-GALLERY.half);
  });

  it('opens from the hall through its south doorway', () => {
    const rects = dungeonColliders([1, 2]);
    let p = { x: 0, z: HALF_D - 2 };
    for (let i = 0; i < 80; i++) p = collide(p.x, p.z + 0.1, rects);
    expect(p.z).toBeGreaterThan(HALF_D + 5);
  });
});

describe('dungeon colliders', () => {
  it("place every chamber's furniture in world coordinates", () => {
    const rects = dungeonColliders([1]);
    const c = chamber(1);
    const desk = toWorld(c, -10.5, 3.0); // a desk in the chamber
    const pushed = collide(desk.x, desk.z, rects);
    expect(Math.hypot(pushed.x - desk.x, pushed.z - desk.z)).toBeGreaterThan(0.3);
    expect(rects.length).toBeGreaterThan(officeColliders().length);
  });

  it('keep each rect axis-aligned after turning it', () => {
    for (const r of dungeonColliders([1, 2])) {
      expect(r.maxX).toBeGreaterThanOrEqual(r.minX);
      expect(r.maxZ).toBeGreaterThanOrEqual(r.minZ);
    }
    expect(rect(0, 0, 1, 1)).toBeTruthy();
  });
});

describe('what to draw', () => {
  it('draws the chamber you are in, and chambers whose door is close in the gallery', () => {
    const c1 = chamber(1);
    const inside = toWorld(c1, 0, 0);
    expect(chambersToDraw(inside.x, inside.z, [1, 2, 3, 4])).toEqual([1]);
    expect(chambersToDraw(0, c1.z, [1, 2, 3, 4]).sort()).toEqual([1, 2]);
    expect(chambersToDraw(0, 0, [1, 2, 3, 4])).toEqual([]);
  });
});

describe('visitSpot', () => {
  it('stands you just inside the door, facing into the chamber, clear of everything', () => {
    for (const s of [1, 2]) {
      const v = visitSpot(s);
      expect(roomAt(v.x, v.z, [1, 2])).toBe(s);
      const p = collide(v.x, v.z, dungeonColliders([1, 2]));
      near(p.x, v.x);
      near(p.z, v.z);
      // facing in: forward is (-sin yaw, -cos yaw), pointing from the door towards the chamber's centre
      const c = chamber(s);
      const fx = -Math.sin(v.yaw);
      const fz = -Math.cos(v.yaw);
      expect(fx * (c.x - v.x) + fz * (c.z - v.z)).toBeGreaterThan(0);
    }
  });
});

describe('inDungeon', () => {
  it('is true in the hall, the gallery and chambers in use, and false outside', () => {
    expect(inDungeon(0, 0, [1])).toBe(true);
    expect(inDungeon(0, HALF_D + 4, [1])).toBe(true);
    const c = chamber(1);
    expect(inDungeon(c.x, c.z, [1])).toBe(true);
    expect(inDungeon(c.x, c.z, [])).toBe(false); // that chamber is gone
    expect(inDungeon(0, galleryEnd([1]) + 1, [1])).toBe(false);
    expect(inDungeon(HALF_W + 5, 0, [1])).toBe(false);
  });

  it('counts every step through a chamber doorway as inside, and the wall beside it as outside', () => {
    const slots = [1, 2, 3, 4];
    for (const s of slots) {
      const c = chamber(s);
      const out = c.side === 'west' ? -1 : 1;
      for (let d = 0; d <= GALLERY.wall + 1; d += 0.05) {
        const x = out * (GALLERY.half - 0.5 + d);
        for (const dz of [-1, 0, 1]) expect(inDungeon(x, c.z + dz, slots), `chamber ${s} at x ${x.toFixed(2)}, dz ${dz}`).toBe(true);
      }
      // inside the wall itself, well clear of the doorway
      expect(inDungeon(out * (GALLERY.half + GALLERY.wall / 2), c.z + 6, slots)).toBe(false);
    }
  });
});

describe('the great hall', () => {
  it('keeps the aisle from the gallery doorway up to the bar clear of the tables, benches and stools', () => {
    const rects = dungeonColliders([1]);
    let p = { x: 0, z: HALF_D - 0.5 };
    for (let i = 0; i < 140; i++) p = collide(p.x, p.z - 0.1, rects);
    expect(p.z).toBeLessThan(-1.5); // walked from the doorway to just in front of the bar's stools
    expect(p.x).toBeCloseTo(0, 6);
  });
});

describe('chamber doors', () => {
  const slots = [1, 2, 3, 4, 5];

  it('only stand open on a chamber that is being drawn, wherever you are', () => {
    for (let x = -30; x <= 30; x += 0.5) {
      for (let z = -12; z <= galleryEnd(slots) + 2; z += 0.5) {
        const drawn = chambersToDraw(x, z, slots);
        for (const s of doorsOpen(x, z, slots)) expect(drawn, `door ${s} open at ${x}, ${z}`).toContain(s);
      }
    }
  });

  it("open as you come up the gallery, stay open while you're inside, and are shut from the hall", () => {
    const c = chamber(1);
    expect(doorsOpen(0, c.z, slots)).toContain(1);
    expect(doorsOpen(c.x, c.z, slots)).toEqual([1]); // inside chamber 1: the door opposite stays shut
    expect(doorsOpen(0, 0, slots)).toEqual([]);
    expect(doorsOpen(0, c.z + 20, slots)).not.toContain(1);
  });
});

describe('what is drawn for the viewer', () => {
  const slots = [1, 2];
  const c1 = chamber(1);
  const c2 = chamber(2);

  it('draws the hall from the hall and the first stretch of the gallery only', () => {
    expect(hallDrawn(0, 0, slots)).toBe(true);
    expect(hallDrawn(0, HALF_D + 5, slots)).toBe(true);
    expect(hallDrawn(0, HALF_D + 40, slots)).toBe(false);
    expect(hallDrawn(c1.x, c1.z, slots)).toBe(false);
  });

  it('says whether a spot is in a room being drawn for someone standing elsewhere', () => {
    expect(drawnFor(c1.x, c1.z, c1.x + 3, c1.z, slots)).toBe(true); // same chamber
    expect(drawnFor(c1.x, c1.z, c2.x, c2.z, slots)).toBe(false); // the chamber across the gallery
    expect(drawnFor(c1.x, c1.z, 0, HALF_D + 6, slots)).toBe(true); // the gallery is always drawn
    const long = [1, 2, 3, 4, 5, 6];
    expect(drawnFor(0, galleryEnd(long) - 1, 0, 0, long)).toBe(true);
    expect(drawnFor(-6, 0, 0, galleryEnd(long) - 1, long)).toBe(false); // the hall, seen from far down the gallery
  });
});

describe('the cat at a door', () => {
  it("knows which leaf she's going through, and none when she's clear of the doorway", () => {
    const c = chamber(2);
    const at = (x: number, z: number) => toWorld(c, x, z);
    const p = at(-0.6, HALF_D);
    expect(doorLeafAt(c, p.x, p.z)).toBe(-1);
    const q = at(0.5, HALF_D + 0.3);
    expect(doorLeafAt(c, q.x, q.z)).toBe(1);
    const inside = at(0.5, HALF_D - 2);
    expect(doorLeafAt(c, inside.x, inside.z)).toBe(0);
    const wall = at(3, HALF_D);
    expect(doorLeafAt(c, wall.x, wall.z)).toBe(0);
  });
});
