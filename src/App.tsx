import { useState } from 'react';
import type { NavigationItem } from './components/layout/Sidebar';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Footer from './components/layout/Footer';
import ErrorNotice from './components/common/ErrorNotice';
import SignedOut from './components/dashboard/SignedOut';
import PageHeading from './components/dashboard/PageHeading';
import WelcomeCard from './components/dashboard/WelcomeCard';
import PointsCard from './components/dashboard/PointsCard';
import ServiceGrid from './components/dashboard/ServiceGrid';
import AccountModal from './components/account/AccountModal';
import { displayInitial, displayName } from './lib/account';
import { usePortalData } from './hooks/usePortalData';

const navigationItems: NavigationItem[] = [
  { label: 'ホーム', icon: 'fa-house' },
  { label: 'ポイント', icon: 'fa-coins' },
  { label: 'ゲーム', icon: 'fa-gamepad' },
  { label: 'YouTube', icon: 'fa-brands fa-youtube' },
  { label: 'チャット', icon: 'fa-comments' },
  { label: 'アカウント', icon: 'fa-user' }
];

export default function App() {
  const { user, points, pointsMessage, loading, error, refresh } = usePortalData();
  const [expanded, setExpanded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [active, setActive] = useState('ホーム');

  const name = displayName(user);
  const initial = displayInitial(name);

  function choose(label: string) {
    setActive(label);
    if (label === 'アカウント') setAccountOpen(true);
    if (label === 'ポイント') {
      document.getElementById('points-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        expanded={expanded}
        active={active}
        items={navigationItems}
        onToggle={() => setExpanded(value => !value)}
        onNavigate={choose}
      />

      <div className="main-wrapper">
        <Topbar
          name={name}
          initial={initial}
          authenticated={Boolean(user)}
          onRefresh={() => void refresh()}
          onOpenAccount={() => setAccountOpen(true)}
        />

        <main className="content">
          <ErrorNotice message={error} />
          {!user && !loading ? (
            <SignedOut />
          ) : (
            <>
              <PageHeading />
              <section className="dashboard-grid">
                <WelcomeCard name={name} email={user?.email} loading={loading} />
                <PointsCard points={points} loading={loading} message={pointsMessage} />
              </section>
              <ServiceGrid onNavigate={choose} />
            </>
          )}
          <Footer />
        </main>
      </div>

      {accountOpen && (
        <AccountModal
          name={name}
          initial={initial}
          email={user?.email}
          onClose={() => setAccountOpen(false)}
          onRefresh={() => void refresh()}
        />
      )}
    </div>
  );
}
