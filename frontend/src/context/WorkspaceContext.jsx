import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../lib/storage';
import { api, getToken, setActiveWorkspaceId as persistActiveWsId } from '../api';

const WORKSPACES_STORAGE_KEY = 'workspaces_v1';
const ACTIVE_WORKSPACE_KEY = 'workspace';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const stored = storage.getItem(WORKSPACES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // abaikan
    }
    return [];
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    try {
      const storedActive = storage.getItem(ACTIVE_WORKSPACE_KEY);
      if (storedActive) return storedActive;
    } catch {
      // abaikan
    }
    return '';
  });

  const [isLoading, setIsLoading] = useState(false);

  // Fungsi untuk memuat workspaces dari backend
  const refreshWorkspaces = useCallback(async () => {
    if (!getToken()) return;
    try {
      setIsLoading(true);
      const res = await api('/api/workspaces');
      if (res && Array.isArray(res.workspaces)) {
        setWorkspaces(res.workspaces);
        try {
          storage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(res.workspaces));
        } catch {}

        // Tetapkan activeWorkspaceId jika belum ada atau tidak valid
        const currentActive = storage.getItem(ACTIVE_WORKSPACE_KEY);
        const validCurrent = res.workspaces.some((w) => w.id === currentActive);
        const nextActive = validCurrent
          ? currentActive
          : (res.activeWorkspaceId || res.workspaces[0]?.id || '');

        if (nextActive) {
          setActiveWorkspaceId(nextActive);
          persistActiveWsId(nextActive);
        }
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Gagal memuat workspaces:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Muat data saat token berubah atau event login terdeteksi
  useEffect(() => {
    refreshWorkspaces();

    const handleLogin = () => refreshWorkspaces();
    const handleLogout = () => {
      setWorkspaces([]);
      setActiveWorkspaceId('');
      try {
        storage.removeItem(WORKSPACES_STORAGE_KEY);
        storage.removeItem(ACTIVE_WORKSPACE_KEY);
      } catch {}
    };

    window.addEventListener('markimate:login', handleLogin);
    window.addEventListener('supermat:login', handleLogin);
    window.addEventListener('markimate:logout', handleLogout);
    window.addEventListener('supermat:logout', handleLogout);

    return () => {
      window.removeEventListener('markimate:login', handleLogin);
      window.removeEventListener('supermat:login', handleLogin);
      window.removeEventListener('markimate:logout', handleLogout);
      window.removeEventListener('supermat:logout', handleLogout);
    };
  }, [refreshWorkspaces]);

  // Sinkronisasi active workspace ID ke storage dan api helper
  useEffect(() => {
    if (activeWorkspaceId) {
      persistActiveWsId(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

  const switchWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id);
    persistActiveWsId(id);
    try {
      window.dispatchEvent(new CustomEvent('markimate:workspace-changed', { detail: { id } }));
      window.dispatchEvent(new CustomEvent('supermat:workspace-changed', { detail: { id } }));
    } catch {
      // abaikan
    }
  }, []);

  const createWorkspace = useCallback(
    async ({ name, niche = 'Other', website = '' }) => {
      const res = await api('/api/workspaces', {
        method: 'POST',
        body: { name: name.trim() || 'Workspace Baru', niche, website },
      });

      if (res && res.workspace) {
        const newWs = res.workspace;
        setWorkspaces((prev) => [newWs, ...prev]);
        setActiveWorkspaceId(newWs.id);
        persistActiveWsId(newWs.id);
        try {
          window.dispatchEvent(new CustomEvent('markimate:workspace-changed', { detail: { id: newWs.id } }));
          window.dispatchEvent(new CustomEvent('supermat:workspace-changed', { detail: { id: newWs.id } }));
        } catch {}
        return newWs;
      }
      return null;
    },
    []
  );

  const updateWorkspace = useCallback(async (id, updates) => {
    try {
      const res = await api(`/api/workspaces/${id}`, {
        method: 'PATCH',
        body: updates,
      });
      const updated = res.workspace || { id, ...updates };
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...updated } : w))
      );
      return updated;
    } catch (err) {
      console.error('[WorkspaceContext] updateWorkspace error:', err);
      throw err;
    }
  }, []);

  const deleteWorkspace = useCallback(async (id) => {
    await api(`/api/workspaces/${id}`, { method: 'DELETE' });
    setWorkspaces((prev) => {
      const remaining = prev.filter((w) => w.id !== id);
      if (activeWorkspaceId === id && remaining.length > 0) {
        setActiveWorkspaceId(remaining[0].id);
        persistActiveWsId(remaining[0].id);
      }
      return remaining;
    });
  }, [activeWorkspaceId]);

  const isModuleActive = useCallback(
    (moduleKey) => {
      if (!activeWorkspace) return true; // Default true jika belum termuat
      if (Array.isArray(activeWorkspace.modules)) {
        return activeWorkspace.modules.includes(moduleKey);
      }
      if (activeWorkspace.entitlements && typeof activeWorkspace.entitlements === 'object') {
        const ent = activeWorkspace.entitlements[moduleKey];
        return ent ? !!ent.active : false;
      }
      return false;
    },
    [activeWorkspace]
  );

  const activateModule = useCallback(
    (moduleKey) => {
      if (!activeWorkspace) return;
      const current = activeWorkspace.modules || [];
      if (!current.includes(moduleKey)) {
        const nextModules = [...current, moduleKey];
        updateWorkspace(activeWorkspace.id, { modules: nextModules });
      }
    },
    [activeWorkspace, updateWorkspace]
  );

  const deactivateModule = useCallback(
    (moduleKey) => {
      if (!activeWorkspace) return;
      const current = activeWorkspace.modules || [];
      const nextModules = current.filter((m) => m !== moduleKey);
      updateWorkspace(activeWorkspace.id, { modules: nextModules });
    },
    [activeWorkspace, updateWorkspace]
  );

  const value = {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isLoading,
    refreshWorkspaces,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    isModuleActive,
    activateModule,
    deactivateModule,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace harus digunakan di dalam WorkspaceProvider');
  }
  return ctx;
}
