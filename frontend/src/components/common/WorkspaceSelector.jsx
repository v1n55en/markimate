import { useState, useRef, useEffect } from 'react';
import {
  Briefcase,
  ChevronDown,
  Check,
  Plus,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export default function WorkspaceSelector() {
  const {
    workspaces,
    activeWorkspace,
    switchWorkspace,
    createWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newNiche, setNewNiche] = useState('Retail & Fashion');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const dropdownRef = useRef(null);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (wsId) => {
    switchWorkspace(wsId);
    setIsOpen(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newBrandName.trim() || submitting) return;
    try {
      setSubmitting(true);
      setErrorMsg('');
      await createWorkspace({
        name: newBrandName.trim(),
        niche: newNiche,
      });
      setNewBrandName('');
      setShowCreateModal(false);
      setIsOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menambahkan brand.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeModulesCount = activeWorkspace?.modules?.length || 3;

  return (
    <div className="workspace-selector-container" ref={dropdownRef}>
      <div style={styles.topLabelRow}>
        <span style={styles.topLabel}>Workspace Aktif</span>
        <span style={styles.modulesCountBadge}>
          <Layers size={10} />
          {activeModulesCount} Modul
        </span>
      </div>

      {/* Button Pemilih Workspace */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.selectorBtn,
          ...(isOpen ? styles.selectorBtnOpen : {}),
        }}
        aria-expanded={isOpen}
      >
        <div style={styles.brandIconBox}>
          <Briefcase size={14} color="var(--accent-cyan)" />
        </div>
        <div style={styles.brandInfo}>
          <span style={styles.brandName} title={activeWorkspace?.name}>
            {activeWorkspace?.name || 'Pilih Brand'}
          </span>
          <span style={styles.brandNiche}>
            {activeWorkspace?.niche || 'Digital Marketing'}
          </span>
        </div>
        <ChevronDown
          size={14}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--transition-fast)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Popover Dropdown List Workspaces */}
      {isOpen && (
        <div className="workspace-popover-card card">
          <div style={styles.popoverHeader}>
            <span style={styles.popoverTitle}>Daftar Brand / Klien</span>
            <span style={styles.popoverSub}>{workspaces.length} terdaftar</span>
          </div>

          <div style={styles.workspacesList}>
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWorkspace?.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  style={{
                    ...styles.wsItem,
                    ...(isSelected ? styles.wsItemActive : {}),
                  }}
                >
                  <div style={styles.wsItemInfo}>
                    <div style={styles.wsItemTitleRow}>
                      <span style={styles.wsItemName}>{ws.name}</span>
                      {isSelected && (
                        <Check size={14} color="var(--accent-green)" />
                      )}
                    </div>
                    <div style={styles.wsItemMeta}>
                      <span>{ws.niche || 'Brand'}</span>
                      <span>·</span>
                      <span style={{ color: 'var(--accent-cyan)' }}>
                        {ws.role ? `${ws.role}` : 'Aktif'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={styles.popoverFooter}>
            <button
              onClick={() => {
                setErrorMsg('');
                setShowCreateModal(true);
                setIsOpen(false);
              }}
              style={styles.addBrandBtn}
            >
              <Plus size={14} />
              <span>Tambah Brand Baru</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Buat Brand Baru */}
      {showCreateModal && (
        <div
          className="workspace-modal-overlay"
          onClick={() => !submitting && setShowCreateModal(false)}
        >
          <div
            className="workspace-modal-card card"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div style={styles.modalIcon}>
                <Sparkles size={18} color="var(--accent-cyan)" />
              </div>
              <h3 style={styles.modalTitle}>Tambah Brand Baru</h3>
              <button
                type="button"
                onClick={() => !submitting && setShowCreateModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={16} />
              </button>
            </div>

            {errorMsg && (
              <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nama Brand / Klien *</label>
                <input
                  type="text"
                  placeholder="Contoh: Skincare Glow Official"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  style={styles.input}
                  required
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Niche Industri</label>
                <select
                  value={newNiche}
                  onChange={(e) => setNewNiche(e.target.value)}
                  style={styles.select}
                  disabled={submitting}
                >
                  <option value="Retail & Fashion">Retail & Fashion</option>
                  <option value="F&B (Kuliner & Kafe)">F&B (Kuliner & Kafe)</option>
                  <option value="Beauty & Skincare">Beauty & Skincare</option>
                  <option value="Agency & Jasa Kreatif">Agency & Jasa Kreatif</option>
                  <option value="Software & Teknologi">Software & Teknologi</option>
                  <option value="Properti & Real Estate">Properti & Real Estate</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={styles.modalCancelBtn}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button type="submit" style={styles.modalSubmitBtn} disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan & Pilih Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    marginBottom: '1rem',
  },
  topLabelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 0.25rem 0.35rem 0.25rem',
  },
  topLabel: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  modulesCountBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
  },
  selectorBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all var(--transition-fast)',
  },
  selectorBtnOpen: {
    borderColor: 'var(--accent-cyan)',
    boxShadow: '0 0 0 1px var(--accent-cyan)',
  },
  brandIconBox: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandInfo: {
    minWidth: 0,
    flex: 1,
  },
  brandName: {
    display: 'block',
    fontSize: '0.825rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.2,
  },
  brandNiche: {
    display: 'block',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '0.1rem',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 200,
    padding: '0.75rem',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    boxShadow: 'var(--shadow-lg)',
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.2rem 0.25rem 0.5rem 0.25rem',
    borderBottom: '1px solid var(--border-muted)',
    marginBottom: '0.5rem',
  },
  popoverTitle: {
    fontSize: '0.725rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  popoverSub: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  workspacesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    maxHeight: '190px',
    overflowY: 'auto',
  },
  wsItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all var(--transition-fast)',
  },
  wsItemActive: {
    backgroundColor: 'var(--bg-base)',
    borderColor: 'var(--border-muted)',
  },
  wsItemInfo: {
    width: '100%',
  },
  wsItemTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.15rem',
  },
  wsItemName: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  wsItemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
  },
  popoverFooter: {
    borderTop: '1px solid var(--border-muted)',
    paddingTop: '0.5rem',
    marginTop: '0.5rem',
  },
  addBrandBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.45rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px dashed var(--border-active)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // Modal overlay
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modalCard: {
    maxWidth: '420px',
    width: '100%',
    padding: '1.75rem',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.25rem',
    position: 'relative',
  },
  modalIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    flex: 1,
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  modalForm: {
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
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  select: {
    padding: '0.65rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  modalCancelBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.825rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  modalSubmitBtn: {
    padding: '0.5rem 1.1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.825rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
};
