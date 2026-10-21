import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Check,
  FileText,
  Coins,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { MODULES, LIFETIME_BUNDLES, formatCurrency } from '../config/pricing';
import { formatDateTime } from '../lib/format';
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

  const ownedModules = billingInfo?.modules || activeWorkspace?.modules || [];
  const isAllFocus3Owned = ['seo', 'ads_report', 'ads_spy'].every((m) => ownedModules.includes(m));

  const handleBuyModule = async (moduleKey) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api('/api/billing/modules', {
        method: 'POST',
        body: { module: moduleKey }
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

  const handleBuyBundle = async (bundleKey = 'focus3') => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api('/api/billing/modules', {
        method: 'POST',
        body: { bundle: bundleKey }
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
              <h1 style={styles.title}>{t('billing.lifetimeModulesTitle')}</h1>
              <span style={styles.brandTag}>{t('billing.activeBrandLabel')} {activeWorkspace?.name}</span>
            </div>
            <p style={styles.subtitle}>
              {t('billing.lifetimeModulesSubtitle')}
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

      {/* 2. Bundle Fokus 3 Hero Card */}
      <div className="focus3-hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="focus3-hero-badge">
              <Sparkles size={13} />
              {t('bundles.popularBadge')}
            </span>
            <h3 className="focus3-hero-title">{t('bundles.fokus3Title')}</h3>
            <p className="focus3-hero-desc">{t('bundles.fokus3Desc')}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="focus3-price-val">{formatCurrency(LIFETIME_BUNDLES.focus3.price, lang)}</div>
            <div className="focus3-one-time-label">{t('bundles.oneTime')}</div>
            <div className="focus3-savings-badge">
              {t('bundles.bundleSavingsBadge', { amount: formatCurrency(LIFETIME_BUNDLES.focus3.savings, lang) })}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.95rem' }}>
            <Coins size={18} />
            <span>{t('bundles.monthlyCreditsForever', { credits: LIFETIME_BUNDLES.focus3.monthlyCredits })}</span>
          </div>
          <ul className="focus3-features-list">
            <li>{t('bundles.fokus3Feat1')}</li>
            <li>{t('bundles.fokus3Feat2')}</li>
            <li>{t('bundles.fokus3Feat3')}</li>
            <li>{t('bundles.fokus3Feat4', { credits: LIFETIME_BUNDLES.focus3.monthlyCredits })}</li>
            <li>{t('bundles.fokus3Feat5')}</li>
          </ul>
          <div style={{ marginTop: '1.25rem' }}>
            {isAllFocus3Owned ? (
              <span style={styles.ownedHeroBadge}>
                <Check size={16} />
                {t('billing.ownedLifetimeBadge')}
              </span>
            ) : (
              <button
                type="button"
                className="focus3-cta-btn"
                onClick={() => handleBuyBundle('focus3')}
                disabled={busy}
              >
                <span>
                  {busy ? t('billing.processing') : t('billing.btnBuyBundle', { price: formatCurrency(LIFETIME_BUNDLES.focus3.price, lang) })}
                </span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Grid Modul Lifetime Mandiri */}
      <div style={styles.sectionHeadingRow}>
        <h3 style={styles.sectionHeading}>{t('billing.chooseModulesTitle')}</h3>
      </div>

      <div className="pricing-lifetime-grid">
        {/* Modul SEO */}
        <div className="plan-card card" style={styles.planCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={styles.planBadge}>{t('billing.oneTimeBadge')}</span>
            {ownedModules.includes('seo') && (
              <span style={styles.ownedBadge}>
                <Check size={11} />
                {t('billing.ownedLifetimeBadge')}
              </span>
            )}
          </div>
          <h3 style={styles.planName}>{t('bundles.seoTitle')}</h3>
          <p style={styles.planDesc}>{t('bundles.seoDesc')}</p>
          <div style={styles.planPriceRow}>
            <span style={styles.planPriceVal}>{formatCurrency(MODULES.seo.price, lang)}</span>
            <span style={styles.planPeriod}>{t('bundles.oneTime')}</span>
          </div>
          <div className="plan-credit-grant">
            <Coins size={15} color="var(--accent-cyan)" />
            <span>{t('bundles.monthlyCreditsForever', { credits: MODULES.seo.monthlyCredits })}</span>
          </div>
          <ul style={styles.planFeatures}>
            <li>{t('bundles.seoFeat1')}</li>
            <li>{t('bundles.seoFeat2')}</li>
            <li>{t('bundles.seoFeat3')}</li>
            <li>{t('bundles.seoFeat4', { credits: MODULES.seo.monthlyCredits })}</li>
          </ul>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            {ownedModules.includes('seo') ? (
              <span style={styles.ownedDisabledBtn}>
                <Check size={15} />
                {t('billing.ownedLifetimeBadge')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleBuyModule('seo')}
                disabled={busy}
                style={styles.buyModuleBtn}
              >
                <span>{busy ? t('billing.processing') : t('billing.btnBuyModule', { price: formatCurrency(MODULES.seo.price, lang) })}</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Modul Ads Report */}
        <div className="plan-card card" style={styles.planCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={styles.planBadge}>{t('billing.oneTimeBadge')}</span>
            {ownedModules.includes('ads_report') && (
              <span style={styles.ownedBadge}>
                <Check size={11} />
                {t('billing.ownedLifetimeBadge')}
              </span>
            )}
          </div>
          <h3 style={styles.planName}>{t('bundles.adsReportTitle')}</h3>
          <p style={styles.planDesc}>{t('bundles.adsReportDesc')}</p>
          <div style={styles.planPriceRow}>
            <span style={styles.planPriceVal}>{formatCurrency(MODULES.ads_report.price, lang)}</span>
            <span style={styles.planPeriod}>{t('bundles.oneTime')}</span>
          </div>
          <div className="plan-credit-grant">
            <Coins size={15} color="var(--accent-cyan)" />
            <span>{t('bundles.monthlyCreditsForever', { credits: MODULES.ads_report.monthlyCredits })}</span>
          </div>
          <ul style={styles.planFeatures}>
            <li>{t('bundles.adsReportFeat1')}</li>
            <li>{t('bundles.adsReportFeat2')}</li>
            <li>{t('bundles.adsReportFeat3')}</li>
            <li>{t('bundles.adsReportFeat4', { credits: MODULES.ads_report.monthlyCredits })}</li>
          </ul>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            {ownedModules.includes('ads_report') ? (
              <span style={styles.ownedDisabledBtn}>
                <Check size={15} />
                {t('billing.ownedLifetimeBadge')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleBuyModule('ads_report')}
                disabled={busy}
                style={styles.buyModuleBtn}
              >
                <span>{busy ? t('billing.processing') : t('billing.btnBuyModule', { price: formatCurrency(MODULES.ads_report.price, lang) })}</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Modul Ads Creative Spy */}
        <div className="plan-card card" style={styles.planCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={styles.planBadge}>{t('billing.oneTimeBadge')}</span>
            {ownedModules.includes('ads_spy') && (
              <span style={styles.ownedBadge}>
                <Check size={11} />
                {t('billing.ownedLifetimeBadge')}
              </span>
            )}
          </div>
          <h3 style={styles.planName}>{t('bundles.adsSpyTitle')}</h3>
          <p style={styles.planDesc}>{t('bundles.adsSpyDesc')}</p>
          <div style={styles.planPriceRow}>
            <span style={styles.planPriceVal}>{formatCurrency(MODULES.ads_spy.price, lang)}</span>
            <span style={styles.planPeriod}>{t('bundles.oneTime')}</span>
          </div>
          <div className="plan-credit-grant">
            <Coins size={15} color="var(--accent-cyan)" />
            <span>{t('bundles.monthlyCreditsForever', { credits: MODULES.ads_spy.monthlyCredits })}</span>
          </div>
          <ul style={styles.planFeatures}>
            <li>{t('bundles.adsSpyFeat1')}</li>
            <li>{t('bundles.adsSpyFeat2')}</li>
            <li>{t('bundles.adsSpyFeat3')}</li>
            <li>{t('bundles.adsSpyFeat4', { credits: MODULES.ads_spy.monthlyCredits })}</li>
          </ul>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            {ownedModules.includes('ads_spy') ? (
              <span style={styles.ownedDisabledBtn}>
                <Check size={15} />
                {t('billing.ownedLifetimeBadge')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleBuyModule('ads_spy')}
                disabled={busy}
                style={styles.buyModuleBtn}
              >
                <span>{busy ? t('billing.processing') : t('billing.btnBuyModule', { price: formatCurrency(MODULES.ads_spy.price, lang) })}</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
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
                        {p.kind === 'module'
                          ? (p.module ? `Modul: ${p.module}` : (p.bundle || t('bundles.fokus3Title')))
                          : (p.kind === 'topup' ? `Top-Up: ${p.credits} cr` : p.kind)}
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
                      {p.kind === 'module'
                        ? (p.module ? `Modul: ${p.module}` : (p.bundle || t('bundles.fokus3Title')))
                        : (p.kind === 'topup' ? `Top-Up: ${p.credits} cr` : p.kind)}
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
  ownedHeroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.65rem 1.25rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: 'var(--accent-green)',
    fontSize: '0.9rem',
    fontWeight: '700',
  },
  planCard: {
    padding: 'clamp(1.25rem, 3vw, 1.5rem)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    borderRadius: '12px',
    boxSizing: 'border-box',
    width: '100%',
  },
  planBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  ownedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#000000',
    backgroundColor: 'var(--accent-cyan)',
    borderRadius: '4px',
    padding: '0.15rem 0.45rem',
  },
  planName: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0.35rem 0',
  },
  planDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    margin: '0 0 0.75rem 0',
  },
  planPriceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    marginBottom: '0.5rem',
  },
  planPriceVal: {
    fontSize: '1.35rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  planPeriod: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  planFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 1rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  buyModuleBtn: {
    width: '100%',
    minHeight: '44px',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontWeight: '700',
    fontSize: '0.88rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    border: 'none',
    cursor: 'pointer',
    padding: '0.6rem 1rem',
    boxSizing: 'border-box',
    transition: 'opacity var(--transition-fast)',
  },
  ownedDisabledBtn: {
    width: '100%',
    minHeight: '44px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: 'var(--text-muted)',
    fontWeight: '700',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.6rem 1rem',
    boxSizing: 'border-box',
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
