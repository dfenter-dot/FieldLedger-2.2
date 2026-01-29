import type {
  AdminRule,
  Assembly,
  AssemblyItem,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  Folder,
  JobType,
  LibraryType,
  Material,
  AppMaterialOverride,
} from './types';

/**
 * IDataProvider
 *
 * AUTHORITATIVE app-wide contract for persistence.
 *
 * For this Admin phase, the contract must fully support:
 * - Company Setup
 * - Job Types
 * - Rules
 *
 * NOTE:
 * - CSV / Job Costing / Branding are intentionally present but will not be expanded
 *   until their sections are prioritized, unless absolutely necessary.
 */
export interface IDataProvider {
  /* ============================
     Context
  ============================ */

  getCurrentCompanyId(): Promise<string>;
  isAppOwner(): Promise<boolean>;

  /* ============================
     Folders
  ============================ */

  listFolders(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]>;

  createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder>;

  saveFolder(folder: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;

  /* ============================
     Materials
  ============================ */

  listMaterials(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Material[]>;

  getMaterial(id: string): Promise<Material | null>;

  saveMaterial(material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;

  getAppMaterialOverride(
    materialId: string,
    companyId: string
  ): Promise<AppMaterialOverride | null>;

  upsertAppMaterialOverride(
    override: Partial<AppMaterialOverride>
  ): Promise<AppMaterialOverride>;

  /* ============================
     Assemblies
  ============================ */

  listAssemblies(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Assembly[]>;

  getAssembly(id: string): Promise<any | null>;

  upsertAssembly(arg: any): Promise<any>;

  deleteAssembly(id: string): Promise<void>;

  /* ============================
     Estimates
  ============================ */

  getEstimates(): Promise<Estimate[]>;
  listEstimates(): Promise<Estimate[]>;

  getEstimate(id: string): Promise<Estimate | null>;
  upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate>;
  deleteEstimate(id: string): Promise<void>;

  /* ============================
     Job Types (Admin)
  ============================ */

  listJobTypes(): Promise<JobType[]>;

  // supports either upsertJobType(jobType) or upsertJobType(companyId, jobType)
  upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType>;

  // supports either deleteJobType(id) or deleteJobType(companyId, id)
  deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void>;

  /* ============================
     Company Settings (Admin)
  ============================ */

  getCompanySettings(): Promise<CompanySettings>;
  saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings>;

  /* ============================
     Admin Rules (Admin)
  ============================ */

  listAdminRules(): Promise<AdminRule[]>;
  getAdminRules(companyId: string): Promise<AdminRule[]>;

  // supports either upsertAdminRule(rule) or upsertAdminRule(companyId, rule)
  upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule>;

  saveAdminRule(rule: Partial<AdminRule>): Promise<void>;

  // supports either deleteAdminRule(id) or deleteAdminRule(companyId, id)
  deleteAdminRule(companyIdOrId: any, maybeId?: any): Promise<void>;

  /* ============================
     CSV / Branding
     (present for compilation only; will be prioritized later)
  ============================ */

  getCsvSettings(): Promise<CsvSettings>;
  saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings>;

  getBrandingSettings(): Promise<BrandingSettings>;
  saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings>;
}
