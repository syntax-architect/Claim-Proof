import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '../ui';

export function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const workerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    // Check if waiting worker was already attached
    if (typeof window !== 'undefined' && window.__cpWaitingWorker) {
      workerRef.current = window.__cpWaitingWorker;
      setShow(true);
    }

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ worker?: ServiceWorker }>;
      if (customEvent.detail?.worker) {
        workerRef.current = customEvent.detail.worker;
      }
      setShow(true);
    };

    window.addEventListener('cp-sw-update', handleUpdate);

    // Also check registration directly if serviceWorker is available
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting && navigator.serviceWorker.controller) {
          workerRef.current = reg.waiting;
          setShow(true);
        }
      }).catch(() => {
        /* best-effort */
      });
    }

    return () => {
      window.removeEventListener('cp-sw-update', handleUpdate);
    };
  }, []);

  const handleReload = () => {
    const worker = workerRef.current || (typeof window !== 'undefined' ? window.__cpWaitingWorker : null);
    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2 rounded-xl border border-proof-500/50 bg-ink-900/95 p-4 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-proof-500/20 text-proof-400">
            <RefreshCw className="h-4 w-4 animate-spin text-proof-400" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-slate-100">Update available, reload</p>
            <p className="text-xs text-slate-400">A new version of ClaimProof is ready to install.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-lg text-slate-400 hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proof-500"
          aria-label="Dismiss update banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={handleReload}
          className="min-h-[28px] px-3 text-xs"
        >
          Reload
        </Button>
      </div>
    </div>
  );
}

