import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageSquare,
  Printer,
  ScanBarcode,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { Card, PageHeader, Button, Badge, useToast } from '../components/ui';
import type { Route } from '../lib/router';
import { SUPPORT_CONFIG } from '../config/support';
import { getFormattedDiagnosticString } from '../lib/diagnostics';

export default function SupportPage({ navigate }: { navigate: (r: Route) => void }) {
  const toast = useToast();
  const [diagnosticText, setDiagnosticText] = useState<string>('Generating diagnostic report...');
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    void getFormattedDiagnosticString().then(setDiagnosticText);
  }, []);

  async function handleCopyDiagnostics() {
    setCopying(true);
    try {
      const text = await getFormattedDiagnosticString();
      setDiagnosticText(text);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      toast.success(
        'Diagnostic info copied',
        'Workstation technical specs copied to clipboard. Zero personal data included.'
      );
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.warn(
        'Unable to auto-copy',
        'Please select and copy the technical report from the box below.'
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate('settings')}
        >
          Back to Settings
        </Button>
        <Badge tone="proof">Support Desk: Active</Badge>
      </div>

      <PageHeader
        icon={LifeBuoy}
        kicker="HELP & DIAGNOSTICS"
        title="Support & Diagnostics"
        subtitle="Fast seller support via WhatsApp, email, and zero-PII workstation diagnostics"
      />

      {/* Support Channels Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* WhatsApp Channel */}
        <Card className="p-6 space-y-4 border-proof-500/30 bg-gradient-to-br from-proof-950/20 to-ink-950">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-proof-500/40 bg-proof-500/20 text-proof-300">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-bold text-white">WhatsApp Support</div>
                <div className="text-xs text-slate-400">Direct message for urgent workstation help</div>
              </div>
            </div>
            <Badge tone="proof">Fastest</Badge>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Connect directly with our technical team on WhatsApp. Share questions about USB scanner setup, webcam mounting, or thermal printer vector scaling.
          </p>

          <div className="space-y-1 text-xs text-slate-400 font-mono">
            <div>Number: <span className="text-white">{SUPPORT_CONFIG.whatsappNumber}</span> <span className="text-[10px] text-warn-400 font-sans">[needs verification]</span></div>
            <div>Hours: <span className="text-slate-300">{SUPPORT_CONFIG.hours}</span> <span className="text-[10px] text-warn-400 font-sans">[needs verification]</span></div>
            <div>Response: <span className="text-slate-300">{SUPPORT_CONFIG.responseTime}</span> <span className="text-[10px] text-warn-400 font-sans">[needs verification]</span></div>
          </div>

          <a
            href={SUPPORT_CONFIG.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full"
          >
            <Button
              variant="primary"
              size="md"
              icon={MessageSquare}
              iconRight={ExternalLink}
              className="w-full"
            >
              Chat on WhatsApp
            </Button>
          </a>
        </Card>

        {/* Email Channel */}
        <Card className="p-6 space-y-4 border-line bg-gradient-to-br from-ink-900 to-ink-950">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-800 text-slate-300">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-bold text-white">Email Helpdesk</div>
                <div className="text-xs text-slate-400">Invoices, enterprise licenses &amp; general inquiries</div>
              </div>
            </div>
            <Badge tone="neutral">Standard</Badge>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            For invoicing, GST billing queries, custom warehouse deployments, license key transfers, or refund requests, reach out via our official support inbox.
          </p>

          <div className="space-y-1 text-xs text-slate-400 font-mono">
            <div>Email: <span className="text-white">{SUPPORT_CONFIG.email}</span></div>
            <div>Subject: <span className="text-slate-300">ClaimProof Support Request</span></div>
            <div>Response: <span className="text-slate-300">Within 1 business day</span></div>
          </div>

          <a
            href={SUPPORT_CONFIG.url}
            className="inline-flex w-full"
          >
            <Button
              variant="secondary"
              size="md"
              icon={Mail}
              className="w-full"
            >
              Send Support Email
            </Button>
          </a>
        </Card>
      </div>

      {/* Zero-PII Workstation Diagnostics Section */}
      <Card className="p-6 space-y-4 border-proof-500/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-proof-500/25 bg-proof-500/12 text-proof-300">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-white">Workstation Diagnostic Info</div>
              <div className="text-xs text-slate-400">Zero personal data · Technical hardware &amp; browser capabilities only</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="proof">0% PII Guaranteed</Badge>
            <Button
              variant="primary"
              size="sm"
              icon={copied ? Check : Copy}
              loading={copying}
              onClick={() => void handleCopyDiagnostics()}
            >
              {copied ? 'Copied to Clipboard!' : 'Copy diagnostic info'}
            </Button>
          </div>
        </div>

        <div className="glass-soft p-4 rounded-xl border border-line text-xs text-slate-300 leading-relaxed space-y-1">
          <div className="flex items-center gap-2 text-proof-300 font-semibold">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Privacy Protection Guarantee
          </div>
          <p>
            When seeking assistance with a webcam, scanner, or printer issue, pasting this technical summary helps our team resolve your issue quickly.
            This report strictly contains <strong className="text-white">hardware capabilities, screen dimensions, browser APIs, and storage quotas</strong>.
            It <strong className="text-white">NEVER contains customer names, shipping labels, order IDs, video filenames, or phone numbers</strong>.
          </p>
        </div>

        {/* Read-only Diagnostic Preview */}
        <div className="relative">
          <pre
            aria-label="Workstation Technical Diagnostics"
            className="max-h-60 overflow-y-auto rounded-xl border border-line bg-ink-950 p-4 font-mono text-[11px] leading-relaxed text-slate-300 focus:outline-none focus:ring-1 focus:ring-proof-500"
          >
            {diagnosticText}
          </pre>
        </div>
      </Card>

      {/* Troubleshooting FAQ */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <HelpCircle className="h-5 w-5 text-proof-400" />
          Common Workstation Troubleshooting
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs leading-relaxed">
          <div className="glass-soft rounded-xl p-4 border border-line space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Camera className="h-4 w-4 text-proof-400" />
              Webcam Not Detected / Black Screen
            </div>
            <p className="text-slate-300">
              Ensure camera permissions are allowed in Chrome: open <span className="font-mono text-slate-400">chrome://settings/content/camera</span> and select "Allow". Verify no other application (e.g. Zoom, OBS, or another browser tab) is locking the webcam.
            </p>
          </div>

          <div className="glass-soft rounded-xl p-4 border border-line space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ScanBarcode className="h-4 w-4 text-proof-400" />
              Barcode Scanner Gun Not Triggering Recording
            </div>
            <p className="text-slate-300">
              ClaimProof detects physical USB/Bluetooth guns via keyboard burst listeners. Ensure your scanner gun is configured in "Keyboard HID Mode" with a trailing <span className="font-mono text-slate-400">Enter / Carriage Return [CR]</span> suffix enabled in its manual barcode programming guide.
            </p>
          </div>

          <div className="glass-soft rounded-xl p-4 border border-line space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Printer className="h-4 w-4 text-proof-400" />
              Thermal Label Printer Margins &amp; Scaling
            </div>
            <p className="text-slate-300">
              When printing cropped 4×6 inch (100×150 mm) labels, set your browser print dialog paper size to <strong className="text-white">4×6 in</strong>, scale to <strong className="text-white">Actual size / 100%</strong>, and margins to <strong className="text-white">None</strong> to prevent thermal cutoffs.
            </p>
          </div>

          <div className="glass-soft rounded-xl p-4 border border-line space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-proof-400" />
              Browser "Save Changes to Folder" Prompt
            </div>
            <p className="text-slate-300">
              Chromium browsers periodically prompt "Save changes to ClaimProof_Vault?" for security. Click <strong className="text-white">Allow</strong> so video clips and JPEG photo collages can continue writing straight to your computer hard drive without interruptions.
            </p>
          </div>
        </div>
      </Card>

      {/* Support SLA Disclaimers */}
      <Card className="p-5 text-xs text-slate-400 space-y-1">
        <div className="font-semibold text-slate-300">Support Terms &amp; Scope of Service</div>
        <p>
          Support covers ClaimProof software installation, PWA updates, barcode scanning configuration, and label cropping settings.
          ClaimProof support does not represent marketplace customer care and cannot directly modify or resolve seller panel disputes on Meesho, Flipkart, Amazon, Myntra, or AJIO <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
        </p>
      </Card>
    </div>
  );
}
