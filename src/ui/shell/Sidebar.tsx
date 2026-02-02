import { NavLink } from 'react-router-dom';
import { useAuth } from '../../providers/auth/AuthContext';
import './sidebar.css';

export function Sidebar() {
  const { signOut } = useAuth();

  async function handleLogout() {
    try {
      await signOut();
      // AppRouter will automatically render LoginPage when user becomes null.
    } catch {
      // ignore
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebarBrand" aria-label="FieldLedger">
        <div className="brandMark">FL</div>
      </div>

      <nav className="sidebarNav">
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? 'navItem active' : 'navItem'
          }
        >
          Dashboard
        </NavLink>

        <NavLink
          to="/materials"
          className={({ isActive }) =>
            isActive ? 'navItem active' : 'navItem'
          }
        >
          Materials
        </NavLink>

        <NavLink
          to="/assemblies"
          className={({ isActive }) =>
            isActive ? 'navItem active' : 'navItem'
          }
        >
          Assemblies
        </NavLink>

        <NavLink
          to="/estimates"
          className={({ isActive }) =>
            isActive ? 'navItem active' : 'navItem'
          }
        >
          Estimates
        </NavLink>

        <div className="navGroup">
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              isActive ? 'navItem active' : 'navItem'
            }
          >
            Admin
          </NavLink>
        </div>
      </nav>

      <div className="sidebarFooter">
        <button className="logoutBtn" onClick={handleLogout} type="button">
          Log Out
        </button>
        <div className="footerHint">Navy • Slate • Gold</div>
      </div>
    </aside>
  );
}



