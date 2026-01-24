import { ReactNode } from 'react';
import { DialogProvider } from './dialogs/DialogContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return <DialogProvider>{children}</DialogProvider>;
}
