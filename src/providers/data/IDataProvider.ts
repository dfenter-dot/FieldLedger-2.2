import {
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
 * AUTHORITATIVE data contract between UI and persistence.
 * All pages must go through this interface.
 *
 * IMPORTANT RULES:
 * - No page talks directly to Supabase.
 * - Ownership (app vs company) is resolved inside the provider.
 * - All saves are explicit (Save / Apply Changes).
 * - Provider returns canonical shapes defined in types.ts.
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

  getAssembly(id: string): Promise<Assembly | null>;

  /**
   * Upsert an assembly and its items.
   * - Assembly must belong to a folder.
   * - Items are persisted in assembly_items.
   */
  saveAssembly(args: {
    assembly: Partial<Assembly>;
    items?: AssemblyItem[];
  }): Promise<Assembly>;

  deleteAssembly(id: string): Promise<void>;

  /* ============================
     Estimates
  ============================ */

  listEstimates(): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | null>;
  saveEstimate(estimate: Partial<Estimate>): Promise<Estimate>;
  deleteEstimate(id: string): Promise<void>;

  /* ============================
     Job Types
  ============================ */

  listJobTypes(): Promise<JobType[]>;
  saveJobType(jobType: Partial<JobType>): Promise<JobType>;
  deleteJobType(id: string): Promise<void>;

  /* ============================
     Admin Rules
  ============================ */

  listAdminRules(): Promise<AdminRule[]>;
  saveAdminRule(rule: Partial<AdminRule>): Promise<AdminRule>;
  deleteAdminRule(id: string): Promise<void>;

  /* ============================
     Company Settings
  ============================ */

  getCompanySettings(): Promise<CompanySettings>;
  saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings>;

  /* ============================
     CSV / Branding
  ============================ */

  getCsvSettings(): Promise<CsvSettings>;
  saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings>;

  getBrandingSettings(): Promise<BrandingSettings>;
  saveBrandingSettings(
    settings: Partial<BrandingSettings>
  ): Promise<BrandingSettings>;
}
