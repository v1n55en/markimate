import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api, getToken } from '../../api';

/**
 * ModuleGuard: Melindungi route modul agar hanya bisa diakses
 * bila modul tersebut telah aktif pada workspace terpilih di server (/api/me atau /api/workspaces).
 * Jika belum aktif, pengguna dialihkan ke halaman aktivasi modul (/app/modules/:key).
 */
export default function ModuleGuard({ moduleKey, children }) {
  const { isModuleActive, activeWorkspace } = useWorkspace();
  const [serverModules, setServerModules] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!getToken()) return;

    // Baca modul dari /api/me (sumber kebenaran server sesuai PRD F1+F2 Langkah 7)
    setLoading(true);
    api('/api/me')
      .then((res) => {
        if (!isMounted) return;
        if (res && Array.isArray(res.modules)) {
          setServerModules(res.modules);
        } else if (res && res.activeWorkspace && Array.isArray(res.activeWorkspace.modules)) {
          setServerModules(res.activeWorkspace.modules);
        }
      })
      .catch((err) => {
        console.warn('[ModuleGuard] Gagal membaca modul dari /api/me:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id]);

  // Jika workspace belum termuat atau masih fetching awal
  if (!activeWorkspace || (loading && serverModules === null)) {
    return children;
  }

  // Cek apakah modul aktif: prioritaskan data dari server /api/me, fallback ke activeWorkspace
  const activeList = serverModules !== null ? serverModules : (activeWorkspace.modules || []);
  const hasAccess = Array.isArray(activeList) ? activeList.includes(moduleKey) : isModuleActive(moduleKey);

  if (!hasAccess) {
    return <Navigate to={`/app/modules/${moduleKey}`} replace />;
  }

  return children;
}
