import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type SelectionMode =
  | { type: 'none' }
  | { type: 'add-materials-to-assembly'; assemblyId: string }
  | { type: 'add-materials-to-estimate'; estimateId: string }
  | { type: 'add-assemblies-to-estimate'; estimateId: string }
  | { type: 'job-costing-pick-estimate' };

type SelectionContextValue = {
  mode: SelectionMode;
  setMode: (m: SelectionMode) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SelectionMode>({ type: 'none' });

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}

