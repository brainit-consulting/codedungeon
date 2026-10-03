import { usePhoneBadge, useStore } from '../store';
import { requestLook } from '../world/Player';
import { CEO_ID } from '../../../shared/types';
import { SetupWizard } from './SetupWizard';
import { unlockAudio } from './sfx';

export function StartScreen() {
  const started = useStore((s) => s.started);
  const loaded = useStore((s) => s.loaded);
  const connected = useStore((s) => s.connected);
  const demo = useStore((s) => s.demo);
  const repos = useStore((s) => s.repos);
  const agents = useStore((s) => s.agents);
  const settings = useStore((s) => s.settings);
  const start = useStore((s) => s.start);
  const waiting = usePhoneBadge();
  if (started) return null;
  if (loaded && !settings.setupDone) return <SetupWizard />;

  const enter = () => {
    start();
    unlockAudio();
    requestLook();
  };
  const ceo = agents[CEO_ID];
  const staff = Object.values(agents).filter((a) => a.role !== 'ceo').length;

  return (
    <div className="start">
      <div className="start-card">
        <div className="start-logo">✻</div>
        <h1>{settings.companyName || 'Code Dungeon'}</h1>
        <p className="start-tag">{settings.managerName ? `Welcome back, ${settings.managerName}.` : 'A dungeon where a guild of AI coders works through your GitHub issues.'}</p>
        <ul className="start-list">
          <li>
            🏰 {repos.length} project{repos.length === 1 ? '' : 's'}, {staff} in the guild{ceo ? `, and ${ceo.name} in the DungeonMaster's quarters` : ''}.
          </li>
          <li>{waiting ? `📜 ${waiting} thing${waiting === 1 ? '' : 's'} waiting on your scroll. Press P once you're in.` : '📜 Press P anywhere for your scroll.'}</li>
          <li>
            🕯️ Walk up behind anyone to watch their slate, or press <kbd>E</kbd> (or click) on things to use them. <kbd>H</kbd> for help.
          </li>
        </ul>
        <button className="btn btn-big" onClick={enter} disabled={!loaded}>
          {loaded ? 'Enter the dungeon' : connected ? 'Loading…' : 'Connecting to the dungeon server…'}
        </button>
        <div className="start-meta">{demo && <span className="pill pill-demo">DEMO MODE: fake repos, fake coders</span>}</div>
      </div>
    </div>
  );
}
