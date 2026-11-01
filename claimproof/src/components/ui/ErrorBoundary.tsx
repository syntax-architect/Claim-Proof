import React, { Component, type ReactNode } from 'react';
import { CheckCircle2, Copy, RotateCcw, ShieldCheck } from 'lucide-react';
import { triggerEmergencySave } from '../../services/recorderCrashGuard';
import { reportError } from '../../services/telemetry';
import { Button, notifyToast } from './index';

export interface ErrorBoundaryProps {
  children: ReactNode;
  level?: 'top' | 'page';
  resetKey?: unknown;
  onCatch?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: ReactNode | ((props: { error: Error | null; reset: () => void }) => ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 1. Immediately safeguard any active recording session
    void triggerEmergencySave(error);

    // 2. Report error with scrubbing (if opted in)
    void reportError(error, { componentStack: errorInfo.componentStack });

    this.setState({ errorInfo });
    this.props.onCatch?.(error, errorInfo);

    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.handleReset();
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    });
  };

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleCopyDetails = async (): Promise<void> => {
    const error = this.state.error;
    const errorInfo = this.state.errorInfo;
    const details = [
      '=== ClaimProof Error Report ===',
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}`,
      `Boundary Level: ${this.props.level || 'page'}`,
      `Message: ${error?.message || 'Unknown error'}`,
      '',
      '=== Stack Trace ===',
      error?.stack || 'No stack trace available',
      '',
      '=== Component Stack ===',
      errorInfo?.componentStack || 'No component stack available',
      '',
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`
    ].join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = details;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);

      notifyToast({
        tone: 'info',
        title: 'Error details copied',
        message: 'Diagnostics copied to clipboard for support.'
      });
    } catch (e) {
      console.error('Failed to copy error details:', e);
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (typeof this.props.fallback === 'function') {
      return this.props.fallback({ error: this.state.error, reset: this.handleReset });
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const level = this.props.level || 'page';
    const isTop = level === 'top';

    return (
      <div
        data-testid={`${level}-error-boundary`}
        className={
          isTop
            ? 'flex min-h-screen w-full items-center justify-center bg-ink-950 p-4 text-white'
            : 'flex w-full items-center justify-center py-10 px-4'
        }
      >
        <div className="glass border-line-bright w-full max-w-lg space-y-5 rounded-2xl p-6 text-center shadow-2xl sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-proof-500/30 bg-proof-500/10 text-proof-400 shadow-inner">
            <ShieldCheck className="h-7 w-7 text-proof-400" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Something went wrong
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              ClaimProof encountered an unexpected issue while{' '}
              {isTop ? 'running the application' : 'loading this section'}.
            </p>
          </div>

          {/* Data preservation confirmation banner */}
          <div className="flex items-center justify-center gap-2.5 rounded-xl border border-proof-500/35 bg-proof-500/10 p-3.5 text-sm font-medium text-proof-300">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-proof-400" />
            <span>Your videos and labels are safe on your computer.</span>
          </div>

          {/* Plain language note — strictly NO stack trace in user-visible UI */}
          {this.state.error?.message && (
            <div className="rounded-lg border border-line bg-ink-900/60 p-3 text-left text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Notice: </span>
              <span>{this.state.error.message}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button variant="primary" onClick={this.handleReload} data-testid="reload-page-button">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reload page
            </Button>

            <Button
              variant="outline"
              onClick={() => void this.handleCopyDetails()}
              data-testid="copy-error-details-button"
            >
              <Copy className="mr-1.5 h-4 w-4" />
              {this.state.copied ? 'Copied error details' : 'Copy error details'}
            </Button>

            {!isTop && (
              <Button variant="ghost" onClick={this.handleReset} data-testid="try-again-button">
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
