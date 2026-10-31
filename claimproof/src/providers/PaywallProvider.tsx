/* Global paywall orchestrator. Any module can raise the UPI checkout modal. */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { PlanId } from '../types';

export type PaywallScope = 'labels' | 'recordings' | 'claimRadar' | 'collage' | 'general';

export interface PaywallRequest {
  plan?: PlanId;
  reason?: string;
  scope?: PaywallScope;
}

interface PaywallContextValue {
  open: boolean;
  request: PaywallRequest | null;
  openPaywall: (req?: PaywallRequest) => void;
  closePaywall: () => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<PaywallRequest | null>(null);

  const openPaywall = useCallback((req: PaywallRequest = {}) => {
    setRequest(req);
    setOpen(true);
  }, []);

  const closePaywall = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, request, openPaywall, closePaywall }),
    [open, request, openPaywall, closePaywall]
  );

  return <PaywallContext.Provider value={value}>{children}</PaywallContext.Provider>;
}

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error('usePaywall must be used within <PaywallProvider>');
  return ctx;
}
