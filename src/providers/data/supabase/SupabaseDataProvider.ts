import { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminRule,
  Assembly,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  Folder,
  JobType,
  LibraryType,
  Material,
  AppMaterialOverride,
} from '../types';
import { IDataProvider } from '../IDataProvider';
import { seedCompanySettings } from '../local/seed';

/**
 * IMPORTANT
 * This provider maps the UI/types model to your current Supabase schema.
 *
 * Your DB schema (from your screenshots):
 * - folders: { owner, library, sort_order, parent_id, company_id, name, created_at, ... }  // NO updated_at
 * - materials: { owner, company_id, folder_id, base_cost, labor_minutes, job_type_id, taxable, ... }
 * - app_material_overrides: { company_id, material_id, override_job_type_id, override_taxable, custom_cost, use_custom_cost, updated_at }
 *
 * The UI/types currently expect legacy fields like Folder.kind / library_type / order_index
 * and Material.unit_cost (rather than base_cost). This file performs the translation.
 */

type DbOwner = 'user' | 'app';
type DbLibrary = 'materials' | 'assemblies';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  private _isAppOwner: boolean | null = null;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private async currentCompanyId(): Promise<string> {
    const { data, error } = await this.supabase.from('profiles').select('company_id').single();
    if (error || !data?.company_id) throw new Error('No company context available');
    return data.company_id;
  }

  async getCurrentCompanyId(): Promise<string> {
    return this.currentCompanyId();
  }

  /**
   * App owner detection (best-effort):
   * - Prefer VITE_APP_OWNER_EMAIL env var (matches auth user email)
   * - If not set, try profiles.is_app_owner boolean (if the column exists)
   * - Otherwise default false
   */
  async isAppOwner(): Promise<boolean> {
    if (this._isAppOwner != null) return this._isAppOwner;

    // 1) Env var based
    const envEmail = (import.meta as any)?.env?.VITE_APP_OWNER_EMAIL;
    try {
      const { data } = await this.supabase.auth.getUser();
      const email = data?.user?.email ?? '';
      if (envEmail && email && String(envEmail).toLowerCase() === String(email).toLowerCase()) {
        this._isAppOwner = true;
        return true;
      }
    } catch {
      // ignore
    }

    // 2) DB column based (safe-fail if column doesn't exist)
    try {
      const { data, error } = await this.supabase.from('profiles').select('is_app_owner').single();
      if (!error && data && typeof (data as any).is_app_owner === 'boolean') {
        this._isAppOwner = Boolean((data as any).is_app_owner);
        return this._isAppOwner;
      }
    } catch {
      // ignore
    }

    this._isAppOwner = false;
    return false;
  }

  private toDbOwner(libraryType: LibraryType): DbOwner {
    // UI: company = user-owned, personal = app-owned
    return libraryType === 'company' ? 'user' : 'app';
  }

  private fromDbOwner(owner: DbOwner): LibraryType {
    return owner === 'user' ? 'company' : 'personal';
  }

  private mapFolderFromDb(row: any): Folder {
    return {
      id: row.id,
      kind: (row.library ?? 'materials') as any,
      library_type: this.fromDbOwner((row.owner ?? 'user') as DbOwner),
      company_id: row.company_id ?? null,
      parent_id: row.parent_id ?? null,
      name: row.name,
      order_index: Number(row.sort_order ?? 0),
      created_at: row.created_at ?? undefined,
      updated_at: (row.updated_at ?? undefined) as any, // some envs may have it; DB currently does not
    } as Folder;
  }

  private mapFolderToDb(folder: Partial<Folder>): any {
    const dbOwner: DbOwner = folder.library_type ? this.toDbOwner(folder.library_type) : 'user';
    const dbLibrary: DbLibrary = (folder.kind ?? 'materials') as DbLibrary;

    return {
      id: folder.id,
      owner: dbOwner,
      library: dbLibrary,
      company_id: folder.company_id ?? null,
      parent_id: folder.parent_id ?? null,
      name: folder.name,
      sort_order: folder.order_index ?? 0,
      created_at: folder.created_at,
      // DO NOT include updated_at (folders table doesn't have it)
    };
  }

  private mapMaterialFromDb(row: any): Material {
    return {
      id: row.id,
      company_id: row.company_id ?? null,
      folder_id: row.folder_id ?? null,
      name: row.name,
      sku: row.sku ?? null,
      description: row.description ?? null,
      unit_cost: Number(row.base_cost ?? 0),
      taxable: Boolean(row.taxable ?? false),
      labor_minutes: typeof row.labor_minutes === 'number' ? row.labor_minutes : undefined,
      job_type_id: row.job_type_id ?? null,
      order_index: typeof row.sort_order === 'number' ? row.sort_order : undefined,
      created_at: row.created_at ?? undefined,
      updated_at: row.updated_at ?? undefined,
      __is_app_material: row.owner === 'app' || row.company_id == null,
    } as Material;
  }

  private mapMaterialToDb(material: Partial<Material>, companyId: string): any {
    // If company_id is explicitly null, treat as app-owned.
    const isExplicitApp = material.company_id === null;
    const isCompanyRow = material.company_id ? true : !isExplicitApp;

    const owner: DbOwner = isCompanyRow ? 'user' : 'app';
    const company_id = isCompanyRow ? (material.company_id ?? companyId) : null;

    return {
      id: material.id,
      owner,
      company_id,
      folder_id: material.folder_id ?? null,
      name: material.name,
      sku: material.sku ?? null,
      description: material.description ?? null,
      base_cost: material.unit_cost,
      taxable: material.taxable ?? false,
      labor_minutes: material.labor_minutes ?? 0,
      job_type_id: material.job_type_id ?? null,
      sort_order: material.order_index ?? 0,
      updated_at: new Date().toISOString(),
    };
  }

  private mergeAppMaterialOverrides(base: Material, ov?: AppMaterialOverride | null): Material {
    const merged: any = { ...(base as any), __is_app_material: true, __has_override: false };
    if (!ov) return merged as Material;

    merged.__has_override = true;

    // DB column names:
    // override_job_type_id, override_taxable, custom_cost, use_custom_cost
    if ((ov as any).override_job_type_id != null) merged.job_type_id = (ov as any).override_job_type_id;
    if ((ov as any).override_taxable != null) merged.taxable = (ov as any).override_taxable;
    if ('custom_cost' in (ov as any)) merged.custom_cost = (ov as any).custom_cost;
    if ('use_custom_cost' in (ov as any)) merged.use_custom_cost = (ov as any).use_custom_cost;

    return merged as Material;
  }

  private async tryListAppMaterialOverrides(companyId: string): Promise<AppMaterialOverride[]> {
    try {
      const { data, error } = await this.supabase
        .from('app_material_overrides')
        .select('*')
        .eq('company_id', companyId);
      if (error) return [];
      return (data ?? []) as any;
    } catch {
      return [];
    }
  }

  private async tryGetAppMaterialOverride(companyId: string, materialId: string): Promise<AppMaterialOverride | null> {
    try {
      const { data, error } = await this.supabase
        .from('app_material_overrides')
        .select('*')
        .eq('company_id', companyId)
        .eq('material_id', materialId)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as any;
    } catch {
      return null;
    }
  }

  async upsertAppMaterialOverride(materialId: string, patch: Partial<AppMaterialOverride>): Promise<AppMaterialOverride> {
    const companyId = await this.currentCompanyId();
    const payload: any = {
      company_id: companyId,
      material_id: materialId,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .upsert(payload, { onConflict: 'company_id,material_id' })
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }

  /* ------------------------------------------------------------------ */
  /* Folders                                                            */
  /* ------------------------------------------------------------------ */

  async getFolders(kind: 'materials' | 'assemblies'): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();

    // Return BOTH user + app folders for this library, similar to the old behavior.
    const { data, error } = await this.supabase
      .from('folders')
      .select('*')
      .eq('library', kind)
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((r: any) => this.mapFolderFromDb(r));
  }

  async listFolders(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();
    const dbOwner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('folders')
      .select('*')
      .eq('library', args.kind)
      .eq('owner', dbOwner)
      .order('sort_order', { ascending: true });

    q = args.parentId ? q.eq('parent_id', args.parentId) : q.is('parent_id', null);
    q = dbOwner === 'user' ? q.eq('company_id', companyId) : q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: any) => this.mapFolderFromDb(r));
  }

  async createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const dbOwner = this.toDbOwner(args.libraryType);

    const payload: any = {
      // DO NOT send id (let DB generate UUID)
      owner: dbOwner,
      library: args.kind,
      name: args.name,
      parent_id: args.parentId,
      sort_order: 0,
      company_id: dbOwner === 'user' ? companyId : null,
      created_at: new Date().toISOString(),
      // folders table has NO updated_at
    };

    const { data, error } = await this.supabase.from('folders').insert(payload).select().single();
    if (error) throw error;
    return this.mapFolderFromDb(data);
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();

    const dbPayload = this.mapFolderToDb(folder);

    // Ensure company scope matches owner
    if ((dbPayload.owner as DbOwner) === 'user') dbPayload.company_id = dbPayload.company_id ?? companyId;
    else dbPayload.company_id = null;

    // folders table has NO updated_at
    delete dbPayload.updated_at;

    const { data, error } = await this.supabase.from('folders').upsert(dbPayload).select().single();
    if (error) throw error;
    return this.mapFolderFromDb(data);
  }

  async deleteFolder(id: string): Promise<void> {
    const { error } = await this.supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Materials                                                          */
  /* ------------------------------------------------------------------ */

  async getMaterials(): Promise<Material[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((r: any) => this.mapMaterialFromDb(r));
  }

  async listMaterials(args: { libraryType: LibraryType; folderId: string | null }): Promise<Material[]> {
    const companyId = await this.currentCompanyId();
    const dbOwner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('materials')
      .select('*')
      .eq('owner', dbOwner)
      .order('name', { ascending: true });

    // scope by company_id for user-owned
    q = dbOwner === 'user' ? q.eq('company_id', companyId) : q.is('company_id', null);

    // folder filter
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    const mats = (data ?? []).map((r: any) => this.mapMaterialFromDb(r));

    if (dbOwner !== 'app') return mats;

    // Merge company overrides for app-owned materials (best-effort)
    const overrides = await this.tryListAppMaterialOverrides(companyId);
    const byMat = new Map<string, AppMaterialOverride>();
    for (const ov of overrides) byMat.set((ov as any).material_id, ov as any);

    return mats.map((m) => this.mergeAppMaterialOverrides(m, byMat.get(m.id) ?? null));
  }

  async getMaterial(id: string): Promise<Material> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('materials').select('*').eq('id', id).maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Material not found');

    const row = this.mapMaterialFromDb(data as any);

    // user-owned material: must match company
    if (row.company_id && row.company_id !== companyId) throw new Error('Material not found');

    // app-owned material: merge overrides (non-owner) for viewing/editing
    if (row.company_id == null) {
      const isOwner = await this.isAppOwner();
      if (!isOwner) {
        const ov = await this.tryGetAppMaterialOverride(companyId, id);
        return this.mergeAppMaterialOverrides(row, ov);
      }
      return { ...row, __is_app_material: true, __has_override: false } as any;
    }

    return row as any;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    // Protect app-owned materials from being edited by normal companies.
    const isAppRow = material.company_id === null;
    if (isAppRow) {
      const isOwner = await this.isAppOwner();
      if (!isOwner) {
        throw new Error('App materials cannot be edited directly. Use company override fields instead.');
      }
    }

    const payload = this.mapMaterialToDb(material, companyId);

    const { data, error } = await this.supabase.from('materials').upsert(payload as any).select().single();
    if (error) throw error;
    return this.mapMaterialFromDb(data);
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    return this.upsertMaterial(material);
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Assemblies                                                         */
  /* ------------------------------------------------------------------ */

  async getAssemblies(): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('assemblies')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async listAssemblies(args: { libraryType: LibraryType; folderId: string | null }): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();

    let q = this.supabase.from('assemblies').select('*').order('created_at', { ascending: false });
    q = args.libraryType === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any;
  }

  async getAssembly(id: string): Promise<Assembly> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('assemblies').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Assembly not found');
    if ((data as any).company_id && (data as any).company_id !== companyId) throw new Error('Assembly not found');
    return data as any;
  }

  async upsertAssembly(assembly: Partial<Assembly>): Promise<Assembly> {
    const companyId = await this.currentCompanyId();
    const payload = {
      ...assembly,
      company_id: assembly.company_id ?? companyId,
      updated_at: new Date().toISOString(),
    };
    if (assembly.company_id === null) (payload as any).company_id = null;

    const { data, error } = await this.supabase.from('assemblies').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  async saveAssembly(assembly: Partial<Assembly>): Promise<Assembly> {
    return this.upsertAssembly(assembly);
  }

  async deleteAssembly(id: string): Promise<void> {
    const { error } = await this.supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Estimates                                                          */
  /* ------------------------------------------------------------------ */

  async listEstimates(): Promise<Estimate[]> {
    return this.getEstimates();
  }

  async getEstimates(): Promise<Estimate[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getEstimate(id: string): Promise<Estimate> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Estimate not found');
    return data as any;
  }

  async saveEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const companyId = await this.currentCompanyId();
    const payload = { ...estimate, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('estimates').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    return this.saveEstimate(estimate);
  }

  async deleteEstimate(id: string): Promise<void> {
    const { error } = await this.supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Admin                                                              */
  /* ------------------------------------------------------------------ */

  async getJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('job_types').select('*').eq('company_id', companyId).order('name');
    if (error) throw error;
    return data ?? [];
  }

  async listJobTypes(): Promise<JobType[]> {
    return this.getJobTypes();
  }

  async saveJobType(jobType: Partial<JobType>): Promise<JobType> {
    const companyId = await this.currentCompanyId();
    const payload = { ...jobType, company_id: companyId };
    const { data, error } = await this.supabase.from('job_types').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  async upsertJobType(jobType: Partial<JobType>): Promise<JobType> {
    return this.saveJobType(jobType);
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    const companyId = await this.currentCompanyId();
    const { error: clearErr } = await this.supabase.from('job_types').update({ is_default: false }).eq('company_id', companyId);
    if (clearErr) throw clearErr;

    const { error: setErr } = await this.supabase
      .from('job_types')
      .update({ is_default: true })
      .eq('company_id', companyId)
      .eq('id', jobTypeId);
    if (setErr) throw setErr;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('company_settings').select('*').eq('company_id', companyId).maybeSingle();
    if (error) throw error;
    if (data) return data as any;

    const payload = seedCompanySettings(companyId);
    const { data: created, error: createErr } = await this.supabase.from('company_settings').insert(payload as any).select().single();
    if (createErr) throw createErr;
    return created as any;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('company_settings').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  /* ------------------------------------------------------------------ */
  /* Admin Rules                                                        */
  /* ------------------------------------------------------------------ */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true });
    if (error) throw error;
    return (data ?? []) as any;
  }

  async getAdminRules(_companyId: string): Promise<AdminRule[]> {
    return this.listAdminRules();
  }

  async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
    const rule = (maybeRule ?? companyIdOrRule) as Partial<AdminRule>;
    const companyId = await this.currentCompanyId();
    const payload = { ...rule, company_id: companyId };

    const { data, error } = await this.supabase.from('admin_rules').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<void> {
    await this.upsertAdminRule(rule);
  }

  async deleteAdminRule(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('admin_rules').delete().eq('id', id);
    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* CSV Settings                                                       */
  /* ------------------------------------------------------------------ */

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('csv_settings').select('*').eq('company_id', companyId).maybeSingle();
    if (error) throw error;
    if (data) return data as any;

    const payload = {
      company_id: companyId,
      allow_material_import: true,
      allow_assembly_import: true,
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createErr } = await this.supabase.from('csv_settings').insert(payload as any).select().single();
    if (createErr) throw createErr;
    return created as any;
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('csv_settings').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  /* ------------------------------------------------------------------ */
  /* Branding Settings                                                  */
  /* ------------------------------------------------------------------ */

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as any;

    const payload = {
      company_id: companyId,
      primary_color: null,
      logo_url: null,
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createErr } = await this.supabase.from('branding_settings').insert(payload as any).select().single();
    if (createErr) throw createErr;
    return created as any;
  }

  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('branding_settings').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }
}
