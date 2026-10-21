import { useState, useEffect } from 'react';
import { LocalizedLink } from '../../lib/localized-router';
import { AppLink } from '../../lib/hosts';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Bell,
  Terminal,
  BarChart2,
  Eye,
  Share2,
  PieChart,
  TrendingUp,
  MessageSquare,
  Users,
  Star,
  Sliders,
  Send,
  Target,
  Activity,
  ShoppingBag,
  Compass,
  Zap,
  HelpCircle,
  ExternalLink,
  Coins,
} from 'lucide-react';
import {
  ROLES,
  AVAILABLE_ROLES,
  SOON_ROLES,
  ACTIVE_ROLES_COUNT,
  TOTAL_ROLES_COUNT,
  getLocalizedRoles,
  getLocalizedCategories,
} from '../../config/roles';
import {
  BUNDLES,
  TEAM_COST_BENCHMARK,
  getLocalizedInHouseComparison,
  formatIDR,
  formatCurrency,
  TRIAL,
  CREDIT_PRICE_IDR,
  MODULES,
  LIFETIME_BUNDLES,
  TOPUP,
} from '../../config/pricing';
import TopupCalculator from '../../components/common/TopupCalculator';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import WaitlistModal from '../../components/common/WaitlistModal';
import SeoHead from '../../components/common/SeoHead';
import { useLanguage } from '../../context/LanguageContext';

// Pemeta ikon Lucide untuk kartu role
const ICON_MAP = {
  Terminal,
  BarChart2,
  Eye,
  Share2,
  PieChart,
  TrendingUp,
  Sparkles,
  MessageSquare,
  Users,
  Star,
  Sliders,
  Send,
  Target,
  Activity,
  ShoppingBag,
  Compass,
};

