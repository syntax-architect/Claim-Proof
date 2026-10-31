import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ToastProvider } from './components/ui';
import Sidebar, { MobileNav } from './components/shell/Sidebar';
import TopBar from './components/shell/TopBar';
import { CommandPalette } from './components/shell/CommandPalette';
import OverviewPage from './pages/OverviewPage';
import SmartLabelWorkbench from './components/smartlabel/SmartLabelWorkbench';
import { VideoRecorderStation } from './components/recorder/VideoRecorderStation';
import { ClaimRadarDashboard } from './components/claims/ClaimRadarDashboard';
import VaultPage from './pages/VaultPage';
import PricingPage from './pages/PricingPage';
import SettingsPage from './pages/SettingsPage';
import { PaywallModal } from './components/paywall/PaywallModal';
import { PaywallProvider } from './providers/PaywallProvider';
import { useHashRoute, type Route } from './lib/router';

function CurrentPage({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  switch (route) {
    case 'labels':
      return <SmartLabelWorkbench />;
    case 'recorder':
      return <VideoRecorderStation />;
    case 'claims':
      return <ClaimRadarDashboard />;
    case 'vault':
      return <VaultPage />;
    case 'pricing':
      return <PricingPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <OverviewPage navigate={navigate} />;
  }
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    const onOpen = () => setPaletteOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('cp-open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('cp-open-palette', onOpen);
    };
  }, []);

  return (
    <ToastProvider>
      <PaywallProvider>
        <div className="flex h-full min-h-screen">
          <Sidebar route={route} navigate={navigate} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar route={route} />
            <MobileNav route={route} navigate={navigate} />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
              <motion.div
                key={route}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <CurrentPage route={route} navigate={navigate} />
              </motion.div>
            </main>
          </div>
        </div>
        <PaywallModal />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </PaywallProvider>
    </ToastProvider>
  );
}
