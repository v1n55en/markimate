import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Users, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { api, getToken } from '../../api';
import MarkimateLogo from '../../components/common/MarkimateLogo';

export default function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  // Muat info undangan dan user yang sedang login
  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError('Tautan undangan tidak memiliki token yang valid.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Cek user login
        if (getToken()) {
          try {
            const meRes = await api('/api/me');
            if (meRes?.user) setCurrentUser(meRes.user);
          } catch {}
        }

        // Cek info undangan
        const infoRes = await api(`/api/invites/info?token=${encodeURIComponent(token)}`);
        if (!infoRes || !infoRes.valid) {
          setError(infoRes?.message || 'Undangan tidak valid atau sudah kadaluarsa.');
        } else {
          setInviteInfo(infoRes.invite);
        }
      } catch (err) {
        setError(err.message || 'Gagal memuat informasi undangan.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  // Handler menerima undangan
  const handleAcceptInvite = async () => {
    try {
      setAccepting(true);
      setAcceptError('');
      const res = await api('/api/invites/accept', {
        method: 'POST',
        body: { token }
      });

      if (res && res.success) {
        setAcceptSuccess(true);
        window.dispatchEvent(new CustomEvent('markimate:workspace-changed', {
          detail: { id: res.workspace?.id }
        }));
        setTimeout(() => {
          navigate('/app/ads');
        }, 2000);
      }
    } catch (err) {
      setAcceptError(err.message || 'Gagal menerima undangan.');
    } finally {
      setAccepting(false);
    }
  };

  const isEmailMatch = currentUser && inviteInfo &&
    currentUser.email?.toLowerCase() === inviteInfo.email?.toLowerCase();

  return (
    <div className="auth-page-container">
      <div className="auth-card-box card">
        {/* Header / Brand */}
        <div className="auth-header">
          <div className="auth-logo-box">
            <MarkimateLogo />
          </div>
          <h1 className="auth-title">Undangan Bergabung</h1>
          <p className="auth-subtitle">
            Kolaborasi dalam satu platform pemasaran digital bersama tim Anda
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
            <p>Memeriksa informasi undangan...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div>
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Undangan Tidak Valid</strong>
                <p style={{ margin: '4px 0 0 0' }}>{error}</p>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                Kembali ke Halaman Masuk
              </Link>
            </div>
          </div>
        )}

        {/* Success State */}
        {!loading && acceptSuccess && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <CheckCircle2 size={26} color="var(--accent-green)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Berhasil Bergabung!
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Anda sekarang adalah anggota dari workspace <strong>{inviteInfo?.workspaceName}</strong>. Mengalihkan ke dashboard...
            </p>
          </div>
        )}

        {/* Info Undangan & Aksi */}
        {!loading && !error && !acceptSuccess && inviteInfo && (
          <div>
            {/* Box Detail Undangan */}
            <div style={{
              padding: '1.25rem',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border-muted)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Users size={18} color="var(--accent-cyan)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Workspace Target</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {inviteInfo.workspaceName}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                fontSize: '0.8rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-muted)'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Pengundang</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{inviteInfo.inviterName}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Peran Akses</span>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: inviteInfo.role === 'admin' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                    color: inviteInfo.role === 'admin' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    fontWeight: '600'
                  }}>
                    {inviteInfo.role === 'admin' ? 'Admin' : 'Viewer (Pengamat)'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Undangan khusus untuk: <strong style={{ color: 'var(--text-primary)' }}>{inviteInfo.email}</strong>
              </div>
            </div>

            {acceptError && (
              <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{acceptError}</span>
              </div>
            )}

            {/* Skenario 1: Belum Login */}
            {!currentUser && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>
                  Silakan masuk atau daftar menggunakan email <strong>{inviteInfo.email}</strong> untuk menerima undangan ini.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <Link
                    to={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <LogIn size={16} />
                    <span>Masuk ke Akun</span>
                  </Link>
                  <Link
                    to={`/register?next=${encodeURIComponent(`/invite?token=${token}`)}`}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <UserPlus size={16} />
                    <span>Daftar Akun Baru</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Skenario 2: Login dengan Email Sesuai */}
            {currentUser && isEmailMatch && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textAlign: 'center' }}>
                  Anda masuk sebagai <strong>{currentUser.email}</strong>. Klik tombol di bawah untuk bergabung sekarang:
                </p>

                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  disabled={accepting}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                >
                  <ShieldCheck size={18} />
                  <span>{accepting ? 'Memproses...' : 'Terima Undangan Sekarang'}</span>
                </button>
              </div>
            )}

            {/* Skenario 3: Login dengan Email Berbeda */}
            {currentUser && !isEmailMatch && (
              <div>
                <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '0.825rem' }}>
                    <strong>Email Tidak Sesuai</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      Undangan ini ditujukan untuk <strong>{inviteInfo.email}</strong>, tetapi Anda sedang masuk sebagai <strong>{currentUser.email}</strong>.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new Event('markimate:logout'));
                      navigate(`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`);
                    }}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span>Ganti Akun & Masuk</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="auth-card-footer">
          <Link to="/terms" className="auth-link">Syarat & Ketentuan</Link>
          <span>·</span>
          <Link to="/privacy" className="auth-link">Kebijakan Privasi</Link>
        </div>
      </div>
    </div>
  );
}
