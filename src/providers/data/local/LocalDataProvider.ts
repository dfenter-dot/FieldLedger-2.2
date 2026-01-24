import { nanoid } from 'nanoid';
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
import type { IDataProvider, LibraryKind } from '../IDataProvider';

const delay = (ms = 150) => new Promise(res => setTimeout(res, ms));

const load = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
};

const save = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export class LocalDataProvider implements IDataProvider {
  /* ----------------------------- folders ----------------------------- */

  async listFolders(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
  }): Promise<Folder[]> {
    await delay();
    const all = load<Folder[]>('folders', []);
    return all.filter(
      f =>
        f.kind === args.kind &&
        f.libraryType === args.libraryType &&
        f.parentId === args.parentId
    );
  }

  async createFolder(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    await delay();
    const all = load<Folder[]>('folders', []);
    const folder: Folder = {
      id: nanoid(),
      name: args.name,
      kind: args.kind,
      libraryType: args.libraryType,
      parentId: args.parentId,
    };
    all.push(folder);
    save('folders', all);
    return folder;
  }

  /* ---------------------------- materials ---------------------------- */

  async listMaterials(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Material[]> {
    await delay();
    const all = load<Material[]>('materials', []);
    return all.filter(
      m =>
        m.libraryType === args.libraryType &&
        m.folderId === args.folderId
    );
  }

  async upsertMaterial(m: Material): Promise<Material> {
    await delay();
    const all = load<Material[]>('materials', []);
    const idx = all.findIndex(x => x.id === m.id);
    if (idx >= 0) all[idx] = m;
    else all.push({ ...m, id: nanoid() });
    save('materials', all);
    return m;
  }

  async deleteMaterial(id: string): Promise<void> {
    await delay();
    save(
      'materials',
      load<Material[]>('materials', []).filter(m => m.id !== id)
    );
  }

  /* ---------------------------- assemblies --------------------------- */

  async getAssembly(id: string): Promise<Assembly | null> {
    await delay();
    return load<Assembly[]>('assemblies', []).find(a => a.id === id) ?? null;
  }

  async listAssemblies(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Assembly[]> {
    await delay();
    const all = load<Assembly[]>('assemblies', []);
    return all.filter(
      a =>
        a.libraryType === args.libraryType &&
        a.folderId === args.folderId
    );
  }

  async upsertAssembly(a: Assembly): Promise<Assembly> {
    await delay();
    const all = load<Assembly[]>('assemblies', []);
    const idx = all.findIndex(x => x.id === a.id);
    if (idx >= 0) all[idx] = a;
    else all.push({ ...a, id: nanoid() });
    save('assemblies', all);
    return a;
  }

  async deleteAssembly(id: string): Promise<void> {
    await delay();
    save(
      'assemblies',
      load<Assembly[]>('assemblies', []).filter(a => a.id !== id)
    );
  }

  /* ----------------------------- estimates --------------------------- */

  async listEstimates(): Promise<Estimate[]> {
    await delay();
    return load<Estimate[]>('estimates', []);
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    await delay();
    return load<Estimate[]>('estimates', []).find(e => e.id === id) ?? null;
  }

  async upsertEstimate(e: Estimate): Promise<Estimate> {
    await delay();
    const all = load<Estimate[]>('estimates', []);
    const idx = all.findIndex(x => x.id === e.id);
    if (idx >= 0) all[idx] = e;
    else all.push({ ...e, id: nanoid() });
    save('estimates', all);
    return e;
  }

  async deleteEstimate(id: string): Promise<void> {
    await delay();
    save(
      'estimates',
      load<Estimate[]>('estimates', []).filter(e => e.id !== id)
    );
  }

  /* ----------------------------- job types ---------------------------- */

  async listJobTypes(): Promise<JobType[]> {
    await delay();
    return load<JobType[]>('jobTypes', []);
  }

  async upsertJobType(jt: JobType): Promise<JobType> {
    await delay();
    const all = load<JobType[]>('jobTypes', []);
    const idx = all.findIndex(x => x.id === jt.id);
    if (idx >= 0) all[idx] = jt;
    else all.push({ ...jt, id: nanoid() });
    save('jobTypes', all);
    return jt;
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    await delay();
    const all = load<JobType[]>('jobTypes', []).map(jt => ({
      ...jt,
      isDefault: jt.id === jobTypeId,
    }));
    save('jobTypes', all);
  }

  /* --------------------- branding / company / csv --------------------- */

  async getBrandingSettings(): Promise<BrandingSettings> {
    await delay();
    return load<BrandingSettings>('branding', {
      companyName: '',
      logoUrl: '',
      primaryColor: '#000000',
    });
  }

  async saveBrandingSettings(
    s: BrandingSettings
  ): Promise<BrandingSettings> {
    await delay();
    save('branding', s);
    return s;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    await delay();
    return load<CompanySettings>('company', {
      name: '',
      address: '',
      phone: '',
      email: '',
    });
  }

  async saveCompanySettings(
    s: CompanySettings
  ): Promise<CompanySettings> {
    await delay();
    save('company', s);
    return s;
  }

  async getCsvSettings(): Promise<CsvSettings> {
    await delay();
    return load<CsvSettings>('csv', {
      includeHeaders: true,
      decimalSeparator: '.',
    });
  }

  async saveCsvSettings(s: CsvSettings): Promise<CsvSettings> {
    await delay();
    save('csv', s);
    return s;
  }

  /* ----------------------------- admin rules -------------------------- */

  async listAdminRules(): Promise<AdminRule[]> {
    await delay();
    return load<AdminRule[]>('adminRules', []);
  }

  async upsertAdminRule(r: AdminRule): Promise<AdminRule> {
    await delay();
    const all = load<AdminRule[]>('adminRules', []);
    const idx = all.findIndex(x => x.id === r.id);
    if (idx >= 0) all[idx] = r;
    else all.push({ ...r, id: nanoid() });
    save('adminRules', all);
    return r;
  }

  async deleteAdminRule(id: string): Promise<void> {
    await delay();
    save(
      'adminRules',
      load<AdminRule[]>('adminRules', []).filter(r => r.id !== id)
    );
  }
}
