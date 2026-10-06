import { useState } from 'react';
import type { RepoView } from '../../../shared/types';
import { api } from '../api';
import { Icon } from './Icon';

// Test browsers a chamber's Playwright asked for that aren't installed (server/browsers.ts): one line each, with
// Install and the download size, how far an install has got, or why it failed. On the Kanban board and in the ledger.

export function BrowserNotice({ repo, small = false }: { repo: RepoView; small?: boolean }) {
  const [starting, setStarting] = useState<string | null>(null);
  if (!repo.browsers?.length) return null;
  const name = repo.fullName.split('/').pop();
  const install = async (key: string) => {
    setStarting(key);
    try {
      await api.installBrowser(repo.id, key);
    } catch {
      // api() already toasted
    } finally {
      setStarting(null);
    }
  };
  return (
    <>
      {repo.browsers.map((b) => (
        <div key={b.key} className={`term-error${b.status === 'installing' ? ' term-busy' : ''}${small ? ' small' : ''}`}>
          <Icon name={b.status === 'installing' ? 'hourglass' : 'warning'} />{' '}
          {b.status === 'installing' ? (
            <>
              Installing {b.name} for {name}'s tests. <b>{b.progress ? `Now ${b.progress}.` : 'Starting…'}</b>
            </>
          ) : (
            <>
              {name}'s tests need {b.name}, which isn't installed, so those tests can't run.
              {b.status === 'failed' && b.error && <div>{b.error}</div>}
              <div>
                <button className="btn btn-small btn-good" disabled={starting === b.key} onClick={() => void install(b.key)}>
                  {b.status === 'failed' ? 'Try again' : `Install ${b.name.split(' ')[0]}`}
                  {b.sizeMb !== null && ` (${b.sizeMb >= 10 ? Math.round(b.sizeMb) : b.sizeMb} MB)`}
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
