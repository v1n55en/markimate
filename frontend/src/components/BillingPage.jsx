import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Building2,
  ShieldCheck,
  Sparkles,
  Check,
  Layers,
  ExternalLink,
  Crown,
  FileText,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  MODULE_PRICES,
  MODULE_QUOTA,
  formatIDR,
  calculatePricing,
} from '../config/pricing';
import { ROLES } from '../config/roles';

const PAYMENT_METHODS = [
  { id: 'qris', label: 'QRIS Instant', icon: QrCode, note: 'GoPay, OVO, DANA, ShopeePay, BCA' },
  { id: 'va', label: 'Virtual Account', icon: Building2, note: 'BCA, Mandiri, BNI, BRI' },
  { id: 'card', label: 'Kartu Kredit / Debit', icon: CreditCard, note: 'Visa, Mastercard' },
];

export default function BillingPage({ refreshMe }) {
  const { activeWorkspace, updateWorkspace } = useWorkspace();

  const [billingCycle, setBillingCycle] = useState(
    activeWorkspace?.billingCycle || 'monthly'
  );

  // Modul terpilih untuk checkout (default modul aktif di workspace)
  const [selectedModules, setSelectedModules] = useState(() => {
    return activeWorkspace?.modules && activeWorkspace.modules.length > 0
      ? activeWorkspace.modules
      : ['seo', 'ads_report', 'ads_spy'];
  });

  const [selectedMethod, setSelectedMethod] = useState('qris');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { ok: boolean, text: string }

  // Sinkronisasi saat activeWorkspace berganti
  useEffect(() => {
    if (activeWorkspace?.modules) {
      setSelectedModules(activeWorkspace.modules);
    }
    if (activeWorkspace?.billingCycle) {
      setBillingCycle(activeWorkspace.billingCycle);
    }
  }, [activeWorkspace?.id, activeWorkspace?.modules, activeWorkspace?.billingCycle]);

  const pricing = calculatePricing({
    selectedModules,
    billingCycle,
  });

  const handleToggleModule = (modKey) => {
    if (selectedModules.includes(modKey)) {
      if (selectedModules.length === 1) {
        alert('Minimal harus memilih 1 modul untuk workspace.');
        return;
      }
      setSelectedModules((prev) => prev.filter((m) => m !== modKey));
    } else {
      setSelectedModules((prev) => [...prev, modKey]);
    }
  };

  const handleSelectBundleFocus3 = () => {
    setSelectedModules(['seo', 'ads_report', 'ads_spy']);
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);

    setTimeout(() => {
      // Simpan perubahan ke activeWorkspace
      updateWorkspace(activeWorkspace.id, {
        modules: selectedModules,
        billingCycle,
        plan: pricing.appliedBundle || 'custom',
      });

      // Tambahkan riwayat tagihan mock ke localStorage
      const newInvoice = {
        invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        workspaceName: activeWorkspace.name,
        modules: selectedModules,
        amount: pricing.totalToPay,
        cycle: billingCycle,
        status: 'Lunas',
      };

      try {
        const historyKey = `supermat_billing_history_${activeWorkspace.id}`;
        const existing = JSON.parse(localStorage.getItem(historyKey) || '[]');
        localStorage.setItem(historyKey, JSON.stringify([newInvoice, ...existing]));
      } catch {
        // abaikan
      }

      setNotice({
        ok: true,
        text: `Langganan berhasil diperbarui! Seluruh ${selectedModules.length} modul aktif di ${activeWorkspace.name}.`,
      });
      setBusy(false);

      if (refreshMe) {
        refreshMe();
      }
    }, 600);
  };

  const handleCancelModule = (modKey) => {
    if (selectedModules.length <= 1) {
      alert('Tidak bisa membatalkan semua modul. Minimal 1 modul harus aktif.');
      return;
    }
    const nextModules = selectedModules.filter((m) => m !== modKey);
    setSelectedModules(nextModules);
    updateWorkspace(activeWorkspace.id, { modules: nextModules });
    setNotice({
      ok: true,
      text: `Modul "${modKey}" telah dinonaktifkan untuk ${activeWorkspace.name}.`,
    });
  };

  // Riwayat tagihan
  const historyKey = `supermat_billing_history_${activeWorkspace?.id}`;
  const historyList = (() => {
    try {
      const stored = localStorage.getItem(historyKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // abaikan
    }
    return [
      {
        invoiceNo: 'INV-849201',
        date: '2026-09-01T08:00:00Z',
        workspaceName: activeWorkspace?.name || 'Workspace',
        modules: activeWorkspace?.modules || ['seo', 'ads_report', 'ads_spy'],
        amount: 3200000,
        cycle: 'monthly',
        status: 'Lunas',
      },
    ];
  })();

  const isFocus3Selected =
    selectedModules.length === 3 &&
    ['seo', 'ads_report', 'ads_spy'].every((m) => selectedModules.includes(m));

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
              <h1 style={styles.title}>Langganan & Paket Modular</h1>
              <span style={styles.brandTag}>Workspace: {activeWorkspace?.name}</span>
            </div>
            <p style={styles.subtitle}>
              Pilih spesialis AI yang Anda butuhkan. Bayar satuan atau ambil bundle diskon. Semua biaya infrastruktur, scraping, dan komputasi AI sudah termasuk.
            </p>
          </div>
        </div>

        {/* Toggle Bulanan / Tahunan */}
        <div style={styles.cycleToggleContainer}>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            style={{
              ...styles.cycleBtn,
              ...(billingCycle === 'monthly' ? styles.cycleBtnActive : {}),
            }}
          >
            Bulanan
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            style={{
              ...styles.cycleBtn,
              ...(billingCycle === 'yearly' ? styles.cycleBtnActive : {}),
            }}
          >
            <span>Tahunan</span>
            <span style={styles.saveBadge}>Hemat 2 Bln</span>
          </button>
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

      {/* 2. Grid Dua Kolom: Pilihan Modul vs Ringkasan Checkout */}
      <div style={styles.mainGrid}>
        {/* Kolom Kiri: Pilihan Modul & Bundle */}
        <div style={styles.leftColumn}>
          <div style={styles.sectionHeadingRow}>
            <h3 style={styles.sectionHeading}>Pilih Modul AI (Role Tersedia)</h3>
            <span style={styles.sectionSubText}>
              {selectedModules.length} dari 3 modul dipilih
            </span>
          </div>

          <div style={styles.modulesSelectionList}>
            {/* 1. SEO Specialist */}
            <div
              onClick={() => handleToggleModule('seo')}
              style={{
                ...styles.moduleChoiceCard,
                ...(selectedModules.includes('seo') ? styles.moduleChoiceSelected : {}),
              }}
              className="card"
            >
              <div style={styles.choiceHeader}>
                <div style={styles.choiceCheckboxBox}>
                  <div
                    style={{
                      ...styles.checkbox,
                      backgroundColor: selectedModules.includes('seo')
                        ? 'var(--accent-cyan)'
                        : 'transparent',
                    }}
                  >
                    {selectedModules.includes('seo') && <Check size={12} color="#000000" />}
                  </div>
                  <div>
                    <strong style={styles.choiceName}>SEO Specialist</strong>
                    <span style={styles.choiceCategory}>Konten & Organik</span>
                  </div>
                </div>

                <div style={styles.choicePriceBlock}>
                  <span style={styles.choicePrice}>
                    {formatIDR(MODULE_PRICES.seo)}
                  </span>
                  <span style={styles.choicePeriod}>/ bulan</span>
                </div>
              </div>

              <p style={styles.choiceDesc}>
                Riset keyword otomatis, penulisan artikel mendalam 1.200+ kata, dan penerbitan ke WordPress/Wix.
              </p>
              <div style={styles.choiceQuota}>
                <Layers size={13} color="var(--accent-cyan)" />
                <span>Kuota: {MODULE_QUOTA.seo}</span>
              </div>
            </div>

            {/* 2. Ads Specialist (Report) */}
            <div
              onClick={() => handleToggleModule('ads_report')}
              style={{
                ...styles.moduleChoiceCard,
                ...(selectedModules.includes('ads_report') ? styles.moduleChoiceSelected : {}),
              }}
              className="card"
            >
              <div style={styles.choiceHeader}>
                <div style={styles.choiceCheckboxBox}>
                  <div
                    style={{
                      ...styles.checkbox,
                      backgroundColor: selectedModules.includes('ads_report')
                        ? 'var(--accent-cyan)'
                        : 'transparent',
                    }}
                  >
                    {selectedModules.includes('ads_report') && (
                      <Check size={12} color="#000000" />
                    )}
                  </div>
                  <div>
                    <strong style={styles.choiceName}>
                      Ads Specialist — Report Semua Platform
                    </strong>
                    <span style={styles.choiceCategory}>Periklanan Berbayar</span>
                  </div>
                </div>

                <div style={styles.choicePriceBlock}>
                  <span style={styles.choicePrice}>
                    {formatIDR(MODULE_PRICES.ads_report)}
                  </span>
                  <span style={styles.choicePeriod}>/ bulan</span>
                </div>
              </div>

              <p style={styles.choiceDesc}>
                Konsolidasi laporan bulanan Meta, Google, TikTok, GMV Max, dan Shopee Ads dengan analitik ROAS AI.
              </p>
              <div style={styles.choiceQuota}>
                <Layers size={13} color="var(--accent-cyan)" />
                <span>Kuota: {MODULE_QUOTA.ads_report}</span>
              </div>
            </div>

            {/* 3. Ads Creative Spy */}
            <div
              onClick={() => handleToggleModule('ads_spy')}
              style={{
                ...styles.moduleChoiceCard,
                ...(selectedModules.includes('ads_spy') ? styles.moduleChoiceSelected : {}),
              }}
              className="card"
            >
              <div style={styles.choiceHeader}>
                <div style={styles.choiceCheckboxBox}>
                  <div
                    style={{
                      ...styles.checkbox,
                      backgroundColor: selectedModules.includes('ads_spy')
                        ? 'var(--accent-cyan)'
                        : 'transparent',
                    }}
                  >
                    {selectedModules.includes('ads_spy') && (
                      <Check size={12} color="#000000" />
                    )}
                  </div>
                  <div>
                    <strong style={styles.choiceName}>Ads Creative Spy</strong>
                    <span style={styles.choiceCategory}>Riset & Intelijen</span>
                  </div>
                </div>

                <div style={styles.choicePriceBlock}>
                  <span style={styles.choicePrice}>
                    {formatIDR(MODULE_PRICES.ads_spy)}
                  </span>
                  <span style={styles.choicePeriod}>/ bulan</span>
                </div>
              </div>

              <p style={styles.choiceDesc}>
                Pantau pergerakan iklan kompetitor di Meta Ad Library, kurasi creative winning, dan bongkar pola hook.
              </p>
              <div style={styles.choiceQuota}>
                <Layers size={13} color="var(--accent-cyan)" />
                <span>Kuota: {MODULE_QUOTA.ads_spy}</span>
              </div>
            </div>
          </div>

          {/* Kartu Promo Paket Bundle Lainnya */}
          <div style={styles.bundleSection}>
            <h3 style={styles.sectionHeading}>Pilihan Paket Spesial & Bundle</h3>

            <div style={styles.bundlesGrid}>
              {/* Bundle Fokus 3 Card */}
              <div
                style={{
                  ...styles.bundleCard,
                  ...(isFocus3Selected ? styles.bundleCardSelected : {}),
                }}
                className="card"
              >
                <div style={styles.bundleBadgeRow}>
                  <span style={styles.popularBadge}>Diskon 20%</span>
                  {isFocus3Selected && (
                    <span style={styles.bundleActiveTag}>Terpilih</span>
                  )}
                </div>
                <h4 style={styles.bundleTitle}>Paket Fokus 3</h4>
                <p style={styles.bundleDesc}>
                  Gabungan 3 pilar: SEO Specialist + Ads Reporting + Creative Spy.
                </p>
                <div style={styles.bundlePriceRow}>
                  <span style={styles.strikePrice}>Rp 4.000.000</span>
                  <strong style={styles.bundlePrice}>Rp 3.200.000</strong>
                  <span style={styles.perMonth}>/ bln</span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectBundleFocus3}
                  style={styles.selectBundleBtn}
                >
                  {isFocus3Selected ? 'Paket Aktif Dipilih' : 'Pilih Bundle Fokus 3'}
                </button>
              </div>

              {/* All-in-One Pre-order Card */}
              <div style={styles.bundleCard} className="card">
                <div style={styles.bundleBadgeRow}>
                  <span style={styles.preorderBadge}>Pre-Order Eksklusif</span>
                </div>
                <h4 style={styles.bundleTitle}>All-in-One AI Team</h4>
                <p style={styles.bundleDesc}>
                  Seluruh 16 role tim marketing AI. Modul baru aktif otomatis saat rilis.
                </p>
                <div style={styles.bundlePriceRow}>
                  <strong style={styles.bundlePrice}>Rp 7.875.000</strong>
                  <span style={styles.perMonth}>/ bln</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      'Pre-order All-in-One AI Team berhasil dicatat! Tim 3Our akan segera mengaktifkan akses awal untuk workspace Anda.'
                    )
                  }
                  style={styles.preorderBtn}
                >
                  <Sparkles size={14} />
                  <span>Pre-Order Sekarang</span>
                </button>
              </div>

              {/* Managed by 3Our Card */}
              <div style={styles.bundleCard} className="card">
                <div style={styles.bundleBadgeRow}>
                  <span style={styles.managedBadge}>Layanan Agensi</span>
                </div>
                <h4 style={styles.bundleTitle}>Managed by 3Our</h4>
                <p style={styles.bundleDesc}>
                  Layanan penuh terkelola. Tim agensi 3Our mengoperasikan platform untuk Anda.
                </p>
                <div style={styles.bundlePriceRow}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Konsultasi & Penawaran Kustom
                  </span>
                </div>
                <a
                  href="https://wa.me/6281234567890?text=Halo%203Our,%20saya%20tertarik%20dengan%20paket%20Managed%20by%203Our%20Supermat"
                  target="_blank"
                  rel="noreferrer"
                  style={styles.contactSalesBtn}
                >
                  <span>Hubungi Tim Sales</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Ringkasan Biaya & Form Checkout */}
        <div style={styles.rightColumn}>
          <form onSubmit={handleCheckoutSubmit} style={styles.checkoutCard} className="card">
            <h3 style={styles.checkoutTitle}>Ringkasan Tagihan</h3>
            <span style={styles.checkoutSub}>
              Siklus Pembayaran: <strong>{billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</strong>
            </span>

            {/* List Modul yang Terpilih */}
            <div style={styles.summaryItemsList}>
              {selectedModules.map((mKey) => (
                <div key={mKey} style={styles.summaryItemRow}>
                  <div style={styles.summaryItemInfo}>
                    <span style={styles.summaryItemName}>
                      {ROLES.find((r) => r.key === mKey)?.name || mKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCancelModule(mKey)}
                      style={styles.cancelModuleBtn}
                      title="Batalkan modul ini"
                    >
                      Hapus
                    </button>
                  </div>
                  <span style={styles.summaryItemPrice}>
                    {formatIDR(MODULE_PRICES[mKey])}
                  </span>
                </div>
              ))}
            </div>

            {/* Diskon Bundle Fokus 3 jika terpenuhi */}
            {pricing.appliedBundle === 'focus3' && (
              <div style={styles.discountRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={13} color="var(--accent-green)" />
                  <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>
                    Diskon Bundle Fokus 3 (20%)
                  </span>
                </div>
                <span style={{ color: 'var(--accent-green)', fontWeight: '700' }}>
                  -{formatIDR(pricing.baseMonthly * pricing.discountPercent)}
                </span>
              </div>
            )}

            {/* Diskon Tahunan (2 Bulan Gratis) jika dipilih */}
            {pricing.isYearly && (
              <div style={styles.discountRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={13} color="var(--accent-green)" />
                  <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>
                    Gratis 2 Bulan (Siklus Tahunan)
                  </span>
                </div>
                <span style={{ color: 'var(--accent-green)', fontWeight: '700' }}>
                  -{formatIDR(pricing.savingsAnnual)}
                </span>
              </div>
            )}

            {/* Total Akhir */}
            <div style={styles.totalBlock}>
              <div>
                <span style={styles.totalLabel}>Total Yang Dibayar</span>
                <span style={styles.totalBillingNote}>
                  {billingCycle === 'yearly' ? 'Untuk 12 bulan penuh' : 'Per bulan'}
                </span>
              </div>
              <strong style={styles.totalAmount}>
                {formatIDR(pricing.totalToPay)}
              </strong>
            </div>

            {/* Pemilihan Metode Pembayaran */}
            <div style={styles.paymentMethodsBlock}>
              <label style={styles.paymentMethodLabel}>Metode Pembayaran Simulasi</label>
              <div style={styles.methodsList}>
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const isSelected = selectedMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      style={{
                        ...styles.methodBtn,
                        ...(isSelected ? styles.methodBtnSelected : {}),
                      }}
                    >
                      <Icon
                        size={17}
                        color={isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)'}
                      />
                      <div style={styles.methodInfo}>
                        <strong style={styles.methodTitle}>{m.label}</strong>
                        <span style={styles.methodNote}>{m.note}</span>
                      </div>
                      {isSelected && <Check size={14} color="var(--accent-cyan)" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tombol Eksekusi Checkout */}
            <button
              type="submit"
              disabled={busy || selectedModules.length === 0}
              style={styles.checkoutSubmitBtn}
            >
              {busy ? (
                <span>Memproses Checkout…</span>
              ) : (
                <>
                  <Crown size={16} />
                  <span>
                    Bayar & Aktifkan {selectedModules.length} Modul ({formatIDR(pricing.totalToPay)})
                  </span>
                </>
              )}
            </button>

            <div style={styles.dummyNotice}>
              <ShieldCheck size={14} color="var(--text-muted)" />
              <span>
                Mode simulasi demo: klik langsung mengaktifkan modul tanpa tagihan kartu nyata.
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* 3. Riwayat Tagihan (Invoices) */}
      <div style={styles.historyCard} className="card">
        <div style={styles.historyHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileText size={16} color="var(--accent-cyan)" />
            <h3 style={styles.historyTitle}>Riwayat Faktur & Tagihan</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Faktur untuk {activeWorkspace?.name}
          </span>
        </div>

        <div style={styles.historyTableWrapper}>
          <table style={styles.historyTable}>
            <thead>
              <tr style={styles.historyThRow}>
                <th style={styles.historyTh}>No. Faktur</th>
                <th style={styles.historyTh}>Tanggal</th>
                <th style={styles.historyTh}>Modul / Paket</th>
                <th style={styles.historyTh}>Total</th>
                <th style={styles.historyTh}>Siklus</th>
                <th style={styles.historyTh}>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyList.map((item, idx) => (
                <tr key={idx} style={styles.historyTr}>
                  <td style={styles.historyTd}>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.invoiceNo}</strong>
                  </td>
                  <td style={styles.historyTd}>
                    {new Date(item.date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td style={styles.historyTd}>
                    {Array.isArray(item.modules)
                      ? item.modules.join(', ')
                      : 'Modul Aktif'}
                  </td>
                  <td style={styles.historyTd}>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatIDR(item.amount)}
                    </strong>
                  </td>
                  <td style={styles.historyTd}>
                    <span style={{ textTransform: 'capitalize' }}>{item.cycle}</span>
                  </td>
                  <td style={styles.historyTd}>
                    <span style={styles.paidStatusBadge}>
                      <Check size={11} />
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '1.75rem',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    overflowY: 'auto',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    flex: 1,
    minWidth: '280px',
  },
  headerIconBox: {
    width: '44px',
    height: '44px',
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
    fontSize: '1.45rem',
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
  cycleToggleContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  cycleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  cycleBtnActive: {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  saveBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
  },
  noticeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.85rem 1.1rem',
    borderRadius: '8px',
    border: '1px solid transparent',
    fontSize: '0.85rem',
    fontWeight: '500',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.45fr 1fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  sectionHeadingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '-0.5rem',
  },
  sectionHeading: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  sectionSubText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  modulesSelectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  moduleChoiceCard: {
    padding: '1.25rem',
    borderRadius: '10px',
    border: '1px solid var(--border-muted)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  moduleChoiceSelected: {
    borderColor: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
    boxShadow: '0 0 0 1px var(--accent-cyan)',
  },
  choiceHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  choiceCheckboxBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceName: {
    display: 'block',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
  },
  choiceCategory: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  choicePriceBlock: {
    textAlign: 'right',
  },
  choicePrice: {
    fontSize: '1rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  choicePeriod: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  choiceDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  choiceQuota: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  bundleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  bundlesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
  },
  bundleCard: {
    padding: '1.25rem',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '0.85rem',
    border: '1px solid var(--border-muted)',
  },
  bundleCardSelected: {
    borderColor: 'var(--accent-green)',
    boxShadow: '0 0 0 1px var(--accent-green)',
  },
  bundleBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popularBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  bundleActiveTag: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
  },
  preorderBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--accent-yellow)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  managedBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  bundleTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  bundleDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    margin: 0,
    flex: 1,
  },
  bundlePriceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
  },
  strikePrice: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
  },
  bundlePrice: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  perMonth: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  selectBundleBtn: {
    padding: '0.5rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  preorderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.5rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  contactSalesBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.5rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  rightColumn: {
    position: 'sticky',
    top: '1.5rem',
  },
  checkoutCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  checkoutTitle: {
    fontSize: '1.1rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  checkoutSub: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    marginTop: '-0.5rem',
  },
  summaryItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    paddingBottom: '0.85rem',
    borderBottom: '1px solid var(--border-muted)',
  },
  summaryItemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.825rem',
  },
  summaryItemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  summaryItemName: {
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  cancelModuleBtn: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  summaryItemPrice: {
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  discountRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.55rem 0.75rem',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: '6px',
    fontSize: '0.78rem',
  },
  totalBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 0',
    borderTop: '1px solid var(--border-muted)',
    borderBottom: '1px solid var(--border-muted)',
  },
  totalLabel: {
    display: 'block',
    fontSize: '0.825rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  totalBillingNote: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  totalAmount: {
    fontSize: '1.35rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  paymentMethodsBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  paymentMethodLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  methodsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  methodBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'all var(--transition-fast)',
  },
  methodBtnSelected: {
    borderColor: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
  },
  methodInfo: {
    flex: 1,
    minWidth: 0,
  },
  methodTitle: {
    display: 'block',
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
  },
  methodNote: {
    display: 'block',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
  },
  checkoutSubmitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.8rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
    width: '100%',
    transition: 'all var(--transition-fast)',
  },
  dummyNotice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    lineHeight: 1.35,
  },
  historyCard: {
    padding: '1.25rem 1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  historyHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  historyTableWrapper: {
    overflowX: 'auto',
  },
  historyTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.8rem',
  },
  historyThRow: {
    borderBottom: '1px solid var(--border-muted)',
  },
  historyTh: {
    padding: '0.65rem 0.85rem',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  historyTr: {
    borderBottom: '1px solid var(--border-muted)',
  },
  historyTd: {
    padding: '0.75rem 0.85rem',
    color: 'var(--text-secondary)',
  },
  paidStatusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
};
