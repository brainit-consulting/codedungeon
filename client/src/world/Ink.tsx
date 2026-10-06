import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PAGE, inkDrawn, pageInk, penAt, type Nib, type PageInk } from './quillRules';

// The ink in a working coder's ledger (Desk.tsx), in step with their quill (quillRules.ts; writingHands.ts moves the
// hand): the right-hand page fills line by line under the nib, the left shows the page written before, and when the
// right page is full its leaf turns over to the left. Thin dark lines, in the bench's frame. While they're away the
// page stays as they left it.

const INK = new THREE.LineBasicMaterial({ color: '#1b130d' });
const LEAF = new THREE.MeshStandardMaterial({
  color: '#d9c49a',
  roughness: 0.95,
  side: THREE.DoubleSide,
});
/** The leaf that turns: a page's size, pivoting on the spine. */
const LEAF_GEO = new THREE.BoxGeometry(0.26, 0.002, 0.33);

function lines(ink: PageInk) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(ink.positions, 3));
  return { ink, g };
}

/** The ink on one bench's ledger, its middle `ledgerZ` from the bench's centre. */
export function Ink({ seed, writing, ledgerZ }: { seed: number; writing: boolean; ledgerZ: number }) {
  const right = useRef<THREE.LineSegments>(null);
  const left = useRef<THREE.LineSegments>(null);
  const carried = useRef<THREE.LineSegments>(null);
  const leaf = useRef<THREE.Group>(null);
  // the pages drawn lately (the one being written, the one before, the one turning), built as they're needed
  const pages = useMemo(() => new Map<string, ReturnType<typeof lines>>(), []);
  const last = useRef<Nib | null>(null);
  useEffect(() => () => pages.forEach((p) => p.g.dispose()), [pages]);

  const page = (n: number, onLeft: boolean) => {
    const key = `${n}:${onLeft ? 'l' : 'r'}`;
    let p = pages.get(key);
    if (!p) {
      p = lines(pageInk(n, seed, onLeft));
      pages.set(key, p);
      // keep a handful: the newest pages
      if (pages.size > 6) {
        const oldest = [...pages.keys()].sort((a, b) => parseInt(a) - parseInt(b))[0];
        pages.get(oldest)!.g.dispose();
        pages.delete(oldest);
      }
    }
    return p;
  };

  useFrame(({ clock }) => {
    // away from the bench, the page stays as it was left
    if (!writing && last.current) return;
    const nib = penAt(clock.elapsedTime, seed);
    last.current = nib;
    // from the moment the leaf starts over, the right-hand page is the next, still blank
    const shown = nib.turn && nib.turning > 0 ? nib.page + 1 : nib.page;
    const r = page(shown, false);
    const l = page(shown - 1, true);
    if (right.current) {
      if (right.current.geometry !== r.g) right.current.geometry = r.g;
      r.g.setDrawRange(0, inkDrawn(r.ink, nib));
    }
    if (left.current && left.current.geometry !== l.g) left.current.geometry = l.g;
    const turning = nib.turn && nib.turning > 0 && nib.turning < 1;
    if (leaf.current) {
      leaf.current.visible = turning;
      leaf.current.rotation.z = nib.turning * Math.PI;
    }
    if (turning && carried.current) {
      const c = page(nib.page, false);
      if (carried.current.geometry !== c.g) carried.current.geometry = c.g;
    }
  });

  return (
    <group>
      <lineSegments ref={right} material={INK} frustumCulled={false} />
      <lineSegments ref={left} material={INK} frustumCulled={false} />
      {/* the leaf turning over on the spine, with the page just written on it */}
      <group ref={leaf} position={[0, PAGE.top, 0]} visible={false}>
        <mesh geometry={LEAF_GEO} material={LEAF} position={[PAGE.middleX, -0.001, ledgerZ]} rotation={[0, 0, -PAGE.tilt]} />
        <lineSegments ref={carried} material={INK} position={[0, -PAGE.top, 0]} frustumCulled={false} />
      </group>
    </group>
  );
}
