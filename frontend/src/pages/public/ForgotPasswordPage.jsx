import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api';
import MarkimateLogo from '../../components/common/MarkimateLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const em = email.trim().toLowerCase();
    if (!em) {
      setError('Harap masukkan alamat email Anda.');
      return;
    }

    try {
      setLoading(true);
      await api('/api/auth/forgot', {
        method: 'POST',
        body: { email: em }
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Gagal mengirim permintaan atur ulang kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-box">
        {/* Header Logo */}
        <div className="auth-header">
          <Link to="/" style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '0.5rem' }}>
            <MarkimateLogo size={36} />
          </Link>
          <h1 className="auth-title">Markimate</h1>
          <p className="auth-subtitle">Atur Ulang Kata Sandi Akun Anda</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto'
            }}>
              <CheckCircle2 size={38} color="#10b981" />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              Periksa Inbox Email Anda
            </h2>

            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
              Jika alamat <strong>{email}</strong> terdaftar di Markimate, kami telah mengirimkan tautan pemulihan kata sandi. Tautan tersebut berlaku selama <strong>30 menit</strong>.
            </p>

            <Link
              to="/login"
              className="auth-btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Halaman Masuk</span>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Masukkan alamat email yang terdaftar pada akun Markimate Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
            </p>

            {error && (
              <div className="auth-alert-box auth-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-field-label">Alamat Email</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="nama@bisnis.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={loading}
              >
                <span>{loading ? 'Mengirimkan…' : 'Kirim Tautan Atur Ulang'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <Link
                to="/login"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--accent-cyan)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowLeft size={14} />
                <span>Kembali ke Halaman Masuk</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
