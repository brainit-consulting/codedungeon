import { useState } from 'react';
import type { RepoView } from '../../../shared/types';
import { api } from '../api';
import { Icon } from './Icon';

// A chamber whose default branch isn't on GitHub yet (server/emptyRepo.ts): the notice, how far the dungeon's upload
// has got, why it failed, and Push to GitHub when the commits are in the chamber's folder. Shown on the Kanban board
// and in the ledger's chamber list.

export function NoMainNotice({ repo, small = false }: { repo: RepoView; small?: boolean }) {
  const [starting, setStarting] = useState(false);
  if (!repo.noMain) return null;
  const up = repo.upload;
  const push = async () => {
    setStarting(true);
    try {
      await api.uploadMain(repo.id);
    } catch {
      // api() already toasted
    } finally {
      setStarting(false);
    }
  };
  return (
    <div className={`term-error${up?.status === 'pushing' ? ' term-busy' : ''}${small ? ' small' : ''}`}>
      <Icon name={up?.status === 'pushing' ? 'hourglass' : 'warning'} /> {repo.noMain}
      {up?.status === 'pushing' && <b> {up.progress ? `Now ${up.progress}.` : 'Starting…'}</b>}
      {up?.status === 'failed' && up.error && <div>{up.error}</div>}
      {repo.canUpload && (
        <div>
          <button className="btn btn-small btn-good" disabled={starting} onClick={() => void push()}>
            {up?.status === 'failed' ? 'Push again' : 'Push to GitHub'}
          </button>
        </div>
      )}
    </div>
  );
}