export default function LandingPage({ scrollToPricing = false }) {
  const { t, lang } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeWaitlistRole, setActiveWaitlistRole] = useState(null);

  useEffect(() => {
    if (scrollToPricing || window.location.hash === '#pricing' || window.location.pathname.endsWith('/pricing')) {
      const el = document.getElementById('pricing');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    }
  }, [scrollToPricing]);

  const localizedRoles = getLocalizedRoles(lang);
  const localizedCategories = getLocalizedCategories(lang);

  // Filter daftar role berdasarkan kategori
  const filteredRoles =
    selectedCategory === 'all'
      ? localizedRoles
      : localizedRoles.filter((r) => r.category === selectedCategory);

  const allInOneBundle = BUNDLES.find((b) => b.key === 'all_in_one');
  const managedBundle = BUNDLES.find((b) => b.key === 'managed');

  return (
    <div style={styles.page}>
      <SeoHead path="/" />
      <PublicNavbar />

      <main style={styles.main}>
        {/* 1. Hero Section */}
        <section style={styles.hero}>
          <div style={styles.heroBadgeRow}>
            <span style={styles.heroBadge}>
              <Sparkles size={14} color="var(--accent-cyan)" />
              {t('hero.badge', 'Markimate · powered by 3our')}
            </span>
          </div>

          <h1 style={styles.heroTitle}>
            {t('hero.title', 'Full Digital Marketing Team in One Platform')}
          </h1>

          <p style={styles.heroSubtitle}>
            {t(
              'hero.subtitle',
              'Hire specialized AI marketing roles or deploy an entire full-stack digital marketing team — at a fraction of in-house team costs, with 100% human-in-the-loop review and approval before anything goes live.'
            )}
          </p>

          <div style={styles.heroCtas}>
            <AppLink to="/register" style={styles.primaryCta}>
              <span>{t('hero.ctaPrimary', { credits: TRIAL.credits, days: TRIAL.days }, `Start Free — ${TRIAL.credits} credits, ${TRIAL.days} days`)}</span>
              <ArrowRight size={16} />
            </AppLink>
            <a href="#pricing" style={styles.secondaryCta}>
              {t('hero.ctaSecondary', 'View Plans & Pricing')}
            </a>
          </div>

          <div style={styles.trialHighlightCard}>
            <Coins size={16} color="var(--accent-cyan)" />
            <span>
              {t('hero.trialBanner', { days: TRIAL.days, credits: TRIAL.credits }, `${TRIAL.days}-Day Free Trial — ${TRIAL.credits} credits, all modules unlocked, zero credit card required`)}
            </span>
            <AppLink to="/register" style={styles.trialLink}>
              {t('hero.claimNow', 'Claim Now →')}
            </AppLink>
          </div>

          <div style={styles.heroProof}>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>{t('hero.proof1', { activeRoles: ACTIVE_ROLES_COUNT })}</span>
            </div>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>{t('hero.proof2', { soonRoles: SOON_ROLES.length })}</span>
            </div>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>{t('hero.proof3', 'Human-in-the-Loop Editorial Approval')}</span>
            </div>
          </div>
        </section>

        {/* 2. Grid "Tim Kamu" (16 Role) */}
        <section id="roles" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>
              {t('rolesGrid.sectionTitle', { totalRoles: TOTAL_ROLES_COUNT })}
            </h2>
            <p style={styles.sectionSub}>
              {t('rolesGrid.sectionSubtitle', { totalRoles: TOTAL_ROLES_COUNT })}
            </p>

            {/* Filter Kategori */}
            <div style={styles.categoryFilters} className="mobile-horizontal-scroll">
              {localizedCategories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    ...styles.categoryTab,
                    ...(selectedCategory === cat.key ? styles.categoryTabActive : {}),
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.rolesGrid}>
            {filteredRoles.map((role) => {
              const IconComp = ICON_MAP[role.iconName] || Sparkles;
              const isAvail = role.status === 'available';

              return (
                <div
                  key={role.key}
                  style={{
                    ...styles.roleCard,
                    ...(isAvail ? styles.roleCardAvailable : {}),
                  }}
                  className="card"
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.cardIconBox}>
                      <IconComp
                        size={22}
                        color={isAvail ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                      />
                    </div>
                    {isAvail ? (
                      <span style={styles.badgeAvailable}>
                        <span style={styles.greenDot} /> {t('rolesGrid.statusAvailable', 'Active & Ready')}
                      </span>
                    ) : (
                      <span style={styles.badgeSoon}>
                        {t('rolesGrid.statusSoon', 'Coming Soon')}
                      </span>
                    )}
                  </div>

                  <div style={styles.cardBody}>
                    <div style={styles.roleCategoryTag}>{role.category}</div>
                    <h3 style={styles.roleName}>{role.name}</h3>
                    <p style={styles.roleDescription}>{role.description}</p>
                  </div>

                  <div style={styles.cardFooter}>
                    {isAvail ? (
                      <LocalizedLink to={`/roles/${role.key}`} style={styles.learnMoreLink}>
                        <span>{t('rolesGrid.viewDetails', 'Role Details')}</span>
                        <ArrowRight size={14} />
                      </LocalizedLink>
                    ) : (
                      <button
                        onClick={() => setActiveWaitlistRole(role)}
                        style={styles.waitlistBtn}
                      >
                        <Bell size={13} />
                        <span>{t('rolesGrid.joinWaitlist', 'Join Waitlist')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Cara Kerja (3 Langkah) */}
        <section id="how-it-works" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>{t('howItWorks.title', 'How It Works: 3 Steps to Autonomous Growth')}</h2>
            <p style={styles.sectionSub}>
              {t(
                'howItWorks.subtitle',
                'Markimate blends autonomous AI execution with strict human oversight so your brand stays high-quality, authentic, and protected.'
              )}
            </p>
          </div>

          <div style={styles.stepsGrid}>
            <div style={styles.stepCard} className="card">
              <div style={styles.stepNumber}>1</div>
              <h3 style={styles.stepTitle}>{t('howItWorks.step1Title', '1. Connect & Configure')}</h3>
              <p style={styles.stepDesc}>
                {t(
                  'howItWorks.step1Desc',
                  'Link your CMS (WordPress, Wix, Sanity, Shopify) or connect advertising channels (Meta, Google, TikTok, Shopee). Set your brand voice, guidelines, and target keywords.'
                )}
              </p>
            </div>

            <div style={styles.stepCard} className="card">
              <div style={styles.stepNumber}>2</div>
              <h3 style={styles.stepTitle}>{t('howItWorks.step2Title', '2. Autonomous Execution & Intelligence')}</h3>
              <p style={styles.stepDesc}>
                {t(
                  'howItWorks.step2Desc',
                  'AI specialists conduct trend research, draft SEO content, track competitor ad libraries, and consolidate multi-channel performance data 24/7.'
                )}
              </p>
            </div>

            <div style={styles.stepCard} className="card">
              <div style={styles.stepNumber}>3</div>
              <h3 style={styles.stepTitle}>{t('howItWorks.step3Title', '3. Human-in-the-Loop Approval')}</h3>
              <p style={styles.stepDesc}>
                {t(
                  'howItWorks.step3Desc',
                  'Review drafts in the editorial drawer, tweak ad insights, and publish directly to your store or CMS with a single click. Zero hallucinations published without your sign-off.'
                )}
              </p>
            </div>
          </div>
        </section>

        {/* 4. Perbandingan Biaya (Tim In-House vs Markimate) */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>{t('benchmark.title', 'Cost Comparison: In-House Team vs Agency vs Markimate')}</h2>
            <p style={styles.sectionSub}>
              {t(
                'benchmark.subtitle',
                'Compare the typical monthly investment required to run a full digital marketing team.'
              )}
            </p>
          </div>

          <div style={styles.comparisonWrapper} className="card">
            <div style={styles.comparisonHeader}>
              <div style={{ flex: '1 1 280px' }}>
                <span style={styles.comparisonBadge}>
                  {t('benchmark.savingsBadge', 'Cost Savings Calculator')}
                </span>
                <h3 style={styles.comparisonTitle}>
                  {t('benchmark.savingsTitle', 'Save Up to 89% on Marketing Operating Costs')}
                </h3>
              </div>
              <div style={styles.benchmarkBox}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t('benchmark.inhouse3Title', 'In-House 3-Role Payroll:')}
                </span>
                <span style={styles.inHouseTotal}>{formatIDR(TEAM_COST_BENCHMARK.focus3, lang)}{t('benchmark.perMonth', '/ mo')}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: '700' }}>
                  {t('benchmark.focus3Badge', { amount: formatCurrency(3200000, lang) }, `Markimate Focus 3: ${formatCurrency(3200000, lang)}/mo`)}
                </span>
              </div>
            </div>

            {/* Desktop / Tablet View (Structured Table) */}
            <div className="comp-table-desktop">
              <div style={styles.tableScroll}>
                <table style={styles.comparisonTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{t('benchmark.thRole', 'Specialist Role')}</th>
                      <th style={styles.th}>{t('benchmark.thDeliverables', 'Monthly Deliverables')}</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>
                        {t('benchmark.thInHouse', 'Avg In-House Payroll')}
                      </th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>
                        {t('benchmark.thMarkimate', 'Markimate Cost')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getLocalizedInHouseComparison(lang).map((row, idx) => {
                      return (
                        <tr key={idx} style={styles.tr}>
                          <td style={styles.td}>
                            <strong>{row.roleName}</strong>
                          </td>
                          <td style={styles.td}>{row.deliverablesText}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>
                            <span style={{ textDecoration: 'line-through' }}>
                              {formatIDR(row.inHouseMonthly, lang)}
                            </span>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <strong style={{ color: 'var(--accent-cyan)' }}>
                              {formatIDR(row.markimateMonthly || row.supermatMonthly, lang)}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={styles.totalRow}>
                      <td style={styles.tdTotal} colSpan={2}>
                        <strong>{t('benchmark.totalTitle', 'Total Monthly Investment (3 Core Focus Pillars)')}</strong>
                      </td>
                      <td style={{ ...styles.tdTotal, textAlign: 'right', color: 'var(--text-muted)' }}>
                        <strong>{formatIDR(TEAM_COST_BENCHMARK.focus3, lang)} {t('benchmark.perMonth', '/ mo')}</strong>
                      </td>
                      <td style={{ ...styles.tdTotal, textAlign: 'right' }}>
                        <strong style={{ color: 'var(--accent-green)', fontSize: '1.05rem' }}>
                          {formatCurrency(3200000, lang)} {t('benchmark.perMonth', '/ mo')} ({t('benchmark.totalDiscount', 'Discount Bundle')})
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View (Touch-Friendly Responsive Cards) */}
            <div className="comp-cards-mobile">
              {getLocalizedInHouseComparison(lang).map((row, idx) => {
                return (
                  <div key={idx} style={styles.mobileCompCard}>
                    <div style={styles.mobileCompHeader}>
                      <span style={styles.mobileCompRoleTitle}>{row.roleName}</span>
                      <span style={styles.mobileCompSavingsBadge}>
                        {t('benchmark.saveTag', 'Save')} {row.savingsPct}%
                      </span>
                    </div>
                    <p style={styles.mobileCompDeliverables}>{row.deliverablesText}</p>
                    <div style={styles.mobileCompPriceGrid}>
                      <div style={styles.mobileCompPriceBox}>
                        <span style={styles.mobileCompPriceLabel}>
                          {t('benchmark.thInHouse', 'In-House Payroll')}
                        </span>
                        <span style={styles.mobileCompInhouseVal}>
                          {formatIDR(row.inHouseMonthly, lang)}
                        </span>
                      </div>
                      <div style={{ ...styles.mobileCompPriceBox, textAlign: 'right' }}>
                        <span style={styles.mobileCompPriceLabel}>
                          {t('benchmark.thMarkimate', 'Markimate')}
                        </span>
                        <span style={styles.mobileCompMarkimateVal}>
                          {formatIDR(row.markimateMonthly || row.supermatMonthly, lang)} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('benchmark.perMonth', '/ mo')}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Total Focus 3 Summary Card for Mobile */}
              <div style={styles.mobileTotalCard}>
                <div style={styles.mobileTotalHeader}>
                  <span style={styles.mobileTotalBadge}>
                    {t('benchmark.focus3MobileBadge', 'Focus 3 Bundle · Save 89%')}
                  </span>
                  <h4 style={styles.mobileTotalTitle}>
                    {t('benchmark.totalTitle', 'Total Monthly Investment')}
                  </h4>
                </div>

                <div style={styles.mobileTotalRow}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                      {t('benchmark.inhouseRolesLabel', 'In-House 3 Roles')}
                    </span>
                    <span style={styles.mobileTotalInhouse}>
                      {formatIDR(TEAM_COST_BENCHMARK.focus3, lang)}{t('benchmark.perMonth', '/ mo')}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 600, display: 'block' }}>
                      {t('benchmark.bundleMarkimateLabel', 'Markimate Bundle')}
                    </span>
                    <span style={styles.mobileTotalMarkimate}>
                      {formatCurrency(3200000, lang)}{t('benchmark.perMonthShort', '/mo')}
                    </span>
                  </div>
                </div>

                <div style={styles.mobileTotalNote}>
                  <Sparkles size={14} color="var(--accent-green)" style={{ flexShrink: 0 }} />
                  <span>{t('benchmark.saveMonthlyNote', { amount: formatCurrency(26175000, lang) }, `You save ${formatCurrency(26175000, lang)} every month`)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Paket & Harga (#pricing) */}
        <section id="pricing" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>{t('bundles.title', 'Flexible Plans for Every Stage of Growth')}</h2>
            <p style={styles.sectionSub}>
              {t(
                'bundles.subtitle',
                'Pick standalone roles for specific bottlenecks, or deploy bundled packages for compound growth.'
              )}
            </p>
          </div>

          <div style={styles.pricingTrialBanner} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={styles.trialBadgeIcon}>
                <Coins size={22} color="var(--accent-cyan)" />
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {t('bundles.pricingTrialTitle', { days: TRIAL.days, credits: TRIAL.credits })}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {t('bundles.pricingTrialDesc', { credits: TRIAL.credits, rate: formatCurrency(CREDIT_PRICE_IDR, lang) })}
                </div>
              </div>
              <AppLink to="/register" style={styles.trialCtaBtn}>
                {t('bundles.pricingTrialBtn', 'Start Free Trial')}
              </AppLink>
            </div>
          </div>

          {/* Bundle Fokus 3 Hero Card (Best Value) */}
          <div className="focus3-hero-card" style={{ marginBottom: '1.5rem' }}>
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

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '1rem' }}>
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
                <AppLink to="/register" className="focus3-cta-btn">
                  <span>{t('bundles.ctaBuyModule')}</span>
                  <ArrowRight size={16} />
                </AppLink>
              </div>
            </div>
          </div>

          {/* 3 Modul Lifetime Grid */}
          <div className="pricing-lifetime-grid">
            {/* 1. SEO */}
            <div className="plan-card card" style={styles.planCard}>
              <span className="plan-badge" style={styles.planBadge}>{t('bundles.lifetimeBadge')}</span>
              <h3 className="plan-name" style={styles.planName}>{t('bundles.seoTitle')}</h3>
              <p className="plan-desc" style={styles.planDesc}>{t('bundles.seoDesc')}</p>
              <div className="plan-price-row" style={styles.planPriceRow}>
                <span className="plan-price-val" style={styles.planPriceVal}>{formatCurrency(MODULES.seo.price, lang)}</span>
                <span className="plan-period" style={styles.planPeriod}>{t('bundles.oneTime')}</span>
              </div>
              <div className="plan-credit-grant">
                <Coins size={15} color="var(--accent-cyan)" />
                <span>{t('bundles.monthlyCreditsForever', { credits: MODULES.seo.monthlyCredits })}</span>
              </div>
              <ul className="plan-features" style={styles.planFeatures}>
                <li>{t('bundles.seoFeat1')}</li>
                <li>{t('bundles.seoFeat2')}</li>
                <li>{t('bundles.seoFeat3')}</li>
                <li>{t('bundles.seoFeat4', { credits: MODULES.seo.monthlyCredits })}</li>
              </ul>
              <AppLink to="/register" style={styles.planBtnSecondary}>
                {t('bundles.ctaSelect')}
              </AppLink>
            </div>

            {/* 2. Ads Report */}
            <div className="plan-card card" style={styles.planCard}>
              <span className="plan-badge" style={styles.planBadge}>{t('bundles.lifetimeBadge')}</span>
              <h3 className="plan-name" style={styles.planName}>{t('bundles.adsReportTitle')}</h3>
              <p className="plan-desc" style={styles.planDesc}>{t('bundles.adsReportDesc')}</p>
              <div className="plan-price-row" style={styles.planPriceRow}>
                <span className="plan-price-val" style={styles.planPriceVal}>{formatCurrency(MODULES.ads_report.price, lang)}</span>
                <span className="plan-period" style={styles.planPeriod}>{t('bundles.oneTime')}</span>
              </div>
              <div className="plan-credit-grant">
                <Coins size={15} color="var(--accent-cyan)" />
                <span>{t('bundles.monthlyCreditsForever', { credits: MODULES.ads_report.monthlyCredits })}</span>
              </div>
              <ul className="plan-features" style={styles.planFeatures}>
                <li>{t('bundles.adsReportFeat1')}</li>
                <li>{t('bundles.adsReportFeat2')}</li>
                <li>{t('bundles.adsReportFeat3')}</li>
                <li>{t('bundles.adsReportFeat4', { credits: MODULES.ads_report.monthlyCredits })}</li>
              </ul>
              <AppLink to="/register" style={styles.planBtnSecondary}>
                {t('bundles.ctaSelect')}
              </AppLink>
            </div>

            {/* 3. Ads Spy */}
            <div className="plan-card card" style={styles.planCard}>
              <span className="plan-badge" style={styles.planBadge}>{t('bundles.lifetimeBadge')}</span>
              <h3 className="plan-name" style={styles.planName}>{t('bundles.adsSpyTitle')}</h3>
              <p className="plan-desc" style={styles.planDesc}>{t('bundles.adsSpyDesc')}</p>
              <div className="plan-price-row" style={styles.planPriceRow}>
                <span className="plan-price-val" style={styles.planPriceVal}>{formatCurrency(MODULES.ads_spy.price, lang)}</span>
                <span className="plan-period" style={styles.planPeriod}>{t('bundles.oneTime')}</span>
              </div>
              <div className="plan-credit-grant">
                <Coins size={15} color="var(--accent-cyan)" />
                <span>{t('bundles.monthlyCreditsForever', { credits: MODULES.ads_spy.monthlyCredits })}</span>
              </div>
              <ul className="plan-features" style={styles.planFeatures}>
                <li>{t('bundles.adsSpyFeat1')}</li>
                <li>{t('bundles.adsSpyFeat2')}</li>
                <li>{t('bundles.adsSpyFeat3')}</li>
                <li>{t('bundles.adsSpyFeat4', { credits: MODULES.ads_spy.monthlyCredits })}</li>
              </ul>
              <AppLink to="/register" style={styles.planBtnSecondary}>
                {t('bundles.ctaSelect')}
              </AppLink>
            </div>
          </div>

          {/* Topup Calculator Section */}
          <div style={{ marginTop: '2.5rem' }}>
            <div style={styles.sectionHeader}>
              <h3 style={{ ...styles.sectionHeading, fontSize: '1.4rem' }}>{t('bundles.topupSectionTitle')}</h3>
              <p style={styles.sectionSub}>
                {t('bundles.topupSectionSubtitle', { min: TOPUP.min })}
              </p>
            </div>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <TopupCalculator isPublic={true} initialCredits={500} />
            </div>
          </div>
        </section>

        {/* 6. Ekosistem Integrasi */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>{t('integrations.title', 'Integrated with the Tools You Use Every Day')}</h2>
            <p style={styles.sectionSub}>
              {t(
                'integrations.subtitle',
                'Direct API connections to top publishing CMS platforms, advertising networks, and e-commerce ecosystems.'
              )}
            </p>
          </div>

          <div style={styles.integrationPills}>
            <span style={styles.intPill}>Meta Ads (FB & IG)</span>
            <span style={styles.intPill}>Google Ads & PMax</span>
            <span style={styles.intPill}>TikTok Ads API</span>
            <span style={styles.intPill}>TikTok Shop | Tokopedia</span>
            <span style={styles.intPill}>Shopee Ads & Open Platform</span>
            <span style={styles.intPill}>WordPress REST API</span>
            <span style={styles.intPill}>Wix Headless</span>
            <span style={styles.intPill}>Sanity CMS</span>
            <span style={styles.intPill}>Shopify Blog</span>
          </div>
        </section>

        {/* 7. FAQ Section */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>{t('faq.title', 'Frequently Asked Questions')}</h2>
            <p style={styles.sectionSub}>{t('faq.subtitle', 'Everything you need to know about Markimate and our AI marketing roles.')}</p>
          </div>

          <div style={styles.faqList}>
            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q1')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a1')}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q2')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a2')}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q3')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a3')}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q4')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a4', { rate: formatCurrency(CREDIT_PRICE_IDR, lang) })}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q5', { days: TRIAL.days, credits: TRIAL.credits })}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a5', { days: TRIAL.days, credits: TRIAL.credits, totalRoles: TOTAL_ROLES_COUNT })}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q6')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a6')}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q7')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a7')}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q8')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a8')}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q9')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a9', { days: 7 })}
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                {t('faq.q10')}
              </h4>
              <p style={styles.faqAnswer}>
                {t('faq.a10', { min: TOPUP.min, rate: formatCurrency(TOPUP.pricePerCredit, lang) })}
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section style={styles.ctaBannerSection}>
          <div style={styles.ctaBannerBox} className="card">
            <Zap size={32} color="var(--accent-cyan)" style={{ marginBottom: '1rem' }} />
            <h2 style={styles.ctaBannerTitle}>{t('finalCta.title', 'Ready to Scale Your Marketing with AI?')}</h2>
            <p style={styles.ctaBannerSub}>
              {t('finalCta.subtitle', { days: TRIAL.days, credits: TRIAL.credits }, `Try all features with your own real data and website for ${TRIAL.days} days. ${TRIAL.credits} free credits, zero credit card required.`)}
            </p>
            <div style={styles.ctaBannerBtns}>
              <AppLink to="/register" style={styles.primaryCta}>
                <span>{t('finalCta.btnTrial', { days: TRIAL.days }, `Start ${TRIAL.days}-Day Free Trial`)}</span>
                <ArrowRight size={16} />
              </AppLink>
              <a href="#roles" style={styles.secondaryCta}>
                {t('finalCta.btnRoles', { count: ROLES.length }, `Browse ${ROLES.length} Roles`)}
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Modal Waitlist untuk Role 'soon' */}
      {activeWaitlistRole && (
        <WaitlistModal
          role={activeWaitlistRole}
          onClose={() => setActiveWaitlistRole(null)}
        />
      )}

      <PublicFooter />
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-primary)',
  },
  main: {
    flex: 1,
    padding: 'clamp(1.25rem, 3vw, 2rem) clamp(0.75rem, 3vw, 1.5rem) 4rem clamp(0.75rem, 3vw, 1.5rem)',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  hero: {
    textAlign: 'center',
    padding: 'clamp(2rem, 5vw, 3.5rem) 0.5rem clamp(2.5rem, 5vw, 4rem) 0.5rem',
    maxWidth: '860px',
    margin: '0 auto',
  },
  heroBadgeRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.35rem 0.85rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    color: 'var(--accent-cyan)',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 'clamp(1.75rem, 5.5vw, 2.75rem)',
    fontWeight: '800',
    letterSpacing: '-0.03em',
    lineHeight: 1.2,
    marginBottom: '1.25rem',
    color: 'var(--text-primary)',
  },
  heroSubtitle: {
    fontSize: 'clamp(0.875rem, 2.5vw, 1.05rem)',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '2rem',
  },
  heroCtas: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.85rem',
    flexWrap: 'wrap',
    marginBottom: '2.5rem',
  },
  primaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.8rem 1.6rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontSize: '0.925rem',
    fontWeight: '700',
    textDecoration: 'none',
    boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)',
  },
  secondaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.8rem 1.6rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.925rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  heroProof: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
    marginTop: '0.5rem',
  },
  proofItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  section: {
    marginBottom: '5rem',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  sectionHeading: {
    fontSize: 'clamp(1.35rem, 4vw, 2rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
    letterSpacing: '-0.02em',
  },
  sectionSub: {
    fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)',
    color: 'var(--text-muted)',
    maxWidth: '680px',
    margin: '0 auto',
    lineHeight: 1.5,
  },
  categoryFilters: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '1.5rem',
  },
  categoryTab: {
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  categoryTabActive: {
    backgroundColor: 'var(--bg-surface-hover)',
    color: 'var(--accent-cyan)',
    borderColor: 'var(--accent-cyan)',
    fontWeight: '600',
  },
  rolesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(270px, 100%), 1fr))',
    gap: '1.25rem',
  },
  roleCard: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
  },
  roleCardAvailable: {
    borderColor: 'rgba(6, 182, 212, 0.3)',
    boxShadow: '0 4px 12px rgba(6, 182, 212, 0.05)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  cardIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAvailable: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: 'var(--accent-green)',
    fontSize: '0.72rem',
    fontWeight: '600',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  greenDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-green)',
  },
  badgeSoon: {
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(113, 113, 122, 0.12)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '500',
    border: '1px solid rgba(113, 113, 122, 0.2)',
  },
  cardBody: {
    flex: 1,
    marginBottom: '1.25rem',
  },
  roleCategoryTag: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.35rem',
  },
  roleName: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
    lineHeight: 1.3,
  },
  roleDescription: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  cardFooter: {
    borderTop: '1px solid var(--border-muted)',
    paddingTop: '0.85rem',
  },
  learnMoreLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    color: 'var(--accent-cyan)',
    fontSize: '0.825rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  waitlistBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: '500',
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
    transition: 'all var(--transition-fast)',
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
    gap: '1.25rem',
  },
  stepCard: {
    padding: 'clamp(1.25rem, 3vw, 2rem) clamp(1rem, 3vw, 1.75rem)',
    position: 'relative',
  },
  stepNumber: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontSize: '1.1rem',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  stepTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.65rem',
  },
  stepDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    margin: 0,
  },
  comparisonWrapper: {
    padding: 'clamp(1rem, 3vw, 2rem)',
    overflow: 'hidden',
  },
  comparisonHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1.25rem',
    marginBottom: '1.75rem',
  },
  comparisonBadge: {
    fontSize: '0.725rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    display: 'block',
    marginBottom: '0.25rem',
  },
  comparisonTitle: {
    fontSize: 'clamp(1.15rem, 3.5vw, 1.35rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  benchmarkBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: 'var(--bg-base)',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-muted)',
    maxWidth: '100%',
  },
  inHouseTotal: {
    fontSize: '1.1rem',
    fontWeight: '800',
    color: 'var(--accent-red)',
    textDecoration: 'line-through',
  },
  tableScroll: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    width: '100%',
  },
  comparisonTable: {
    width: '100%',
    minWidth: '520px',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    padding: '0.75rem 0.85rem',
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    borderBottom: '1px solid var(--border-muted)',
    textAlign: 'left',
  },
  tr: {
    borderBottom: '1px solid var(--border-muted)',
  },
  td: {
    padding: '0.8rem 0.85rem',
    color: 'var(--text-secondary)',
  },
  totalRow: {
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  tdTotal: {
    padding: '0.85rem',
    borderTop: '2px solid var(--border-active)',
    color: 'var(--text-primary)',
  },
  // Mobile Comparison Cards
  mobileCompCard: {
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '12px',
    padding: '1.15rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  mobileCompHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  mobileCompRoleTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  mobileCompSavingsBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-green)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    whiteSpace: 'nowrap',
  },
  mobileCompDeliverables: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  mobileCompPriceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--border-muted)',
  },
  mobileCompPriceBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  mobileCompPriceLabel: {
    fontSize: '0.675rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: '600',
  },
  mobileCompInhouseVal: {
    fontSize: '0.9rem',
    color: 'var(--accent-red)',
    textDecoration: 'line-through',
    fontWeight: '600',
  },
  mobileCompMarkimateVal: {
    fontSize: '0.975rem',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
  },
  mobileTotalCard: {
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    borderRadius: '12px',
    padding: '1.25rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  mobileTotalHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  mobileTotalBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  mobileTotalTitle: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  mobileTotalRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: '0.75rem 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  mobileTotalInhouse: {
    fontSize: '0.85rem',
    color: 'var(--accent-red)',
    textDecoration: 'line-through',
    fontWeight: '600',
  },
  mobileTotalMarkimate: {
    fontSize: '1.15rem',
    color: 'var(--accent-green)',
    fontWeight: '800',
  },
  mobileTotalNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.78rem',
    color: 'var(--accent-green)',
    fontWeight: '600',
  },
  pricingCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
    gap: '1.25rem',
  },
  planCard: {
    padding: 'clamp(1.25rem, 3vw, 1.75rem)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    borderRadius: '12px',
  },
  planCardFeatured: {
    borderColor: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
    boxShadow: '0 8px 24px rgba(6, 182, 212, 0.12)',
  },
  planBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  planBadgeFeatured: {
    fontSize: '0.7rem',
    fontWeight: '800',
    color: '#000000',
    backgroundColor: 'var(--accent-cyan)',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    alignSelf: 'flex-start',
    marginBottom: '0.5rem',
  },
  planBadgePreorder: {
    fontSize: '0.7rem',
    fontWeight: '800',
    color: 'var(--accent-yellow)',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    alignSelf: 'flex-start',
    marginBottom: '0.5rem',
  },
  planName: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.35rem',
  },
  planDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginBottom: '1rem',
    minHeight: '2.4rem',
  },
  planPriceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    marginBottom: '0.5rem',
  },
  planPriceVal: {
    fontSize: '1.65rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  planPeriod: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  discountBadge: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: 'var(--accent-green)',
    marginBottom: '1rem',
  },
  preorderNotice: {
    fontSize: '0.72rem',
    color: 'var(--accent-yellow)',
    marginBottom: '1rem',
  },
  planFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 1.5rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    flex: 1,
  },
  planBtnPrimary: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontWeight: '700',
    fontSize: '0.85rem',
    textAlign: 'center',
    textDecoration: 'none',
  },
  planBtnSecondary: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '0.85rem',
    textAlign: 'center',
    textDecoration: 'none',
  },
  planBtnContact: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid var(--accent-green)',
    color: 'var(--accent-green)',
    fontWeight: '700',
    fontSize: '0.85rem',
    textAlign: 'center',
    textDecoration: 'none',
  },
  integrationPills: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.75rem',
    maxWidth: '900px',
    margin: '0 auto',
  },
  intPill: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.825rem',
    fontWeight: '500',
  },
  faqList: {
    maxWidth: '850px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  faqItem: {
    padding: '1.5rem',
  },
  faqQuestion: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  faqAnswer: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: 0,
    paddingLeft: '1.75rem',
  },
  ctaBannerSection: {
    marginBottom: '2rem',
  },
  ctaBannerBox: {
    padding: 'clamp(1.75rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem)',
    textAlign: 'center',
    borderRadius: '16px',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    background:
      'linear-gradient(180deg, rgba(6, 182, 212, 0.08) 0%, rgba(9, 9, 11, 0.95) 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  ctaBannerTitle: {
    fontSize: 'clamp(1.35rem, 4.5vw, 1.85rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  ctaBannerSub: {
    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
    color: 'var(--text-secondary)',
    maxWidth: '640px',
    marginBottom: '1.75rem',
    lineHeight: 1.5,
  },
  ctaBannerBtns: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.85rem',
    flexWrap: 'wrap',
  },
  trialHighlightCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.6rem 1.1rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.35)',
    color: '#67e8f9',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginTop: '0.5rem',
    marginBottom: '1.75rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '100%',
    lineHeight: 1.4,
  },
  trialLink: {
    color: 'var(--accent-cyan)',
    fontWeight: 700,
    textDecoration: 'underline',
    marginLeft: '0.35rem',
    whiteSpace: 'nowrap',
  },
  pricingTrialBanner: {
    marginBottom: '2rem',
    padding: '1.25rem 1.5rem',
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    border: '1px solid rgba(6, 182, 212, 0.35)',
    borderRadius: '12px',
  },
  trialBadgeIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trialCtaBtn: {
    padding: '0.6rem 1.25rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#09090b',
    fontWeight: 700,
    fontSize: '0.85rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
  },
};
