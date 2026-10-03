import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { materialKey } from './models';

describe('sharing model materials', () => {
  it('keeps the vertex-colour copy of a material apart from the plain one with the same name', () => {
    const plain = new THREE.MeshStandardMaterial({ name: 'MI_Trim_Metal' });
    const tinted = new THREE.MeshStandardMaterial({ name: 'MI_Trim_Metal', vertexColors: true });
    expect(materialKey(plain)).not.toBe(materialKey(tinted));
    expect(materialKey(plain)).toBe(materialKey(new THREE.MeshStandardMaterial({ name: 'MI_Trim_Metal' })));
  });
});
