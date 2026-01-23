import { NavLink } from 'react-router-dom';
import { useAuth } from '../../providers/auth/AuthContext';
import './sidebar.css';

export function Sidebar() {
  const { user, has } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebarBrand">
        <div className="brandMark">FL</div>
        <div className="brandText">
          <div className="brandName">FieldLedger</div>
          <div className="brandSub">{user?.role === 'admin' ? 'Admin' : 'Technician'}</div>
        </div>
      </div>

      <nav className="sidebarNav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Dashboard</NavLink>
        <NavLink to="/materials" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Materials</NavLink>
        <NavLink to="/assemblies" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Assemblies</NavLink>
        <NavLink to="/estimates" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Estimates</NavLink>

        {has('admin.access') && (
          <div className="navGroup">
            <div className="navGroupLabel">Admin</div>
            <NavLink to="/admin/company-setup" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Company Setup</NavLink>
            <NavLink to="/admin/job-types" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Job Types</NavLink>
            <NavLink to="/admin/rules" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Admin Rules</NavLink>
            <NavLink to="/admin/csv" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>CSV</NavLink>
            <NavLink to="/admin/branding" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Branding</NavLink>
            <NavLink to="/admin/job-costing" className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>Job Costing</NavLink>
          </div>
        )}
      </nav>

      <div className="sidebarFooter">
        <div className="footerHint">Navy • Slate • Gold</div>
      </div>
    </aside>
  );
}
