import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Check,
  FileText,
  Coins,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { CREDIT_PACKS, formatCurrency, formatIDR } from '../config/pricing';
import { formatDateTime, formatNumber } from '../lib/format';
import { api } from '../api';

const PAYMENT_STATUS_CONFIG = {
  paid: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', labelKey: 'billing.statusPaid' },
  pending: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', labelKey: 'billing.statusPending' },
  expired: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', labelKey: 'billing.statusExpired' },
  failed: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', labelKey: 'billing.statusFailed' },
  refunded: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', labelKey: 'billing.statusRefunded' },
};

function getPaymentStatusMeta(status) {
  return PAYMENT_STATUS_CONFIG[status] || {
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    labelKey: 'billing.statusPending'
  };
}

function formatInvoiceKind(p) {
  if (p.kind === 'pack') {
    return `Paket ${p.packName || p.packId || p.pack || 'Credit'}`.trim();
  }
  if (p.kind === 'topup') {
    return `Top-Up (${p.credits} cr)`;
  }
  if (p.kind === 'module') {
    return p.module ? `Modul: ${p.module}` : (p.bundle ? `Paket: ${p.bundle}` : 'Modul (lama)');
  }
  return p.kind || 'Top-up';
}

export default function BillingPage({ refreshMe }) {
  const { lang, t } = useLanguage();
  const { activeWorkspace } = useWorkspace();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [billingInfo, setBillingInfo] = useState(null);

  const fetchBillingData = async () => {
    try {
      const [bData, pData] = await Promise.all([
        api('/api/billing').catch(() => null),
        api('/api/billing/payments').catch(() => ({ payments: [] })),
      ]);
      if (bData) setBillingInfo(bData);
      if (pData?.payments) setPayments(pData.payments);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [activeWorkspace?.id]);

  const handleBuyPack = async (packId) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api('/api/billing/pack', {
        method: 'POST',
        body: { packId }
      });
      if (res?.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      await fetchBillingData();
      if (refreshMe) refreshMe();
      setNotice({ ok: true, text: t('billing.checkoutSuccess') });
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. Header Halaman */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconBox}>
            <CreditCard size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={styles.titleRow}>
              <h1 style={styles.title}>{t('billing.creditPacksTitle', 'Paket Credit & Tagihan')}</h1>
              <span style={styles.brandTag}>{t('billing.activeBrandLabel')} {activeWorkspace?.name}</span>
            </div>
            <p style={styles.subtitle}>
              {t('billing.creditPacksSubtitle', 'Semua modul aktif gratis. Beli paket credit untuk kuota aksi AI lebih hemat dan tanpa batas kedaluwarsa.')}
            </p>
          </div>
        </div>
      </div>

      {/* Notice Alert Box */}
      {notice && (
        <div
          style={{
            ...styles.noticeBox,
            backgroundColor: notice.ok
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            borderColor: notice.ok
              ? 'rgba(16, 185, 129, 0.3)'
              : 'rgba(239, 68, 68, 0.3)',
            color: notice.ok ? 'var(--accent-green)' : 'var(--accent-red)',
          }}
        >
          {notice.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 2. Banner Semua Modul Aktif Gratis */}
      <div style={styles.freeModulesBanner} className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={styles.bannerIconBox}>
            <Sparkles size={20} color="var(--accent-cyan)" />
          </div>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('billing.allModulesActiveTitle')}
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              {t('billing.allModulesActiveDesc')}
            </p>
          </div>
          <Link to="/app/billing/wallet" style={styles.walletLinkBtn}>
            <Wallet size={14} />
            <span>{t('billing.openWalletBtn')}</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 3. Grid Paket Credit Hemat (CREDIT_PACKS) */}
      <div style={styles.sectionHeadingRow}>
        <div>
          <h2 style={styles.sectionHeading}>{t('billing.packsTitle')}</h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            {t('billing.packsSubtitle')}
          </p>
        </div>
      </div>

      <div style={styles.packsGrid}>
        {Object.values(CREDIT_PACKS).map((pack) => {
          const discountPct = Math.round(pack.discount * 100);
          const isPopular = pack.id === 'pack_2500';
          return (
            <div
              key={pack.id}
              className="card"
              style={{
                ...styles.packCard,
                ...(isPopular ? styles.packCardPopular : {})
              }}
            >
              {isPopular && (
                <span style={styles.popularBadge}>
                  <Sparkles size={11} />
                  {t('bundles.popularBadge')}
                </span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={styles.packName}>{pack.name}</h3>
                {discountPct > 0 && (
                  <span style={styles.discountBadge}>
                    {t('billing.savePctBadge', { pct: discountPct })}
                  </span>
                )}
              </div>

              <div style={styles.packCreditBox}>
                <Coins size={16} color="var(--accent-cyan)" />
                <span style={styles.packCreditCount}>{formatNumber(pack.credits, lang)}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('common.credit', 'credit')}</span>
              </div>

              <div style={styles.packPriceRow}>
                <span style={styles.packPriceVal}>{formatCurrency(pack.price, lang)}</span>
              </div>

              <div style={styles.packFeatureList}>
                <div style={styles.packFeatureItem}>
                  <Check size={13} color="var(--accent-green)" />
                  <span>{t('billing.topupNeverExpires')}</span>
                </div>
                <div style={styles.packFeatureItem}>
                  <Check size={13} color="var(--accent-green)" />
                  <span>{t('billing.packRateInfo', { rate: formatIDR(Math.round(pack.price / pack.credits)) })}</span>
                </div>
                <div style={styles.packFeatureItem}>
                  <Check size={13} color="var(--accent-green)" />
                  <span>{t('billing.allModulesFree')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleBuyPack(pack.id)}
                disabled={busy}
                style={{
                  ...styles.buyPackBtn,
                  ...(isPopular ? styles.buyPackBtnPopular : {})
                }}
              >
                <span>{busy ? t('billing.processing', 'Memproses...') : t('billing.btnBuyPack', { name: pack.name }, `Beli ${pack.name}`)}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. Riwayat Tagihan & Pembayaran (Invoices) */}
      <div style={styles.historyCard} className="card">
        <div style={styles.historyHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileText size={16} color="var(--accent-cyan)" />
            <h3 style={styles.historyTitle}>{t('billing.invoicesTitle')}</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('billing.invoicesWorkspace', { name: activeWorkspace?.name })}
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="desktop-only-table" style={styles.historyTableWrapper}>
          <table style={styles.historyTable}>
            <thead>
              <tr style={styles.historyThRow}>
                <th style={styles.historyTh}>{t('billing.invId')}</th>
                <th style={styles.historyTh}>{t('billing.invDate')}</th>
                <th style={styles.historyTh}>{t('billing.itemCol')}</th>
                <th style={styles.historyTh}>{t('billing.invAmount')}</th>
                <th style={styles.historyTh}>{t('billing.invStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {t('billing.noPayments')}
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const statusMeta = getPaymentStatusMeta(p.status);
                  return (
                    <tr key={p.id} style={styles.historyTr}>
                      <td style={styles.historyTd}>
                        <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                          {p.invoiceNo || p.id?.slice(0, 8)}
                        </strong>
                      </td>
                      <td style={styles.historyTd}>
                        {formatDateTime(p.createdAt, lang)}
                      </td>
                      <td style={styles.historyTd}>
                        {formatInvoiceKind(p)}
                      </td>
                      <td style={styles.historyTd}>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(p.amount, lang)}
                        </strong>
                      </td>
                      <td style={styles.historyTd}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: statusMeta.bg,
                            color: statusMeta.color
                          }}
                        >
                          {t(statusMeta.labelKey)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="mobile-only-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {t('billing.noPayments')}
            </div>
          ) : (
            payments.map((p) => {
              const statusMeta = getPaymentStatusMeta(p.status);
              return (
                <div
                  key={p.id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-base)',
                    border: '1px solid var(--border-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                      {p.invoiceNo || p.id?.slice(0, 8)}
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: statusMeta.bg,
                        color: statusMeta.color
                      }}
                    >
                      {t(statusMeta.labelKey)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span>
                      {formatInvoiceKind(p)}
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.amount, lang)}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatDateTime(p.createdAt, lang)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 'clamp(0.85rem, 2.5vw, 1.75rem)',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.25rem',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    flex: 1,
    minWidth: 'min(280px, 100%)',
  },
  headerIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginBottom: '0.25rem',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 'clamp(1.2rem, 3.5vw, 1.45rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  brandTag: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '650px',
  },
  noticeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid transparent',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  sectionHeadingRow: {
    marginTop: '0.5rem',
  },
  sectionHeading: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  freeModulesBanner: {
    padding: '1.25rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
  },
  bannerIconBox: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  walletLinkBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.55rem 0.95rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    fontWeight: '700',
    textDecoration: 'none',
    transition: 'all var(--transition-fast)',
  },
  packsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
    gap: '1.25rem',
  },
  packCard: {
    padding: '1.5rem',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    position: 'relative',
    transition: 'all var(--transition-fast)',
  },
  packCardPopular: {
    border: '1px solid var(--accent-yellow)',
    boxShadow: '0 0 25px rgba(245, 158, 11, 0.12)',
  },
  popularBadge: {
    position: 'absolute',
    top: '-10px',
    right: '20px',
    backgroundColor: 'var(--accent-yellow)',
    color: '#000',
    fontSize: '0.68rem',
    fontWeight: '800',
    borderRadius: '20px',
    padding: '0.2rem 0.65rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    textTransform: 'uppercase',
  },
  discountBadge: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  packName: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  packCreditBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    borderRadius: '8px',
  },
  packCreditCount: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: 'var(--accent-cyan)',
  },
  packPriceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
  },
  packPriceVal: {
    fontSize: '1.45rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  packFeatureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    margin: '0.25rem 0 auto 0',
  },
  packFeatureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  buyPackBtn: {
    width: '100%',
    minHeight: '44px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
    padding: '0.65rem 1rem',
    transition: 'all var(--transition-fast)',
  },
  buyPackBtnPopular: {
    backgroundColor: 'var(--accent-yellow)',
    color: '#000',
    border: 'none',
  },
  historyCard: {
    padding: '1.25rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  historyTitle: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  historyTableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },
  historyTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.85rem',
  },
  historyThRow: {
    borderBottom: '1px solid var(--border-muted)',
  },
  historyTh: {
    padding: '0.6rem 0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  historyTr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  historyTd: {
    padding: '0.75rem',
    color: 'var(--text-secondary)',
  },
};
