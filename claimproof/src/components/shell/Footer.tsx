import { BRAND } from '../../config/brand';
import { HardDrive, HelpCircle, Lock, ShieldCheck } from 'lucide-react';
import { Logo, StatusDot } from '../ui';
import { navigateTo, type Route } from '../../lib/router';

export default function Footer({ navigate }: { navigate?: (r: Route) => void }) {
  const handleNav = (r: Route) => {
    if (navigate) {
      navigate(r);
    } else {
      navigateTo(r);
    }
  };

  return (
    <footer className="mt-auto border-t border-line bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Brand & Guarantee */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="rounded-full border border-proof-500/30 bg-proof-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-proof-300">
                100% Local-First
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Zero-cloud shipping label cropper &amp; barcode-verified packing proof studio for
              Indian e-commerce merchants. Videos and labels stay on your computer.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <StatusDot tone="proof" /> Offline-Ready
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-slate-400" /> Direct Disk Vault
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-slate-400" /> ₹0 Server Cost
              </span>
            </div>
          </div>

          {/* Quick Links & Legal */}
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Studio
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <a
                    href="#/labels"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('labels');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors"
                  >
                    SmartLabel Studio
                  </a>
                </li>
                <li>
                  <a
                    href="#/recorder"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('recorder');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors"
                  >
                    AWB Video Recorder
                  </a>
                </li>
                <li>
                  <a
                    href="#/claims"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('claims');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors"
                  >
                    ClaimRadar
                  </a>
                </li>
                <li>
                  <a
                    href="#/pricing"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('pricing');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors"
                  >
                    Pricing &amp; License
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Legal &amp; Trust
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <a
                    href="#/privacy"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('privacy');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-proof-400" />
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="#/terms"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('terms');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="#/refund"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('refund');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors"
                  >
                    Refund Policy
                  </a>
                </li>
                <li>
                  <a
                    href="#/support"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('support');
                    }}
                    className="inline-flex items-center min-h-[28px] py-1 hover:text-white transition-colors gap-1.5"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-proof-400" />
                    Support &amp; Diagnostics
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-line/60 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-600">
          <div>
            © {new Date().getFullYear()} {BRAND.domain} · All rights reserved. Indian E-Commerce
            Packing Proof Suite.
          </div>
          <div className="text-slate-500">
            Meesho, Flipkart, Amazon, Myntra &amp; AJIO are trademarks of their respective owners.
          </div>
        </div>
      </div>
    </footer>
  );
}
