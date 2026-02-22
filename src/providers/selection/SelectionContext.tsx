import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type SelectionMode =
  | { type: 'none' }
  | { type: 'add-materials-to-assembly'; assemblyId: string }
  | { type: 'add-materials-to-estimate'; estimateId: string; optionId?: string | null }
  | { type: 'add-assemblies-to-estimate'; estimateId: string; optionId?: string | null }
  | { type: 'job-costing-pick-estimate' }
  | { type: 'pick-assemblies-for-export'; returnTo: string };

type SelectionContextValue = {
  mode: SelectionMode;
  setMode: (m: SelectionMode) => void;
  exportAssemblyIds: string[];
  setExportAssemblyIds: (ids: string[]) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SelectionMode>({ type: 'none' });
  const [exportAssemblyIds, setExportAssemblyIds] = useState<string[]>([]);

  const value = useMemo(
    () => ({ mode, setMode, exportAssemblyIds, setExportAssemblyIds }),
    [mode, exportAssemblyIds]
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}



