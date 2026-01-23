import { Outlet } from 'react-router-dom';
import { useAuth } from '../../providers/auth/AuthContext';

export function AdminLayout() {
  const { has } = useAuth();
  if (!has('admin.access')) {
    return <div className="muted">Admin access required.</div>;
  }
  return <Outlet />;
}
