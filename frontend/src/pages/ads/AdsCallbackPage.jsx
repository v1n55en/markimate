import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { finishConnect, isAdsMock } from '../../ads/adsApi';
import { PLATFORMS_META } from '../../ads/mockData';
import ModuleComingSoonCard from '../../components/common/ModuleComingSoonCard';

export default function AdsCallbackPage() {
  if (!isAdsMock()) {
    return <ModuleComingSoonCard roleKey="ads_report" />;
  }
  const { lang, t } = useLanguage();
  const { platform } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(2);
  const calledRef = useRef(false);

  const platformMeta = PLATFORMS_META[platform] || {
    name: platform?.toUpperCase() || 'Platform',
    color: 'var(--accent-cyan)',
    accentBg: 'rgba(6, 182, 212, 0.1)',
  };

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const runCallback = async () => {
      // Ambil seluruh parameter query string
      const query = {};
      for (const [k, v] of searchParams.entries()) {
        query[k] = v;
      }

      try {
        await finishConnect(platform, query);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setErrorMessage(err.message || (lang.startsWith('id') ? 'Gagal memproses otorisasi akun iklan.' : 'Failed to process ad account authorization.'));
      }
    };

    runCallback();
  }, [platform, searchParams]);

  // Efek countdown redirect setelah sukses
  useEffect(() => {
    if (status !== 'success') return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          navigate('/app/ads/connections');
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, navigate]);

  return (
    <div style={styles.container}>
      <div style={styles.card} className="card">
        {/* Status: Processing */}
        {status === 'processing' && (
          <div style={styles.stateBox}>
            <div
              style={{
                ...styles.platformIcon,
                backgroundColor: platformMeta.accentBg,
                color: platformMeta.color,
              }}
            >
              <RefreshCw
                size={32}
                style={{ animation: 'spin 1.2s linear infinite' }}
              />
            </div>
            <h2 style={styles.title}>{t('ads.callback.authenticating', { platform: platformMeta.name })}</h2>
            <p style={styles.text}>
              {t('ads.callback.authenticatingDesc')}
            </p>
          </div>
        )}

        {/* Status: Success */}
        {status === 'success' && (
          <div style={styles.stateBox}>
            <div style={styles.successIconBox}>
              <CheckCircle2 size={36} color="var(--accent-green)" />
            </div>
            <h2 style={styles.title}>{t('ads.callback.successTitle')}</h2>
            <p style={styles.text}>
              {t('ads.callback.successDesc', { platform: platformMeta.name })}
            </p>
            <div style={styles.redirectBadge}>
              {t('ads.callback.redirectCountdown', { seconds: countdown })}
            </div>
            <button
              onClick={() => navigate('/app/ads/connections')}
              style={styles.primaryBtn}
            >
              {t('ads.callback.goToConnections')}
            </button>
          </div>
        )}

        {/* Status: Error */}
        {status === 'error' && (
          <div style={styles.stateBox}>
            <div style={styles.errorIconBox}>
              <XCircle size={36} color="var(--accent-red)" />
            </div>
            <h2 style={styles.title}>{t('ads.callback.errorTitle')}</h2>
            <p style={styles.errorText}>{errorMessage}</p>
            <div style={styles.actionRow}>
              <Link to="/app/ads/connections" style={styles.secondaryBtn}>
                <ArrowLeft size={16} />
                <span>{lang.startsWith('id') ? 'Kembali' : 'Back'}</span>
              </Link>
              <button
                onClick={() => {
                  calledRef.current = false;
                  setStatus('processing');
                  setErrorMessage('');
                  navigate(`/app/ads/connect/${platform}/callback?code=retry_demo_${Date.now()}`);
                }}
                style={styles.primaryBtn}
              >
                {t('ads.callback.retryBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '75vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    padding: '2.5rem 2rem',
    textAlign: 'center',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    boxShadow: 'var(--shadow-lg)',
  },
  stateBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  successIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  errorIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  title: {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.65rem',
  },
  text: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: 'var(--accent-red)',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  redirectBadge: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '1rem',
    fontStyle: 'italic',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    justifyContent: 'center',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: '500',
    textDecoration: 'none',
    cursor: 'pointer',
  },
};
