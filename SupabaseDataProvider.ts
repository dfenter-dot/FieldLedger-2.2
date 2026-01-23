import type { IDataProvider } from '../IDataProvider';
import type { Assembly, BrandingSettings, Estimate, Folder, JobType, LibraryType, Material } from '../types';

/**
 * SupabaseDataProvider (v0.1)
 * -------------------------
 * This is a stub that defines the contract and keeps the app compiling.
 * Replace the internals with your Supabase queries + RLS setup.
 *
 * IMPORTANT:
 * - Production should not use localStorage.
 * - Do not hardcode secrets; use Netlify env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 */
function notImplemented(name: string): never {
  throw new Error(`SupabaseDataProvider.${name} not implemented yet. Wire this to your Supabase schema.`);
}

export const SupabaseDataProvider: IDataProvider = {
  async listFolders() { notImplemented('listFolders'); },
  async createFolder() { notImplemented('createFolder'); },

  async listMaterials() { notImplemented('listMaterials'); },
  async upsertMaterial(m: Material) { return m; },
  async deleteMaterial() { notImplemented('deleteMaterial'); },

  async listAssemblies() { notImplemented('listAssemblies'); },
  async upsertAssembly(a: Assembly) { return a; },
  async deleteAssembly() { notImplemented('deleteAssembly'); },

  async listEstimates() { notImplemented('listEstimates'); },
  async getEstimate() { notImplemented('getEstimate'); },
  async upsertEstimate(e: Estimate) { return e; },
  async deleteEstimate() { notImplemented('deleteEstimate'); },

  async listJobTypes() { notImplemented('listJobTypes'); },
  async upsertJobType(jt: JobType) { return jt; },
  async setDefaultJobType() { notImplemented('setDefaultJobType'); },

  async getBrandingSettings(): Promise<BrandingSettings> { notImplemented('getBrandingSettings'); },
  async saveBrandingSettings(s: BrandingSettings): Promise<BrandingSettings> { return s; },
};
