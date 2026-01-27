import React from 'react';
import { NavLink } from 'react-router-dom';

import './mobilenav.css';

export function MobileNav() {
  return (
    <nav className="mobileNav" aria-label="Primary">
      <NavLink to="/" className={({ isActive }) => (isActive ? 'mobileItem active' : 'mobileItem')}>
        Dashboard
      </NavLink>
      <NavLink
        to="/materials"
        className={({ isActive }) => (isActive ? 'mobileItem active' : 'mobileItem')}
      >
        Materials
      </NavLink>
      <NavLink
        to="/assemblies"
        className={({ isActive }) => (isActive ? 'mobileItem active' : 'mobileItem')}
      >
        Assemblies
      </NavLink>
      <NavLink
        to="/estimates"
        className={({ isActive }) => (isActive ? 'mobileItem active' : 'mobileItem')}
      >
        Estimates
      </NavLink>
      <NavLink
        to="/admin"
        className={({ isActive }) => (isActive ? 'mobileItem active' : 'mobileItem')}
      >
        Admin
      </NavLink>
    </nav>
  );
}


