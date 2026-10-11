import { useState } from 'react';
import { X, Bell, CheckCircle2, AlertCircle } from 'lucide-react';

export default function WaitlistModal({ role, onClose }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!role) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Harap masukkan alamat email Anda.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Simpan ke local storage untuk mode mock
      const existing = JSON.parse(localStorage.getItem('supermat_waitlist') || '[]');
      existing.push({
        roleKey: role.key,
        roleName: role.name,
        email,
        name,
        submittedAt: new Date().toISOString(),
      });
      localStorage.setItem('supermat_waitlist', JSON.stringify(existing));

      // Simulasi delay request
      await new Promise((r) => setTimeout(r, 400));
      setSubmitted(true);
    } catch {
      setError('Terjadi kendala saat menyimpan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} className="card" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={styles.closeBtn} aria-label="Tutup modal">
          <X size={18} />
        </button>

        {!submitted ? (
          <div>
            <div style={styles.header}>
              <div style={styles.iconBox}>
                <Bell size={22} color="var(--accent-yellow)" />
              </div>
              <h3 style={styles.title}>Kabari Saya Saat Role Ini Rilis</h3>
              <p style={styles.subtitle}>
                Role <strong>{role.name}</strong> sedang dalam tahap pengembangan akhir. Jadilah yang pertama mencoba dan dapatkan penawaran early bird.
              </p>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nama Anda (Opsional)</label>
                <input
                  type="text"
                  placeholder="Nama atau brand bisnis"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Alamat Email Aktif *</label>
                <input
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              <button type="submit" disabled={loading} style={styles.submitBtn}>
                {loading ? 'Menyimpan…' : 'Daftar Antrean & Dapatkan Notifikasi'}
              </button>

              <span style={styles.privacyNote}>
                Kami menghargai privasi Anda. Tidak ada spam, hanya update penting seputar peluncuran.
              </span>
            </form>
          </div>
        ) : (
          <div style={styles.successBox}>
            <div style={styles.successIconBox}>
              <CheckCircle2 size={36} color="var(--accent-green)" />
            </div>
            <h3 style={styles.title}>Anda Sudah Terdaftar!</h3>
            <p style={styles.subtitle}>
              Terima kasih! Kami akan mengirimkan notifikasi ke <strong>{email}</strong> segera setelah role <strong>{role.name}</strong> siap digunakan.
            </p>
            <button onClick={onClose} style={styles.closeModalBtn}>
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modal: {
    maxWidth: '460px',
    width: '100%',
    padding: '2rem',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    boxShadow: 'var(--shadow-lg)',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: '1.25rem',
    right: '1.25rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  iconBox: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.75rem',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.4rem',
  },
  subtitle: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--accent-red)',
    fontSize: '0.78rem',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '0.65rem 0.85rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  submitBtn: {
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-yellow)',
    border: 'none',
    color: '#000000',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  privacyNote: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    display: 'block',
  },
  successBox: {
    textAlign: 'center',
    padding: '1rem 0',
  },
  successIconBox: {
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  closeModalBtn: {
    padding: '0.6rem 1.5rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '1.25rem',
  },
};
