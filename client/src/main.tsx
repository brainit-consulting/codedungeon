import { createRoot } from 'react-dom/client';
import { App } from './App';
import { connect } from './net';
import { startMusic } from './ui/music';
import { useStore } from './store';
import './styles.css';

connect();
startMusic();
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__swarmStore = useStore;
createRoot(document.getElementById('root')!).render(<App />);
