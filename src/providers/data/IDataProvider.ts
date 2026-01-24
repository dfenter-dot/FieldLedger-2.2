import {
  Assembly,
  CompanySettings,
  Estimate,
  Folder,
  JobType,
  Material,
} from './types';

export interface IDataProvider {
  /* ------------------------------------------------------------------ */
  /* Folders                                                            */
  /* ------------------------------------------------------------------ */

  getFolders(kind: 'materials' | 'assemblies'): Promise<Folder[]>;
  saveFolder(folder: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;

  /* ------------------------------------------------------------------ */
  /* Materials                                                          */
  /* ------------------------------------------------------------------ */

  getMaterials(): Promise<Material[]>;
  saveMaterial(material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;

  /* ------------------------------------------------------------------ */
  /* Assemblies                                                         */
  /* ------------------------------------------------------------------ */

  getAssemblies(): Promise<Assembly[]>;
  saveAssembly(assembly: Partial<Assembly>): Promise<Assembly>;
  deleteAssembly(id: string): Promise<void>;

  /* ------------------------------------------------------------------ */
  /* Estimates                                                          */
  /* ------------------------------------------------------------------ */

  // Some UI code still calls listEstimates(); keep both for compatibility
  listEstimates(): Promise<Estimate[]>;
  getEstimates(): Promise<Estimate[]>;
  saveEstimate(estimate: Partial<Estimate>): Promise<Estimate>;
  deleteEstimate(id: string): Promise<void>;

  /* ------------------------------------------------------------------ */
  /* Admin                                                              */
  /* ------------------------------------------------------------------ */

  getJobTypes(): Promise<JobType[]>;
  saveJobType(jobType: Partial<JobType>): Promise<JobType>;

  getCompanySettings(): Promise<CompanySettings>;
  saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings>;
}
