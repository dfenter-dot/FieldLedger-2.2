import { NavLink } from 'react-router-dom';
import { useAuth } from '../../providers/auth/AuthContext';
import './mobilenav.css';

export function MobileNav() {
  const { has } = useAuth();

  return (
    <nav className="mobileNav" aria-label="Primary">
      <NavLink to="/" className={({ isActive }) => isActive ? 'mNavItem active' : 'mNavItem'}>Dashboard</NavLink>
      <NavLink to="/materials" className={({ isActive }) => isActive ? 'mNavItem active' : 'mNavItem'}>Materials</NavLink>
      <NavLink to="/assemblies" className={({ isActive }) => isActive ? 'mNavItem active' : 'mNavItem'}>Assemblies</NavLink>
      <NavLink to="/estimates" className={({ isActive }) => isActive ? 'mNavItem active' : 'mNavItem'}>Estimates</NavLink>
      {has('admin.access') ? (
        <NavLink to="/admin" className={({ isActive }) => isActive ? 'mNavItem active' : 'mNavItem'}>Admin</NavLink>
      ) : null}
    </nav>
  );
}
