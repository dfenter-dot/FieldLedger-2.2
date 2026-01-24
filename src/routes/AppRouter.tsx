import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../ui/shell/AppShell';
import { DashboardPage } from '../views/dashboard/DashboardPage';
import { MaterialsHomePage } from '../views/materials/MaterialsHomePage';
import { MaterialEditorPage } from '../views/materials/MaterialEditorPage';
import { LibraryFolderPage } from '../views/library/LibraryFolderPage';
import { AssembliesHomePage } from '../views/assemblies/AssembliesHomePage';
import { AssemblyEditorPage } from '../views/assemblies/AssemblyEditorPage';
import { EstimatesPage } from '../views/estimates/EstimatesPage';
import { EstimateEditorPage } from '../views/estimates/EstimateEditorPage';
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

export function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <LoginPage />;
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


