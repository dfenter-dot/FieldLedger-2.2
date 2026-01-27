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
 * SupabaseDataProvider
 *
 * DB enums:
 * - owner_type: 'app' | 'company'
 * - library_type: 'materials' | 'assemblies'
 *
 * IMPORTANT DB NOTES:
 * - folders table DOES NOT have updated_at
 * - materials table DOES have updated_at
 * - app_material_overrides stores override fields only
 */

type DbOwner = 'company' | 'app';
type DbLibrary = 'materials' | 'assemblies';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  private _isAppOwner: boolean | null = null;

  /* ============================
     Helpers
  ============================ */

  private async currentCompanyId(): Promise<string> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('company_id')
      .single();

    if (error || !data?.company_id) {
      throw new Error('No company context available');
    }

    return data.company_id;
  }

  async getCurrentCompanyId(): Promise<string> {
    return this.currentCompanyId();
  }

  async isAppOwner(): Promise<boolean> {
    if (this._isAppOwner !== null) return this._isAppOwner;

    // ENV VAR CHECK
    try {
      const envEmail = (import.meta as any)?.env?.VITE_APP_OWNER_EMAIL;
      if (envEmail) {
        const { data } = await this.supabase.auth.getUser();
        const email = data?.user?.email ?? '';
        if (email && email.toLowerCase() === String(envEmail).toLowerCase()) {
          this._isAppOwner = true;
          return true;
        }
      }
    } catch {
      // ignore
    }

    // DB FLAG CHECK
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('is_app_owner')
        .single();

      if (!error && typeof (data as any)?.is_app_owner === 'boolean') {
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
    return libraryType === 'company' ? 'company' : 'app';
  }

  private fromDbOwner(owner: DbOwner): LibraryType {
    return owner === 'company' ? 'company' : 'personal';
  }

  /* ============================
     Folder Mapping
  ============================ */

  private mapFolderFromDb(row: any): Folder {
    return {
      id: row.id,
      kind: row.library,
      library_type: this.fromDbOwner(row.owner),
      company_id: row.company_id ?? null,
      parent_id: row.parent_id ?? null,
      name: row.name,
      order_index: Number(row.sort_order ?? 0),
      created_at: row.created_at,
    } as Folder;
  }

  private mapFolderToDb(folder: Partial<Folder>): any {
    const owner = folder.library_type
      ? this.toDbOwner(folder.library_type)
      : 'company';

    return {
      id: folder.id,
      owner,
      library: folder.kind ?? 'materials',
      company_id: owner === 'company' ? folder.company_id : null,
      parent_id: folder.parent_id ?? null,
      name: folder.name,
      sort_order: folder.order_index ?? 0,
      created_at: folder.created_at,
    };
  }

  /* ============================
     Material Mapping
  ============================ */

  private mapMaterialFromDb(row: any): Material {
    return {
      id: row.id,
      company_id: row.company_id ?? null,
      folder_id: row.folder_id ?? null,
      name: row.name,
      sku: row.sku ?? null,
      description: row.description ?? null,
      unit_cost: Number(row.base_cost ?? 0),
      taxable: Boolean(row.taxable),
      labor_minutes: Number(row.labor_minutes ?? 0),
      job_type_id: row.job_type_id ?? null,
      order_index: Number(row.sort_order ?? 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
      __is_app_material: row.owner === 'app',
    } as Material;
  }

  private mapMaterialToDb(material: Partial<Material>, companyId: string): any {
    const isApp = material.company_id === null;
    const owner: DbOwner = isApp ? 'app' : 'company';

    return {
      id: material.id,
      owner,
      company_id: owner === 'company' ? companyId : null,
      folder_id: material.folder_id ?? null,
      name: material.name,
      sku: material.sku ?? null,
      description: material.description ?? null,
      base_cost: material.unit_cost ?? 0,
      taxable: material.taxable ?? false,
      labor_minutes: material.labor_minutes ?? 0,
      job_type_id: material.job_type_id ?? null,
      sort_order: material.order_index ?? 0,
      updated_at: new Date().toISOString(),
    };
  }

  /* ============================
     App Material Overrides
  ============================ */

  private async getOverrides(companyId: string): Promise<Map<string, AppMaterialOverride>> {
    const map = new Map<string, AppMaterialOverride>();

    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .select('*')
      .eq('company_id', companyId);

    if (!error && data) {
      for (const o of data) {
        map.set(o.material_id, o);
      }
    }

    return map;
  }

  private mergeOverride(base: Material, ov?: AppMaterialOverride): Material {
    if (!ov) return base;

    return {
      ...base,
      job_type_id: ov.override_job_type_id ?? base.job_type_id,
      taxable: ov.override_taxable ?? base.taxable,
      custom_cost: ov.custom_cost ?? undefined,
      use_custom_cost: ov.use_custom_cost ?? undefined,
      __has_override: true,
    } as Material;
  }

  /* ============================
     Folders
  ============================ */

  async listFolders(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('folders')
      .select('*')
      .eq('library', args.kind)
      .eq('owner', owner)
      .order('sort_order');

    q = args.parentId ? q.eq('parent_id', args.parentId) : q.is('parent_id', null);
    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => this.mapFolderFromDb(r));
  }

  async createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    const payload = {
      owner,
      library: args.kind,
      name: args.name,
      parent_id: args.parentId,
      sort_order: 0,
      company_id: owner === 'company' ? companyId : null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('folders')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return this.mapFolderFromDb(data);
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const payload = this.mapFolderToDb(folder);

    if (payload.owner === 'company') {
      payload.company_id = payload.company_id ?? companyId;
    } else {
      payload.company_id = null;
    }

    const { data, error } = await this.supabase
      .from('folders')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return this.mapFolderFromDb(data);
  }

  async deleteFolder(id: string): Promise<void> {
    const { error } = await this.supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Materials
  ============================ */

  async listMaterials(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Material[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('materials')
      .select('*')
      .eq('owner', owner)
      .order('name');

    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    let mats = (data ?? []).map((r) => this.mapMaterialFromDb(r));

    if (owner === 'app') {
      const overrides = await this.getOverrides(companyId);
      mats = mats.map((m) => this.mergeOverride(m, overrides.get(m.id)));
    }

    return mats;
  }

  async getMaterial(id: string): Promise<Material> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    const material = this.mapMaterialFromDb(data);

    if (material.company_id === null) {
      const isOwner = await this.isAppOwner();
      if (!isOwner) {
        const overrides = await this.getOverrides(companyId);
        return this.mergeOverride(material, overrides.get(id));
      }
    }

    return material;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    if (material.company_id === null) {
      const isOwner = await this.isAppOwner();
      if (!isOwner) {
        throw new Error('App materials cannot be edited directly');
      }
    }

    const payload = this.mapMaterialToDb(material, companyId);

    const { data, error } = await this.supabase
      .from('materials')
      .upsert(payload)
      .select()
      .single();

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

  /* ============================
     EVERYTHING ELSE (unchanged)
  ============================ */

  async getAssemblies(): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('assemblies')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`);
    if (error) throw error;
    return data ?? [];
  }

  async listAssemblies(): Promise<Assembly[]> {
    return this.getAssemblies();
  }

  async getEstimates(): Promise<Estimate[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data ?? [];
  }

  async getJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data ?? [];
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const { data } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();
    return data ?? seedCompanySettings(companyId);
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase
      .from('company_settings')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }
}
