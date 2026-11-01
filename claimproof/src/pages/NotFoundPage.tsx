import { useEffect, useState } from 'react';
import { FileQuestion, Home, HelpCircle, ScanBarcode } from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';
import { getRawPath, navigateTo, type Route } from '../lib/router';
import { SUPPORT_CONFIG } from '../config/support';

export interface NotFoundPageProps {
  navigate?: (route: Route) => void;
  path?: string;
}

export default function NotFoundPage({ navigate, path }: NotFoundPageProps) {
  const [displayPath, setDisplayPath] = useState(
    () =>
      path ||
      getRawPath() ||
      (typeof window !== 'undefined' ? window.location.hash || window.location.pathname : '')
  );

  useEffect(() => {
    if (path) {
      setDisplayPath(path);
      return;
    }
    const updatePath = () => {
      setDisplayPath(getRawPath() || window.location.hash || window.location.pathname);
    };
    window.addEventListener('hashchange', updatePath);
    return () => window.removeEventListener('hashchange', updatePath);
  }, [path]);

  const handleGoOverview = () => {
    if (navigate) {
      navigate('overview');
    } else {
      navigateTo('overview');
    }
  };

  const handleOpenLabels = () => {
    if (navigate) {
      navigate('labels');
    } else {
      navigateTo('labels');
    }
  };

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-4 py-12 text-center">
      <Card className="w-full max-w-lg p-8 sm:p-10 shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-warn-500/30 bg-warn-500/10 text-warn-400">
          <FileQuestion className="h-8 w-8" />
        </div>

        <div className="mt-5">
          <Badge tone="warn" className="mb-2">
            404 NOT FOUND
          </Badge>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Page Not Found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            We couldn't find the parcel, proof station, or page you were looking for. The link may
            be outdated, mistyped, or the route does not exist.
          </p>
        </div>

        {displayPath && (
          <div className="mt-5 rounded-lg border border-line bg-ink-850/80 p-2.5 text-left">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Unrecognized path
            </div>
            <div className="mt-1 font-mono text-xs text-slate-300 break-all">{displayPath}</div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="primary" icon={Home} onClick={handleGoOverview}>
            Go to Overview
          </Button>
          <Button variant="secondary" icon={ScanBarcode} onClick={handleOpenLabels}>
            Open SmartLabel Studio
          </Button>
        </div>

        <div className="mt-8 border-t border-line pt-4 text-xs text-slate-500">
          Need assistance with your evidence or labels?{' '}
          <a
            href={SUPPORT_CONFIG.url}
            className="inline-flex items-center gap-1 font-medium text-proof-400 underline underline-offset-4 transition-colors hover:text-proof-300"
          >
            <HelpCircle className="h-3.5 w-3.5 inline" />
            {SUPPORT_CONFIG.label}
          </a>
        </div>
      </Card>
    </div>
  );
}
