import React, { useEffect, useState } from 'react';
import { AlertCircle, History, IndianRupee, Save } from 'lucide-react';
import { db } from '../../db/schema';
import { claimWindowLabel } from '../../lib/claimRules';
import { istDateKey } from '../../lib/dateUtils';
import { paiseToRupees } from '../../lib/money';
import {
  createAuditEntry,
  formatClaimStatus,
  normalizeClaimStatus,
  validateRupeeAmount,
  type CanonicalClaimStatus
} from '../../services/ledgerService';
import type { ClaimAuditEntry, ClaimItem, Marketplace } from '../../types';
import { Button, Field, Modal, Segmented, useToast } from '../ui';

const MARKETPLACE_OPTIONS: Marketplace[] = [
  'Meesho',
  'Flipkart',
  'Amazon',
  'AJIO',
  'Myntra',
  'Snapdeal',
  'GlowRoad',
  'Unknown'
];

interface ClaimEditModalProps {
  open: boolean;
  onClose: () => void;
  claim?: ClaimItem | null;
  onSaved?: (claim: ClaimItem) => void;
}

export function ClaimEditModal({ open, onClose, claim, onSaved }: ClaimEditModalProps) {
  const toast = useToast();
  const isEditing = Boolean(claim && claim.id !== undefined);

  const [awb, setAwb] = useState('');
  const [marketplace, setMarketplace] = useState<Marketplace>('Meesho');
  const [status, setStatus] = useState<CanonicalClaimStatus>('not_filed');
  const [claimedRupees, setClaimedRupees] = useState('');
  const [recoveredRupees, setRecoveredRupees] = useState('');
  const [filedDate, setFiledDate] = useState('');
  const [resolvedDate, setResolvedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setShowAuditTrail(false);
    setEditReason('');

    if (claim) {
      setAwb(claim.awb || '');
      setMarketplace(claim.marketplace || 'Meesho');
      setStatus(normalizeClaimStatus(claim.status));
      setClaimedRupees(
        claim.amountClaimedPaise !== undefined
          ? String(paiseToRupees(claim.amountClaimedPaise))
          : ''
      );
      setRecoveredRupees(
        claim.amountRecoveredPaise !== undefined
          ? String(paiseToRupees(claim.amountRecoveredPaise))
          : ''
      );
      setFiledDate(claim.filedAt ? istDateKey(new Date(claim.filedAt)) : '');
      setResolvedDate(claim.resolvedAt ? istDateKey(new Date(claim.resolvedAt)) : '');
      setNotes(claim.notes || '');
    } else {
      setAwb('');
      setMarketplace('Meesho');
      setStatus('not_filed');
      setClaimedRupees('');
      setRecoveredRupees('');
      setFiledDate('');
      setResolvedDate('');
      setNotes('');
    }
  }, [open, claim]);

  const handleStatusChange = (newStatus: CanonicalClaimStatus) => {
    setStatus(newStatus);
    const today = istDateKey(new Date());

    if (newStatus === 'filed' && !filedDate) {
      setFiledDate(today);
    }

    if (newStatus === 'won') {
      if (!resolvedDate) setResolvedDate(today);
      if (!recoveredRupees || Number(recoveredRupees) === 0) {
        setRecoveredRupees(claimedRupees);
      }
    } else if (newStatus === 'lost') {
      if (!resolvedDate) setResolvedDate(today);
      setRecoveredRupees('0');
    } else if (newStatus === 'partly_won') {
      if (!resolvedDate) setResolvedDate(today);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanAwb = awb.trim().toUpperCase();
    if (!cleanAwb) {
      setErrorMsg('Please enter a valid Air Waybill (AWB) number.');
      return;
    }

    const valClaimed = validateRupeeAmount(claimedRupees, 'Claimed amount');
    if (!valClaimed.valid) {
      setErrorMsg(valClaimed.error || 'Invalid claimed amount.');
      return;
    }

    const valRecovered = validateRupeeAmount(recoveredRupees, 'Recovered amount');
    if (!valRecovered.valid) {
      setErrorMsg(valRecovered.error || 'Invalid recovered amount.');
      return;
    }

    if (status === 'partly_won' && valRecovered.paise > valClaimed.paise) {
      setErrorMsg(
        'For a partly won claim, recovered amount cannot exceed claimed amount. Please check the amounts.'
      );
      return;
    }

    setSaving(true);
    try {
      const filedAtMs = filedDate ? new Date(`${filedDate}T12:00:00+05:30`).getTime() : undefined;
      const resolvedAtMs = resolvedDate
        ? new Date(`${resolvedDate}T12:00:00+05:30`).getTime()
        : undefined;

      const updatedPayload: Partial<ClaimItem> = {
        awb: cleanAwb,
        marketplace,
        status,
        amountClaimedPaise: valClaimed.paise,
        amountRecoveredPaise: valRecovered.paise,
        filedAt: filedAtMs,
        resolvedAt: resolvedAtMs,
        notes: notes.trim()
      };

      let finalClaim: ClaimItem;

      if (isEditing && claim?.id) {
        const auditEntry = createAuditEntry({
          fromClaim: claim,
          toClaim: updatedPayload,
          reason: editReason.trim() || undefined,
          source: 'user_edit'
        });

        const newAuditTrail: ClaimAuditEntry[] = [...(claim.auditTrail || []), auditEntry];

        finalClaim = {
          ...claim,
          ...updatedPayload,
          auditTrail: newAuditTrail
        };

        await db.claims.update(claim.id, {
          ...updatedPayload,
          auditTrail: newAuditTrail
        });

        toast.success(`Claim for ${cleanAwb} updated successfully.`);
      } else {
        const now = Date.now();
        const auditEntry = createAuditEntry({
          toClaim: updatedPayload,
          reason: editReason.trim() || 'Claim manually created',
          source: 'user_edit'
        });

        const newClaimItem: ClaimItem = {
          awb: cleanAwb,
          orderId: cleanAwb,
          marketplace,
          courier: 'Delhivery',
          sku: 'UNKNOWN',
          qty: 1,
          flagReason: 'Damaged',
          notes: notes.trim(),
          returnScanAt: now,
          deadlineAt: now + 72 * 3600 * 1000,
          status,
          disputeText: '',
          amountClaimedPaise: valClaimed.paise,
          amountRecoveredPaise: valRecovered.paise,
          filedAt: filedAtMs,
          resolvedAt: resolvedAtMs,
          auditTrail: [auditEntry]
        };

        const newId = await db.claims.add(newClaimItem);
        finalClaim = { ...newClaimItem, id: newId };
        toast.success(`New claim for ${cleanAwb} logged in ledger.`);
      }

      onSaved?.(finalClaim);
      onClose();
    } catch (err) {
      console.error('[ClaimEditModal] Failed to save claim:', err);
      setErrorMsg('Failed to save claim to local database. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const auditHistory = claim?.auditTrail || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? `Update Claim — ${claim?.awb}` : 'Log New Claim in Ledger'}
      subtitle="Track claim filing status, amounts, and recovered revenue strictly on your device."
      icon={IndianRupee}
      width="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-xs text-danger-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-danger-400 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Air Waybill (AWB)">
            <input
              type="text"
              required
              disabled={isEditing}
              value={awb}
              onChange={(e) => setAwb(e.target.value.toUpperCase())}
              placeholder="e.g. 5894372819"
              aria-label="Air Waybill (AWB)"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2 font-mono text-sm text-white focus:border-proof-400 focus:outline-none disabled:opacity-60"
            />
          </Field>

          <Field label="Marketplace">
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as Marketplace)}
              aria-label="Marketplace"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2 text-sm text-white focus:border-proof-400 focus:outline-none"
            >
              {MARKETPLACE_OPTIONS.map((mp) => (
                <option key={mp} value={mp}>
                  {claimWindowLabel(mp)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Dispute Status">
          <Segmented<CanonicalClaimStatus>
            value={status}
            onChange={handleStatusChange}
            options={[
              { value: 'not_filed', label: 'Not filed' },
              { value: 'filed', label: 'Filed' },
              { value: 'won', label: 'Won' },
              { value: 'partly_won', label: 'Partly won' },
              { value: 'lost', label: 'Lost' }
            ]}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount Claimed (₹)" hint="Enter in Rupees; stored as integer paise">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-500">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={claimedRupees}
                onChange={(e) => setClaimedRupees(e.target.value)}
                placeholder="0"
                aria-label="Amount Claimed in Rupees"
                className="w-full rounded-xl border border-line bg-ink-900 pl-8 pr-3.5 py-2 font-mono text-sm text-white focus:border-proof-400 focus:outline-none"
              />
            </div>
          </Field>

          <Field label="Amount Recovered (₹)" hint="Payout received from marketplace">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-500">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={recoveredRupees}
                onChange={(e) => setRecoveredRupees(e.target.value)}
                placeholder="0"
                aria-label="Amount Recovered in Rupees"
                className="w-full rounded-xl border border-line bg-ink-900 pl-8 pr-3.5 py-2 font-mono text-sm text-white focus:border-proof-400 focus:outline-none"
              />
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Filed Date (IST)">
            <input
              type="date"
              value={filedDate}
              onChange={(e) => setFiledDate(e.target.value)}
              aria-label="Filed Date in IST"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2 text-sm text-white focus:border-proof-400 focus:outline-none"
            />
          </Field>

          <Field label="Resolved Date (IST)">
            <input
              type="date"
              value={resolvedDate}
              onChange={(e) => setResolvedDate(e.target.value)}
              aria-label="Resolved Date in IST"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2 text-sm text-white focus:border-proof-400 focus:outline-none"
            />
          </Field>
        </div>

        <Field label="Notes / Ticket Number" hint="Marketplace dispute ticket ID or seller notes">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Ticket #MEESHO-82910, returned package had rocks inside"
            aria-label="Dispute notes"
            className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2 text-sm text-white focus:border-proof-400 focus:outline-none"
          />
        </Field>

        {isEditing && (
          <Field label="Edit Reason (for audit trail)" hint="Why is this claim being updated?">
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Received partial refund from Meesho support"
              aria-label="Reason for edit"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-1.5 text-xs text-white focus:border-proof-400 focus:outline-none"
            />
          </Field>
        )}

        {isEditing && auditHistory.length > 0 && (
          <div className="pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setShowAuditTrail(!showAuditTrail)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-proof-300 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              <span>
                {showAuditTrail ? 'Hide' : 'View'} Audit Trail ({auditHistory.length}{' '}
                {auditHistory.length === 1 ? 'change' : 'changes'})
              </span>
            </button>

            {showAuditTrail && (
              <div
                className="mt-2.5 max-h-40 overflow-y-auto rounded-xl border border-line bg-ink-950/70 p-3 space-y-2 text-xs text-slate-300 font-mono"
                role="region"
                aria-label="Claim edit audit trail"
              >
                {auditHistory.map((item, idx) => (
                  <div key={idx} className="border-b border-line/40 pb-2 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{item.changedAt}</span>
                      <span className="uppercase text-[10px] text-proof-400 font-bold">
                        {item.source || 'user_edit'}
                      </span>
                    </div>
                    {item.toStatus && item.fromStatus !== item.toStatus && (
                      <div className="text-white mt-0.5">
                        Status: {formatClaimStatus(item.fromStatus)} →{' '}
                        <span className="font-bold text-proof-300">
                          {formatClaimStatus(item.toStatus)}
                        </span>
                      </div>
                    )}
                    {item.toRecoveredPaise !== undefined &&
                      item.toRecoveredPaise !== item.fromRecoveredPaise && (
                        <div className="text-proof-300">
                          Recovered: ₹{paiseToRupees(item.toRecoveredPaise)}
                        </div>
                      )}
                    {item.reason && (
                      <div className="text-slate-400 italic text-[11px] mt-0.5">
                        Note: {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            disabled={saving}
            aria-label="Save Claim"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Claim' : 'Save Claim'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
