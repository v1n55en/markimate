import { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Download,
  Filter,
  CheckCircle,
  AlertCircle,
  Zap,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { getCredits, getCreditLedger, formatIDR, api } from '../../api';
import { CREDIT_PRICE_IDR } from '../../config/pricing';
import { useLanguage } from '../../context/LanguageContext';
import { formatDate as fmtDate, formatDateTime, formatNumber } from '../../lib/format';

export const TOPUP_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    price: 500000,
    credits: 500,
    bonus: 0,
    tag: 'Basic',
    tagKey: 'billing.packageStarterTag',
    popular: false,
    desc: 'Sufficient for ±8 complete articles with 3 AI images.',
    descKey: 'billing.packageStarterDesc',
  },
  {
    id: 'growth',
    name: 'Growth Pack',
    price: 1000000,
    credits: 1050,
    bonus: 50,
    tag: 'Most Popular',
    tagKey: 'billing.packageGrowthTag',
    popular: true,
    desc: 'Bonus +50 credits. Sufficient for ±14 illustrated articles & topic research.',
    descKey: 'billing.packageGrowthDesc',
  },
  {
    id: 'scale',
    name: 'Scale Pack',
    price: 2500000,
    credits: 2750,
    bonus: 250,
    tag: 'Best Value (10% Bonus)',
    tagKey: 'billing.packageScaleTag',
    popular: false,
    desc: 'Bonus +250 credits. Scaled for active brand teams & agencies.',
    descKey: 'billing.packageScaleDesc',
  },
];

