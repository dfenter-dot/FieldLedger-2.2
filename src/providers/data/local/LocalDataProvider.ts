// src/providers/data/local/LocalDataProvider.ts

import type { IDataProvider, LibraryKind } from '../IDataProvider';
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
} from '../types';

import {
  seedAdminRules,
  seedAssemblies,
  seedBrandingSettings,
  seedCompanySettings,
  seedCsvSettings,
  seedEstimates,
  seedFolders,
  seedJobTypes,
  seedMaterials,
} from './seed';

export class LocalDataProvider implements IDataProvider {
  private folders: Folder[] = [...seedFolders];
  private materials: Material[] = [...seedMaterials];
  private assemblies: Assembly[] = [...seedAssemblies];
  private estimates: Estimate[] = [...seedEstimates];
  private jobTypes: JobType[] = [...seedJobTypes];
  private adminRules: AdminRule[] = [...seedAdminRules];
  private companySettings: CompanySettings = { ...seedCompanySettings };
  private csvSettings: CsvSettings = { ...seedCsvSettings };
  private brandingSettings: BrandingSettings = { ...seedBrandingSettings };

  /* ---------------- Folders ---------------- */

  async listFolders(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
  }): Promise<Folder[]> {
    return this.folders.filter(
      f =>
        f.kind === args.kind &&
        f.library_type === args.libraryType &&
        f.parent_id === args.parentId
    );
  }

  async createFolder(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: args.name,
      parent_id: args.parentId,
      kind: args.kind,
      library_type: args.libraryType,
      company_id: 'demo-company-id',
      created_at: new Date().toISOString(),
    };

    this.folders.push(folder);
    return folder;
  }

  /* ---------------- Materials ---------------- */

  async listMaterials(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Material[]> {
    return this.materials.filter(
      m =>
        m.folder_id === args.folderId &&
        (args.libraryType === 'company'
          ? m.company_id !== null
          : m.company_id === null)
    );
  }

  async upsertMaterial(m: Material): Promise<Material> {
    const idx = this.materials.findIndex(x => x.id === m.id);
    if (idx >= 0) this.materials[idx] = m;
    else this.materials.push(m);
    return m;
  }

  async deleteMaterial(id: string): Promise<void> {
    this.materials = this.materials.filter(m => m.id !== id);
  }

  /* ---------------- Assemblies ---------------- */

  async listAssemblies(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Assembly[]> {
    return this.assemblies.filter(
      a =>
        a.folder_id === args.folderId &&
        (args.libraryType === 'company'
          ? a.company_id !== null
          : a.company_id === null)
    );
  }

  async upsertAssembly(a: Assembly): Promise<Assembly> {
    const idx = this.assemblies.findIndex(x => x.id === a.id);
    if (idx >= 0) this.assemblies[idx] = a;
    else this.assemblies.push(a);
    return a;
  }

  async deleteAssembly(id: string): Promise<void> {
    this.assemblies = this.assemblies.filter(a => a.id !== id);
  }

  /* ---------------- Estimates ---------------- */

  async listEstimates(): Promise<Estimate[]> {
    return [...this.estimates];
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    return this.estimates.find(e => e.id === id) ?? null;
  }

  async upsertEstimate(e: Estimate): Promise<Estimate> {
    const idx = this.estimates.findIndex(x => x.id === e.id);
    if (idx >= 0) this.estimates[idx] = e;
    else this.estimates.push(e);
    return e;
  }

  async deleteEstimate(id: string): Promise<void> {
    this.estimates = this.estimates.filter(e => e.id !== id);
  }

  /* ---------------- Job Types ---------------- */

  async listJobTypes(): Promise<JobType[]> {
    return [...this.jobTypes];
  }

  async upsertJobType(jt: JobType): Promise<JobType> {
    const idx = this.jobTypes.findIndex(x => x.id === jt.id);
    if (idx >= 0) this.jobTypes[idx] = jt;
    else this.jobTypes.push(jt);
    return jt;
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    this.jobTypes = this.jobTypes.map(jt => ({
      ...jt,
      is_default: jt.id === jobTypeId,
    }));
  }

  /* ---------------- Admin Rules ---------------- */

  async listAdminRules(): Promise<AdminRule[]> {
    return [...this.adminRules].sort((a, b) => a.priority - b.priority);
  }

  async upsertAdminRule(r: AdminRule): Promise<AdminRule> {
    const idx = this.adminRules.findIndex(x => x.id === r.id);
    if (idx >= 0) this.adminRules[idx] = r;
    else this.adminRules.push(r);
    return r;
  }

  async deleteAdminRule(id: string): Promise<void> {
    this.adminRules = this.adminRules.filter(r => r.id !== id);
  }

  /* ---------------- Settings ---------------- */

  async getCompanySettings(): Promise<CompanySettings> {
    return this.companySettings;
  }

  async saveCompanySettings(s: CompanySettings): Promise<CompanySettings> {
    this.companySettings = {
      ...s,
      updated_at: new Date().toISOString(),
    };
    return this.companySettings;
  }

  async getCsvSettings(): Promise<CsvSettings> {
    return this.csvSettings;
  }

  async saveCsvSettings(s: CsvSettings): Promise<CsvSettings> {
    this.csvSettings = {
      ...s,
      updated_at: new Date().toISOString(),
    };
    return this.csvSettings;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    return this.brandingSettings;
  }

  async saveBrandingSettings(
    s: BrandingSettings
  ): Promise<BrandingSettings> {
    this.brandingSettings = {
      ...s,
      updated_at: new Date().toISOString(),
    };
    return this.brandingSettings;
  }
}
