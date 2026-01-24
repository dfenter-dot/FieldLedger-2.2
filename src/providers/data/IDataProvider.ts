import type {
  Assembly,
  BrandingSettings,
  Estimate,
  Folder,
  JobType,
  LibraryType,
  Material,
} from './types';

export type LibraryKind = 'materials' | 'assemblies';

export type IDataProvider = {
  // Folders
  listFolders: (args: { kind: LibraryKind; libraryType: LibraryType; parentId: string | null }) => Promise<Folder[]>;
  createFolder: (args: { kind: LibraryKind; libraryType: LibraryType; parentId: string | null; name: string }) => Promise<Folder>;

  // Materials
  listMaterials: (args: { libraryType: LibraryType; folderId: string }) => Promise<Material[]>;
  upsertMaterial: (m: Material) => Promise<Material>;
  deleteMaterial: (id: string) => Promise<void>;

  // Assemblies
  listAssemblies: (args: { libraryType: LibraryType; folderId: string }) => Promise<Assembly[]>;
  upsertAssembly: (a: Assembly) => Promise<Assembly>;
  deleteAssembly: (id: string) => Promise<void>;

  // Estimates
  listEstimates: () => Promise<Estimate[]>;
  getEstimate: (id: string) => Promise<Estimate | null>;
  upsertEstimate: (e: Estimate) => Promise<Estimate>;
  deleteEstimate: (id: string) => Promise<void>;

  // Admin
  listJobTypes: () => Promise<JobType[]>;
  upsertJobType: (jt: JobType) => Promise<JobType>;
  setDefaultJobType: (jobTypeId: string) => Promise<void>;

  getBrandingSettings: () => Promise<BrandingSettings>;
  saveBrandingSettings: (s: BrandingSettings) => Promise<BrandingSettings>;
};
