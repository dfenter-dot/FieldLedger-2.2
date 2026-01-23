import type { IDataProvider, LibraryKind } from '../IDataProvider';
import type { Assembly, BrandingSettings, Estimate, Folder, JobType, LibraryType, Material } from '../types';
import { lsGet, lsSet, uid } from './localStore';
import { SEED_BRANDING, SEED_ESTIMATES, SEED_FOLDERS, SEED_JOB_TYPES, SEED_MATERIALS } from './seed';

const KEY = {
  folders: (kind: LibraryKind) => `fl_${kind}_folders_v1`,
  materials: `fl_materials_v1`,
  assemblies: `fl_assemblies_v1`,
  estimates: `fl_estimates_v1`,
  jobTypes: `fl_job_types_v1`,
  branding: `fl_branding_v1`,
};

function ensureSeeded(kind: LibraryKind) {
  const foldersKey = KEY.folders(kind);
  const seeded = lsGet<boolean>(`__seeded_${foldersKey}`, false);
  if (!seeded) {
    lsSet(foldersKey, SEED_FOLDERS);
    lsSet(KEY.materials, SEED_MATERIALS);
    lsSet(KEY.estimates, SEED_ESTIMATES);
    lsSet(KEY.jobTypes, SEED_JOB_TYPES);
    lsSet(KEY.branding, SEED_BRANDING);
    lsSet(`__seeded_${foldersKey}`, true);
  }
}

function sortByOrder<T extends { sortOrder: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
}

export const LocalDataProvider: IDataProvider = {
  async listFolders({ kind, libraryType, parentId }) {
    ensureSeeded(kind);
    const folders = lsGet<Folder[]>(KEY.folders(kind), []);
    return sortByOrder(folders.filter(f => f.libraryType === libraryType && f.parentId === parentId));
  },

  async createFolder({ kind, libraryType, parentId, name }) {
    ensureSeeded(kind);
    const folders = lsGet<Folder[]>(KEY.folders(kind), []);
    const nextOrder = Math.max(0, ...folders.filter(f => f.parentId === parentId && f.libraryType === libraryType).map(f => f.sortOrder)) + 1;
    const folder: Folder = {
      id: uid('folder'),
      companyId: 'mock-company',
      libraryType,
      parentId,
      name,
      sortOrder: nextOrder,
      imageUrl: null,
    };
    folders.push(folder);
    lsSet(KEY.folders(kind), folders);
    return folder;
  },

  async listMaterials({ libraryType, folderId }) {
    ensureSeeded('materials');
    const rows = lsGet<Material[]>(KEY.materials, []);
    return sortByOrder(rows.filter(m => m.libraryType === libraryType && m.folderId === folderId));
  },

  async upsertMaterial(m) {
    ensureSeeded('materials');
    const rows = lsGet<Material[]>(KEY.materials, []);
    const idx = rows.findIndex(x => x.id === m.id);
    if (idx >= 0) rows[idx] = m;
    else rows.push(m);
    lsSet(KEY.materials, rows);
    return m;
  },

  async deleteMaterial(id) {
    ensureSeeded('materials');
    const rows = lsGet<Material[]>(KEY.materials, []);
    lsSet(KEY.materials, rows.filter(x => x.id !== id));
  },

  async listAssemblies({ libraryType, folderId }) {
    ensureSeeded('assemblies');
    const rows = lsGet<Assembly[]>(KEY.assemblies, []);
    return sortByOrder(rows.filter(a => a.libraryType === libraryType && a.folderId === folderId));
  },

  async upsertAssembly(a) {
    ensureSeeded('assemblies');
    const rows = lsGet<Assembly[]>(KEY.assemblies, []);
    const idx = rows.findIndex(x => x.id === a.id);
    if (idx >= 0) rows[idx] = a;
    else rows.push(a);
    lsSet(KEY.assemblies, rows);
    return a;
  },

  async deleteAssembly(id) {
    ensureSeeded('assemblies');
    const rows = lsGet<Assembly[]>(KEY.assemblies, []);
    lsSet(KEY.assemblies, rows.filter(x => x.id !== id));
  },

  async listEstimates() {
    ensureSeeded('estimates');
    const rows = lsGet<Estimate[]>(KEY.estimates, []);
    return [...rows].sort((a,b)=> b.number - a.number);
  },

  async getEstimate(id) {
    ensureSeeded('estimates');
    const rows = lsGet<Estimate[]>(KEY.estimates, []);
    return rows.find(e => e.id === id) ?? null;
  },

  async upsertEstimate(e) {
    ensureSeeded('estimates');
    const rows = lsGet<Estimate[]>(KEY.estimates, []);
    const idx = rows.findIndex(x => x.id === e.id);
    if (idx >= 0) rows[idx] = e;
    else rows.push(e);
    lsSet(KEY.estimates, rows);
    return e;
  },

  async deleteEstimate(id) {
    ensureSeeded('estimates');
    const rows = lsGet<Estimate[]>(KEY.estimates, []);
    lsSet(KEY.estimates, rows.filter(x => x.id !== id));
  },

  async listJobTypes() {
    ensureSeeded('jobTypes');
    const rows = lsGet<JobType[]>(KEY.jobTypes, []);
    return rows;
  },

  async upsertJobType(jt) {
    ensureSeeded('jobTypes');
    const rows = lsGet<JobType[]>(KEY.jobTypes, []);
    const idx = rows.findIndex(x => x.id === jt.id);
    if (idx >= 0) rows[idx] = jt;
    else rows.push(jt);
    lsSet(KEY.jobTypes, rows);
    return jt;
  },

  async setDefaultJobType(jobTypeId) {
    ensureSeeded('jobTypes');
    const rows = lsGet<JobType[]>(KEY.jobTypes, []);
    const next = rows.map(j => ({ ...j, isDefault: j.id === jobTypeId }));
    lsSet(KEY.jobTypes, next);
  },

  async getBrandingSettings() {
    ensureSeeded('branding');
    return lsGet<BrandingSettings>(KEY.branding, {});
  },

  async saveBrandingSettings(s) {
    ensureSeeded('branding');
    lsSet(KEY.branding, s);
    return s;
  },
};
