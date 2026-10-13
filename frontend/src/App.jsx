import { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import KeywordManager from './components/KeywordManager';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CmsSettings from './components/CmsSettings';
import BillingPage from './components/BillingPage';
import CreditWalletPage from './pages/billing/CreditWalletPage';
import AutoTopicsPage from './pages/seo/AutoTopicsPage';
import InsufficientCreditsModal from './components/common/InsufficientCreditsModal';
import { storage } from './lib/storage';

// Halaman Publik
import LandingPage from './pages/public/LandingPage';
import PrivacyPage from './pages/public/PrivacyPage';
import TermsPage from './pages/public/TermsPage';
import RoleDetailPage from './pages/public/RoleDetailPage';

// Halaman Ads Report
import AdsSummaryPage from './pages/ads/AdsSummaryPage';
import AdsConnectionsPage from './pages/ads/AdsConnectionsPage';
import AdsReportsPage from './pages/ads/AdsReportsPage';
import AdsReportDetailPage from './pages/ads/AdsReportDetailPage';
import AdsCallbackPage from './pages/ads/AdsCallbackPage';

import { api, getToken, setToken } from './api';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { LanguageProvider } from './context/LanguageContext';
import ModuleGuard from './components/common/ModuleGuard';
import ModuleActivatePage from './pages/app/ModuleActivatePage';
import WorkspaceDashboardPage from './pages/app/WorkspaceDashboardPage';

// Halaman Ads Creative Spy
import SpyOverviewPage from './pages/spy/SpyOverviewPage';
import SpyCompetitorsPage from './pages/spy/SpyCompetitorsPage';
import SpyLibraryPage from './pages/spy/SpyLibraryPage';
import SpyInsightsPage from './pages/spy/SpyInsightsPage';

// Komponen Pembungkus Route Terproteksi
function ProtectedLayout({ me, onLogout, refreshMe }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (!me) {
    const nextPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${nextPath}`} replace />;
  }

  const user = me.user;
  const plan = user.plan || 'free';

  const goTo = (tab) => {
    if (tab === 'keywords') navigate('/app/seo/keywords');
    else if (tab === 'topics') navigate('/app/seo/topics');
    else if (tab === 'analytics') navigate('/app/seo/analytics');
    else if (tab === 'settings') navigate('/app/seo/settings');
    else if (tab === 'billing') navigate('/app/billing');
    else navigate(`/app/${tab}`);
  };

  return (
    <div className="app-container">
      <InsufficientCreditsModal />
      <Sidebar
        user={user}
        onLogout={onLogout}
        plan={plan}
        usage={me.usage}
      />

      <div style={styles.contentWrapper}>
        <main className="main-content">
          <Routes>
            <Route index element={<WorkspaceDashboardPage me={me} />} />

            {/* Rute Modul SEO (Guarded) */}
            <Route
              path="seo/keywords"
              element={
                <ModuleGuard moduleKey="seo">
                  <KeywordManager me={me} refreshMe={refreshMe} goTo={goTo} />
                </ModuleGuard>
              }
            />
            <Route
              path="seo/topics"
              element={
                <ModuleGuard moduleKey="seo">
                  <AutoTopicsPage me={me} refreshMe={refreshMe} goTo={goTo} />
                </ModuleGuard>
              }
            />
            <Route
              path="seo/analytics"
              element={
                <ModuleGuard moduleKey="seo">
                  <AnalyticsDashboard me={me} />
                </ModuleGuard>
              }
            />
            <Route
              path="seo/settings"
              element={
                <ModuleGuard moduleKey="seo">
                  <CmsSettings me={me} refreshMe={refreshMe} goTo={goTo} />
                </ModuleGuard>
              }
            />

            {/* Rute Modul Ads Report (Guarded) */}
            <Route
              path="ads"
              element={
                <ModuleGuard moduleKey="ads_report">
                  <AdsSummaryPage />
                </ModuleGuard>
              }
            />
            <Route
              path="ads/connections"
              element={
                <ModuleGuard moduleKey="ads_report">
                  <AdsConnectionsPage />
                </ModuleGuard>
              }
            />
            <Route
              path="ads/reports"
              element={
                <ModuleGuard moduleKey="ads_report">
                  <AdsReportsPage user={user} />
                </ModuleGuard>
              }
            />
            <Route
              path="ads/reports/:reportId"
              element={
                <ModuleGuard moduleKey="ads_report">
                  <AdsReportDetailPage user={user} />
                </ModuleGuard>
              }
            />
            <Route
              path="ads/connect/:platform/callback"
              element={
                <ModuleGuard moduleKey="ads_report">
                  <AdsCallbackPage />
                </ModuleGuard>
              }
            />

            {/* Rute Modul Ads Creative Spy (Guarded) */}
            <Route
              path="spy"
              element={
                <ModuleGuard moduleKey="ads_spy">
                  <SpyOverviewPage />
                </ModuleGuard>
              }
            />
            <Route
              path="spy/competitors"
              element={
                <ModuleGuard moduleKey="ads_spy">
                  <SpyCompetitorsPage />
                </ModuleGuard>
              }
            />
            <Route
              path="spy/library"
              element={
                <ModuleGuard moduleKey="ads_spy">
                  <SpyLibraryPage />
                </ModuleGuard>
              }
            />
            <Route
              path="spy/insights"
              element={
                <ModuleGuard moduleKey="ads_spy">
                  <SpyInsightsPage />
                </ModuleGuard>
              }
            />

            {/* Halaman Aktivasi Modul & Waitlist */}
            <Route path="modules/:key" element={<ModuleActivatePage />} />

            {/* Rute Akun */}
            <Route path="billing" element={<BillingPage me={me} refreshMe={refreshMe} />} />
            <Route path="billing/credits" element={<CreditWalletPage me={me} />} />

            {/* Fallback di dalam /app */}
            <Route path="*" element={<Navigate to="/app/ads" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// Komponen Utama App
export default function App() {
  const [me, setMe] = useState(null); // { user, plan, usage, cms }
  const [booting, setBooting] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token || token.includes('demo_token')) {
      if (token?.includes('demo_token')) setToken('');
      setMe(null);
      return null;
    }

    try {
      const data = await api('/api/me');
      setMe(data);
      return data;
    } catch {
      setToken('');
      setMe(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // Bersihkan sesi mock legacy & sisa key demo saat boot (PRD Hapus Mode Demo)
    [
      'user',
      'plan',
      'keywords',
      'credentials',
      'run_count',
      'demo_session',
      'demo_state',
      'markimate_demo_session',
      'markimate_demo_state',
      'supermat_demo_session',
      'supermat_demo_state',
    ].forEach((k) => {
      try { storage.removeItem(k); } catch { /* abaikan */ }
    });

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const toRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.includes('demo_session') || k.includes('demo_token') || k.includes('demo_state'))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      }
      const curToken = storage.getItem('token');
      if (curToken && (curToken.includes('demo_token') || curToken.includes('demo_session'))) {
        storage.removeItem('token');
        setToken('');
      }
    } catch { /* abaikan */ }

    refreshMe().finally(() => setBooting(false));

    const onLogout = () => {
      setToken('');
      setMe(null);
    };

    window.addEventListener('markimate:logout', onLogout);
    window.addEventListener('supermat:logout', onLogout);
    return () => {
      window.removeEventListener('markimate:logout', onLogout);
      window.removeEventListener('supermat:logout', onLogout);
    };
  }, [refreshMe]);

  const handleLoginSuccess = async () => {
    setBooting(true);
    await refreshMe();
    setBooting(false);
  };

  const handleLogout = () => {
    setToken('');
    setMe(null);
    window.dispatchEvent(new Event('markimate:logout'));
    window.dispatchEvent(new Event('supermat:logout'));
  };

  if (booting) {
    return (
      <div style={styles.loadingScreen}>
        Memuat Markimate…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <LanguageProvider>
          <Routes>
            {/* Rute Publik */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/roles/:key" element={<RoleDetailPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            <Route
              path="/login"
              element={
                me ? (
                  <Navigate to="/app/ads" replace />
                ) : (
                  <AuthScreen onLoginSuccess={handleLoginSuccess} initialMode="login" />
                )
              }
            />
            <Route
              path="/register"
              element={
                me ? (
                  <Navigate to="/app/ads" replace />
                ) : (
                  <AuthScreen onLoginSuccess={handleLoginSuccess} initialMode="register" />
                )
              }
            />

            {/* Rute Terproteksi Aplikasi */}
            <Route
              path="/app/*"
              element={
                <ProtectedLayout
                  me={me}
                  onLogout={handleLogout}
                  refreshMe={refreshMe}
                />
              }
            />

            {/* Catch-all redirect ke Beranda */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LanguageProvider>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}

const styles = {
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    backgroundColor: 'var(--bg-base)',
  },
  contentWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-base)',
  },
};
