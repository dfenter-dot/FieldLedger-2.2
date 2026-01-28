import { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminRule,
  Assembly,
  AppAssemblyOverride,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Folder,
  JobType,
  LibraryType,
  Material,
  AppMaterialOverride,
  OwnerType,
} from '../types';
import { IDataProvider } from '../IDataProvider';
import { seedCompanySettings } from '../local/seed';

/**
 * SupabaseDataProvider
 *
 * DB enums:
 * - owner_type: 'app' | 'company'   (your DB uses column name: owner, enum type owner_type)
 * - library_type: 'materials' | 'assemblies'
 *
 * IMPORTANT DB NOTES (confirmed from your Supabase metadata):
 * - assemblies columns include: owner, company_id, folder_id, name, description,
 *   job_type_id, use_admin_rules, customer_supplies_materials, taxable, created_at, updated_at
 * - assembly_items columns include: assembly_id, item_type, material_id, name, quantity,
 *   material_cost_override, labor_minutes, sort_order
 * - app_assembly_overrides exists and now has RLS policies (you added them)
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
    const { data, error } = await this.supabase.from('profiles').select('company_id').single();
    if (error || !data?.company_id) throw new Error('No company context available');
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
      const { data, error } = await this.supabase.from('profiles').select('is_app_owner').single();
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
    // UI: company = tenant-owned library, personal = app-owned library
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
    const owner = folder.library_type ? this.toDbOwner(folder.library_type) : 'company';

    return {
      id: folder.id,
      owner,
      library: (folder.kind ?? 'materials') as DbLibrary,
      company_id: owner === 'company' ? folder.company_id : null,
      parent_id: folder.parent_id ?? null,
      name: folder.name,
      sort_order: (folder as any).order_index ?? (folder as any).sort_order ?? 0,
      image_path: (folder as any).image_path ?? null,
    };
  }

  /* ============================
     Material Mapping
  ============================ */

  private mapMaterialFromDb(row: any): Material {
    return {
      id: row.id,
      company_id: row.company_id ?? null,
      owner: row.owner,
      folder_id: row.folder_id,

      name: row.name,
      sku: row.sku,
      description: row.description,

      base_cost: Number(row.base_cost ?? 0),
      taxable: Boolean(row.taxable),

      labor_minutes: Number(row.labor_minutes ?? 0),
      job_type_id: row.job_type_id ?? null,

      image_path: row.image_path ?? null,

      created_at: row.created_at,
      updated_at: row.updated_at,

      custom_cost: row.custom_cost ?? null,
      use_custom_cost: row.use_custom_cost ?? false,
      effective_cost: row.effective_cost ?? undefined,
    } as Material;
  }

  private mapMaterialToDb(material: Partial<Material>): any {
    return {
      id: material.id,
      owner: material.owner,
      company_id: material.company_id ?? null,
      folder_id: material.folder_id,

      name: material.name,
      sku: material.sku ?? null,
      description: material.description ?? null,

      base_cost: material.base_cost ?? 0,
      taxable: material.taxable ?? false,

      labor_minutes: material.labor_minutes ?? 0,
      job_type_id: material.job_type_id ?? null,

      image_path: material.image_path ?? null,

      sort_order: (material as any).sort_order ?? 0,
    };
  }

  /* ============================
     Assemblies (matches your Supabase schema)
  ============================ */

  async listAssemblies(params: { libraryType: LibraryType; folderId: string | null }): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();
    const owner: DbOwner = this.toDbOwner(params.libraryType);

    const folderId = params.folderId;
    if (!folderId) return [];

    // NOTE: your DB assemblies table does NOT have sort_order; order by name for stable UI.
    const q = this.supabase
      .from('assemblies')
      .select('*')
      .eq('owner', owner)
      .eq('folder_id', folderId)
      .order('name', { ascending: true });

    if (owner === 'company') q.eq('company_id', companyId);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any[];
  }

  async getAssembly(id: string): Promise<Assembly | null> {
    const { data: a, error } = await this.supabase.from('assemblies').select('*').eq('id', id).single();
    if (error) throw error;
    if (!a) return null;

    const { data: items, error: e2 } = await this.supabase
      .from('assembly_items')
      .select('*')
      .eq('assembly_id', id)
      .order('sort_order', { ascending: true });

    if (e2) throw e2;

    // Return shape used by your UI: assembly row + items array
    return { ...(a as any), items: items ?? [] } as any;
  }

  async upsertAssembly(assembly: Partial<Assembly> & { items?: any[] }): Promise<Assembly> {
    const companyId = await this.currentCompanyId();

    const isOwner = await this.isAppOwner();
    const owner: DbOwner = (assembly as any).owner
      ? ((assembly as any).owner as DbOwner)
      : ((assembly as any).library_type ? this.toDbOwner((assembly as any).library_type) : 'company');

    // Guard: normal companies cannot mutate app-owned base assemblies
    if (owner === 'app' && !isOwner) {
      throw new Error('Not allowed to modify app-owned assemblies');
    }

    // Map to your real DB column names:
    // - customer_supplies_materials (DB) vs customer_supplied_materials (spec)
    const payload: any = {
      ...assembly,
      owner,
      company_id: owner === 'company' ? (assembly as any).company_id ?? companyId : null,
    };

    // normalize field name if UI/spec sends customer_supplied_materials
    if (payload.customer_supplied_materials !== undefined && payload.customer_supplies_materials === undefined) {
      payload.customer_supplies_materials = payload.customer_supplied_materials;
      delete payload.customer_supplied_materials;
    }

    // items are stored separately
    const items = (payload.items ?? []) as any[];
    delete payload.items;

    const { data: saved, error } = await this.supabase.from('assemblies').upsert(payload).select('*').single();
    if (error) throw error;

    // Replace items (your FK exists; cascade may exist, but this is safe)
    const { error: delErr } = await this.supabase.from('assembly_items').delete().eq('assembly_id', saved.id);
    if (delErr) throw delErr;

    if (items.length) {
      // Map item payload to your DB columns:
      // - item_type (DB) vs type (spec)
      // - material_cost_override (DB) vs material_cost (spec)
      // - labor_minutes (DB) is single integer
      const rows = items.map((it, idx) => {
        const itemType = it.item_type ?? it.type ?? 'material';
        const laborMinutes =
          typeof it.labor_minutes === 'number'
            ? it.labor_minutes
            : typeof it.laborMinutes === 'number'
              ? it.laborMinutes
              : // if spec sends labor_hours + labor_minutes
                (Number(it.labor_hours ?? 0) * 60 + Number(it.labor_minutes ?? 0)) || 0;

        const materialCostOverride =
          it.material_cost_override ??
          it.materialCostOverride ??
          it.material_cost ??
          it.materialCost ??
          null;

        return {
          assembly_id: saved.id,
          item_type: itemType,
          material_id: it.material_id ?? it.materialId ?? null,
          name: it.name ?? null,
          quantity: it.quantity ?? 1,
          material_cost_override: materialCostOverride,
          labor_minutes: laborMinutes,
          sort_order: idx,
        };
      });

      const { error: insErr } = await this.supabase.from('assembly_items').insert(rows);
      if (insErr) throw insErr;
    }

    return (await this.getAssembly(saved.id)) as any;
  }

  async deleteAssembly(id: string): Promise<void> {
    const isOwner = await this.isAppOwner();

    const { data: a } = await this.supabase.from('assemblies').select('id, owner').eq('id', id).single();
    if ((a as any)?.owner === 'app' && !isOwner) {
      throw new Error('Not allowed to delete app-owned assemblies');
    }

    // delete items first if no cascade
    await this.supabase.from('assembly_items').delete().eq('assembly_id', id);

    const { error } = await this.supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     App Assembly Overrides (your DB has this; you just added policies)
  ============================ */

  async listAppAssemblyOverrides(): Promise<AppAssemblyOverride[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('app_assembly_overrides')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return (data ?? []) as any[];
  }

  async upsertAppAssemblyOverride(override: Partial<AppAssemblyOverride>): Promise<AppAssemblyOverride> {
    const companyId = await this.currentCompanyId();
    const payload = { ...override, company_id: companyId };

    const { data, error } = await this.supabase.from('app_assembly_overrides').upsert(payload).select('*').single();
    if (error) throw error;
    return data as any;
  }

  /* ============================
     Materials
  ============================ */

  async listMaterials(library: OwnerType): Promise<Material[]> {
    const companyId = await this.currentCompanyId();
    const owner = library;

    const q = this.supabase.from('materials').select('*').eq('owner', owner).order('sort_order', { ascending: true });

    if (owner === 'user') q.eq('company_id', companyId);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => this.mapMaterialFromDb(r));
  }

  async getMaterial(id: string): Promise<Material | null> {
    const { data, error } = await this.supabase.from('materials').select('*').eq('id', id).single();
    if (error) throw error;
    return data ? this.mapMaterialFromDb(data) : null;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    const payload = this.mapMaterialToDb({
      ...material,
      company_id: material.owner === 'user' ? companyId : null,
    });

    const { data, error } = await this.supabase.from('materials').upsert(payload).select('*').single();
    if (error) throw error;
    return this.mapMaterialFromDb(data);
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Folders
  ============================ */

  async listFolders(library: LibraryType, owner: OwnerType): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();

    const q = this.supabase
      .from('folders')
      .select('*')
      .eq('library', library)
      .eq('owner', owner)
      .order('sort_order', { ascending: true });

    if (owner === 'user') q.eq('company_id', companyId);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => this.mapFolderFromDb(r));
  }

  async upsertFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();

    const owner = folder.library_type ? this.toDbOwner(folder.library_type) : 'company';

    const payload = this.mapFolderToDb({
      ...folder,
      company_id: owner === 'company' ? companyId : null,
    } as any);

    const { data, error } = await this.supabase.from('folders').upsert(payload).select('*').single();
    if (error) throw error;
    return this.mapFolderFromDb(data);
  }

  async deleteFolder(id: string): Promise<void> {
    const { error } = await this.supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     App Material Overrides
  ============================ */

  async listAppMaterialOverrides(): Promise<AppMaterialOverride[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return (data ?? []) as any[];
  }

  async upsertAppMaterialOverride(override: Partial<AppMaterialOverride>): Promise<void> {
    const companyId = await this.currentCompanyId();
    const payload = { ...override, company_id: companyId };
    const { error } = await this.supabase.from('app_material_overrides').upsert(payload);
    if (error) throw error;
  }

  /* ============================
     Company Settings
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('company_settings').select('*').eq('company_id', companyId).single();

    if (error) {
      // If missing, seed
      const seeded = seedCompanySettings(companyId);
      const { data: inserted, error: insErr } = await this.supabase
        .from('company_settings')
        .insert(seeded)
        .select('*')
        .single();
      if (insErr) throw insErr;
      return inserted as any;
    }

    return data as any;
  }

  async upsertCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId };
    const { data, error } = await this.supabase.from('company_settings').upsert(payload).select('*').single();
    if (error) throw error;
    return data as any;
  }

  /* ============================
     Job Types
  ============================ */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('job_types').select('*').eq('company_id', companyId).order('name');
    if (error) throw error;
    return (data ?? []) as any[];
  }

  async getJobTypes(companyId: string): Promise<JobType[]> {
    const { data, error } = await this.supabase.from('job_types').select('*').eq('company_id', companyId).order('name');
    if (error) throw error;
    return (data ?? []) as any[];
  }

  async upsertJobType(companyId: string, jobType: Partial<JobType>): Promise<JobType> {
    const payload = { ...jobType, company_id: companyId };
    const { data, error } = await this.supabase.from('job_types').upsert(payload).select('*').single();
    if (error) throw error;
    return data as any;
  }

  async deleteJobType(companyId: string, jobTypeId: string): Promise<void> {
    const { error } = await this.supabase.from('job_types').delete().eq('company_id', companyId).eq('id', jobTypeId);
    if (error) throw error;
  }

  /* ============================
     Admin Rules
  ============================ */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true });
    if (error) throw error;
    return (data ?? []) as any[];
  }

  async getAdminRules(companyId: string): Promise<AdminRule[]> {
    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true });
    if (error) throw error;
    return (data ?? []) as any[];
  }

  async upsertAdminRule(companyId: string, rule: Partial<AdminRule>): Promise<AdminRule> {
    const payload = { ...rule, company_id: companyId };
    const { data, error } = await this.supabase.from('admin_rules').upsert(payload).select('*').single();
    if (error) throw error;
    return data as any;
  }

  async deleteAdminRule(companyId: string, ruleId: string): Promise<void> {
    const { error } = await this.supabase.from('admin_rules').delete().eq('company_id', companyId).eq('id', ruleId);
    if (error) throw error;
  }

  /* ============================
     CSV Settings
  ============================ */

  async getCsvSettings(companyId: string): Promise<CsvSettings | null> {
    const { data } = await this.supabase.from('csv_settings').select('*').eq('company_id', companyId).single();
    return (data as any) ?? null;
  }

  async upsertCsvSettings(companyId: string, settings: Partial<CsvSettings>): Promise<CsvSettings> {
    const payload = { ...settings, company_id: companyId };
    const { data, error } = await this.supabase.from('csv_settings').upsert(payload).select('*').single();
    if (error) throw error;
    return data as any;
  }

  /* ============================
     Branding Settings
  ============================ */

  async getBrandingSettings(companyId: string): Promise<BrandingSettings | null> {
    const { data } = await this.supabase.from('branding_settings').select('*').eq('company_id', companyId).single();
    return (data as any) ?? null;
  }

  async upsertBrandingSettings(companyId: string, settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const payload = { ...settings, company_id: companyId };
    const { data, error } = await this.supabase.from('branding_settings').upsert(payload).select('*').single();
    if (error) throw error;
    return data as any;
  }
}
