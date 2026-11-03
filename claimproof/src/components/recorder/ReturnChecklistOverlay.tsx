import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  HelpCircle,
  Info,
  Link as LinkIcon,
  Package,
  ShieldAlert
} from 'lucide-react';
import { Badge, Button, Card, Kbd } from '../ui';
import {
  RETURN_CONDITIONS,
  getChecklistProfile,
  type EvidenceChecklistStep,
  type ReturnCondition
} from '../../config/evidenceChecklists';
import type { Marketplace, RecordingMeta } from '../../types';
import { cn } from '../../lib/utils';

export interface StepTickState {
  completed: boolean;
  completedAtOffsetSec?: number;
}

export interface ReturnChecklistOverlayProps {
  marketplace?: Marketplace;
  elapsedSec?: number;
  isRecording: boolean;
  linkedDispatch?: RecordingMeta | null;
  selectedCondition: ReturnCondition | null;
  onSelectCondition: (condition: ReturnCondition) => void;
  stepTicks: Record<string, StepTickState>;
  onToggleStep: (stepId: string) => void;
  showConditionRequiredWarning?: boolean;
}

export function ReturnChecklistOverlay({
  marketplace,
  elapsedSec: _elapsedSec,
  isRecording,
  linkedDispatch,
  selectedCondition,
  onSelectCondition,
  stepTicks,
  onToggleStep,
  showConditionRequiredWarning = false
}: ReturnChecklistOverlayProps) {
  const profile = getChecklistProfile(marketplace);
  const [showInfo, setShowInfo] = useState(false);

  // Global keyboard shortcuts for ticking steps (1-6 or sequential advance)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // 1-6 keys direct toggle
      const stepIndex = Number.parseInt(e.key, 10);
      if (!Number.isNaN(stepIndex) && stepIndex >= 1 && stepIndex <= profile.steps.length) {
        const step = profile.steps[stepIndex - 1];
        if (step) {
          e.preventDefault();
          onToggleStep(step.id);
          return;
        }
      }

      // 't' or 'T' key to advance next incomplete step
      if (e.key.toLowerCase() === 't') {
        const nextUnticked = profile.steps.find((s) => !stepTicks[s.id]?.completed);
        if (nextUnticked) {
          e.preventDefault();
          onToggleStep(nextUnticked.id);
        }
      }
    },
    [isRecording, onToggleStep, profile.steps, stepTicks]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const completedCount = profile.steps.filter((s) => stepTicks[s.id]?.completed).length;
  const allStepsComplete = completedCount === profile.steps.length;

  return (
    <Card className="border-proof-500/30 bg-ink-900/95 p-4 shadow-xl">
      {/* ── Header with Marketplace Profile & Linked Video Status ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-proof-300" />
          <span className="font-display text-sm font-bold text-white">{profile.displayName}</span>
          <Badge tone="warn" className="text-[10px]">
            {profile.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {allStepsComplete && (
            <Badge tone="proof" className="text-[10px]">
              ALL STEPS VERIFIED
            </Badge>
          )}
          {linkedDispatch ? (
            <Badge tone="proof" className="text-[10px]">
              <LinkIcon className="h-3 w-3" />
              Linked to Dispatch #{linkedDispatch.id} ({linkedDispatch.sku || 'SKU matched'})
            </Badge>
          ) : (
            <Badge tone="neutral" className="text-[10px]">
              Standalone Return (No dispatch video on file)
            </Badge>
          )}

          <Button
            variant="ghost"
            size="xs"
            icon={HelpCircle}
            onClick={() => setShowInfo((s) => !s)}
            aria-label="Toggle marketplace guidelines info"
            title="Marketplace unboxing requirements"
          />
        </div>
      </div>

      {/* ── Marketplace Guidelines Detail (collapsible) ── */}
      {showInfo && (
        <div className="mt-3 rounded-lg border border-line bg-ink-950/80 p-3 text-xs text-slate-300">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info-300" />
            <div>
              <strong className="text-white">Marketplace Rule: </strong>
              {profile.notes}
            </div>
          </div>
        </div>
      )}

      {/* ── Continuous Recording Safeguard Warning ── */}
      <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-info-500/25 bg-info-500/10 p-2.5 text-xs text-info-300">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-info-400" />
        <div>
          <span className="font-semibold text-white">Continuous Video Rule:</span> Pausing is
          disabled. Marketplaces commonly reject paused, cut, or stitched videos as manipulated
          evidence. Record the entire unboxing in one single take.
        </div>
      </div>

      {/* ── Step-by-Step Checklist ── */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>
            Unboxing Protocol ({completedCount}/{profile.steps.length} steps)
          </span>
          <span className="font-mono text-[11px] text-proof-300">
            Press <Kbd>1</Kbd>–<Kbd>{profile.steps.length}</Kbd> or <Kbd>T</Kbd> to tick
          </span>
        </div>

        <div className="mt-2 space-y-2">
          {profile.steps.map((step: EvidenceChecklistStep) => {
            const isDone = stepTicks[step.id]?.completed ?? false;
            const offset = stepTicks[step.id]?.completedAtOffsetSec;

            return (
              <button
                type="button"
                key={step.id}
                onClick={() => onToggleStep(step.id)}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-all',
                  isDone
                    ? 'border-proof-500/40 bg-proof-500/10'
                    : 'border-line bg-ink-950/60 hover:border-line-bright'
                )}
                aria-pressed={isDone}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-proof-300" />
                  ) : (
                    <Circle className="h-4.5 w-4.5 text-slate-500 group-hover:text-slate-300" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-bold',
                        isDone ? 'text-proof-300 line-through opacity-85' : 'text-white'
                      )}
                    >
                      {step.order}. {step.title}
                    </span>
                    <Kbd className="text-[9px]">{step.hotkey}</Kbd>
                    {isDone && offset !== undefined && (
                      <span className="font-mono text-[10px] text-proof-400">T+{offset}s</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">{step.instruction}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mandatory Condition Tagging ── */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Mandatory Condition Outcome *
          </div>
          {selectedCondition && (
            <span className="font-mono text-[11px] text-proof-300">Condition selected</span>
          )}
        </div>

        {showConditionRequiredWarning && !selectedCondition && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-danger-500/40 bg-danger-500/10 p-2 text-xs text-danger-300 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Select one package condition tag below before saving.</span>
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {RETURN_CONDITIONS.map((cond) => {
            const isSelected = selectedCondition === cond.value;

            return (
              <button
                type="button"
                key={cond.value}
                onClick={() => onSelectCondition(cond.value)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all',
                  isSelected
                    ? cond.tone === 'success'
                      ? 'border-success-500 bg-success-500/20 text-success-300 ring-1 ring-success-500'
                      : cond.tone === 'danger'
                        ? 'border-danger-500 bg-danger-500/20 text-danger-300 ring-1 ring-danger-500'
                        : 'border-warn-500 bg-warn-500/20 text-warn-300 ring-1 ring-warn-500'
                    : 'border-line bg-ink-950/70 text-slate-400 hover:border-line-bright hover:text-white'
                )}
                aria-pressed={isSelected}
              >
                <span className="text-xs font-bold leading-tight">{cond.label}</span>
                <span className="mt-1 text-[9px] line-clamp-2 leading-tight opacity-75">
                  {cond.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
