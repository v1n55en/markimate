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
import VerifyPage from './pages/public/VerifyPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';
import DataDeletionPage from './pages/public/DataDeletionPage';
import GoogleCallbackPage from './pages/public/GoogleCallbackPage';

// Halaman Ads Report
import AdsSummaryPage from './pages/ads/AdsSummaryPage';
import AdsConnectionsPage from './pages/ads/AdsConnectionsPage';
import AdsReportsPage from './pages/ads/AdsReportsPage';
import AdsReportDetailPage from './pages/ads/AdsReportDetailPage';
import AdsCallbackPage from './pages/ads/AdsCallbackPage';

import { api, getToken, setToken, refreshSession, API_BASE_URL } from './api';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { LanguageProvider } from './context/LanguageContext';
import { useInitialLanguageRedirect } from './lib/localized-router';
import ModuleGuard from './components/common/ModuleGuard';
import ModuleActivatePage from './pages/app/ModuleActivatePage';
import WorkspaceDashboardPage from './pages/app/WorkspaceDashboardPage';
import SecuritySettingsPage from './pages/app/SecuritySettingsPage';
import AccountSettingsPage from './pages/app/AccountSettingsPage';
import MembersSettingsPage from './pages/app/MembersSettingsPage';
import InvitePage from './pages/public/InvitePage';

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

            {/* Rute Akun & Keamanan */}
            <Route path="billing" element={<BillingPage me={me} refreshMe={refreshMe} />} />
            <Route path="billing/credits" element={<CreditWalletPage me={me} />} />
            <Route path="settings/account" element={<AccountSettingsPage me={me} refreshMe={refreshMe} />} />
            <Route path="settings/security" element={<SecuritySettingsPage />} />
            <Route path="settings/members" element={<MembersSettingsPage me={me} refreshMe={refreshMe} />} />

            {/* Fallback di dalam /app */}
            <Route path="*" element={<Navigate to="/app/ads" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// Komponen Routing yang dibungkus di dalam LanguageProvider
function AppRoutes({ me, onLoginSuccess, onLogout, refreshMe }) {
  // Redirect kunjungan pertama kali ke /id bila browser berbahasa Indonesia (PRD F3 §2.3)
  useInitialLanguageRedirect();

  return (
    <Routes>
      {/* Rute Publik Kanonik (EN) */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/roles/:key" element={<RoleDetailPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/data-deletion" element={<DataDeletionPage />} />

      {/* Rute Publik Terlokalisasi (ID) (PRD F3 §2.3) */}
      <Route path="/id" element={<LandingPage />} />
      <Route path="/id/roles/:key" element={<RoleDetailPage />} />
      <Route path="/id/privacy" element={<PrivacyPage />} />
      <Route path="/id/terms" element={<TermsPage />} />
      <Route path="/id/data-deletion" element={<DataDeletionPage />} />

      {/* Rute Auth (Kanonik EN) */}
      <Route path="/verify" element={<VerifyPage onLoginSuccess={onLoginSuccess} />} />
      <Route path="/forgot" element={<ForgotPasswordPage />} />
      <Route path="/reset" element={<ResetPasswordPage />} />
      <Route path="/invite" element={<InvitePage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage onLogin={onLoginSuccess} />} />

      <Route
        path="/login"
        element={
          me ? (
            <Navigate to="/app/ads" replace />
          ) : (
            <AuthScreen onLoginSuccess={onLoginSuccess} initialMode="login" />
          )
        }
      />
      <Route
        path="/register"
        element={
          me ? (
            <Navigate to="/app/ads" replace />
          ) : (
            <AuthScreen onLoginSuccess={onLoginSuccess} initialMode="register" />
          )
        }
      />

      {/* Rute Auth Terlokalisasi (ID) (PRD F3 Langkah 5) */}
      <Route path="/id/verify" element={<VerifyPage onLoginSuccess={onLoginSuccess} />} />
      <Route path="/id/forgot" element={<ForgotPasswordPage />} />
      <Route path="/id/reset" element={<ResetPasswordPage />} />
      <Route path="/id/invite" element={<InvitePage />} />
      <Route
        path="/id/login"
        element={
          me ? (
            <Navigate to="/app/ads" replace />
          ) : (
            <AuthScreen onLoginSuccess={onLoginSuccess} initialMode="login" />
          )
        }
      />
      <Route
        path="/id/register"
        element={
          me ? (
            <Navigate to="/app/ads" replace />
          ) : (
            <AuthScreen onLoginSuccess={onLoginSuccess} initialMode="register" />
          )
        }
      />

      {/* Rute Terproteksi Aplikasi */}
      <Route
        path="/app/*"
        element={
          <ProtectedLayout
            me={me}
            onLogout={onLogout}
            refreshMe={refreshMe}
          />
        }
      />

      {/* Catch-all redirect ke Beranda */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Komponen Utama App
export default function App() {
  const [me, setMe] = useState(null); // { user, plan, usage, cms }
  const [booting, setBooting] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      // 1. Periksa apakah ada token legacy 30 hari di storage untuk migrasi transisi tanpa logout paksa
      const legacyToken = storage.getItem('token');
      if (legacyToken && !legacyToken.includes('demo_token') && !getToken()) {
        try {
          const upgRes = await fetch(`${API_BASE_URL}/api/auth/upgrade-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${legacyToken}`,
            },
            credentials: 'include',
          });
          const upgData = await upgRes.json().catch(() => null);
          if (upgRes.ok && upgData?.accessToken) {
            setToken(upgData.accessToken);
            storage.removeItem('token');
          }
        } catch {
          // Abaikan error jaringan saat upgrade, coba fallback ke refreshSession
        }
      }

      // 2. Jika belum ada token di memory, coba refresh session via cookie httpOnly mk_rt
      if (!getToken()) {
        try {
          await refreshSession();
        } catch {
          setToken('');
          setMe(null);
          return null;
        }
      }

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

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', retryOn401: false });
    } catch {
      // Abaikan jika jaringan error saat logout
    }
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
          <AppRoutes
            me={me}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            refreshMe={refreshMe}
          />
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
