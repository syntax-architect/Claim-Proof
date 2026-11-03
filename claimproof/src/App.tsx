import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { ToastProvider } from './components/ui';
import { I18nProvider } from './lib/i18n';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { getOnboardingState } from './services/onboardingService';
import Sidebar, { MobileNav } from './components/shell/Sidebar';
import TopBar from './components/shell/TopBar';
import { CommandPalette } from './components/shell/CommandPalette';
import { GlobalEvidenceSearchModal } from './components/search/GlobalEvidenceSearchModal';
import { startHidListener } from './lib/hidScanner';
import OverviewPage from './pages/OverviewPage';
import SmartLabelWorkbench from './components/smartlabel/SmartLabelWorkbench';
import { VideoRecorderStation } from './components/recorder/VideoRecorderStation';
import { ClaimRadarDashboard } from './components/claims/ClaimRadarDashboard';
import { ClaimUrgencyAlertBanner } from './components/claims/ClaimUrgencyAlertBanner';
import MoneyPage from './pages/MoneyPage';
import VaultPage from './pages/VaultPage';
import PricingPage from './pages/PricingPage';
import SettingsPage from './pages/SettingsPage';
import ScannerTestPage from './pages/ScannerTestPage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import SupportPage from './pages/SupportPage';
import Footer from './components/shell/Footer';

const PhoneCompanionPage = lazy(() => import('./pages/PhoneCompanionPage'));
import { PaywallModal } from './components/paywall/PaywallModal';
import { PaywallProvider } from './providers/PaywallProvider';
import { useHashRoute, type Route } from './lib/router';
import { useRouteSeo } from './lib/seo';
import { UpdatePrompt } from './components/pwa/UpdatePrompt';
import { fadeUp } from './lib/motion';

export function CurrentPage({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  switch (route) {
    case 'labels':
      return <SmartLabelWorkbench />;
    case 'recorder':
      return <VideoRecorderStation />;
    case 'claims':
      return <ClaimRadarDashboard />;
    case 'money':
      return <MoneyPage navigate={navigate} />;
    case 'vault':
      return <VaultPage />;
    case 'pricing':
      return <PricingPage />;
    case 'settings':
      return <SettingsPage />;
    case 'scanner-test':
      return <ScannerTestPage navigate={navigate} />;
    case 'privacy':
      return <PrivacyPolicyPage navigate={navigate} />;
    case 'terms':
      return <TermsPage navigate={navigate} />;
    case 'refund':
      return <RefundPolicyPage navigate={navigate} />;
    case 'support':
      return <SupportPage navigate={navigate} />;
    case 'pair':
      return (
        <Suspense fallback={null}>
          <PhoneCompanionPage onBackToApp={() => navigate('overview')} />
        </Suspense>
      );
    case 'overview':
      return <OverviewPage navigate={navigate} />;
    case 'not-found':
    case '404':
    default:
      return <NotFoundPage navigate={navigate} />;
  }
}

export default function App() {
  const [route, navigate] = useHashRoute();
  useRouteSeo(route);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    void getOnboardingState().then((state) => {
      if (!state.completed && !state.skipped) {
        setOnboardingOpen(true);
      }
    });

    const onOpenOnboarding = () => setOnboardingOpen(true);
    window.addEventListener('cp-open-onboarding', onOpenOnboarding);
    return () => {
      window.removeEventListener('cp-open-onboarding', onOpenOnboarding);
    };
  }, []);

  const routeRef = useRef(route);
  routeRef.current = route;
  const onboardingOpenRef = useRef(onboardingOpen);
  onboardingOpenRef.current = onboardingOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    const onOpenPalette = () => setPaletteOpen(true);
    const onOpenSearch = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>;
      setSearchQuery(customEvent.detail?.query ?? '');
      setSearchOpen(true);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('cp-open-palette', onOpenPalette);
    window.addEventListener('cp-open-search', onOpenSearch);

    // Global barcode laser gun listener outside recorder station & scanner test
    const hid = startHidListener((code) => {
      if (
        routeRef.current !== 'recorder' &&
        routeRef.current !== 'scanner-test' &&
        !onboardingOpenRef.current
      ) {
        setSearchQuery(code);
        setSearchOpen(true);
      }
    });

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('cp-open-palette', onOpenPalette);
      window.removeEventListener('cp-open-search', onOpenSearch);
      hid.stop();
    };
  }, []);

  if (route === 'pair') {
    return (
      <MotionConfig reducedMotion="user">
        <I18nProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <PhoneCompanionPage onBackToApp={() => navigate('overview')} />
            </Suspense>
          </ToastProvider>
        </I18nProvider>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <ToastProvider>
          <PaywallProvider>
            <div className="flex h-full min-h-screen">
              <Sidebar route={route} navigate={navigate} />
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Sticky shell cluster: header, urgency banner and tab rail move as one,
                    so the tab rail can never slide beneath the header when scrolling. */}
                <div className="sticky top-0 z-40">
                  <TopBar route={route} />
                  <ClaimUrgencyAlertBanner navigate={navigate} />
                  <MobileNav route={route} navigate={navigate} />
                </div>
                <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
                  <ErrorBoundary level="page" resetKey={route}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={route}
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                      >
                        <CurrentPage route={route} navigate={navigate} />
                      </motion.div>
                    </AnimatePresence>
                  </ErrorBoundary>
                </main>
                <Footer navigate={navigate} />
              </div>
            </div>
            <PaywallModal />
            <OnboardingModal
              open={onboardingOpen}
              onClose={() => setOnboardingOpen(false)}
              navigate={navigate}
            />
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
            <GlobalEvidenceSearchModal
              open={searchOpen}
              onClose={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              initialQuery={searchQuery}
            />
            <UpdatePrompt />
          </PaywallProvider>
        </ToastProvider>
      </I18nProvider>
    </MotionConfig>
  );
}
