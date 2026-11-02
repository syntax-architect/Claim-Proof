import {
  ArrowLeft,
  Clock,
  CreditCard,
  HelpCircle,
  Mail,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { BRAND } from '../config/brand';
import { Card, PageHeader, Button, Badge } from '../components/ui';
import type { Route } from '../lib/router';
import { SUPPORT_CONFIG } from '../config/support';

export default function RefundPolicyPage({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('settings')}>
          Back to Settings
        </Button>
        <Badge tone="proof">Updated: November 2026</Badge>
      </div>

      <PageHeader
        icon={RotateCcw}
        kicker="BILLING & SATISFACTION"
        title="Refund & Cancellation Policy"
        subtitle={`Transparent policies for ${BRAND.name} paid plans, renewals, and cancellations`}
      />

      {/* Free Tier Callout */}
      <Card className="border-proof-500/30 bg-proof-500/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-proof-400 mt-0.5" />
          <div className="text-xs leading-relaxed text-slate-300">
            <strong className="text-white">Try Before You Buy with Our Perpetual Free Tier:</strong>{' '}
            {BRAND.name} includes a generous Free Tier (40 label crops/day and 10 AWB
            recordings/day) with no credit card required. We encourage all sellers to test their
            barcode scanner gun, thermal printer, and webcam compatibility thoroughly before
            upgrading to a paid plan.
          </div>
        </div>
      </Card>

      {/* 1. 7-Day Refund Policy */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <Clock className="h-5 w-5 text-proof-400" />
          1. 7-Day Refund Policy
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          If you purchase a Starter Station, ClaimRadar Pro, or Warehouse license and determine that
          the software does not fit your warehouse packing workflow or workstation setup, you are
          entitled to request a{' '}
          <strong className="text-white">full refund within 7 calendar days</strong> from the
          initial date of purchase{' '}
          <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
        </p>
        <p className="text-xs leading-relaxed text-slate-400">
          To qualify for the 7-day refund, simply contact our support team with your payment
          confirmation within 7 days of the transaction timestamp.
        </p>
      </Card>

      {/* 2. Subscription Cancellations & 3-Day Grace Period */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <CreditCard className="h-5 w-5 text-proof-400" />
          2. Subscription Cancellations &amp; 3-Day Grace Period
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          You may cancel an ongoing monthly or annual subscription at any time prior to your next
          renewal billing date <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>
          :
        </p>
        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5 pl-2">
          <li>
            <strong>No Cancellation Penalties:</strong> You can cancel directly from the customer
            billing portal or by emailing our support desk.
          </li>
          <li>
            <strong>Continued Access:</strong> When cancelled, your workstation retains
            uninterrupted Pro feature access until the end of the current billing cycle plus a
            complimentary <strong className="text-white">3-day grace period</strong>.
          </li>
          <li>
            <strong>Automatic Free Tier Reversion:</strong> After the grace period concludes, your
            account reverts to the Free Tier. All your historical video recordings and label indices
            stored on your computer remain completely intact and accessible.
          </li>
        </ul>
      </Card>

      {/* 3. Refund Processing Timeline */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <RotateCcw className="h-5 w-5 text-proof-400" />
          3. Refund Processing Timeline
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          Once your refund request is verified by our team:
        </p>
        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5 pl-2">
          <li>
            The refund is initiated immediately through our authorized payment gateway (Razorpay).
          </li>
          <li>
            Funds are credited back to the original source payment method (UPI account, Debit/Credit
            Card, or Netbanking) typically within{' '}
            <strong className="text-white">5 to 7 business days</strong>, depending on your banking
            provider's processing timeline{' '}
            <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
          </li>
          <li>
            Upon issuance of a refund, the associated cryptographic license key is permanently
            revoked.
          </li>
        </ul>
      </Card>

      {/* 4. Exclusions & Fair Use */}
      <Card className="p-6 space-y-3">
        <div className="text-base font-bold text-white">4. Exclusions &amp; Abuse Prevention</div>
        <p className="text-xs leading-relaxed text-slate-300">
          Refund requests may be declined in circumstances involving{' '}
          <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>:
        </p>
        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-2">
          <li>Requests submitted after the 7-day initial purchase satisfaction window.</li>
          <li>Repetitive purchase-and-refund cycles by the same customer or business entity.</li>
          <li>Unauthorized license key redistribution or resale attempts.</li>
        </ul>
      </Card>

      {/* 5. How to Initiate a Refund */}
      <Card className="p-6 space-y-4 border-proof-500/20">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <HelpCircle className="h-5 w-5 text-proof-400" />
          5. How to Request a Refund
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          To initiate a refund, please send an email to our support team with the following details:
        </p>
        <div className="glass-soft p-4 rounded-xl border border-line text-xs font-mono text-slate-300 space-y-1">
          <div>To: {SUPPORT_CONFIG.email}</div>
          <div>Subject: Refund Request - {BRAND.name} License</div>
          <div className="text-slate-400">---</div>
          <div>1. Razorpay Payment ID (e.g. pay_xxx or sub_xxx)</div>
          <div>2. Email address used during checkout</div>
          <div>3. Brief reason for refund (optional, helps us improve the software)</div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={Mail}
            onClick={() => {
              window.location.href = `mailto:${SUPPORT_CONFIG.email}?subject=${encodeURIComponent(`Refund Request - ${BRAND.name} License`)}`;
            }}
          >
            Email Support for Refund
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('support')}>
            Open Support &amp; Help
          </Button>
        </div>
      </Card>
    </div>
  );
}
