import { useLocation } from 'react-router-dom';
import { useAuth } from '../../providers/auth/AuthContext';
import './topbar.css';

function titleFromPath(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/materials')) return 'Materials';
  if (pathname.startsWith('/assemblies')) return 'Assemblies';
  if (pathname.startsWith('/estimates')) return 'Estimates';
  if (pathname.startsWith('/admin/company-setup')) return 'Company Setup';
  if (pathname.startsWith('/admin/job-types')) return 'Job Types';
  if (pathname.startsWith('/admin/rules')) return 'Admin Rules';
  if (pathname.startsWith('/admin/csv')) return 'CSV';
  if (pathname.startsWith('/admin/branding')) return 'Branding';
  if (pathname.startsWith('/admin/job-costing')) return 'Job Costing';
  return 'FieldLedger';
}

export function Topbar() {
  const loc = useLocation();
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div className="topbarTitle">{titleFromPath(loc.pathname)}</div>
      <div className="topbarRight">
        <div className="chip">{user?.email}</div>
      </div>
    </header>
  );
}
