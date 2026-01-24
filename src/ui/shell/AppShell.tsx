import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import './shell.css';

export function AppShell({ children }: { children: ReactNode }) {
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

