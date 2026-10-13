import { useState } from 'react';
import {
  User,
  KeyRound,
  Mail,
  Save,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Download,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { api, getToken } from '../../api';

export default function AccountSettingsPage({ me, refreshMe }) {
  const user = me?.user || {};

  // Tab State: profile | password | email | export | danger
  const [activeTab, setActiveTab] = useState('profile');

  // Form State: Profil
  const [name, setName] = useState(user.name || '');
  const [brandName, setBrandName] = useState(user.brandName || user.brand_name || '');
  const [niche, setNiche] = useState(user.niche || 'Other');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Form State: Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Form State: Email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // Form State: Ekspor
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  // Form State: Hapus Akun
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [blockedWorkspaces, setBlockedWorkspaces] = useState([]);

  // Handler: Simpan Profil
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    try {
      setSavingProfile(true);
      await api('/api/me', {
        method: 'PATCH',
        body: { name, brandName, niche }
      });
      setProfileSuccess('Profil akun berhasil diperbarui.');
      setTimeout(() => setProfileSuccess(''), 4000);
      if (refreshMe) await refreshMe();
    } catch (err) {
      setProfileError(err.message || 'Gagal menyimpan profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handler: Ganti Password
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 10) {
      setPasswordError('Kata sandi baru minimal 10 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi baru tidak sesuai.');
      return;
    }

    try {
      setSavingPassword(true);
      await api('/api/account/password', {
        method: 'POST',
        body: { currentPassword, newPassword }
      });
      setPasswordSuccess('Kata sandi berhasil diperbarui. Sesi perangkat lain telah dicabut.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 5000);
    } catch (err) {
      setPasswordError(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Handler: Ganti Email
  const handleSaveEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const targetEm = newEmail.trim().toLowerCase();
    if (!targetEm || !targetEm.includes('@')) {
      setEmailError('Format alamat email baru tidak valid.');
      return;
    }
    if (targetEm === (user.email || '').toLowerCase()) {
      setEmailError('Alamat email baru sama dengan alamat email saat ini.');
      return;
    }
    if (!emailPassword) {
      setEmailError('Kata sandi wajib diisi untuk verifikasi keamanan.');
      return;
    }

    try {
      setSavingEmail(true);
      const res = await api('/api/account/email', {
        method: 'POST',
        body: { newEmail: targetEm, password: emailPassword }
      });
      setEmailSuccess(res.message || 'Tautan konfirmasi telah dikirimkan ke alamat email baru.');
      setNewEmail('');
      setEmailPassword('');
    } catch (err) {
      setEmailError(err.message || 'Gagal mengajukan perubahan email.');
    } finally {
      setSavingEmail(false);
    }
  };

  // Handler: Ekspor Data Akun
  const handleExportData = async () => {
    setExportError('');
    setExporting(true);

    try {
      const token = getToken();
      const res = await fetch('/api/account/export', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal mengekspor data akun.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `markimate-account-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Gagal mengunduh file ekspor data.');
    } finally {
      setExporting(false);
    }
  };

  // Handler: Minta Hapus Akun
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');
    setDeleteSuccess('');
    setBlockedWorkspaces([]);

    if (confirmWord !== 'HAPUS') {
      setDeleteError('Harap ketik kata "HAPUS" untuk konfirmasi.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Kata sandi wajib diisi untuk konfirmasi penghapusan.');
      return;
    }

    try {
      setDeletingAccount(true);
      const res = await api('/api/account/delete', {
        method: 'POST',
        body: {
          password: deletePassword,
          confirm: confirmWord
        }
      });
      setDeleteSuccess(res.message || 'Akun Anda telah dijadwalkan untuk dihapus dalam 30 hari.');
      setDeletePassword('');
      setConfirmWord('');

      // Redirect ke login setelah 3 detik
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (err) {
      if (err.code === 'TRANSFER_OWNERSHIP_FIRST' && Array.isArray(err.workspaces)) {
        setBlockedWorkspaces(err.workspaces);
      }
      setDeleteError(err.message || 'Gagal mengajukan penghapusan akun.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="security-page-container">
      {/* Header Halaman */}
      <div className="security-page-header">
        <div>
          <h1 className="security-page-title">Pengaturan Akun</h1>
          <p className="security-page-subtitle">
            Kelola identitas profil, kata sandi, alamat email, ekspor data, dan privasi akun Anda.
          </p>
        </div>
      </div>

      {/* Tab Navigasi Horizontal */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'profile' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'profile' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderColor: activeTab === 'profile' ? 'var(--accent-cyan)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <User size={15} />
          <span>Profil Pengguna</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'password' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'password' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderColor: activeTab === 'password' ? 'var(--accent-cyan)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <KeyRound size={15} />
          <span>Kata Sandi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'email' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'email' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderColor: activeTab === 'email' ? 'var(--accent-cyan)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Mail size={15} />
          <span>Alamat Email</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'export' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'export' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderColor: activeTab === 'export' ? 'var(--accent-cyan)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Download size={15} />
          <span>Ekspor Data</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('danger')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'danger' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
            color: activeTab === 'danger' ? 'var(--accent-red)' : 'var(--text-secondary)',
            borderColor: activeTab === 'danger' ? 'var(--accent-red)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Trash2 size={15} />
          <span>Hapus Akun</span>
        </button>
      </div>

      {/* Konten Tab 1: Profil */}
      {activeTab === 'profile' && (
        <div className="security-card-container">
          <div className="security-card-header">
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Informasi Profil Pribadi
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Nama lengkap dan merek bisnis yang digunakan sebagai identitas akun Anda.
              </p>
            </div>
          </div>

          <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
            {profileSuccess && (
              <div className="auth-alert-box auth-alert-success" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="auth-alert-box auth-alert-error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="auth-form" style={{ maxWidth: '480px' }}>
              <div className="auth-field">
                <label className="auth-field-label">Nama Lengkap</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Nama Lengkap Anda"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">Nama Merek / Bisnis Utama</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Nama Brand atau Startup"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">Niche / Industri Bisnis</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Misal: Teknologi, Fashion, Kuliner"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProfile}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={15} />
                  <span>{savingProfile ? 'Menyimpan…' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konten Tab 2: Password */}
      {activeTab === 'password' && (
        <div className="security-card-container">
          <div className="security-card-header">
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Ubah Kata Sandi
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Perbarui kata sandi Anda secara berkala. Seluruh sesi di perangkat lain akan dicabut otomatis.
              </p>
            </div>
          </div>

          <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
            {passwordSuccess && (
              <div className="auth-alert-box auth-alert-success" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="auth-alert-box auth-alert-error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="auth-form" style={{ maxWidth: '480px' }}>
              <div className="auth-field">
                <label className="auth-field-label">Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Masukkan kata sandi saat ini"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">Kata Sandi Baru (Min. 10 karakter)</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Kata sandi baru minimal 10 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={10}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Ketik ulang kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingPassword}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <KeyRound size={15} />
                  <span>{savingPassword ? 'Memperbarui…' : 'Perbarui Kata Sandi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konten Tab 3: Email */}
      {activeTab === 'email' && (
        <div className="security-card-container">
          <div className="security-card-header">
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Perbarui Alamat Email
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Email saat ini: <strong>{user.email}</strong>
              </p>
            </div>
          </div>

          <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
            {emailSuccess && (
              <div className="auth-alert-box auth-alert-success" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} />
                <span>{emailSuccess}</span>
              </div>
            )}
            {emailError && (
              <div className="auth-alert-box auth-alert-error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{emailError}</span>
              </div>
            )}

            <div style={{
              backgroundColor: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.25rem',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '540px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                <ShieldCheck size={16} />
                <span>Prosedur Keamanan Perubahan Email</span>
              </div>
              Tautan verifikasi akan dikirimkan ke alamat email baru Anda. Alamat email akun Anda hanya akan resmi berganti setelah Anda mengklik tautan verifikasi tersebut. Notifikasi keamanan juga akan dikirimkan ke email lama.
            </div>

            <form onSubmit={handleSaveEmail} className="auth-form" style={{ maxWidth: '480px' }}>
              <div className="auth-field">
                <label className="auth-field-label">Alamat Email Baru</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="email.baru@bisnis.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">Konfirmasi Kata Sandi Akun</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Masukkan kata sandi akun untuk verifikasi"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingEmail}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Mail size={15} />
                  <span>{savingEmail ? 'Mengirimkan Tautan…' : 'Kirim Tautan Verifikasi Email Baru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konten Tab 4: Ekspor Data */}
      {activeTab === 'export' && (
        <div className="security-card-container">
          <div className="security-card-header">
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Ekspor Seluruh Data Akun
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Unduh salinan data profil, workspace, artikel SEO, pengaturan CMS (tanpa kunci rahasia), dan ledger kredit Anda.
              </p>
            </div>
          </div>

          <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
            {exportError && (
              <div className="auth-alert-box auth-alert-error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{exportError}</span>
              </div>
            )}

            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.25rem',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '540px'
            }}>
              <p style={{ margin: 0 }}>
                Data akan diekspor dalam format <strong>JSON</strong> standar yang dapat Anda simpan atau gunakan sebagai cadangan (portabilitas data GDPR). Data kredensial koneksi CMS dan hash kata sandi otomatis dikecualikan demi keamanan.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>{exporting ? 'Menyiapkan File…' : 'Unduh File Ekspor (.JSON)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Konten Tab 5: Hapus Akun (Zona Berbahaya) */}
      {activeTab === 'danger' && (
        <div className="security-card-container" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div className="security-card-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.04)' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-red)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} />
                <span>Zona Berbahaya: Hapus Akun</span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Permintaan penghapusan permanen akun Markimate dan workspace terkait.
              </p>
            </div>
          </div>

          <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
            {deleteSuccess && (
              <div className="auth-alert-box auth-alert-success" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} />
                <span>{deleteSuccess} Anda akan dialihkan ke halaman login…</span>
              </div>
            )}

            {deleteError && (
              <div className="auth-alert-box auth-alert-error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            {blockedWorkspaces.length > 0 && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem',
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                maxWidth: '540px'
              }}>
                <strong style={{ color: 'var(--accent-red)', display: 'block', marginBottom: '4px' }}>
                  Transfer Kepemilikan Diperlukan
                </strong>
                Anda masih menjadi owner pada workspace berikut yang memiliki anggota lain:
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {blockedWorkspaces.map(w => (
                    <li key={w.id}><strong>{w.name}</strong></li>
                  ))}
                </ul>
                Buka menu <em>Anggota & Tim</em> untuk mengalihkan kepemilikan workspace kepada anggota lain terlebih dahulu.
              </div>
            )}

            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.25rem',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '540px'
            }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                Ketentuan Masa Tenggang 30 Hari:
              </p>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li>Seluruh sesi aktif di semua perangkat akan dicabut seketika.</li>
                <li>Seluruh jadwal penulisan otomatis dan sumber topik Google Trends akan dinonaktifkan.</li>
                <li>Data akun akan disimpan selama 30 hari. Jika berubah pikiran, cukup login kembali sebelum 30 hari berakhir untuk membatalkan penghapusan.</li>
              </ul>
            </div>

            <form onSubmit={handleDeleteAccount} className="auth-form" style={{ maxWidth: '480px' }}>
              <div className="auth-field">
                <label className="auth-field-label">Kata Sandi Akun</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Masukkan kata sandi Anda"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">
                  Ketik kata <strong style={{ color: 'var(--accent-red)' }}>HAPUS</strong> untuk konfirmasi
                </label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="HAPUS"
                  value={confirmWord}
                  onChange={(e) => setConfirmWord(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={deletingAccount || confirmWord !== 'HAPUS'}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: (deletingAccount || confirmWord !== 'HAPUS') ? 'not-allowed' : 'pointer',
                    opacity: (deletingAccount || confirmWord !== 'HAPUS') ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={15} />
                  <span>{deletingAccount ? 'Memproses Penghapusan…' : 'Jadwalkan Penghapusan Akun (30 Hari)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
