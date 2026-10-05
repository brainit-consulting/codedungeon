// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { auditProps, restingGap, verdict } from './propAudit';

describe('restingGap', () => {
  it('measures from the prop’s lowest point down to the highest surface found under it', () => {
    expect(restingGap(0.8, [0.75, 0.62, null])).toBeCloseTo(0.05);
    expect(restingGap(0.75, [0.75])).toBeCloseTo(0);
  });

  it('is null with nothing at all under it', () => {
    expect(restingGap(1, [null, null])).toBeNull();
  });
});

describe('verdict', () => {
  it('lets a hair of air or overlap pass, and calls out floating and sinking', () => {
    expect(verdict(0.004)).toBe('ok');
    expect(verdict(-0.01)).toBe('ok');
    expect(verdict(0.03)).toBe('floats');
    expect(verdict(-0.06)).toBe('sunk');
    expect(verdict(null)).toBe('nothing under');
  });
});

describe('auditProps', () => {
  /** A 1 m table top at 0.75 m, and two mugs: one standing on it, one hovering 6 cm above it. */
  function room() {
    const scene = new THREE.Scene();
    const table = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1));
    table.position.set(0, 0.725, 0);
    scene.add(table);
    const mug = (name: string, x: number, y: number) => {
      const g = new THREE.Group();
      g.userData.model = name;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1).translate(0, 0.05, 0));
      g.add(m);
      g.position.set(x, y, 0);
      scene.add(g);
      return g;
    };
    mug('props/Mug', -0.2, 0.75);
    mug('props/Mug', 0.2, 0.81);
    scene.updateMatrixWorld(true);
    return scene;
  }

  it('finds the prop that floats and passes the one standing on the table', () => {
    const report = auditProps(room());
    expect(report).toHaveLength(2);
    const [standing, hovering] = [...report].sort((a, b) => a.at[0] - b.at[0]);
    expect(verdict(standing.gap)).toBe('ok');
    expect(hovering.gap).toBeCloseTo(0.06, 2);
    expect(verdict(hovering.gap)).toBe('floats');
  });
});
