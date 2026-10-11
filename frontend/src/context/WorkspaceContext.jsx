import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const WORKSPACES_STORAGE_KEY = 'supermat_workspaces_v1';
const ACTIVE_WORKSPACE_KEY = 'supermat_workspace';

// Data awal workspace contoh untuk demonstrasi multi-brand
const INITIAL_WORKSPACES = [
  {
    id: 'ws-3our-official',
    name: '3Our Brand Official',
    niche: 'Creative Agency & SaaS',
    modules: ['seo', 'ads_report', 'ads_spy'], // Fokus 3 lengkap aktif
    plan: 'focus3',
    billingCycle: 'monthly',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'ws-kopi-makmur',
    name: 'Kopi Makmur F&B',
    niche: 'F&B (Kuliner & Kafe)',
    modules: ['seo'], // Hanya SEO aktif; Ads Report & Spy terkunci
    plan: 'seo_only',
    billingCycle: 'monthly',
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'ws-hijab-store',
    name: 'Hijab Store Indonesia',
    niche: 'Retail & Fashion',
    modules: ['ads_report', 'ads_spy'], // Ads & Spy aktif; SEO terkunci
    plan: 'custom',
    billingCycle: 'yearly',
    createdAt: '2026-09-15T00:00:00Z',
  },
];

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const stored = localStorage.getItem(WORKSPACES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // abaikan
    }
    return INITIAL_WORKSPACES;
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    try {
      const storedActive = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      if (storedActive && INITIAL_WORKSPACES.some((w) => w.id === storedActive)) {
        return storedActive;
      }
    } catch {
      // abaikan
    }
    return INITIAL_WORKSPACES[0].id;
  });

  // Sinkronisasi ke localStorage setiap kali ada perubahan workspaces
  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces));
    } catch {
      // abaikan
    }
  }, [workspaces]);

  // Sinkronisasi active workspace ID
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
    } catch {
      // abaikan
    }
  }, [activeWorkspaceId]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

  const switchWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id);
    try {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
      window.dispatchEvent(new CustomEvent('supermat:workspace-changed', { detail: { id } }));
    } catch {
      // abaikan
    }
  }, []);

  const createWorkspace = useCallback(
    ({ name, niche = 'Other', initialModules = ['seo'] }) => {
      const newWs = {
        id: `ws-${Date.now()}`,
        name: name.trim() || 'Brand Baru',
        niche,
        modules: initialModules,
        plan: 'custom',
        billingCycle: 'monthly',
        createdAt: new Date().toISOString(),
      };
      setWorkspaces((prev) => [newWs, ...prev]);
      setActiveWorkspaceId(newWs.id);
      try {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, newWs.id);
        window.dispatchEvent(new CustomEvent('supermat:workspace-changed', { detail: { id: newWs.id } }));
      } catch {
        // abaikan
      }
      return newWs;
    },
    []
  );

  const updateWorkspace = useCallback((id, updates) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  }, []);

  const isModuleActive = useCallback(
    (moduleKey) => {
      if (!activeWorkspace) return false;
      return (activeWorkspace.modules || []).includes(moduleKey);
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

  const resetAllWorkspaces = useCallback(() => {
    setWorkspaces(INITIAL_WORKSPACES);
    setActiveWorkspaceId(INITIAL_WORKSPACES[0].id);
    try {
      localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(INITIAL_WORKSPACES));
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, INITIAL_WORKSPACES[0].id);
    } catch {
      // abaikan
    }
  }, []);

  const value = {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    isModuleActive,
    activateModule,
    deactivateModule,
    resetAllWorkspaces,
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
