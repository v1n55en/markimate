import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  formatIDR,
  formatCompactIDR,
  formatCompact,
  formatNumber,
  formatPercent,
  formatRoas,
} from '../../ads/format';

export default function KpiCard({
  title,
  value,
  format = 'number',
  delta,
  isGoodWhenLower = false,
  subtitle = null,
  icon: Icon,
  compact = false,
}) {
  const { t } = useLanguage();
  const displaySubtitle = subtitle || t('ads.summary.vsLastMonth', 'vs last month');
  // Format nilai utama
  let formattedValue = value;
  if (format === 'currency') formattedValue = formatIDR(value);
  else if (format === 'compactCurrency') formattedValue = formatCompactIDR(value);
  else if (format === 'compact') formattedValue = formatCompact(value);
  else if (format === 'percent') formattedValue = formatPercent(value);
  else if (format === 'roas') formattedValue = formatRoas(value);
  else if (typeof value === 'number') formattedValue = formatNumber(value);

  // Evaluasi warna delta
  const hasDelta = delta !== undefined && delta !== null;
  const isPositive = delta > 0;
  const isZero = delta === 0;

  let isGood = isPositive;
  if (isGoodWhenLower) {
    isGood = !isPositive && !isZero;
  }

  const deltaColor = isZero
    ? 'var(--text-muted)'
    : isGood
    ? 'var(--accent-green)'
    : 'var(--accent-red)';

  const deltaBg = isZero
    ? 'rgba(113, 113, 122, 0.12)'
    : isGood
    ? 'rgba(16, 185, 129, 0.12)'
    : 'rgba(239, 68, 68, 0.12)';

  const deltaBorder = isZero
    ? 'rgba(113, 113, 122, 0.2)'
    : isGood
    ? 'rgba(16, 185, 129, 0.25)'
    : 'rgba(239, 68, 68, 0.25)';

  return (
    <div style={styles.card} className="card">
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        {Icon && (
          <div style={styles.iconBox}>
            <Icon size={16} color="var(--accent-cyan)" />
          </div>
        )}
      </div>

      <div style={styles.valueRow}>
        <div style={{ ...styles.value, fontSize: compact ? '1.5rem' : '1.875rem' }}>
          {formattedValue}
        </div>
      </div>

      <div style={styles.footerRow}>
        {hasDelta && (
          <span
            style={{
              ...styles.deltaBadge,
              backgroundColor: deltaBg,
              color: deltaColor,
              borderColor: deltaBorder,
            }}
          >
            {isZero ? (
              <Minus size={12} />
            ) : isPositive ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}
            <span>
              {isPositive ? '+' : ''}
              {Number(delta).toFixed(1)}%
            </span>
          </span>
        )}
        <span style={styles.subtitle}>{displaySubtitle}</span>
      </div>
    </div>
  );
}

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '1.25rem',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    minHeight: '135px',
    transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '0.8125rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    letterSpacing: '0.01em',
  },
  iconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  valueRow: {
    margin: '0.25rem 0 0.5rem 0',
  },
  value: {
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '-0.025em',
    lineHeight: 1.15,
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  deltaBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    border: '1px solid',
    fontSize: '0.725rem',
    fontWeight: '600',
    lineHeight: 1,
  },
  subtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
};
