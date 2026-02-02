import { ReactNode, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import './shell.css';

export function AppShell({ children }: { children: ReactNode }) {
useEffect(() => {
  const root = document.documentElement;

  const applyTheme = () => {
    const v = (localStorage.getItem('fieldledger_theme') as 'default' | 'light' | null) ?? 'default';
    root.classList.toggle('theme-light', v === 'light');
  };

  applyTheme();

  const onStorage = (e: StorageEvent) => {
    if (e.key === 'fieldledger_theme') applyTheme();
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}, []);

  return (
    <div className="appShell">
      <Sidebar />
      <div className="appMain">
        <Topbar />
        <main className="appContent">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}



