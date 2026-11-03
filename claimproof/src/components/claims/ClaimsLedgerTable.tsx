import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  Edit3,
  FileSpreadsheet,
  History,
  Plus,
  Search,
  Trash2,
  Upload
} from 'lucide-react';
import { db } from '../../db/schema';
import { claimWindowLabel } from '../../lib/claimRules';
import { formatISTShort, istDateKey } from '../../lib/dateUtils';
import { formatPaise } from '../../lib/money';
import { cn } from '../../lib/utils';
import {
  claimStatusBadgeTone,
  exportClaimsToCSV,
  formatClaimStatus,
  normalizeClaimStatus,
  parseClaimsFromCSV,
  type CanonicalClaimStatus
} from '../../services/ledgerService';
import type { ClaimItem } from '../../types';
import { Badge, Button, Card, EmptyState, Modal, useToast } from '../ui';
import { ClaimEditModal } from './ClaimEditModal';

interface ClaimsLedgerTableProps {
  claims: ClaimItem[];
  onRefresh?: () => void;
  className?: string;
}

export function ClaimsLedgerTable({ claims, onRefresh, className }: ClaimsLedgerTableProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CanonicalClaimStatus>('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');

  const [editClaim, setEditClaim] = useState<ClaimItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [auditViewClaim, setAuditViewClaim] = useState<ClaimItem | null>(null);

  // Filter claims
  const filteredClaims = claims.filter((claim) => {
    const norm = normalizeClaimStatus(claim.status);
    if (statusFilter !== 'all' && norm !== statusFilter) return false;
    if (marketplaceFilter !== 'all' && claim.marketplace !== marketplaceFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchAwb = claim.awb.toLowerCase().includes(q);
      const matchOrder = claim.orderId?.toLowerCase().includes(q);
      const matchSku = claim.sku?.toLowerCase().includes(q);
      const matchNotes = claim.notes?.toLowerCase().includes(q);
      if (!matchAwb && !matchOrder && !matchSku && !matchNotes) return false;
    }

    return true;
  });

  const handleExportCSV = () => {
    if (claims.length === 0) {
      toast.warn('No claims to export.');
      return;
    }

    try {
      const csvContent = exportClaimsToCSV(filteredClaims.length > 0 ? filteredClaims : claims);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `saboot-claims-ledger-${istDateKey(new Date())}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${filteredClaims.length > 0 ? filteredClaims.length : claims.length} claims to CSV.`
      );
    } catch (err) {
      console.error('[ClaimsLedgerTable] CSV Export failed:', err);
      toast.error('Failed to export CSV. Please try again.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const { claims: parsedClaims, errors } = parseClaimsFromCSV(text);

      if (errors.length > 0) {
        toast.error(`CSV Import issue: ${errors[0]}`);
      }

      if (parsedClaims.length === 0) {
        if (errors.length === 0) {
          toast.warn('No valid claim rows found in CSV file.');
        }
        return;
      }

      let importedCount = 0;
      let updatedCount = 0;

      for (const item of parsedClaims) {
        if (!item.awb) continue;
        const existing = await db.claims.where('awb').equals(item.awb).first();

        if (existing && existing.id !== undefined) {
          const mergedAudit = [...(existing.auditTrail || []), ...(item.auditTrail || [])];
          await db.claims.update(existing.id, {
            ...item,
            auditTrail: mergedAudit
          });
          updatedCount++;
        } else {
          await db.claims.add({
            awb: item.awb,
            orderId: item.orderId || item.awb,
            marketplace: item.marketplace || 'Meesho',
            courier: item.courier || 'Delhivery',
            sku: item.sku || 'UNKNOWN',
            qty: item.qty ?? 1,
            flagReason: item.flagReason || 'Damaged',
            notes: item.notes || '',
            returnScanAt: Date.now(),
            deadlineAt: Date.now() + 72 * 3600 * 1000,
            status: item.status || 'not_filed',
            disputeText: '',
            amountClaimedPaise: item.amountClaimedPaise || 0,
            amountRecoveredPaise: item.amountRecoveredPaise || 0,
            auditTrail: item.auditTrail || []
          });
          importedCount++;
        }
      }

      toast.success(
        `CSV Import complete: ${importedCount} claims added, ${updatedCount} existing claims updated.`
      );
      onRefresh?.();
    } catch (err) {
      console.error('[ClaimsLedgerTable] CSV Import failed:', err);
      toast.error('Failed to parse CSV file. Ensure valid columns and format.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteClaim = async (claimItem: ClaimItem) => {
    if (!claimItem.id) return;
    if (window.confirm(`Delete claim for ${claimItem.awb} from ledger?`)) {
      try {
        await db.claims.delete(claimItem.id);
        toast.success(`Claim for ${claimItem.awb} deleted.`);
        onRefresh?.();
      } catch (err) {
        console.error('[ClaimsLedgerTable] Delete failed:', err);
        toast.error('Could not delete claim. Please try again.');
      }
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search AWB, SKU, Order..."
              aria-label="Search claims ledger"
              className="w-full rounded-xl border border-line bg-ink-900/90 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-proof-400 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | CanonicalClaimStatus)}
            aria-label="Filter by dispute status"
            className="rounded-xl border border-line bg-ink-900/90 px-3 py-1.5 text-xs text-slate-300 focus:border-proof-400 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="not_filed">Not filed</option>
            <option value="filed">Filed</option>
            <option value="won">Won</option>
            <option value="partly_won">Partly won</option>
            <option value="lost">Lost</option>
          </select>

          {/* Marketplace Filter */}
          <select
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
            aria-label="Filter by marketplace"
            className="rounded-xl border border-line bg-ink-900/90 px-3 py-1.5 text-xs text-slate-300 focus:border-proof-400 focus:outline-none"
          >
            <option value="all">All Marketplaces</option>
            <option value="Meesho">Meesho</option>
            <option value="Flipkart">Flipkart</option>
            <option value="Amazon">Amazon</option>
            <option value="AJIO">AJIO</option>
            <option value="Myntra">Myntra</option>
            <option value="Snapdeal">Snapdeal</option>
            <option value="GlowRoad">GlowRoad</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Upload CSV File"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import CSV"
          >
            Import CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={handleExportCSV}
            aria-label="Export CSV"
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              setEditClaim(null);
              setIsEditOpen(true);
            }}
            aria-label="Log new claim"
          >
            Log Claim
          </Button>
        </div>
      </div>

      {/* Table Card */}
      {claims.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={FileSpreadsheet}
            title="No claims in ledger yet"
            description="Track return disputes, filed claims, and revenue recoveries across Meesho, Flipkart, and Amazon — stored locally on your computer."
            primaryAction={{
              label: 'Log your first claim',
              onClick: () => {
                setEditClaim(null);
                setIsEditOpen(true);
              },
              icon: Plus
            }}
            secondaryLink={{
              label: 'Import from CSV',
              onClick: () => fileInputRef.current?.click(),
              icon: Upload
            }}
          />
        </Card>
      ) : filteredClaims.length === 0 ? (
        <Card className="p-8 text-center text-xs text-slate-400">
          <AlertCircle className="mx-auto h-6 w-6 text-slate-500 mb-2" />
          <div>No claims match the selected filters or search term.</div>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setMarketplaceFilter('all');
            }}
            className="mt-2 text-proof-300 font-semibold hover:underline"
          >
            Reset all filters
          </button>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-line">
          <div
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-proof-500"
            role="region"
            tabIndex={0}
            aria-label="Claims Ledger Table"
          >
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-ink-950/60 uppercase tracking-wider text-[10px] font-semibold text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    AWB
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Marketplace
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Amount Claimed
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Amount Recovered
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Filed Date (IST)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Resolved Date (IST)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Notes
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {filteredClaims.map((claim) => {
                  const norm = normalizeClaimStatus(claim.status);
                  const tone = claimStatusBadgeTone(norm);

                  return (
                    <tr
                      key={claim.id || claim.awb}
                      className="hover:bg-ink-800/40 transition-colors"
                    >
                      {/* AWB */}
                      <td className="px-4 py-3 font-mono font-bold text-white">{claim.awb}</td>

                      {/* Marketplace */}
                      <td className="px-4 py-3">
                        <Badge tone="info">{claimWindowLabel(claim.marketplace)}</Badge>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge tone={tone}>{formatClaimStatus(norm)}</Badge>
                      </td>

                      {/* Amount Claimed */}
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200 mono-tabular">
                        {formatPaise(claim.amountClaimedPaise)}
                      </td>

                      {/* Amount Recovered */}
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono font-bold mono-tabular',
                          (claim.amountRecoveredPaise || 0) > 0
                            ? 'text-proof-300'
                            : 'text-slate-500'
                        )}
                      >
                        {formatPaise(claim.amountRecoveredPaise)}
                      </td>

                      {/* Filed Date */}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {claim.filedAt ? formatISTShort(claim.filedAt) : '—'}
                      </td>

                      {/* Resolved Date */}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {claim.resolvedAt ? formatISTShort(claim.resolvedAt) : '—'}
                      </td>

                      {/* Notes */}
                      <td
                        className="px-4 py-3 max-w-[200px] truncate text-slate-400"
                        title={claim.notes}
                      >
                        {claim.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditClaim(claim);
                              setIsEditOpen(true);
                            }}
                            title="Edit claim details"
                            aria-label={`Edit claim ${claim.awb}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-700 hover:text-white transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {claim.auditTrail && claim.auditTrail.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setAuditViewClaim(claim)}
                              title="View edit audit trail"
                              aria-label={`View audit trail for ${claim.awb}`}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-700 hover:text-proof-300 transition-colors"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteClaim(claim)}
                            title="Delete claim from ledger"
                            aria-label={`Delete claim ${claim.awb}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-500/20 hover:text-danger-300 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <ClaimEditModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditClaim(null);
        }}
        claim={editClaim}
        onSaved={() => onRefresh?.()}
      />

      {/* Dedicated Audit Trail View Modal */}
      {auditViewClaim && (
        <Modal
          open={Boolean(auditViewClaim)}
          onClose={() => setAuditViewClaim(null)}
          title={`Audit Trail — ${auditViewClaim.awb}`}
          subtitle="Complete chronological history of edits to status, amounts, and notes."
          icon={History}
          width="md"
        >
          <div className="space-y-3 max-h-80 overflow-y-auto font-mono text-xs text-slate-300">
            {auditViewClaim.auditTrail?.map((entry, idx) => (
              <div key={idx} className="rounded-xl border border-line bg-ink-950/70 p-3 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{entry.changedAt}</span>
                  <span className="uppercase text-[10px] font-bold text-proof-400">
                    {entry.source || 'user_edit'}
                  </span>
                </div>
                {entry.toStatus && entry.fromStatus !== entry.toStatus && (
                  <div className="text-white">
                    Status: {formatClaimStatus(entry.fromStatus)} →{' '}
                    <span className="font-bold text-proof-300">
                      {formatClaimStatus(entry.toStatus)}
                    </span>
                  </div>
                )}
                {entry.toClaimedPaise !== undefined &&
                  entry.toClaimedPaise !== entry.fromClaimedPaise && (
                    <div>Claimed: {formatPaise(entry.toClaimedPaise)}</div>
                  )}
                {entry.toRecoveredPaise !== undefined &&
                  entry.toRecoveredPaise !== entry.fromRecoveredPaise && (
                    <div className="text-proof-300">
                      Recovered: {formatPaise(entry.toRecoveredPaise)}
                    </div>
                  )}
                {entry.reason && (
                  <div className="text-slate-400 italic text-[11px]">Note: {entry.reason}</div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => setAuditViewClaim(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
