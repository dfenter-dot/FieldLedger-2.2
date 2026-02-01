import { ReactNode, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useData } from '../../providers/data/DataContext';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import './shell.css';

export function AppShell({ children }: { children: ReactNode }) {
  const data = useData();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const branding = await data.getBrandingSettings();
        if (cancelled) return;
        const theme = branding?.ui_theme ?? 'default';
        const root = document.documentElement;
        root.classList.toggle('theme-light', theme === 'light');
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [data]);

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


