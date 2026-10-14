import { useEffect, useMemo, useState } from 'react';
import { FileText, CheckCircle2, Clock, TrendingUp, Search, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, formatNumber } from '../lib/format';
import { api, CMS_LABEL } from '../api';

export default function AnalyticsDashboard({ me }) {
  const { lang, t } = useLanguage();
  const user = me.user;
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/keywords')
      .then(d => setKeywords(d.keywords || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = keywords.length;
    const written = keywords.filter(k => k.article).length;
    const published = keywords.filter(k => k.status === 'Published').length;
    const drafts = keywords.filter(k => k.status === 'Draft Created').length;
    const review = keywords.filter(k => k.status === 'Review Ready').length;
    const errors = keywords.filter(k => k.status === 'Error').length;
    const words = keywords.reduce((s, k) => s + (k.article?.wordCount || 0), 0);
    const volume = keywords.reduce((s, k) => s + (Number(k.volume) || 0), 0);
    const byCms = {};
    keywords.forEach(k => { byCms[k.cms] = (byCms[k.cms] || 0) + 1; });

    // 8 minggu terakhir: artikel dibuat per minggu
    const weeks = [...Array(8)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (7 - i) * 7);
      return {
        label: formatDate(d, lang, { day: '2-digit', month: 'short' }),
        count: 0,
        ts: d.getTime(),
      };
    });

    keywords.forEach(k => {
      const t = k.lastRunAt ? new Date(k.lastRunAt).getTime() : null;
      if (!t) return;
      for (let i = weeks.length - 1; i >= 0; i--) {
        if (t >= weeks[i].ts) {
          weeks[i].count++;
          break;
        }
      }
    });

    return { total, written, published, drafts, review, errors, words, volume, byCms, weeks };
  }, [keywords, lang]);

  const maxWeek = Math.max(1, ...stats.weeks.map(w => w.count));
  const top = [...keywords].filter(k => k.volume).sort((a, b) => b.volume - a.volume).slice(0, 8);
  const limit = me.usage?.limit || 0;
  const used = me.usage?.runsThisMonth || 0;

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>{lang.startsWith('id') ? 'Analitik & Insights' : 'Analytics & Insights'}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {lang.startsWith('id')
            ? `Ringkasan produksi konten ${user.brandName} di Markimate. Data performa Google Search Console per artikel akan menyusul.`
            : `Content production summary for ${user.brandName} in Markimate. Google Search Console performance data per article coming soon.`}
        </p>
      </header>

      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <Kpi
          icon={FileText}
          color="var(--accent-cyan)"
          label={lang.startsWith('id') ? 'Artikel dibuat' : 'Articles created'}
          value={stats.written}
          sub={`${used}/${limit || '∞'} ${lang.startsWith('id') ? 'kuota bulan ini' : 'quota this month'}`}
        />
        <Kpi
          icon={CheckCircle2}
          color="var(--accent-green)"
          label={lang.startsWith('id') ? 'Terbit di CMS' : 'Published to CMS'}
          value={stats.published}
          sub={`${stats.drafts} ${lang.startsWith('id') ? 'masih draf' : 'still drafts'}`}
        />
        <Kpi
          icon={Clock}
          color="var(--accent-yellow)"
          label={lang.startsWith('id') ? 'Menunggu review' : 'Awaiting review'}
          value={stats.review}
          sub={stats.errors ? `${stats.errors} error` : (lang.startsWith('id') ? 'tidak ada error' : 'no errors')}
        />
        <Kpi
          icon={TrendingUp}
          color="var(--accent-blue)"
          label={lang.startsWith('id') ? 'Total volume target' : 'Total target volume'}
          value={formatNumber(stats.volume, lang)}
          sub={`${formatNumber(stats.words, lang)} ${lang.startsWith('id') ? 'kata ditulis' : 'words written'}`}
        />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ fontSize: '1rem' }}>
            {lang.startsWith('id') ? 'Artikel per minggu (8 minggu)' : 'Articles per week (8 weeks)'}
          </h2>
          <div style={styles.chart}>
            {stats.weeks.map(w => (
              <div key={w.label} style={styles.barCol} title={`${w.count} ${lang.startsWith('id') ? 'artikel' : 'articles'}`}>
                <div style={{ ...styles.bar, height: `${Math.max(4, (w.count / maxWeek) * 140)}px` }} />
                <span style={styles.barLabel}>{w.label}</span>
              </div>
            ))}
          </div>
          <div style={{ ...styles.sub, marginTop: '0.75rem' }}>
            {lang.startsWith('id') ? 'Distribusi CMS:' : 'CMS Distribution:'}{' '}
            {Object.keys(stats.byCms).length
              ? Object.entries(stats.byCms).map(([c, n]) => `${CMS_LABEL[c] || c} ${n}`).join(' · ')
              : '–'}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-muted)' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={16} />
              {lang.startsWith('id') ? 'Keyword dengan volume tertinggi' : 'Highest volume keywords'}
            </h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang.startsWith('id') ? 'Keyword target' : 'Target keyword'}</th>
                  <th>Volume</th>
                  <th>KD</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} style={styles.empty}>
                      {lang.startsWith('id') ? 'Memuat…' : 'Loading…'}
                    </td>
                  </tr>
                )}
                {!loading && !top.length && (
                  <tr>
                    <td colSpan={4} style={styles.empty}>
                      {lang.startsWith('id') ? 'Belum ada data riset. Jalankan keyword dulu.' : 'No research data yet. Run keyword generation first.'}
                    </td>
                  </tr>
                )}
                {top.map(k => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{k.article?.primaryKeyword || k.keyword}</div>
                      <div style={styles.sub}>{k.keyword}</div>
                    </td>
                    <td>{formatNumber(Number(k.volume) || 0, lang)}</td>
                    <td>{k.difficulty ?? '–'}</td>
                    <td>
                      <span className="badge badge-secondary">{k.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', opacity: 0.8 }}>
        <AlertTriangle size={16} color="var(--text-muted)" />
        <span style={styles.sub}>
          {lang.startsWith('id')
            ? 'Integrasi Google Search Console (klik & impresi per artikel) sedang disiapkan oleh 3Our dan akan muncul di halaman ini untuk pelanggan Pro.'
            : 'Google Search Console integration (clicks & impressions per article) is being prepared by 3Our and will be available on this page for Pro subscribers.'}
        </span>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value, sub }) {
  return (
    <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <div
        style={{
          padding: '0.6rem',
          borderRadius: 10,
          backgroundColor: color.replace(')', ', 0.15)').replace('var(', 'color-mix(in srgb, ').replace(', 0.15)', ' 15%, transparent)'),
        }}
      >
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={styles.sub}>{label}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={styles.sub}>{sub}</div>
      </div>
    </div>
  );
}

const styles = {
  sub: { fontSize: '0.78rem', color: 'var(--text-muted)' },
  chart: { display: 'flex', alignItems: 'flex-end', gap: '0.6rem', height: '180px', padding: '0.5rem 0' },
  barCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', height: '100%' },
  bar: { width: '100%', borderRadius: '6px 6px 2px 2px', background: 'linear-gradient(180deg, var(--accent-cyan), rgba(6,182,212,0.35))' },
  barLabel: { fontSize: '0.65rem', color: 'var(--text-muted)' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' },
};
