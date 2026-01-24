import {
  Assembly,
  CompanySettings,
  Estimate,
  Folder,
  JobType,
  Material,
} from '../types';
import { IDataProvider } from '../IDataProvider';
import {
  seedCompanySettings,
  seedDefaultJobType,
} from './seed';

/**
 * LocalDataProvider
 * -----------------
 * Used ONLY for local/dev/demo contexts.
 * Live app must use SupabaseDataProvider.
 */
export class LocalDataProvider implements IDataProvider {
  private folders: Folder[] = [];
  private materials: Material[] = [];
  private assemblies: Assembly[] = [];
  private estimates: Estimate[] = [];
  private jobTypes: JobType[] = [];
  private companySettings!: CompanySettings;

  constructor(private companyId: string) {
    this.bootstrap();
  }

  private bootstrap() {
    // Seed company settings
    this.companySettings = seedCompanySettings(this.companyId);

    // Seed default job type
    const defaultJobType = seedDefaultJobType(this.companyId);
    this.jobTypes.push(defaultJobType);
  }

  /* ------------------------------------------------------------------ */
  /* Folders                                                            */
  /* ------------------------------------------------------------------ */

  async getFolders(kind: 'materials' | 'assemblies'): Promise<Folder[]> {
    return this.folders.filter(f => f.kind === kind);
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    if (folder.id) {
      const idx = this.folders.findIndex(f => f.id === folder.id);
      if (idx >= 0) {
        this.folders[idx] = { ...this.folders[idx], ...folder } as Folder;
        return this.folders[idx];
      }
    }

    const newFolder: Folder = {
      ...(folder as Folder),
    };
    this.folders.push(newFolder);
    return newFolder;
  }

  async deleteFolder(id: string): Promise<void> {
    this.folders = this.folders.filter(f => f.id !== id);
  }

  /* ------------------------------------------------------------------ */
  /* Materials                                                          */
  /* ------------------------------------------------------------------ */

  async getMaterials(): Promise<Material[]> {
    return this.materials;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    if (material.id) {
      const idx = this.materials.findIndex(m => m.id === material.id);
      if (idx >= 0) {
        this.materials[idx] = {
          ...this.materials[idx],
          ...material,
        } as Material;
        return this.materials[idx];
      }
    }

    const newMaterial = material as Material;
    this.materials.push(newMaterial);
    return newMaterial;
  }

  async deleteMaterial(id: string): Promise<void> {
    this.materials = this.materials.filter(m => m.id !== id);
  }

  /* ------------------------------------------------------------------ */
  /* Assemblies                                                         */
  /* ------------------------------------------------------------------ */

  async getAssemblies(): Promise<Assembly[]> {
    return this.assemblies;
  }

  async saveAssembly(assembly: Partial<Assembly>): Promise<Assembly> {
    if (assembly.id) {
      const idx = this.assemblies.findIndex(a => a.id === assembly.id);
      if (idx >= 0) {
        this.assemblies[idx] = {
          ...this.assemblies[idx],
          ...assembly,
        } as Assembly;
        return this.assemblies[idx];
      }
    }

    const newAssembly = assembly as Assembly;
    this.assemblies.push(newAssembly);
    return newAssembly;
  }

  async deleteAssembly(id: string): Promise<void> {
    this.assemblies = this.assemblies.filter(a => a.id !== id);
  }

  /* ------------------------------------------------------------------ */
  /* Estimates                                                          */
  /* ------------------------------------------------------------------ */

  async getEstimates(): Promise<Estimate[]> {
    return this.estimates;
  }

  async saveEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    if (estimate.id) {
      const idx = this.estimates.findIndex(e => e.id === estimate.id);
      if (idx >= 0) {
        this.estimates[idx] = {
          ...this.estimates[idx],
          ...estimate,
        } as Estimate;
        return this.estimates[idx];
      }
    }

    const newEstimate = estimate as Estimate;
    this.estimates.push(newEstimate);
    return newEstimate;
  }

  async deleteEstimate(id: string): Promise<void> {
    this.estimates = this.estimates.filter(e => e.id !== id);
  }

  /* ------------------------------------------------------------------ */
  /* Admin                                                              */
  /* ------------------------------------------------------------------ */

  async getJobTypes(): Promise<JobType[]> {
    return this.jobTypes;
  }

  async saveJobType(jobType: Partial<JobType>): Promise<JobType> {
    if (jobType.id) {
      const idx = this.jobTypes.findIndex(j => j.id === jobType.id);
      if (idx >= 0) {
        this.jobTypes[idx] = {
          ...this.jobTypes[idx],
          ...jobType,
        } as JobType;
        return this.jobTypes[idx];
      }
    }

    const newJobType = jobType as JobType;
    this.jobTypes.push(newJobType);
    return newJobType;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    return this.companySettings;
  }

  async saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings> {
    this.companySettings = {
      ...this.companySettings,
      ...settings,
    };
    return this.companySettings;
  }
}
