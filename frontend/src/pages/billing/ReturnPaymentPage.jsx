import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, AlertCircle, ArrowLeft, Wallet } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../api';
import { formatIDR } from '../../lib/format';

export default function ReturnPaymentPage() {
  const [searchParams] = useSearchParams();
  const invoice = searchParams.get('invoice') || '';
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!invoice) {
      setLoading(false);
      setErrorMsg(t('billing.returnMissingInvoice'));
      return;
    }

    let isMounted = true;
    let timerId = null;

    const checkStatus = async () => {
      try {
        const data = await api(`/api/billing/payments/${encodeURIComponent(invoice)}`);
        if (!isMounted) return;

        setPayment(data);
        setLoading(false);

        // Jika sudah final (paid, failed, expired, refunded), stop polling
        if (['paid', 'failed', 'expired', 'refunded'].includes(data.status)) {
          if (data.status === 'paid') {
            window.dispatchEvent(new Event('markimate:credits_updated'));
            window.dispatchEvent(new Event('supermat:credits_updated'));
          }
          return;
        }

        // Lanjutkan polling setiap 3 detik hingga maks 40x (120 detik)
        if (pollCount < 40) {
          timerId = setTimeout(() => {
            setPollCount(c => c + 1);
          }, 3000);
        }
      } catch (err) {
        if (!isMounted) return;
        setLoading(false);
        setErrorMsg(err.message || t('billing.returnLoadError'));
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [invoice, pollCount, t]);

  const status = payment?.status || 'pending';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {loading && (
          <div style={styles.centerBox}>
            <div style={styles.spinner} />
            <h2 style={styles.title}>{t('billing.returnCheckingTitle')}</h2>
            <p style={styles.desc}>{t('billing.returnCheckingDesc')}</p>
          </div>
        )}

        {!loading && errorMsg && (
          <div style={styles.centerBox}>
            <AlertCircle size={48} color="#ef4444" style={styles.statusIcon} />
            <h2 style={styles.title}>{t('billing.returnFailedTitle')}</h2>
            <p style={styles.desc}>{errorMsg}</p>
            <button
              type="button"
              className="btn btn-secondary"
              style={styles.actionBtn}
              onClick={() => navigate('/app/billing/credits')}
            >
              <ArrowLeft size={16} />
              {t('billing.returnBackToWallet')}
            </button>
          </div>
        )}

        {!loading && !errorMsg && status === 'paid' && (
          <div style={styles.centerBox}>
            <CheckCircle2 size={56} color="#10b981" style={styles.statusIcon} />
            <h2 style={styles.title}>{t('billing.returnPaidTitle')}</h2>
            <p style={styles.desc}>
              {t('billing.returnPaidDesc', { item: payment?.itemName || t('billing.packageDefault') })}
            </p>

            <div style={styles.detailBox}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>{t('billing.returnInvoiceNo')}</span>
                <span style={styles.detailVal}>{payment?.invoiceNumber}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>{t('billing.returnAmount')}</span>
                <span style={styles.detailVal}>{formatIDR(payment?.amount || 0)}</span>
              </div>
              {payment?.credits ? (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>{t('billing.returnCreditsAdded')}</span>
                  <span style={{ ...styles.detailVal, color: '#059669', fontWeight: 700 }}>
                    +{payment.credits} {t('billing.creditsUnit')}
                  </span>
                </div>
              ) : null}
              {payment?.method && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>{t('billing.returnMethod')}</span>
                  <span style={styles.detailVal}>{payment.method}</span>
                </div>
              )}
            </div>

            <div style={styles.buttonGroup}>
              <button
                type="button"
                className="btn btn-primary"
                style={styles.actionBtn}
                onClick={() => navigate('/app/billing/credits')}
              >
                <Wallet size={16} />
                {t('billing.returnBackToWallet')}
              </button>
            </div>
          </div>
        )}

        {!loading && !errorMsg && status === 'pending' && (
          <div style={styles.centerBox}>
            <Clock size={56} color="#f59e0b" style={styles.statusIcon} />
            <h2 style={styles.title}>{t('billing.returnPendingTitle')}</h2>
            <p style={styles.desc}>{t('billing.returnPendingDesc')}</p>

            <div style={styles.detailBox}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>{t('billing.returnInvoiceNo')}</span>
                <span style={styles.detailVal}>{payment?.invoiceNumber}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>{t('billing.returnAmount')}</span>
                <span style={styles.detailVal}>{formatIDR(payment?.amount || 0)}</span>
              </div>
            </div>

            <div style={styles.buttonGroup}>
              {payment?.checkoutUrl && (
                <a
                  href={payment.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={styles.actionBtn}
                >
                  {t('billing.returnContinuePayment')}
                </a>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                style={styles.actionBtn}
                onClick={() => navigate('/app/billing/credits')}
              >
                {t('billing.returnBackToWallet')}
              </button>
            </div>
          </div>
        )}

        {!loading && !errorMsg && (status === 'expired' || status === 'failed' || status === 'refunded') && (
          <div style={styles.centerBox}>
            <XCircle size={56} color="#ef4444" style={styles.statusIcon} />
            <h2 style={styles.title}>
              {status === 'expired' ? t('billing.returnExpiredTitle') : t('billing.returnFailedTitle')}
            </h2>
            <p style={styles.desc}>
              {status === 'expired' ? t('billing.returnExpiredDesc') : t('billing.returnFailedDesc')}
            </p>

            <div style={styles.buttonGroup}>
              <button
                type="button"
                className="btn btn-primary"
                style={styles.actionBtn}
                onClick={() => navigate('/app/billing/credits')}
              >
                {t('billing.returnTryAgain')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '560px',
    margin: '32px auto',
    padding: '0 16px',
    width: '100%',
    boxSizing: 'border-box'
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '32px 24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
  },
  centerBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  statusIcon: {
    marginBottom: '16px'
  },
  spinner: {
    width: '44px',
    height: '44px',
    border: '4px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 8px 0',
    lineHeight: '1.3'
  },
  desc: {
    fontSize: '14px',
    color: '#64748b',
    margin: '0 0 24px 0',
    lineHeight: '1.5'
  },
  detailBox: {
    width: '100%',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
    boxSizing: 'border-box'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px dashed #e2e8f0',
    fontSize: '14px'
  },
  detailLabel: {
    color: '#64748b'
  },
  detailVal: {
    color: '#0f172a',
    fontWeight: '600',
    overflowWrap: 'anywhere'
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%'
  },
  actionBtn: {
    width: '100%',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: '600'
  }
};
