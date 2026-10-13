import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api';
import MarkimateLogo from '../../components/common/MarkimateLogo';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(token ? '' : 'Tautan reset tidak valid atau tidak memiliki token.');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Token reset tidak ditemukan pada tautan.');
      return;
    }
    if (password.length < 10) {
      setError('Kata sandi minimal 10 karakter untuk standar keamanan.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    try {
      setLoading(true);
      await api('/api/auth/reset', {
        method: 'POST',
        body: { token, password }
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Tautan reset tidak valid atau telah kadaluarsa.');
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
          <p className="auth-subtitle">Buat Kata Sandi Baru</p>
        </div>

        {success ? (
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
              Kata Sandi Berhasil Diatur Ulang!
            </h2>

            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
              Kata sandi akun Anda telah diperbarui. Semua sesi perangkat lama telah dicabut demi keamanan akun Anda. Silakan masuk dengan kata sandi baru.
            </p>

            <button
              onClick={() => navigate('/login')}
              className="auth-btn-primary"
            >
              <span>Masuk Sekarang</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div className="auth-alert-box auth-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-field-label">Kata Sandi Baru</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Minimal 10 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <div style={{
                  fontSize: '0.75rem',
                  color: password.length >= 10 ? 'var(--accent-green, #10b981)' : 'var(--text-secondary)',
                  marginTop: '2px'
                }}>
                  {password.length >= 10 ? '✓ Panjang kata sandi memenuhi syarat' : '• Minimal 10 karakter'}
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-field-label">Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Ulangi kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={loading || !token}
              >
                <span>{loading ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}</span>
                <KeyRound size={16} />
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <Link
                to="/login"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--accent-cyan)',
                  textDecoration: 'none',
                  fontWeight: 500
                }}
              >
                ← Kembali ke Halaman Masuk
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
