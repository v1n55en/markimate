import { useState } from 'react';
import { Coins, Sparkles, FileText, BarChart2, Eye, ArrowRight } from 'lucide-react';
import { TOPUP, TRIAL, quoteTopup, formatCurrency } from '../../config/pricing';
import { formatNumber } from '../../lib/format';
import { useLanguage } from '../../context/LanguageContext';
import { AppLink } from '../../lib/hosts';

export default function TopupCalculator({
  onBuy,
  busy = false,
  isPublic = false,
  initialCredits = 500,
}) {
  const { lang, t } = useLanguage();
  const [credits, setCredits] = useState(initialCredits);

  const safeCredits = Math.max(TOPUP.min, Math.min(TOPUP.max, Math.floor(Number(credits) || 0)));
  const quote = quoteTopup(safeCredits);

  const handleStep = (delta) => {
    setCredits((prev) => {
      const cur = Math.floor(Number(prev) || 0);
      return Math.max(TOPUP.min, Math.min(TOPUP.max, cur + delta));
    });
  };

  const handleQuickSelect = (val) => {
    setCredits(val);
  };

  const handleInputChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v)) {
      setCredits(0);
    } else {
      setCredits(v);
    }
  };

  const handleBlur = () => {
    setCredits(safeCredits);
  };

  // Estimasi output nyata berdasarkan credit-defaults.js
  const estArticles = Math.floor(safeCredits / 75);
  const estReports = Math.floor(safeCredits / 400);
  const estScans = Math.floor(safeCredits / 40);

  const sortedTiers = [...TOPUP.tiers].sort((a, b) => a.min - b.min);

  return (
    <div className="topup-calculator-card">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Coins size={18} color="var(--accent-cyan)" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('billing.topupCustomTitle')}
          </h3>
        </div>
        <p className="topup-card-subtitle">
          {t('billing.topupCustomSubtitle', {
            t1: formatNumber(sortedTiers[0].min, lang),
            d1: `${Math.round(sortedTiers[0].disc * 100)}%`,
            t2: formatNumber(sortedTiers[1].min, lang),
            d2: `${Math.round(sortedTiers[1].disc * 100)}%`,
            t3: formatNumber(sortedTiers[2].min, lang),
            d3: `${Math.round(sortedTiers[2].disc * 100)}%`
          })}
        </p>
      </div>

      {/* Stepper & Quick Pills */}
      <div className="topup-stepper-row">
        <div className="topup-input-box">
          <button
            type="button"
            className="topup-step-btn"
            onClick={() => handleStep(-50)}
            disabled={safeCredits <= TOPUP.min || busy}
            aria-label="-"
          >
            -
          </button>
          <input
            type="number"
            className="topup-number-input"
            value={credits || ''}
            onChange={handleInputChange}
            onBlur={handleBlur}
            min={TOPUP.min}
            max={TOPUP.max}
            step={50}
            disabled={busy}
          />
          <button
            type="button"
            className="topup-step-btn"
            onClick={() => handleStep(50)}
            disabled={safeCredits >= TOPUP.max || busy}
            aria-label="+"
          >
            +
          </button>
        </div>

        <div className="topup-quick-pills">
          {TOPUP.quickOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`topup-pill-btn ${safeCredits === opt ? 'active' : ''}`}
              onClick={() => handleQuickSelect(opt)}
              disabled={busy}
            >
              {formatNumber(opt, lang)} cr
            </button>
          ))}
        </div>
      </div>

      {/* Rincian Harga & Diskon Volume */}
      <div className="topup-calc-result-box">
        <div className="topup-price-row">
          <span className="topup-row-label">
            {t('billing.topupGrossLabel')}
          </span>
          <span className="topup-row-value">
            {formatCurrency(safeCredits * TOPUP.pricePerCredit, lang)}
          </span>
        </div>

        {quote.discountPct > 0 && (
          <div className="topup-price-row topup-discount-row">
            <div className="topup-discount-label-group">
              <span className="topup-row-label">
                {t('billing.topupDiscountRow', { pct: Math.round(quote.discountPct * 100) })}
              </span>
              <span className="topup-badge-save">
                <Sparkles size={11} />
                {t('billing.savePctBadge', { pct: Math.round(quote.discountPct * 100) })}
              </span>
            </div>
            <span className="topup-discount-value">
              {'-' + formatCurrency(quote.discount, lang)}
            </span>
          </div>
        )}

        {quote.discountPct === 0 && quote.nextTier && (
          <div className="topup-next-tier-hint">
            <Sparkles size={13} color="var(--accent-cyan)" />
            <span>
              {t('billing.topupNextTierHint', {
                n: formatNumber(quote.nextTier.creditsNeeded, lang),
                pct: Math.round(quote.nextTier.disc * 100)
              })}
            </span>
          </div>
        )}

        <div className="topup-total-row">
          <span className="topup-total-label">
            {t('billing.topupTotalPayLabel')}
          </span>
          <span className="topup-total-value">
            {formatCurrency(quote.amount, lang)}
          </span>
        </div>
      </div>

      {/* Estimasi Hasil Nyata */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('billing.topupOutputEstTitle')}
        </div>
        <div className="topup-est-grid">
          <div className="topup-est-item">
            <FileText size={15} color="var(--accent-cyan)" />
            <span>
              {t('billing.topupOutputArticles', { count: estArticles })}
            </span>
          </div>
          <div className="topup-est-item">
            <BarChart2 size={15} color="var(--accent-blue)" />
            <span>
              {t('billing.topupOutputReports', { count: estReports })}
            </span>
          </div>
          <div className="topup-est-item">
            <Eye size={15} color="var(--accent-purple)" />
            <span>
              {t('billing.topupOutputScans', { count: estScans })}
            </span>
          </div>
        </div>
      </div>

      {/* Tombol Aksi */}
      {isPublic ? (
        <AppLink to="/register" className="topup-submit-btn">
          <span>{t('billing.btnPublicTopupTrial', { credits: TRIAL.credits })}</span>
          <ArrowRight size={16} />
        </AppLink>
      ) : (
        <button
          type="button"
          className="topup-submit-btn"
          onClick={() => onBuy && onBuy(safeCredits)}
          disabled={busy || safeCredits < TOPUP.min}
        >
          <Coins size={16} />
          <span>
            {busy
              ? t('billing.processing')
              : t('billing.btnBuyCustomCredits', {
                  credits: formatNumber(safeCredits, lang),
                  amount: formatCurrency(quote.amount, lang)
                })}
          </span>
        </button>
      )}
    </div>
  );
}
