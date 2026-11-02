import { BRAND } from '../config/brand';
import { AlertTriangle, ArrowLeft, FileText, Scale, ShieldAlert, Sparkles } from 'lucide-react';
import { Card, PageHeader, Button, Badge } from '../components/ui';
import type { Route } from '../lib/router';

export default function TermsPage({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('settings')}>
          Back to Settings
        </Button>
        <Badge tone="proof">Updated: November 2026</Badge>
      </div>

      <PageHeader
        icon={FileText}
        kicker="LEGAL & COMPLIANCE"
        title="Terms of Service"
        subtitle={`Workstation software license agreement and conditions of use for ${BRAND.legalName}`}
      />

      {/* Summary Note */}
      <Card className="border-warn-500/30 bg-warn-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn-400 mt-0.5" />
          <div className="text-xs leading-relaxed text-slate-300">
            <strong className="text-white">Notice to Indian E-Commerce Sellers:</strong> Please read
            these Terms of Service carefully before utilizing the {BRAND.legalName}. By accessing or
            running this progressive web application on your workstation, you agree to be bound by
            these terms. Legal sections containing standard statutory language are subject to legal
            validation <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
          </div>
        </div>
      </Card>

      {/* 1. Scope of the Software */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <Sparkles className="h-5 w-5 text-proof-400" />
          1. Scope of the Software &amp; Local Execution
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          {BRAND.legalName} is an offline-first desktop browser productivity tool designed to assist
          Indian marketplace merchants in shipping label vector formatting (
          <strong className="text-white">SmartLabel Studio</strong>), uncut barcode-verified
          packaging and unboxing video recording (
          <strong className="text-white">{BRAND.name} AWB Recorder</strong>), and dispute dossier
          preparation (<strong className="text-white">ClaimRadar</strong>).
        </p>
        <p className="text-xs leading-relaxed text-slate-300">
          All processing, PDF vector cropping, barcode decoding, and video compilation execute
          directly within your browser runtime and local file system. {BRAND.name} does not provide
          remote cloud storage, parcel tracking courier APIs, or automated dispute filing bot
          services.
        </p>
      </Card>

      {/* 2. Marketplace Independence & No Affiliation */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <ShieldAlert className="h-5 w-5 text-warn-400" />
          2. Marketplace Independence &amp; Trademark Disclaimers
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          {BRAND.name} is an independent software application and is{' '}
          <strong className="text-white">
            NOT affiliated with, sponsored by, authorized by, or endorsed by
          </strong>
          :
        </p>
        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-2">
          <li>
            <strong>Meesho</strong> (Fashnear Technologies Private Limited)
          </li>
          <li>
            <strong>Flipkart</strong> (Flipkart Internet Private Limited)
          </li>
          <li>
            <strong>Amazon India</strong> (Amazon Seller Services Private Limited)
          </li>
          <li>
            <strong>Myntra</strong> (Myntra Designs Private Limited)
          </li>
          <li>
            <strong>AJIO</strong> (Reliance Retail Limited)
          </li>
        </ul>
        <p className="text-xs leading-relaxed text-slate-400">
          All registered trademarks, courier names (e.g. Delhivery, Shadowfax, Ekart, Valmo,
          Xpressbees), and platform logos referenced within the application are the exclusive
          property of their respective owners and are used purely for descriptive, interoperability
          purposes.
        </p>
      </Card>

      {/* 3. Marketplace Claims Outcomes & Dispute Disclaimers */}
      <Card className="p-6 space-y-3 border-proof-500/20">
        <div className="flex items-center gap-2 text-base font-bold text-white">
          <Scale className="h-5 w-5 text-proof-400" />
          3. Marketplace Claims Outcomes &amp; Dispute Disclaimers
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          {BRAND.name} provides organizational tools, live timestamp evidence banners (with live IST
          timestamps and decoded AWB numbers), and formatted dispute templates.
        </p>
        <div className="glass-soft p-4 rounded-xl border border-line text-xs text-slate-300 leading-relaxed space-y-2">
          <p>
            <strong className="text-white">NO ASSURANCE OF CLAIM APPROVAL:</strong> Under no
            circumstances does {BRAND.name} promise, warrant, or represent that any marketplace
            platform (including but not limited to Meesho SAFE claims, Flipkart SPF claims, or
            Amazon SAFE-T claims) will approve, accept, or reimburse any dispute or ticket submitted
            by the user <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
          </p>
          <p>
            Dispute rules, allowable filing windows, acceptable evidence formats, and final
            adjudication decisions remain under the sole, discretionary authority of the respective
            e-commerce marketplace policies{' '}
            <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
          </p>
        </div>
      </Card>

      {/* 4. Software License & Workstation Device Binding */}
      <Card className="p-6 space-y-3">
        <div className="text-base font-bold text-white">
          4. Software License Grant &amp; Workstation Use
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          Subject to the terms of your active subscription or Free Tier allocation, {BRAND.name}
          grants you a limited, non-exclusive, non-transferable, revocable license to run the
          software on your designated workstation(s){' '}
          <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>:
        </p>
        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-2">
          <li>
            <strong>Starter Station &amp; ClaimRadar Pro:</strong> Licensed for 1 workstation device
            with soft device binding support.
          </li>
          <li>
            <strong>Warehouse Pack:</strong> Licensed for up to 3 simultaneous workstations in a
            single packing facility.
          </li>
          <li>
            <strong>Prohibited Actions:</strong> You may not decompile, reverse engineer, resell,
            sublicense, modify, or circumvent the cryptographic offline license signature
            verification mechanism{' '}
            <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
          </li>
        </ul>
      </Card>

      {/* 5. User Responsibility for Local Storage & Backups */}
      <Card className="p-6 space-y-3">
        <div className="text-base font-bold text-white">
          5. Local Storage, Hardware Compatibility &amp; Backups
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          Because {BRAND.name} is strictly offline-first, you maintain full custody and sole
          responsibility for maintaining adequate hardware backups of your local disk and Evidence
          Vault folders. {BRAND.name} does not retain copies of your videos, photos, or documents
          and cannot restore files lost due to computer hardware failure, accidental deletion, or
          operating system malfunction.
        </p>
      </Card>

      {/* 6. Disclaimers of Warranties & Limitation of Liability */}
      <Card className="p-6 space-y-3">
        <div className="text-base font-bold text-white">
          6. Disclaimer of Warranties &amp; Limitation of Liability
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-slate-400">
          <p>
            {BRAND.legalName.toUpperCase()} IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT{' '}
            <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
          </p>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE INDIAN LAW, IN NO EVENT SHALL{' '}
            {BRAND.name.toUpperCase()}, ITS FOUNDERS, OR CONTRIBUTORS BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS,
            DATA, OR REVENUE ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SOFTWARE{' '}
            <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
          </p>
        </div>
      </Card>

      {/* 7. Governing Law */}
      <Card className="p-6 space-y-3">
        <div className="text-base font-bold text-white">
          7. Governing Law &amp; Dispute Resolution
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          These Terms shall be governed by and construed in accordance with the laws of the Republic
          of India. Any disputes arising out of or related to these Terms shall be subject to the
          exclusive jurisdiction of the competent courts in India{' '}
          <span className="font-mono text-warn-400">[NEEDS LEGAL REVIEW]</span>.
        </p>
      </Card>
    </div>
  );
}
