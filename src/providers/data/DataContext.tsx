import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { IDataProvider } from './IDataProvider';
import { useAuth } from '../auth/AuthContext';
import { createDataProvider } from './dataProviderFactory.ts';
import {
  Assembly,
  Estimate,
  JobType,
  Material,
  BrandingSettings,
  CompanySettings,
  AdminRule,
} from './types';

interface DataContextValue {
  provider: IDataProvider | null;
  companyId: string | null;
  estimates: Estimate[];
  materials: Material[];
  assemblies: Assembly[];
  jobTypes: JobType[];
  branding: BrandingSettings | null;
  companySettings: CompanySettings | null;
  rules: AdminRule[];
  reloadAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [provider, setProvider] = useState<IDataProvider | null>(null);

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [rules, setRules] = useState<AdminRule[]>([]);

  // Resolve company FIRST
  useEffect(() => {
    if (!session) return;

    const resolveCompany = async () => {
      const baseProvider = createDataProvider('supabase');
      const cid = await baseProvider.getCompanyIdForUser(session.user.id);

      if (!cid) {
        console.error('Company ID could not be resolved');
        return;
      }

      setCompanyId(cid);
      setProvider(createDataProvider('supabase', cid));
    };

    resolveCompany();
  }, [session]);

  // HARD GUARD: never query without company + provider
  const reloadAll = async () => {
    if (!provider || !companyId) return;

    const [
      estimatesRes,
      materialsRes,
      assembliesRes,
      jobTypesRes,
      brandingRes,
      companySettingsRes,
      rulesRes,
    ] = await Promise.all([
      provider.getEstimates(),
      provider.getMaterials(),
      provider.getAssemblies(),
      provider.getJobTypes(),
      provider.getBrandingSettings(),
      provider.getCompanySettings(),
      provider.getRules(),
    ]);

    setEstimates(estimatesRes ?? []);
    setMaterials(materialsRes ?? []);
    setAssemblies(assembliesRes ?? []);
    setJobTypes(jobTypesRes ?? []);
    setBranding(brandingRes ?? null);
    setCompanySettings(companySettingsRes ?? null);
    setRules(rulesRes ?? []);
  };

  useEffect(() => {
    if (!provider || !companyId) return;
    reloadAll();
  }, [provider, companyId]);

  const value = useMemo(
    () => ({
      provider,
      companyId,
      estimates,
      materials,
      assemblies,
      jobTypes,
      branding,
      companySettings,
      rules,
      reloadAll,
    }),
    [
      provider,
      companyId,
      estimates,
      materials,
      assemblies,
      jobTypes,
      branding,
      companySettings,
      rules,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
