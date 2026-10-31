import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/* Offline-capable PWA service worker (production builds only). */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline start is best-effort */
    });
  });
}

/* PWA install prompt capture — surfaced in the command palette & top bar. */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  const promptEvent = e as Event & { prompt: () => Promise<void> };
  window.__cpInstallAvailable = true;
  window.__cpInstall = () => {
    void promptEvent.prompt();
    window.__cpInstallAvailable = false;
  };
  window.dispatchEvent(new Event('cp-install-available'));
});
