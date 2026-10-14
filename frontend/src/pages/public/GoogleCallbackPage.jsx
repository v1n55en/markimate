import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, KeyRound, AlertCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { setToken, API_BASE_URL } from '../../api.js';

export default function GoogleCallbackPage({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('processing'); // 'processing' | 'link_required' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [emailToLink, setEmailToLink] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);

  const exchangeStartedRef = useRef(false);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const handleExchange = useCallback(async (authCode, authState) => {
    try {
      setStatus('processing');

      const res = await fetch(`${API_BASE_URL}/api/auth/google/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: authCode,
          state: authState
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.code === 'LINK_PASSWORD_REQUIRED') {
          setStatus('link_required');
          setEmailToLink(data.email || '');
          setPendingToken(data.pendingToken || '');
          return;
        }
        throw new Error(data.error || 'Terjadi kesalahan saat memproses login Google.');
      }

      setStatus('success');
      if (data.accessToken) {
        setToken(data.accessToken);
      }
      if (onLogin) {
        onLogin(data.user, data.accessToken);
      }

      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 700);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Gagal menghubungkan dengan Google.');
    }
  }, [navigate, onLogin]);

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      setErrorMessage(
        errorParam === 'access_denied'
          ? 'Otorisasi Google dibatalkan oleh pengguna.'
          : `Gagal otorisasi Google: ${errorParam}`
      );
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMessage('Parameter otorisasi Google tidak lengkap.');
      return;
    }

    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    handleExchange(code, state);
  }, [code, state, errorParam, handleExchange]);

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!linkPassword || !pendingToken) return;
    try {
      setSubmittingLink(true);
      setErrorMessage('');

      const res = await fetch(`${API_BASE_URL}/api/auth/google/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pendingToken,
          password: linkPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menautkan akun Google.');
      }

      setStatus('success');
      if (data.accessToken) {
        setToken(data.accessToken);
      }
      if (onLogin) {
        onLogin(data.user, data.accessToken);
      }

      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 700);
    } catch (err) {
      setErrorMessage(err.message || 'Gagal menautkan akun.');
    } finally {
      setSubmittingLink(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-box">
        {status === 'processing' && (
          <div className="callback-status-box">
            <div className="callback-icon-circle callback-icon-cyan">
              <Loader2 size={36} className="animate-spin" />
            </div>
            <h2 className="callback-title">Menghubungkan Akun Google…</h2>
            <p className="callback-desc">
              Sedang memverifikasi data dan menyiapkan sesi workspace Anda. Mohon tunggu sebentar.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="callback-status-box">
            <div className="callback-icon-circle callback-icon-green">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="callback-title">Berhasil Masuk!</h2>
            <p className="callback-desc">
              Mengarahkan Anda ke dashboard Markimate…
            </p>
          </div>
        )}

        {status === 'link_required' && (
          <div>
            <div className="callback-header-row">
              <div className="callback-header-icon">
                <Lock size={22} />
              </div>
              <div className="callback-header-text">
                <h2>Tautkan Akun Google</h2>
                <p>Verifikasi keamanan kepemilikan akun</p>
              </div>
            </div>

            <div className="callback-info-callout">
              Email <strong>{emailToLink}</strong> sudah terdaftar di Markimate menggunakan kata sandi. Masukkan kata sandi akun Anda untuk menautkannya dengan akun Google ini demi mencegah pengambilalihan akun yang tidak sah.
            </div>

            {errorMessage && (
              <div className="auth-error-alert" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLinkSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-field-label">Kata Sandi Markimate Anda</label>
                <div className="auth-input-wrapper">
                  <input
                    type="password"
                    className="auth-input"
                    placeholder="Masukkan kata sandi akun saat ini"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <KeyRound size={16} className="auth-input-icon" />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingLink || !linkPassword}
                className="btn btn-primary"
                style={{ width: '100%', minHeight: '44px', fontWeight: 600, fontSize: '15px' }}
              >
                {submittingLink ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Memverifikasi…</span>
                  </>
                ) : (
                  <span>Konfirmasi & Tautkan Akun</span>
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Link to="/login" className="callback-cancel-link">
                <ArrowLeft size={14} />
                <span>Batalkan dan kembali ke login</span>
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="callback-status-box">
            <div className="callback-icon-circle callback-icon-red">
              <AlertCircle size={36} />
            </div>
            <h2 className="callback-title">Gagal Masuk dengan Google</h2>
            <p className="callback-desc">
              {errorMessage || 'Terjadi kesalahan yang tidak terduga saat mencoba menghubungkan akun.'}
            </p>
            <div style={{ width: '100%' }}>
              <Link
                to="/login"
                className="btn btn-primary"
                style={{ width: '100%', minHeight: '44px', textDecoration: 'none', fontWeight: 600 }}
              >
                <ArrowLeft size={16} />
                <span>Kembali ke Halaman Masuk</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
