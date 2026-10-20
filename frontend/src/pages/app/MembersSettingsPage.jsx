import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  ShieldCheck,
  Eye,
  UserMinus,
  Copy,
  Check,
  AlertCircle,
  KeyRound,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { api } from '../../api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatDate } from '../../lib/format';

export default function MembersSettingsPage({ me, refreshMe }) {
  const { activeWorkspace } = useWorkspace();
  const currentWorkspaceId = activeWorkspace?.id;
  const { t, lang } = useLanguage();

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State: Undang Anggota
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copiedInviteId, setCopiedInviteId] = useState('');

  // Modal State: Transfer Ownership
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferPassword, setTransferPassword] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  // Cari peran user saat ini di workspace aktif
  const currentUserRole = activeWorkspace?.role || 'viewer';
  const isOwner = currentUserRole === 'owner';
  const isAdminOrOwner = ['owner', 'admin'].includes(currentUserRole);

  // Muat data anggota & undangan
  const loadMembersAndInvites = useCallback(async () => {
    if (!currentWorkspaceId) return;

    try {
      setLoading(true);
      setError('');

      const [membersRes, invitesRes] = await Promise.all([
        api(`/api/workspaces/${currentWorkspaceId}/members`),
        isAdminOrOwner ? api(`/api/workspaces/${currentWorkspaceId}/invites`).catch(() => ({ invites: [] })) : Promise.resolve({ invites: [] })
      ]);

      if (membersRes && Array.isArray(membersRes.members)) {
        setMembers(membersRes.members);
      }
      if (invitesRes && Array.isArray(invitesRes.invites)) {
        setInvites(invitesRes.invites);
      }
    } catch (err) {
      setError(err.message || t('settings.members.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, isAdminOrOwner, t]);

  useEffect(() => {
    loadMembersAndInvites();
  }, [loadMembersAndInvites]);

  // Handler: Kirim Undangan
  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    try {
      setInviting(true);
      setInviteError('');
      setInviteSuccess('');

      const res = await api(`/api/workspaces/${currentWorkspaceId}/invites`, {
        method: 'POST',
        body: { email: inviteEmail.trim(), role: inviteRole }
      });

      if (res && res.success) {
        setInviteSuccess(t('settings.members.inviteSuccess', { email: inviteEmail.trim() }));
        setInviteEmail('');
        setTimeout(() => setInviteSuccess(''), 5000);
        await loadMembersAndInvites();
      }
    } catch (err) {
      setInviteError(err.message || t('settings.members.inviteError'));
    } finally {
      setInviting(false);
    }
  };

  // Handler: Cabut / Batalkan Undangan
  const handleRevokeInvite = async (inviteId) => {
    if (!window.confirm(t('settings.members.revokeInviteConfirm'))) return;
    try {
      await api(`/api/workspaces/${currentWorkspaceId}/invites/${inviteId}`, {
        method: 'DELETE'
      });
      await loadMembersAndInvites();
    } catch (err) {
      alert(err.message || t('settings.members.revokeInviteError'));
    }
  };

  // Handler: Ubah Role Anggota
  const handleChangeRole = async (userId, newRole) => {
    try {
      await api(`/api/workspaces/${currentWorkspaceId}/members/${userId}`, {
        method: 'PATCH',
        body: { role: newRole }
      });
      await loadMembersAndInvites();
    } catch (err) {
      alert(err.message || t('settings.members.changeRoleError'));
    }
  };

  // Handler: Hapus Anggota / Keluar
  const handleRemoveMember = async (userId, isSelf) => {
    const confirmMsg = isSelf
      ? t('settings.members.confirmLeave')
      : t('settings.members.confirmRemove');

    if (!window.confirm(confirmMsg)) return;

    try {
      await api(`/api/workspaces/${currentWorkspaceId}/members/${userId}`, {
        method: 'DELETE'
      });
      if (isSelf) {
        window.location.reload();
      } else {
        await loadMembersAndInvites();
      }
    } catch (err) {
      alert(err.message || t('settings.members.removeMemberError'));
    }
  };

  // Handler: Transfer Ownership
  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!transferTarget || !transferPassword || transferring) return;

    try {
      setTransferring(true);
      setTransferError('');

      const res = await api(`/api/workspaces/${currentWorkspaceId}/transfer-ownership`, {
        method: 'POST',
        body: { userId: transferTarget.userId, password: transferPassword }
      });

      if (res && res.success) {
        setTransferSuccess(t('settings.members.transferSuccess'));
        setTransferPassword('');
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferSuccess('');
          loadMembersAndInvites();
          if (refreshMe) refreshMe();
        }, 1500);
      }
    } catch (err) {
      setTransferError(err.message || t('settings.members.transferError'));
    } finally {
      setTransferring(false);
    }
  };

  const copyInviteLink = (invite) => {
    const appUrl = window.location.origin;
    const dummyLink = `${appUrl}/invite?token=${invite.id}`;
    navigator.clipboard.writeText(dummyLink);
    setCopiedInviteId(invite.id);
    setTimeout(() => setCopiedInviteId(''), 3000);
  };

  return (
    <div className="members-page-container">
      {/* Header Halaman */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            {t('settings.members.title')}
          </h1>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.15rem 0.6rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            color: 'var(--accent-cyan)',
            fontWeight: '600'
          }}>
            {activeWorkspace?.name || t('settings.members.activeWorkspaceFallback')}
          </span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
          {t('settings.members.subtitle', { role: currentUserRole.toUpperCase() })}
        </p>
      </div>

      {error && (
        <div className="auth-alert auth-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Bagian 1: Undang Anggota Baru (Khusus Owner/Admin) */}
      {isAdminOrOwner && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <UserPlus size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.members.inviteSectionTitle')}
            </h3>
          </div>

          {inviteSuccess && (
            <div className="auth-alert auth-alert-success" style={{ marginBottom: '1rem' }}>
              <Check size={18} style={{ flexShrink: 0 }} />
              <span>{inviteSuccess}</span>
            </div>
          )}

          {inviteError && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{inviteError}</span>
            </div>
          )}

          <form onSubmit={handleSendInvite} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <input
                type="email"
                placeholder={t('settings.members.inviteEmailPlaceholder')}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                required
                disabled={inviting}
              />
            </div>

            <div style={{ width: '160px' }}>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="select"
                style={{ width: '100%', boxSizing: 'border-box' }}
                disabled={inviting}
              >
                <option value="viewer">{t('settings.members.roleViewer')}</option>
                <option value="admin">{t('settings.members.roleAdmin')}</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={inviting}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}
            >
              <span>{inviting ? t('settings.members.sending') : t('settings.members.sendInvite')}</span>
            </button>
          </form>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
            {t('settings.members.inviteNotice')}
          </p>
        </div>
      )}

      {/* Bagian 2: Daftar Anggota Aktif */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.members.listTitle', { count: members.length })}
            </h3>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('settings.members.loading')}</p>
        ) : members.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('settings.members.empty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {members.map((member) => {
              const isOwnerMember = member.role === 'owner';
              const isSelf = member.isCurrentUser;
              const canEditThisMember = isOwner && !isOwnerMember && !isSelf;
              const canRemoveThisMember = (isOwner && !isOwnerMember) || (isAdminOrOwner && member.role === 'viewer' && !isSelf) || (isSelf && !isOwner);

              return (
                <div key={member.userId} className="member-item-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 240px' }}>
                    <div className="member-avatar-box">
                      {isOwnerMember ? (
                        <ShieldCheck size={20} color="var(--accent-cyan)" />
                      ) : (
                        <Users size={18} color="var(--text-secondary)" />
                      )}
                    </div>
                    <div className="member-info-content">
                      <div className="member-name-title">
                        <span>{member.name || t('settings.members.userFallback')}</span>
                        {isSelf && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                            {t('settings.members.youTag')}
                          </span>
                        )}
                      </div>
                      <div className="member-meta-row">
                        <span>{member.email}</span>
                        <span>·</span>
                        <span>{member.joinedAt ? formatDate(member.joinedAt, lang) : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="member-actions-slot">
                    {/* Role Display / Switcher */}
                    {canEditThisMember ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                        className="select"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                      >
                        <option value="viewer">{t('settings.members.roleViewer')}</option>
                        <option value="admin">{t('settings.members.roleAdmin')}</option>
                      </select>
                    ) : (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        backgroundColor: isOwnerMember
                          ? 'rgba(6, 182, 212, 0.15)'
                          : member.role === 'admin'
                          ? 'rgba(59, 130, 246, 0.15)'
                          : 'rgba(148, 163, 184, 0.12)',
                        color: isOwnerMember
                          ? 'var(--accent-cyan)'
                          : member.role === 'admin'
                          ? '#60a5fa'
                          : 'var(--text-secondary)'
                      }}>
                        {member.role === 'owner'
                          ? t('settings.members.roleOwner')
                          : member.role === 'admin'
                          ? t('settings.members.roleAdmin')
                          : t('settings.members.roleViewer')}
                      </span>
                    )}

                    {/* Transfer Ownership Button (Owner only, for other members) */}
                    {isOwner && !isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTarget(member);
                          setTransferPassword('');
                          setTransferError('');
                          setShowTransferModal(true);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        title={t('settings.members.transferTooltip')}
                      >
                        {t('settings.members.transferBtn')}
                      </button>
                    )}

                    {/* Remove Member / Leave Button */}
                    {canRemoveThisMember && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId, isSelf)}
                        className="btn btn-secondary"
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.75rem',
                          color: '#ef4444',
                          borderColor: 'rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        {isSelf ? t('settings.members.leaveBtn') : t('settings.members.removeBtn')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bagian 3: Undangan Tertunda (Pending Invites) */}
      {isAdminOrOwner && invites.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Mail size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.members.pendingTitle', { count: invites.length })}
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {invites.map((inv) => (
              <div key={inv.id} className="member-item-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 240px' }}>
                  <div className="member-avatar-box">
                    <Mail size={18} color="var(--text-muted)" />
                  </div>
                  <div className="member-info-content">
                    <div className="member-name-title">
                      <span>{inv.email}</span>
                    </div>
                    <div className="member-meta-row">
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>
                        {inv.role === 'admin' ? t('settings.members.roleAdmin') : t('settings.members.roleViewer')}
                      </span>
                      <span>·</span>
                      <span>{inv.expiresAt ? formatDate(inv.expiresAt, lang) : '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="member-actions-slot">
                  <button
                    type="button"
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      color: '#ef4444',
                      borderColor: 'rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Transfer Ownership */}
      {showTransferModal && transferTarget && (
        <div className="workspace-modal-overlay" onClick={() => !transferring && setShowTransferModal(false)}>
          <div className="workspace-modal-card card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <KeyRound size={18} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, flex: 1 }}>
                {t('settings.members.transferModalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => !transferring && setShowTransferModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              {t('settings.members.transferModalDesc', { workspace: activeWorkspace?.name, targetName: transferTarget.name, targetEmail: transferTarget.email })}
            </p>

            {transferSuccess && (
              <div className="auth-alert auth-alert-success" style={{ marginBottom: '1rem' }}>
                <Check size={18} style={{ flexShrink: 0 }} />
                <span>{transferSuccess}</span>
              </div>
            )}

            {transferError && (
              <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleTransferOwnership}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t('settings.members.confirmPasswordLabel')}
                </label>
                <input
                  type="password"
                  placeholder={t('settings.members.confirmPasswordPlaceholder')}
                  value={transferPassword}
                  onChange={(e) => setTransferPassword(e.target.value)}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                  disabled={transferring}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="btn btn-secondary"
                  disabled={transferring}
                >
                  {t('settings.members.cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={transferring}
                  style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }}
                >
                  {transferring ? t('settings.members.processingTransfer') : t('settings.members.confirmTransferBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