export default function CreditWalletPage({ me, onTopupClick }) {
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [filterModule, setFilterModule] = useState('all');
  const [filterKind, setFilterKind] = useState('all');
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [topupBusy, setTopupBusy] = useState(null);
  const [topupNotice, setTopupNotice] = useState(null);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [cData, lData] = await Promise.all([
        getCredits().catch(() => null),
        getCreditLedger({ limit: 100 }).catch(() => ({ ledger: [] })),
      ]);

      if (cData) setCredits(cData);
      if (lData?.ledger) setLedger(lData.ledger);
    } finally {
      setLoading(false);
    }
  };

  const handleTopupPackage = async (pack) => {
    if (onTopupClick) {
      onTopupClick(pack);
      return;
    }
    try {
      setTopupBusy(pack.id);
      setTopupNotice(null);
      const res = await api('/api/credits/topup', {
        method: 'POST',
        body: { packageId: pack.id }
      });

      // Buka Snap jika script tersedia
      if (window.snap && res.token && !res.token.startsWith('snap_mock_')) {
        window.snap.pay(res.token, {
          onSuccess: () => {
            fetchWalletData();
            window.dispatchEvent(new Event('markimate:credits_updated'));
            window.dispatchEvent(new Event('supermat:credits_updated'));
            setTopupNotice({ ok: true, text: t('billing.topupSuccessNotice', { credits: pack.credits }) });
          },
          onPending: () => {
            setTopupNotice({ ok: true, text: t('billing.topupPendingNotice') });
          },
          onError: (err) => {
            setTopupNotice({ ok: false, text: err.status_message || t('billing.topupFailedNotice') });
          },
          onClose: () => {
            fetchWalletData();
          }
        });
      } else {
        // Mode sandbox / dev simulation: simulasi settlement
        try {
          await api('/api/webhooks/midtrans', {
            method: 'POST',
            body: {
              order_id: res.orderId,
              transaction_status: 'settlement',
              status_code: '200',
              gross_amount: String(pack.price),
              payment_type: 'qris'
            }
          });
          await fetchWalletData();
          window.dispatchEvent(new Event('markimate:credits_updated'));
          window.dispatchEvent(new Event('supermat:credits_updated'));
          setTopupNotice({
            ok: true,
            text: t('billing.topupSandboxNotice', { name: pack.name, credits: pack.credits })
          });
        } catch (simErr) {
          setTopupNotice({ ok: false, text: simErr.message });
        }
      }
    } catch (err) {
      setTopupNotice({ ok: false, text: err.message });
    } finally {
      setTopupBusy(null);
    }
  };

  useEffect(() => {
    fetchWalletData();
    const handleUpdate = () => fetchWalletData();
    window.addEventListener('markimate:credits_updated', handleUpdate);
    window.addEventListener('supermat:credits_updated', handleUpdate);
    return () => {
      window.removeEventListener('markimate:credits_updated', handleUpdate);
      window.removeEventListener('supermat:credits_updated', handleUpdate);
    };
  }, []);

  const totalBalance = credits?.balance?.total ?? 0;
  const trialBalance = credits?.balance?.trial ?? 0;
  const subBalance = credits?.balance?.sub ?? 0;
  const topupBalance = credits?.balance?.topup ?? 0;

  const trialEnds = credits?.expires?.trial ? new Date(credits.expires.trial) : null;
  const subEnds = credits?.expires?.sub ? new Date(credits.expires.sub) : null;
  const topupEnds = credits?.expires?.topup ? new Date(credits.expires.topup) : null;

  const isTrialActive = Boolean(credits?.trial?.active);
  const trialDaysLeft = credits?.trial?.daysLeft ?? 0;

  // Filter ledger
  const filteredLedger = useMemo(() => {
    return ledger.filter((item) => {
      if (filterKind !== 'all' && item.kind !== filterKind) return false;
      if (filterModule !== 'all') {
        if (!item.action_key || !item.action_key.startsWith(filterModule)) return false;
      }
      return true;
    });
  }, [ledger, filterKind, filterModule]);

  // Ekspor CSV
  const handleExportCsv = () => {
    if (filteredLedger.length === 0) return;
    const headers = [
      t('billing.csvHeaderId'),
      t('billing.csvHeaderTime'),
      t('billing.csvHeaderType'),
      t('billing.csvHeaderAction'),
      t('billing.csvHeaderBucket'),
      t('billing.csvHeaderDelta'),
      t('billing.csvHeaderBalance'),
      t('billing.csvHeaderNote')
    ];
    const rows = filteredLedger.map((r) => [
      r.id,
      r.created_at,
      r.kind,
      r.action_key || '-',
      r.bucket,
      r.delta,
      r.balance_after,
      `"${(r.note || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `markimate-credit-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    try {
      return formatDateTime(iso, lang);
    } catch {
      return iso;
    }
  };

  const formatSimpleDate = (iso) => {
    if (!iso) return '-';
    try {
      return fmtDate(iso, lang);
    } catch {
      return iso;
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. Header Banner Dompet Credit */}
      <div style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.headerBadge}>
              <Coins size={13} color="var(--accent-cyan)" />
              {t('billing.walletBadge')}
            </span>
            {isTrialActive && (
              <span style={styles.trialBadge}>
                {`⚡ ${t('billing.activeTrialDays', { days: trialDaysLeft })}`}
              </span>
            )}
          </div>
          <h1 style={styles.title}>
            {t('billing.managementTitle')}
          </h1>
          <p style={styles.subtitle}>
            {t('billing.managementSubtitle', { rate: formatIDR(CREDIT_PRICE_IDR) })}
          </p>
        </div>

        <div style={styles.headerActionBox}>
          <button
            onClick={() => setShowCheatsheet(!showCheatsheet)}
            style={styles.cheatsheetToggleBtn}
          >
            <HelpCircle size={15} />
            <span>{t('billing.actionRatesBtn')}</span>
          </button>
        </div>
      </div>

      {/* 2. Kartu Ringkasan Saldo Berdasarkan Bucket */}
      <div style={styles.bucketsGrid}>
        {/* Total Saldo */}
        <div style={{ ...styles.bucketCard, ...styles.bucketTotalCard }} className="card">
          <div style={styles.bucketCardTop}>
            <span style={styles.bucketLabel}>{t('billing.bucketTotal')}</span>
            <div style={styles.totalIconBox}>
              <Coins size={18} color="var(--accent-cyan)" />
            </div>
          </div>
          <div style={styles.bucketValRow}>
            <span style={styles.totalVal}>{formatNumber(totalBalance, lang)}</span>
            <span style={styles.bucketUnit}>{t('billing.creditsUnit')}</span>
          </div>
          <div style={styles.dailyCapRow}>
            <span>{t('billing.usedToday')}</span>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
              {credits?.dailyUsed || 0} / {credits?.dailyCap || 500} cr
            </span>
          </div>
        </div>

        {/* Bucket Trial */}
        <div style={styles.bucketCard} className="card">
          <div style={styles.bucketCardTop}>
            <span style={styles.bucketLabel}>{t('billing.bucketTrial')}</span>
            <span style={styles.bucketMiniTag}>{t('billing.daysUnit', { days: 7 })}</span>
          </div>
          <div style={styles.bucketValRow}>
            <span style={styles.bucketVal}>{formatNumber(trialBalance, lang)}</span>
            <span style={styles.bucketUnit}>cr</span>
          </div>
          <div style={styles.bucketExpRow}>
            <Clock size={12} color="var(--text-muted)" />
            <span>
              {trialEnds
                ? t('billing.expires', { date: formatDate(trialEnds, lang) })
                : t('billing.inactive')}
            </span>
          </div>
        </div>

        {/* Bucket Langganan */}
        <div style={styles.bucketCard} className="card">
          <div style={styles.bucketCardTop}>
            <span style={styles.bucketLabel}>{t('billing.bucketSub')}</span>
            <span style={styles.bucketMiniTag}>{t('billing.daysUnit', { days: 30 })}</span>
          </div>
          <div style={styles.bucketValRow}>
            <span style={styles.bucketVal}>{formatNumber(subBalance, lang)}</span>
            <span style={styles.bucketUnit}>cr</span>
          </div>
          <div style={styles.bucketExpRow}>
            <Clock size={12} color="var(--text-muted)" />
            <span>
              {subEnds
                ? t('billing.resetsOn', { date: formatDate(subEnds, lang) })
                : t('billing.noActivePlan')}
            </span>
          </div>
        </div>

        {/* Bucket Top-up */}
        <div style={styles.bucketCard} className="card">
          <div style={styles.bucketCardTop}>
            <span style={styles.bucketLabel}>{t('billing.bucketTopup')}</span>
            <span style={styles.bucketMiniTag}>{t('billing.daysUnit', { days: 365 })}</span>
          </div>
          <div style={styles.bucketValRow}>
            <span style={styles.bucketVal}>{formatNumber(topupBalance, lang)}</span>
            <span style={styles.bucketUnit}>cr</span>
          </div>
          <div style={styles.bucketExpRow}>
            <Clock size={12} color="var(--text-muted)" />
            <span>
              {topupEnds
                ? t('billing.validUntil', { date: formatDate(topupEnds, lang) })
                : t('billing.valid365')}
            </span>
          </div>
        </div>
      </div>

      {/* Cheatsheet Tarif Aksi (Collapsible) */}
      {showCheatsheet && (
        <div style={styles.cheatsheetCard} className="card">
          <div style={styles.cheatsheetHeader}>
            <h4 style={styles.cheatsheetTitle}>
              {t('billing.cheatsheetTitle')}
            </h4>
            <span style={styles.cheatsheetSub}>
              {t('billing.cheatsheetSubtitle')}
            </span>
          </div>
          <div style={styles.rateGrid}>
            <div style={styles.rateItem}>
              <span style={styles.rateName}>{'seo.article'}</span>
              <span style={styles.rateVal}>{'60 cr'}</span>
              <span style={styles.rateDesc}>{t('billing.rateDescSeoArticle')}</span>
            </div>
            <div style={styles.rateItem}>
              <span style={styles.rateName}>{'seo.image'}</span>
              <span style={styles.rateVal}>{'5 cr / img'}</span>
              <span style={styles.rateDesc}>{t('billing.rateDescSeoImage')}</span>
            </div>
            <div style={styles.rateItem}>
              <span style={styles.rateName}>{'seo.topics_run'}</span>
              <span style={styles.rateVal}>{'10 cr'}</span>
              <span style={styles.rateDesc}>{t('billing.rateDescSeoTopics')}</span>
            </div>
            <div style={styles.rateItem}>
              <span style={styles.rateName}>{'ads.report'}</span>
              <span style={styles.rateVal}>{'400 cr'}</span>
              <span style={styles.rateDesc}>{t('billing.rateDescAdsReport')}</span>
            </div>
            <div style={styles.rateItem}>
              <span style={styles.rateName}>{'spy.scan'}</span>
              <span style={styles.rateVal}>{'40 cr'}</span>
              <span style={styles.rateDesc}>{t('billing.rateDescSpyScan')}</span>
            </div>
            <div style={styles.rateItem}>
              <span style={styles.rateName}>{'spy.insight'}</span>
              <span style={styles.rateVal}>{'50 cr'}</span>
              <span style={styles.rateDesc}>{t('billing.rateDescSpyInsight')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Paket Top-up Tambahan */}
      <div style={styles.sectionHeaderRow}>
        <div>
          <h2 style={styles.sectionTitle}>
            {t('billing.topupSectionTitle')}
          </h2>
          <p style={styles.sectionDesc}>
            {t('billing.topupSectionDesc')}
          </p>
        </div>
      </div>

      {topupNotice && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            backgroundColor: topupNotice.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${topupNotice.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: topupNotice.ok ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.85rem'
          }}
        >
          {topupNotice.text}
        </div>
      )}

      <div style={styles.packsGrid}>
        {TOPUP_PACKAGES.map((pack) => (
          <div
            key={pack.id}
            style={{
              ...styles.packCard,
              ...(pack.popular ? styles.packCardPopular : {}),
            }}
            className="card"
          >
            {pack.popular && (
              <div style={styles.popularBadge}>
                <Sparkles size={12} color="#000" />
                <span>{pack.tagKey ? t(pack.tagKey) : pack.tag}</span>
              </div>
            )}
            <h3 style={styles.packName}>{pack.name}</h3>
            <div style={styles.packPriceRow}>
              <span style={styles.packPrice}>{formatIDR(pack.price, lang)}</span>
            </div>
            <div style={styles.packCreditBox}>
              <Coins size={16} color="var(--accent-cyan)" />
              <span style={styles.packCreditCount}>{formatNumber(pack.credits, lang)} {t('billing.creditsUnit')}</span>
              {pack.bonus > 0 && (
                <span style={styles.packBonusBadge}>+{pack.bonus} {t('billing.bonusBadge', 'bonus')}</span>
              )}
            </div>
            <p style={styles.packDesc}>{pack.descKey ? t(pack.descKey) : pack.desc}</p>
            <button
              onClick={() => handleTopupPackage(pack)}
              disabled={topupBusy === pack.id}
              style={{
                ...styles.packBuyBtn,
                ...(pack.popular ? styles.packBuyBtnPopular : {}),
                opacity: topupBusy === pack.id ? 0.7 : 1
              }}
            >
              <span>{topupBusy === pack.id ? t('billing.processing') : t('billing.buyCreditsBtn', { credits: pack.credits })}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* 4. Buku Besar Mutasi (Ledger) */}
      <div style={styles.ledgerSection}>
        <div style={styles.ledgerHeaderRow}>
          <div>
            <h2 style={styles.sectionTitle}>
              {t('billing.ledgerSectionTitle')}
            </h2>
            <p style={styles.sectionDesc}>
              {t('billing.ledgerSubtitle')}
            </p>
          </div>

          <div style={styles.ledgerControls}>
            {/* Filter Module */}
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">{t('billing.filterAllModules')}</option>
              <option value="seo">{t('billing.filterSeo')}</option>
              <option value="ads">{t('billing.filterAds')}</option>
              <option value="spy">{t('billing.filterSpy')}</option>
            </select>

            {/* Filter Kind */}
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">{t('billing.filterAllTypes')}</option>
              <option value="usage">{t('billing.filterUsage')}</option>
              <option value="grant_trial">{t('billing.filterGrantTrial')}</option>
              <option value="topup">{t('billing.filterTopup')}</option>
              <option value="expire">{t('billing.filterExpire')}</option>
            </select>

            {/* Download CSV */}
            <button
              onClick={handleExportCsv}
              disabled={filteredLedger.length === 0}
              style={styles.exportBtn}
              title={t('billing.downloadCsvTitle')}
            >
              <Download size={14} />
              <span>{t('billing.exportCsv')}</span>
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div style={styles.tableWrapper} className="card">
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>{t('billing.thDateTime')}</th>
                <th style={styles.th}>{t('billing.thAction')}</th>
                <th style={styles.th}>{t('billing.thBucket')}</th>
                <th style={styles.th}>{t('billing.thNote')}</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>{t('billing.thDelta')}</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>{t('billing.thBalanceAfter')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyTd}>
                    {loading
                      ? t('billing.emptyLoading')
                      : t('billing.emptyNoTx')}
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => {
                  const isPositive = row.delta > 0;
                  const isZero = row.delta === 0;
                  return (
                    <tr key={row.id} style={styles.tr}>
                      <td style={styles.tdTime}>{formatDateTime(row.created_at, lang)}</td>
                      <td style={styles.tdAction}>
                        <div style={styles.actionBadgeRow}>
                          <span style={styles.actionKeyTag}>
                            {row.action_key || row.kind}
                          </span>
                        </div>
                      </td>
                      <td style={styles.tdBucket}>
                        <span style={styles.bucketTag}>{row.bucket || '-'}</span>
                      </td>
                      <td style={styles.tdNote}>
                        <span style={styles.noteText}>{row.note || '-'}</span>
                      </td>
                      <td
                        style={{
                          ...styles.tdDelta,
                          color: isZero
                            ? 'var(--text-muted)'
                            : isPositive
                            ? 'var(--accent-green, #10b981)'
                            : 'var(--accent-yellow)',
                        }}
                      >
                        {isPositive ? `+${row.delta}` : `${row.delta}`} cr
                      </td>
                      <td style={styles.tdBalanceAfter}>
                        {formatNumber(row.balance_after, lang)} cr
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.75rem',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginBottom: '0.45rem',
  },
  headerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    borderRadius: '6px',
    padding: '0.2rem 0.55rem',
    textTransform: 'uppercase',
  },
  trialBadge: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-yellow)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '6px',
    padding: '0.2rem 0.55rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
    letterSpacing: '-0.025em',
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.88rem',
    color: 'var(--text-secondary)',
    marginTop: '0.35rem',
    maxWidth: '650px',
    lineHeight: 1.5,
  },
  headerActionBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  cheatsheetToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.55rem 0.95rem',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  bucketsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  bucketCard: {
    padding: '1.25rem',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    border: '1px solid var(--border-muted)',
    backgroundColor: 'var(--bg-surface)',
  },
  bucketTotalCard: {
    border: '1px solid rgba(6, 182, 212, 0.4)',
    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(0, 0, 0, 0) 100%)',
  },
  bucketCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bucketLabel: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
  totalIconBox: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketMiniTag: {
    fontSize: '0.65rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
  },
  bucketValRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
  },
  totalVal: {
    fontSize: '2rem',
    fontWeight: '900',
    letterSpacing: '-0.03em',
    color: 'var(--text-primary)',
  },
  bucketVal: {
    fontSize: '1.65rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
  },
  bucketUnit: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
  },
  dailyCapRow: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '0.45rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  bucketExpRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    paddingTop: '0.35rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  cheatsheetCard: {
    padding: '1.25rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px dashed rgba(255, 255, 255, 0.15)',
  },
  cheatsheetHeader: {
    marginBottom: '0.85rem',
  },
  cheatsheetTitle: {
    fontSize: '0.92rem',
    fontWeight: '700',
    margin: 0,
    color: 'var(--text-primary)',
  },
  cheatsheetSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  rateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
  },
  rateItem: {
    padding: '0.65rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  rateName: {
    fontSize: '0.75rem',
    fontWeight: '700',
    fontFamily: 'monospace',
    color: 'var(--accent-cyan)',
  },
  rateVal: {
    fontSize: '0.95rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  rateDesc: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: '0.5rem',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  sectionDesc: {
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
    marginTop: '0.25rem',
  },
  packsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
  packName: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  packPriceRow: {
    display: 'flex',
    alignItems: 'baseline',
  },
  packPrice: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
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
    fontSize: '0.95rem',
    fontWeight: '800',
    color: 'var(--accent-cyan)',
  },
  packBonusBadge: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-green, #10b981)',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    marginLeft: 'auto',
  },
  packDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: '0 0 auto 0',
  },
  packBuyBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.85rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'all var(--transition-fast)',
  },
  packBuyBtnPopular: {
    backgroundColor: 'var(--accent-yellow)',
    color: '#000',
    border: 'none',
  },
  ledgerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '1rem',
  },
  ledgerHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  ledgerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  filterSelect: {
    padding: '0.45rem 0.75rem',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid var(--border-muted)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.825rem',
  },
  thRow: {
    borderBottom: '1px solid var(--border-muted)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  th: {
    padding: '0.75rem 1rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    transition: 'background-color var(--transition-fast)',
  },
  tdTime: {
    padding: '0.75rem 1rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
  tdAction: {
    padding: '0.75rem 1rem',
  },
  actionBadgeRow: {
    display: 'flex',
    alignItems: 'center',
  },
  actionKeyTag: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    color: 'var(--text-primary)',
  },
  tdBucket: {
    padding: '0.75rem 1rem',
  },
  bucketTag: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: '600',
  },
  tdNote: {
    padding: '0.75rem 1rem',
    color: 'var(--text-secondary)',
  },
  noteText: {
    display: 'block',
    maxWidth: '300px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tdDelta: {
    padding: '0.75rem 1rem',
    textAlign: 'right',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
  tdBalanceAfter: {
    padding: '0.75rem 1rem',
    textAlign: 'right',
    color: 'var(--text-muted)',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  emptyTd: {
    padding: '2.5rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
};
