import { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthContext';
import { DataProvider } from './data/DataContext';
import { SelectionProvider } from './selection/SelectionContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>
        <SelectionProvider>
          {children}
        </SelectionProvider>
      </DataProvider>
    </AuthProvider>
  );
}
