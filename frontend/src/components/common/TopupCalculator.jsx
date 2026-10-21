import { useState } from 'react';
import { Coins, Sparkles, FileText, BarChart2, Eye, ArrowRight } from 'lucide-react';
import { TOPUP, quoteTopup, formatCurrency } from '../../config/pricing';
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

  return (
    <div className="topup-calculator-card">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Coins size={18} color="var(--accent-cyan)" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('billing.topupCustomTitle', 'Custom Credit Top-Up')}
          </h3>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {t('billing.topupCustomSubtitle', {
            min: TOPUP.min,
            rate: formatCurrency(TOPUP.pricePerCredit, lang),
            tier1: 1000,
            disc1: '5%',
            tier2: 2500,
            disc2: '10%'
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('billing.topupGrossLabel', { rate: formatCurrency(TOPUP.pricePerCredit, lang) })}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {formatCurrency(safeCredits * TOPUP.pricePerCredit, lang)}
            </div>
          </div>

          {quote.discountPct > 0 && (
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: 'var(--accent-green)',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}
              >
                <Sparkles size={12} />
                {t('billing.topupDiscountBadge', { pct: Math.round(quote.discountPct * 100) })}
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '0.2rem' }}>
                -{formatCurrency(Math.round(safeCredits * TOPUP.pricePerCredit * quote.discountPct), lang)}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: '1px dashed var(--border-muted)',
            paddingTop: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}
        >
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('billing.topupTotalPayLabel', 'Total Investment:')}
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
            {formatCurrency(quote.amount, lang)}
          </span>
        </div>
      </div>

      {/* Estimasi Hasil Nyata */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('billing.topupOutputEstTitle', 'Estimated Real Deliverables:')}
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
          <span>{t('billing.btnPublicTopupTrial', { credits: 300 })}</span>
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
              ? t('billing.processing', 'Processing...')
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
