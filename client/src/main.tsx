import { createRoot } from 'react-dom/client';
import { App } from './App';
import { connect } from './net';
import { startMusic } from './ui/music';
import { useStore } from './store';
import { preloadSignIcons } from './world/signIcons';
import './styles.css';

connect();
startMusic();
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__swarmStore = useStore;
// the signs' icons first (a few milliseconds), so no sign paints before they can be drawn
void preloadSignIcons().then(() => createRoot(document.getElementById('root')!).render(<App />));
