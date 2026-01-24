import { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthContext';
import { DataProvider } from './data/DataContext';
import { SelectionProvider } from './selection/SelectionContext';
import { DialogProvider } from './dialogs/DialogContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>
        <SelectionProvider>
          <DialogProvider>{children}</DialogProvider>
        </SelectionProvider>
      </DataProvider>
    </AuthProvider>
  );
}

