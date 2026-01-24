import { NavLink } from 'react-router-dom';
import { useAuth } from '../../providers/auth/AuthContext';
import './sidebar.css';

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebarBrand">
        <div className="brandMark">FL</div>
        <div className="brandText">
          <div className="brandName">FieldLedger</div>
          <div className="brandSub">{user?.email ?? 'Not signed in'}</div>
        </div>
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
          to="/materials/user"
          className={({ isActive }) =>
            isActive ? 'navItem active' : 'navItem'
          }
        >
          Materials
        </NavLink>

        <NavLink
          to="/assemblies/user"
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
        <div className="footerHint">Navy • Slate • Gold</div>
      </div>
    </aside>
  );
}

