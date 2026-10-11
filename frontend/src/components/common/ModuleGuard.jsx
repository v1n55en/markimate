import { Navigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * ModuleGuard: Melindungi route modul agar hanya bisa diakses
 * bila modul tersebut telah aktif pada workspace terpilih.
 * Jika belum aktif, pengguna dialihkan ke halaman aktivasi modul (/app/modules/:key).
 */
export default function ModuleGuard({ moduleKey, children }) {
  const { isModuleActive, activeWorkspace } = useWorkspace();

  // Jika workspace belum terpasang atau sedang memuat, biarkan child me-render
  if (!activeWorkspace) {
    return children;
  }

  // Jika modul belum diaktifkan pada workspace aktif
  if (!isModuleActive(moduleKey)) {
    return <Navigate to={`/app/modules/${moduleKey}`} replace />;
  }

  return children;
}
