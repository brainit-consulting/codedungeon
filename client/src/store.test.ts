import { describe, expect, it } from 'vitest';
import type { RepoView } from '../../shared/types';
import { useStore } from './store';

const repo = (id: string, floor: number) => ({ id, floor }) as unknown as RepoView;

describe('the room you are in', () => {
  it('sends you back to the hall when the project whose chamber you stand in is removed', () => {
    useStore.setState({ repos: [repo('a/one', 1), repo('a/two', 2)], floor: 2, visit: null });
    useStore.getState().apply({ type: 'repoRemoved', repoId: 'a/two' } as never);
    expect(useStore.getState().floor).toBe(0);
    expect(useStore.getState().visit?.to).toBe(0);
  });

  it('leaves you where you are when another project is removed', () => {
    useStore.setState({ repos: [repo('a/one', 1), repo('a/two', 2)], floor: 1, visit: null });
    useStore.getState().apply({ type: 'repoRemoved', repoId: 'a/two' } as never);
    expect(useStore.getState().floor).toBe(1);
    expect(useStore.getState().visit).toBeNull();
  });
});
