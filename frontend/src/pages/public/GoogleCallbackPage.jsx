import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, KeyRound, AlertCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';

export default function GoogleCallbackPage({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAccessToken } = useWorkspace();

  const [status, setStatus] = useState('processing'); // 'processing' | 'link_required' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [emailToLink, setEmailToLink] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [submittingLink, setSubmittingLink] = useState('');

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

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

    handleExchange(code, state);
  }, [code, state, errorParam]);

  const handleExchange = async (authCode, authState, password = null) => {
    try {
      if (password) setSubmittingLink(true);
      else setStatus('processing');

      const res = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: authCode,
          state: authState,
          ...(password ? { linkPassword: password } : {})
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.code === 'LINK_PASSWORD_REQUIRED') {
          setStatus('link_required');
          setEmailToLink(data.email || '');
          setSubmittingLink(false);
          return;
        }
        throw new Error(data.error || 'Terjadi kesalahan saat memproses login Google.');
      }

      setStatus('success');
      if (data.accessToken && setAccessToken) {
        setAccessToken(data.accessToken);
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
    } finally {
      setSubmittingLink(false);
    }
  };

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (!linkPassword) return;
    handleExchange(code, state, linkPassword);
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-box">
        {status === 'processing' && (
          <div className="text-center py-6">
            <div className="inline-flex p-4 rounded-full bg-cyan-500/10 mb-4 animate-spin">
              <Loader2 size={36} className="text-cyan-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Menghubungkan Akun Google…</h2>
            <p className="text-sm text-slate-400">
              Sedang memverifikasi data dan menyiapkan sesi workspace Anda. Mohon tunggu sebentar.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-6">
            <div className="inline-flex p-4 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 size={36} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Berhasil Masuk!</h2>
            <p className="text-sm text-slate-400">
              Mengarahkan Anda ke dashboard Markimate…
            </p>
          </div>
        )}

        {status === 'link_required' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Tautkan Akun Google</h2>
                <p className="text-xs text-slate-400">Verifikasi keamanan kepemilikan akun</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5 mb-4 text-xs text-slate-300 leading-relaxed">
              Email <strong>{emailToLink}</strong> sudah terdaftar di Markimate menggunakan kata sandi. Masukkan kata sandi akun Anda untuk menautkannya dengan akun Google ini demi mencegah pengambilalihan akun yang tidak sah.
            </div>

            {errorMessage && (
              <div className="auth-error-alert mb-4">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLinkSubmit} className="space-y-4">
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
                className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold"
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

            <div className="text-center mt-4">
              <Link to="/login" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1">
                <ArrowLeft size={13} />
                <span>Batalkan dan kembali ke login</span>
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-4">
            <div className="inline-flex p-4 rounded-full bg-rose-500/10 mb-4 text-rose-400">
              <AlertCircle size={36} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Gagal Masuk dengan Google</h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {errorMessage || 'Terjadi kesalahan yang tidak terduga saat mencoba menghubungkan akun.'}
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/login"
                className="btn btn-primary py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2"
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
