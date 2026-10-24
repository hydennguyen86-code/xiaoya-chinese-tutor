import { createRoot } from 'react-dom/client';
import App from './App';
import { initServerStore } from './lib/serverStore';
import './styles.css';

// Load saved learner data from the server's data folder before the app reads it.
void initServerStore().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
