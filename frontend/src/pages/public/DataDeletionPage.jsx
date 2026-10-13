import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldAlert, CheckCircle2, AlertCircle, Search, ExternalLink, ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../../api';

export default function DataDeletionPage() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [confirmationCode, setConfirmationCode] = useState(initialCode);
  const [checking, setChecking] = useState(false);
  const [statusResult, setStatusResult] = useState(null);
  const [statusError, setStatusError] = useState('');

  const handleCheckStatus = async (e) => {
    if (e) e.preventDefault();
    const code = confirmationCode.trim();
    if (!code) {
      setStatusError('Silakan masukkan kode konfirmasi penghapusan.');
      return;
    }

    setStatusError('');
    setStatusResult(null);
    setChecking(true);

    try {
      const res = await api(`/api/data-deletion/status?code=${encodeURIComponent(code)}`);
      setStatusResult(res);
    } catch (err) {
      setStatusError(err.message || 'Kode konfirmasi tidak ditemukan atau tidak valid.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-wrapper" style={{ maxWidth: '640px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Halaman Masuk</span>
          </Link>
        </div>

        <div className="auth-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-red)'
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Penghapusan Data Pengguna & Meta
              </h1>
              <p style={{ fontSize: '0.825rem', margin: '2px 0 0 0', color: 'var(--text-secondary)' }}>
                Panduan Penghapusan Data Sesuai Ketentuan Privasi Platform & Meta
              </p>
            </div>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            <p style={{ marginTop: 0 }}>
              Sesuai dengan Kebijakan Platform Meta dan komitmen privasi Markimate, pengguna memiliki hak penuh untuk meminta penghapusan akun serta seluruh data integrasi iklan Meta, kata kunci, artikel, dan koneksi CMS kapan saja.
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              1. Menghapus Akun & Data Anda di Markimate
            </h3>
            <p>
              Jika Anda memiliki akun Markimate yang aktif, Anda dapat meminta penghapusan akun beserta seluruh workspace Anda langsung dari menu pengaturan:
            </p>
            <div style={{ margin: '0.75rem 0' }}>
              <Link
                to="/app/settings/account"
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  fontSize: '0.85rem'
                }}
              >
                <span>Buka Pengaturan Akun</span>
                <ExternalLink size={14} />
              </Link>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Akun yang diminta untuk dihapus akan memasuki masa tenggang 30 hari sebelum seluruh data dihapus permanen. Anda dapat membatalkannya kapan saja dengan login kembali dalam periode tersebut.
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
              2. Penghapusan Data Aplikasi dari Facebook / Meta
            </h3>
            <p>
              Jika Anda telah mencabut izin aplikasi Markimate melalui menu <em>Settings & Privacy &gt; Settings &gt; Apps and Websites</em> di akun Facebook/Meta Anda, Meta akan secara otomatis memicu Webhook Callback Penghapusan Data ke server Markimate.
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

          {/* Form Cek Status Penghapusan */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Periksa Status Permintaan Penghapusan Data
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '1rem' }}>
              Masukkan Kode Konfirmasi Penghapusan (Confirmation Code) yang Anda terima dari Meta untuk memeriksa status proses penghapusan:
            </p>

            <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="auth-input"
                style={{ flex: '1 1 240px', minWidth: '220px' }}
                placeholder="Contoh: del_a1b2c3d4e5f6..."
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={checking}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Search size={15} />
                <span>{checking ? 'Memeriksa…' : 'Cek Status'}</span>
              </button>
            </form>

            {statusError && (
              <div
                className="auth-alert-box auth-alert-error"
                style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <AlertCircle size={16} />
                <span>{statusError}</span>
              </div>
            )}

            {statusResult && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.9rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Permintaan Penghapusan Terverifikasi</span>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <div>Kode Konfirmasi: <code style={{ color: 'var(--text-primary)' }}>{statusResult.confirmationCode}</code></div>
                  <div>Status Proses: <strong style={{ color: 'var(--accent-green)' }}>{statusResult.status?.toUpperCase() || 'COMPLETED'}</strong></div>
                  <div>Waktu Diproses: {new Date(statusResult.requestedAt).toLocaleString('id-ID')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
