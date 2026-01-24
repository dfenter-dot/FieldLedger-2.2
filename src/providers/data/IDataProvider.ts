import type {
  AdminRule,
  Assembly,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  Folder,
  JobType,
  Material,
} from './types';

export type LibraryKind = 'materials' | 'assemblies' | 'estimates';

export interface IDataProvider {
  // folders
  listFolders(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
  }): Promise<Folder[]>;

  createFolder(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
    name: string;
  }): Promise<Folder>;

  // materials
  listMaterials(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Material[]>;

  upsertMaterial(m: Material): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;

  // assemblies
  getAssembly(id: string): Promise<Assembly | null>;

  listAssemblies(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Assembly[]>;

  upsertAssembly(a: Assembly): Promise<Assembly>;
  deleteAssembly(id: string): Promise<void>;

  // estimates
  listEstimates(): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | null>;
  upsertEstimate(e: Estimate): Promise<Estimate>;
  deleteEstimate(id: string): Promise<void>;

  // job types
  listJobTypes(): Promise<JobType[]>;
  upsertJobType(jt: JobType): Promise<JobType>;
  setDefaultJobType(jobTypeId: string): Promise<void>;

  // branding / company / csv
  getBrandingSettings(): Promise<BrandingSettings>;
  saveBrandingSettings(s: BrandingSettings): Promise<BrandingSettings>;

  getCompanySettings(): Promise<CompanySettings>;
  saveCompanySettings(s: CompanySettings): Promise<CompanySettings>;

  getCsvSettings(): Promise<CsvSettings>;
  saveCsvSettings(s: CsvSettings): Promise<CsvSettings>;

  // admin rules
  listAdminRules(): Promise<AdminRule[]>;
  upsertAdminRule(r: AdminRule): Promise<AdminRule>;
  deleteAdminRule(id: string): Promise<void>;
}
