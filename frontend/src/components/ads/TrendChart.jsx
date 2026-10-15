import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { formatCompactIDR, formatRoas, formatIDR, formatNumber } from '../../ads/format';

export default function TrendChart({
  monthlyData = [],
  dailyData = [],
  title,
}) {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'daily'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const chartTitle = title || t('ads.trend.defaultTitle');
  const activeData = viewMode === 'monthly' ? monthlyData : dailyData;
  const labelKey = viewMode === 'monthly' ? 'month' : 'date';

  if (!activeData || activeData.length === 0) {
    return (
      <div style={styles.emptyContainer} className="card">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {t('ads.trend.notAvailable')}
        </span>
      </div>
    );
  }

  // Cari max values untuk normalisasi tinggi grafik
  const maxSpend = Math.max(...activeData.map((d) => d.spend || 0), 1);
  const maxResults = Math.max(...activeData.map((d) => d.results || 0), 1);

  // Dimensi SVG
  const width = 800;
  const height = 260;
  const padding = { top: 30, right: 40, bottom: 45, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const stepX = chartWidth / (activeData.length > 1 ? activeData.length - 1 : 1);
  const barWidth = Math.max(12, Math.min(36, chartWidth / activeData.length - 14));

  // Titik koordinat garis Hasil
  const linePoints = activeData.map((d, i) => {
    const x = padding.left + (activeData.length > 1 ? i * stepX : chartWidth / 2);
    const yRatio = (d.results || 0) / maxResults;
    const y = padding.top + chartHeight - yRatio * chartHeight;
    return { x, y, data: d, index: i };
  });

  const pathD = linePoints.reduce(
    (acc, curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`),
    ''
  );

  return (
    <div style={styles.container} className="card">
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>{chartTitle}</h3>
          <p style={styles.subtitle}>
            {t('ads.trend.subtitle')}
          </p>
        </div>

        <div style={styles.controls}>
          {dailyData.length > 0 && (
            <div style={styles.toggleGroup}>
              <button
                onClick={() => { setViewMode('monthly'); setHoveredPoint(null); }}
                style={{
                  ...styles.toggleBtn,
                  ...(viewMode === 'monthly' ? styles.toggleBtnActive : {}),
                }}
              >
                {t('ads.trend.last6Months')}
              </button>
              <button
                onClick={() => { setViewMode('daily'); setHoveredPoint(null); }}
                style={{
                  ...styles.toggleBtn,
                  ...(viewMode === 'daily' ? styles.toggleBtnActive : {}),
                }}
              >
                {t('ads.trend.dailyPoints', { count: activeData.length })}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={styles.legendBar} />
          <span>{t('ads.trend.legendSpend')}</span>
        </div>
        <div style={styles.legendItem}>
          <div style={styles.legendLine} />
          <span>{t('ads.trend.legendResults')}</span>
        </div>
      </div>

      {/* Area SVG Grafik */}
      <div style={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={styles.svg}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Grid lines horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding.top + chartHeight - pct * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--border-muted)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                {/* Label Sumbu Kiri (Spend) */}
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="11"
                  fontFamily="var(--font-sans)"
                >
                  {formatCompactIDR(pct * maxSpend)}
                </text>
              </g>
            );
          })}

          {/* Batang Spend */}
          {activeData.map((d, i) => {
            const xCenter = padding.left + (activeData.length > 1 ? i * stepX : chartWidth / 2);
            const x = xCenter - barWidth / 2;
            const barHeight = ((d.spend || 0) / maxSpend) * chartHeight;
            const y = padding.top + chartHeight - barHeight;
            const isHovered = hoveredPoint?.index === i;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  rx="4"
                  fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradient)'}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={() => setHoveredPoint({ index: i, data: d, x: xCenter, y })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {/* Label Sumbu X */}
                <text
                  x={xCenter}
                  y={height - 12}
                  textAnchor="middle"
                  fill={isHovered ? 'var(--text-primary)' : 'var(--text-muted)'}
                  fontSize="11"
                  fontWeight={isHovered ? '600' : '400'}
                  fontFamily="var(--font-sans)"
                >
                  {d[labelKey]}
                </text>
              </g>
            );
          })}

          {/* Garis Hasil (Results) */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Titik Lingkaran Hasil */}
          {linePoints.map((pt, i) => {
            const isHovered = hoveredPoint?.index === i;
            return (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 6 : 4}
                fill="#10b981"
                stroke="#09090b"
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={() => setHoveredPoint({ index: i, data: pt.data, x: pt.x, y: pt.y })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredPoint && (
          <div
            style={{
              ...styles.tooltip,
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${Math.max(10, (hoveredPoint.y / height) * 100 - 20)}%`,
            }}
          >
            <div style={styles.tooltipTitle}>{hoveredPoint.data[labelKey]}</div>
            <div style={styles.tooltipRow}>
              <span style={{ color: 'var(--accent-cyan)' }}>{t('ads.trend.tooltipSpend')}</span>
              <strong>{formatIDR(hoveredPoint.data.spend)}</strong>
            </div>
            <div style={styles.tooltipRow}>
              <span style={{ color: 'var(--accent-green)' }}>{t('ads.trend.tooltipResults')}</span>
              <strong>{formatNumber(hoveredPoint.data.results)} {t('ads.trend.conversionsUnit')}</strong>
            </div>
            {hoveredPoint.data.roas && (
              <div style={styles.tooltipRow}>
                <span style={{ color: 'var(--accent-yellow)' }}>{t('ads.trend.tooltipRoas')}</span>
                <strong>{formatRoas(hoveredPoint.data.roas)}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '1.5rem',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    position: 'relative',
  },
  emptyContainer: {
    padding: '2.5rem',
    textAlign: 'center',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '0.25rem',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleGroup: {
    display: 'inline-flex',
    padding: '0.2rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  toggleBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  toggleBtnActive: {
    backgroundColor: 'var(--bg-surface-hover)',
    color: 'var(--text-primary)',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    marginBottom: '1rem',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  legendBar: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    backgroundColor: 'var(--accent-cyan)',
  },
  legendLine: {
    width: '14px',
    height: '3px',
    borderRadius: '2px',
    backgroundColor: 'var(--accent-green)',
  },
  svgWrapper: {
    position: 'relative',
    width: '100%',
    overflowX: 'auto',
  },
  svg: {
    width: '100%',
    height: '260px',
    display: 'block',
  },
  tooltip: {
    position: 'absolute',
    transform: 'translate(-50%, -100%)',
    backgroundColor: '#09090b',
    border: '1px solid var(--border-active)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    boxShadow: 'var(--shadow-lg)',
    pointerEvents: 'none',
    zIndex: 10,
    minWidth: '150px',
    whiteSpace: 'nowrap',
  },
  tooltipTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.35rem',
    borderBottom: '1px solid var(--border-muted)',
    paddingBottom: '0.25rem',
  },
  tooltipRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    fontSize: '0.72rem',
    lineHeight: 1.4,
  },
};
