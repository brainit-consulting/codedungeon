import { useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { requestLook } from '../world/Player';
import { CEO_ID, type RepoView } from '../../../shared/types';
import { BronzeGear, Icon } from './Icon';
import { ProjectPicker } from './ProjectPicker';

// First run: who you are, the company, your CEO and your first project. Every field has a default, so
// "Skip" (or just pressing Next) gets a working office.

const COMPANIES = ['The Gilded Quill', 'Blackthorn Forge', 'Ravenhold Scriptorium', 'The Iron Lantern Guild', 'Wyrmstone Works', 'The Crooked Tower', 'Owl & Anvil', 'The Salt Road Company', 'Hollow Oak Abbey', 'The Merge & Mortar Guild'];
const CEO_NAMES = [
  'Mortimer', 'Morgana', 'Bertilak', 'Ysolde', 'Gawain', 'Brangwen', 'Percival', 'Elaine', 'Tristram', 'Vivienne', 'Taliesin', 'Melisande',
  'Ermengarde', 'Bohemond', 'Radegund', 'Hrothgar', 'Theodora', 'Ottokar', 'Morgause', 'Aldous',
];
/** Heraldic tinctures for the DungeonMaster's robe: gules, azure, vert, or, purpure, tenné. */
const ROBES = ['#8e2a22', '#2f4d7a', '#3d6332', '#b8862b', '#5e3a63', '#a5512a'];
const STEPS = ['Welcome', 'You', 'Your DungeonMaster', 'First project', 'Ready'];

const pickOther = <T,>(list: T[], current: T) => {
  const rest = list.filter((x) => x !== current);
  return rest[Math.floor(Math.random() * rest.length)];
};

/** The DungeonMaster as a woodcut: hooded robe in their tincture, a staff with an ember, a beard or long hair. */
function CeoPortrait({ color, look }: { color: string; look: 'feminine' | 'masculine' }) {
  const ink = '#2a1d14';
  const line = { stroke: ink, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 120 120" className="ceo-portrait" aria-hidden="true">
      <circle cx="60" cy="60" r="57" fill="#ecdfc2" {...line} strokeWidth="3" />
      <circle cx="60" cy="60" r="51" fill="none" {...line} strokeWidth="0.8" strokeDasharray="2 3" />
      <path d="M97 112V34" {...line} strokeWidth="4" />
      <path d="M97 13C103 20 102 26 97 29C92 26 91 20 97 13Z" fill="#a0441c" {...line} strokeWidth="1.6" />
      <path d="M20 117C21 92 36 82 60 82C84 82 99 92 100 117Z" fill={color} {...line} strokeWidth="3" />
      <path d="M60 84C51 95 49 106 50 117M60 84C69 95 71 106 70 117" fill="none" {...line} strokeWidth="1.4" />
      <path d="M30 104L33 110M36 98L39 104M84 98L81 104M90 104L87 110" {...line} strokeWidth="1" />
      <path d="M27 92C23 54 37 22 60 18C83 22 97 54 93 92C83 82 37 82 27 92Z" fill={color} {...line} strokeWidth="3" />
      <path d="M60 18C83 22 97 54 93 92C88 87 82 85 76 84C84 60 76 32 60 18Z" fill={ink} opacity="0.28" />
      <ellipse cx="60" cy="56" rx="20" ry="25" fill={ink} />
      <ellipse cx="60" cy="59" rx="14" ry="18" fill="#e3bd8e" />
      {look === 'feminine' ? (
        <path d="M47 46C44 62 45 76 49 86M73 46C76 62 75 76 71 86" fill="none" stroke="#4a3322" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <path d="M46 61C46 80 52 92 60 97C68 92 74 80 74 61C69 69 51 69 46 61Z" fill="#d8d0bf" {...line} strokeWidth="1.8" />
      )}
      <path d="M50 52L56 51M64 51L70 52" {...line} strokeWidth="2.4" />
      <path d="M52 56H55M65 56H68" {...line} strokeWidth="2" />
      <path d="M56 70Q60 72 64 70" fill="none" {...line} strokeWidth="1.8" />
      <circle cx="60" cy="88" r="4.2" fill="#a0441c" {...line} strokeWidth="1.6" />
    </svg>
  );
}

export function SetupWizard() {
  const user = useStore((s) => s.user);
  const demo = useStore((s) => s.demo);
  const ghReady = useStore((s) => s.ghReady);
  const ghError = useStore((s) => s.ghError);
  const ceoAgent = useStore((s) => s.agents[CEO_ID]);
  const start = useStore((s) => s.start);

  const [step, setStep] = useState(0);
  const [managerName, setManagerName] = useState('');
  const [companyName, setCompanyName] = useState(() => COMPANIES[Math.floor(Math.random() * COMPANIES.length)]);
  // a name or colour saved before the dungeon (an office-era name like Morgan, a tie colour) gives way to a period one
  const [ceoName, setCeoName] = useState(() => (ceoAgent && CEO_NAMES.includes(ceoAgent.name) ? ceoAgent.name : CEO_NAMES[Math.floor(Math.random() * CEO_NAMES.length)]));
  const [ceoLook, setCeoLook] = useState<'feminine' | 'masculine'>(ceoAgent?.look ?? 'masculine');
  const [ceoColor, setCeoColor] = useState(() => (ceoAgent && ROBES.includes(ceoAgent.color) ? ceoAgent.color : ROBES[0]));
  const [hiring, setHiring] = useState<'approve' | 'auto'>('approve');
  const [project, setProject] = useState<RepoView | null>(null);
  const [busy, setBusy] = useState(false);

  const me = managerName.trim() || user || 'Overlord';
  const ceo = ceoName.trim() || 'Mortimer';
  const company = companyName.trim() || COMPANIES[0];

  const save = () => api.setup({ managerName: me, companyName: company, hiring, ceoName: ceo, ceoLook, ceoColor });
  const finish = async () => {
    setBusy(true);
    try {
      await save();
      await api.updateSettings({ setupDone: true, tutorialStep: 0 });
      start();
      requestLook();
    } catch {
      setBusy(false); // api() already toasted
    }
  };
  const next = async () => {
    if (step === 2) {
      setBusy(true);
      try {
        await save(); // so the CEO already knows everyone's names when they study the first project
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setStep(step + 1);
  };

  return (
    <div className="start">
      <div className="start-card wizard">
        <div className="wizard-steps">
          {STEPS.map((s, i) => (
            <span key={s} className={`wizard-dot ${i === step ? 'wizard-dot-on' : i < step ? 'wizard-dot-done' : ''}`} title={s} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="start-logo"><BronzeGear /></div>
            <h1>Code Dungeon</h1>
            <p className="start-tag">Your own software dungeon, worked by a guild of AI coders.</p>
            <ul className="start-list">
              <li><Icon name="castle" /> Every project gets its own chamber, with coders and an assay room working through its GitHub issues.</li>
              <li><Icon name="crown" /> A DungeonMaster studies each project, plans the work and puts forward the specialists it needs. You approve every recruit.</li>
              <li><Icon name="scroll" /> Your scroll keeps you informed from anywhere in the dungeon.</li>
            </ul>
            {!ghReady && ghError && <div className="term-error small"><Icon name="warning" /> {ghError}</div>}
            <button className="btn btn-big" onClick={() => setStep(1)}>
              Let's set up your company
            </button>
            <div className="start-meta">
              <button className="linkish" onClick={finish} disabled={busy}>
                Skip setup and use the defaults
              </button>
              {demo && <span className="pill pill-demo">DEMO MODE</span>}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="wizard-icon"><Icon name="crown" /></div>
            <h2>Who's the Overlord?</h2>
            <p className="start-tag">That's you. You run the company; the coders do the typing.</p>
            <label className="field">
              <span>Your name</span>
              <input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder={user ?? 'Overlord'} autoFocus />
            </label>
            <label className="field">
              <span>Company name</span>
              <div className="row" style={{ margin: 0 }}>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={COMPANIES[0]} />
                <button type="button" className="btn btn-small" title="Suggest another name" onClick={() => setCompanyName(pickOther(COMPANIES, companyName))}>
                  <Icon name="dice" />
                </button>
              </div>
            </label>
            <p className="muted small">It goes on the sign in the great hall. Change either any time in the Overlord's ledger.</p>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Meet your DungeonMaster</h2>
            <div className="ceo-setup">
              <CeoPortrait color={ceoColor} look={ceoLook} />
              <div className="grow">
                <label className="field">
                  <span>Name</span>
                  <div className="row" style={{ margin: 0 }}>
                    <input value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder="Mortimer" autoFocus />
                    <button type="button" className="btn btn-small" title="Suggest another name" onClick={() => setCeoName(pickOther(CEO_NAMES, ceoName))}>
                      <Icon name="dice" />
                    </button>
                  </div>
                </label>
                <div className="row">
                  <label className="toggle">
                    <input type="radio" checked={ceoLook === 'feminine'} onChange={() => setCeoLook('feminine')} /> She
                  </label>
                  <label className="toggle">
                    <input type="radio" checked={ceoLook === 'masculine'} onChange={() => setCeoLook('masculine')} /> He
                  </label>
                  <span className="spacer" />
                  {ROBES.map((c) => (
                    <button key={c} type="button" className={`swatch ${c === ceoColor ? 'swatch-on' : ''}`} style={{ background: c }} onClick={() => setCeoColor(c)} title="Their robe" />
                  ))}
                </div>
                <div className="muted small">Claude Opus 5.5 at xhigh effort: the thinking-hardest soul in the dungeon.</div>
              </div>
            </div>
            <p className="start-tag" style={{ margin: '12px 0 6px' }}>
              {ceo} studies every project, writes its QA checklist, plans the work as GitHub issues and puts forward who to recruit.
            </p>
            <label className="toggle block">
              <input type="radio" checked={hiring === 'approve'} onChange={() => setHiring('approve')} />
              <span>
                <b>Ask me before every recruit</b> (recommended). Recruits wait in the great hall and on your scroll.
              </span>
            </label>
            <label className="toggle block">
              <input type="radio" checked={hiring === 'auto'} onChange={() => setHiring('auto')} />
              <span>
                <b>Let {ceo} recruit</b> on their own, up to 6 people per chamber.
              </span>
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Your first project</h2>
            {project ? (
              <div className="wizard-done">
                <div className="wizard-icon"><Icon name="banner" /></div>
                <p>
                  <b>{project.fullName}</b> moved into chamber {project.floor}.
                </p>
                <p className="muted">
                  {ceo} is studying it right now and will write to you when they know who the guild needs. A tester is already in the assay room.
                </p>
              </div>
            ) : (
              <>
                <p className="start-tag">Pick one of your project folders, a GitHub repo, or start something new. Every project needs to be on GitHub: issues and pull requests are how the guild works.</p>
                <ProjectPicker onConnected={setProject} />
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div className="wizard-icon"><Icon name="castle" /></div>
            <h2>{company} is open for business</h2>
            <ul className="start-list">
              <li>
                <Icon name="crown" /> {ceo}{project ? ` is studying ${project.fullName.split('/')[1]}` : ' is waiting for your first project'}.{' '}
                {hiring === 'approve' ? 'Recruits wait for your yes.' : 'Recruits up to 6 per chamber go through on their own.'}
              </li>
              <li>
                <Icon name="scroll" /> Press <kbd>P</kbd> anywhere for your scroll: write to {ceo}, approve recruits, and see every project at a glance.
              </li>
              <li>
                <Icon name="compass" /> A short tour starts when you walk in. Press <kbd>H</kbd> any time for help.
              </li>
            </ul>
            <button className="btn btn-big" onClick={finish} disabled={busy}>
              {busy ? 'Opening the gates…' : 'Enter the dungeon'}
            </button>
          </>
        )}

        {step > 0 && step < 4 && (
          <div className="wizard-nav">
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
              ← Back
            </button>
            <span className="spacer" />
            {step === 3 && !project && (
              <button className="linkish" onClick={() => setStep(4)}>
                I'll add one later
              </button>
            )}
            {(step !== 3 || project) && (
              <button className="btn btn-good" onClick={() => void next()} disabled={busy}>
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
