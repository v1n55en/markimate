import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, AlertCircle, X, ArrowRight, Zap } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function InsufficientCreditsModal() {
  const [modalData, setModalData] = useState(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const handleInsufficient = (e) => {
      const detail = e.detail || {};
      setModalData(detail);
    };
    window.addEventListener('markimate:insufficient_credits', handleInsufficient);
    window.addEventListener('supermat:insufficient_credits', handleInsufficient);
    return () => {
      window.removeEventListener('markimate:insufficient_credits', handleInsufficient);
      window.removeEventListener('supermat:insufficient_credits', handleInsufficient);
    };
  }, []);

  if (!modalData) return null;

  const isDailyCap = modalData.code === 'DAILY_CAP';
  const need = Number(modalData.need || 0);
  const have = Number(modalData.have || 0);

  const handleClose = () => setModalData(null);

  const handleTopup = () => {
    handleClose();
    navigate('/app/billing/credits');
  };

  const handleViewPlans = () => {
    handleClose();
    navigate('/app/billing');
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="card">
        {/* Header Modal */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={{ ...styles.iconBox, backgroundColor: isDailyCap ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}>
              {isDailyCap ? (
                <AlertCircle size={22} color="var(--accent-red)" />
              ) : (
                <Coins size={22} color="var(--accent-yellow)" />
              )}
            </div>
            <div>
              <h3 style={styles.title}>
                {isDailyCap
                  ? t('app.insufficientCredits.dailyLimitTitle')
                  : t('app.insufficientCredits.insufficientTitle')}
              </h3>
              <span style={styles.subtitle}>
                {isDailyCap
                  ? t('app.insufficientCredits.dailyLimitSubtitle')
                  : t('app.insufficientCredits.insufficientSubtitle')}
              </span>
            </div>
          </div>
          <button onClick={handleClose} style={styles.closeBtn} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content Box */}
        <div style={styles.content}>
          {isDailyCap ? (
            <p style={styles.message}>
              {t('app.insufficientCredits.dailyLimitDesc')}
            </p>
          ) : (
            <>
              <p style={styles.message}>
                {t('app.insufficientCredits.walletInsufficientMsg')}
              </p>

              <div style={styles.statsCard}>
                <div style={styles.statCol}>
                  <span style={styles.statLabel}>{t('app.insufficientCredits.requiredLabel')}</span>
                  <span style={{ ...styles.statVal, color: 'var(--accent-yellow)' }}>
                    {need} <span style={styles.statUnit}>{t('billing.creditsUnit', 'credits')}</span>
                  </span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.statCol}>
                  <span style={styles.statLabel}>{t('app.insufficientCredits.availableLabel')}</span>
                  <span style={{ ...styles.statVal, color: have === 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                    {have} <span style={styles.statUnit}>{t('billing.creditsUnit', 'credits')}</span>
                  </span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.statCol}>
                  <span style={styles.statLabel}>{t('app.insufficientCredits.shortageLabel')}</span>
                  <span style={{ ...styles.statVal, color: 'var(--accent-red)' }}>
                    -{Math.max(0, need - have)} <span style={styles.statUnit}>{t('billing.creditsUnit', 'credits')}</span>
                  </span>
                </div>
              </div>
            </>
          )}

          <div style={styles.tipBox}>
            <Zap size={15} color="var(--accent-cyan)" />
            <span>
              {t('app.insufficientCredits.tipText')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actions}>
          <button onClick={handleTopup} style={styles.primaryBtn}>
            <Coins size={16} />
            <span>{t('app.insufficientCredits.btnTopup')}</span>
            <ArrowRight size={15} />
          </button>
          <button onClick={handleViewPlans} style={styles.secondaryBtn}>
            <span>{t('app.insufficientCredits.btnViewPlans')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '16px',
    maxWidth: '480px',
    width: '100%',
    padding: '1.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.15)',
    animation: 'fadeIn 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  iconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginTop: '0.15rem',
    display: 'block',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.35rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  message: {
    fontSize: '0.88rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  },
  statsCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '0.85rem 0.5rem',
  },
  statCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
  },
  statLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: '600',
  },
  statVal: {
    fontSize: '1.15rem',
    fontWeight: '800',
  },
  statUnit: {
    fontSize: '0.68rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tipBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    borderRadius: '10px',
    padding: '0.65rem 0.85rem',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: 'var(--accent-yellow)',
    color: '#000',
    fontWeight: '700',
    fontSize: '0.88rem',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.65rem 1.25rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    fontSize: '0.825rem',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
};
