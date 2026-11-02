import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/fraunces';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { setupGlobalErrorHandlers } from './lib/errorHandler';
import './styles/globals.css';

setupGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary level="top">
      <App />
    </ErrorBoundary>
  </StrictMode>
);

/* Offline-capable PWA service worker (production builds only). */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const notifyUpdate = (worker: ServiceWorker) => {
          window.__cpWaitingWorker = worker;
          window.dispatchEvent(new CustomEvent('cp-sw-update', { detail: { worker } }));
        };

        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate(installingWorker);
            }
          });
        });
      })
      .catch(() => {
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
