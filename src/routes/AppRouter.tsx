import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppShell } from '../ui/shell/AppShell';
import { DashboardPage } from '../views/dashboard/DashboardPage';
import { MaterialsHomePage } from '../views/materials/MaterialsHomePage';
import { MaterialEditorPage } from '../views/materials/MaterialEditorPage';
import { LibraryFolderPage } from '../views/library/LibraryFolderPage';
import { AssembliesHomePage } from '../views/assemblies/AssembliesHomePage';
import { AssemblyEditorPage } from '../views/assemblies/AssemblyEditorPage';
import { EstimatesPage } from '../views/estimates/EstimatesPage';
import { EstimateEditorPage } from '../views/estimates/EstimateEditorPage';
import { EstimatePreviewPage } from '../views/estimates/EstimatePreviewPage';
import { EstimateOptionsPage } from '../views/estimates/EstimateOptionsPage';
import { JobCostingPage } from '../views/admin/JobCostingPage';
import { AdminLayout } from '../views/admin/AdminLayout';
import { AdminHomePage } from '../views/admin/AdminHomePage';
import { CompanySetupPage } from '../views/admin/CompanySetupPage';
import { JobTypesPage } from '../views/admin/JobTypesPage';
import { AdminRulesPage } from '../views/admin/AdminRulesPage';
import { CsvPage } from '../views/admin/CsvPage';
import { BrandingPage } from '../views/admin/BrandingPage';
import { useAuth } from '../providers/auth/AuthContext';
import { LoginPage } from '../views/auth/LoginPage';
import { PendingAccessPage } from '../views/auth/PendingAccessPage';
import { supabase } from '../supabase/client';

export function AppRouter() {
  const { user, isLoading } = useAuth();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);

  // Guard: a user can authenticate before they are assigned to a company.
  // Keep hooks unconditional; drive behavior off `user`.
  useEffect(() => {
    let cancelled = false;

    // If logged out, reset.
    if (!user?.id) {
      setCompanyReady(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('company_id, access_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        // If the profile row isn't readable yet (RLS/migration), don't hard-block the app.
        // But if we *can* read it and there's no company_id (or it's pending), show the pending screen.
        if (error) {
          setCompanyReady(true);
          return;
        }

        const status = String((data as any)?.access_status ?? 'active').toLowerCase();
        const companyId = (data as any)?.company_id ?? null;
        setCompanyReady(Boolean(companyId) && status !== 'pending');
      } catch {
        if (!cancelled) setCompanyReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (companyReady === false) {
    return <PendingAccessPage />;
  }

  if (companyReady === null) {
    return null;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />

        {/* Materials */}
        <Route path="/materials" element={<MaterialsHomePage />} />
        <Route path="/materials/:libraryType/:materialId" element={<MaterialEditorPage />} />
        <Route path="/materials/:libraryType/*" element={<LibraryFolderPage kind="materials" />} />

        {/* Assemblies */}
        <Route path="/assemblies" element={<AssembliesHomePage />} />
        <Route path="/assemblies/:libraryType/:assemblyId" element={<AssemblyEditorPage />} />
        <Route path="/assemblies/:libraryType/*" element={<LibraryFolderPage kind="assemblies" />} />

        {/* Estimates */}
        <Route path="/estimates" element={<EstimatesPage />} />
        <Route path="/estimates/:estimateId/preview" element={<EstimatePreviewPage />} />
        <Route path="/estimates/:estimateId/options" element={<EstimateOptionsPage />} />
        <Route path="/estimates/:estimateId" element={<EstimateEditorPage />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHomePage />} />
          <Route path="company-setup" element={<CompanySetupPage />} />
          <Route path="job-types" element={<JobTypesPage />} />
          <Route path="rules" element={<AdminRulesPage />} />
          <Route path="csv" element={<CsvPage />} />
          <Route path="branding" element={<BrandingPage />} />
          <Route path="job-costing" element={<JobCostingPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}




