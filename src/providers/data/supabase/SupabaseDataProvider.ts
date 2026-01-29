import { SupabaseClient } from '@supabase/supabase-js';
import type {
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
import type { IDataProvider } from '../IDataProvider';
import { seedCompanySettings } from '../local/seed';

/**
 * SupabaseDataProvider
 *
 * PHASE SCOPE (current):
 * - Admin ✅
 * - Materials ✅
 * - Assemblies ✅ (AUTHORITATIVE)
 *
 * Estimates, CSV, Branding are intentionally stubbed.
 */

type DbOwner = 'company' | 'app';
type DbLibrary = 'materials' | 'assemblies';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  private _isAppOwner: boolean | null = null;

  /* ============================
     Context
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

    try {
      const envEmail = (import.meta as any)?.env?.VITE_APP_OWNER_EMAIL;
      if (envEmail) {
        const { data } = await this.supabase.auth.getUser();
        const email = data?.user?.email ?? '';
        if (email.toLowerCase() === String(envEmail).toLowerCase()) {
          this._isAppOwner = true;
          return true;
        }
      }
    } catch {}

    try {
      const { data } = await this.supabase
        .from('profiles')
        .select('is_app_owner')
        .single();
      if (typeof (data as any)?.is_app_owner === 'boolean') {
        this._isAppOwner = Boolean((data as any).is_app_owner);
        return this._isAppOwner;
      }
    } catch {}

    this._isAppOwner = false;
    return false;
  }

  private toDbOwner(libraryType: LibraryType): DbOwner {
    return libraryType === 'company' ? 'company' : 'app';
  }

  private fromDbOwner(owner: DbOwner): LibraryType {
    return owner === 'company' ? 'company' : 'app';
  }

  /* ============================
     Company Settings
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();

    const { data } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) return data as CompanySettings;

    const seeded = seedCompanySettings(companyId);
    const { data: created, error } = await this.supabase
      .from('company_settings')
      .insert(seeded as any)
      .select()
      .single();
    if (error) throw error;

    return created as CompanySettings;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('company_settings')
      .upsert({
        ...settings,
        company_id: companyId,
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();
    if (error) throw error;
    return data as CompanySettings;
  }

  /* ============================
     Job Types
  ============================ */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('name');
    if (error) throw error;
    return (data ?? []) as JobType[];
  }

  async upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType> {
    const jobType = (maybeJobType ?? companyIdOrJobType) as Partial<JobType>;
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('job_types')
      .upsert({
        ...jobType,
        company_id: jobType.company_id ?? companyId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as JobType;
  }

  async deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('job_types').delete().eq('id', id);
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
      .order('priority');
    if (error) throw error;
    return (data ?? []) as AdminRule[];
  }

  async getAdminRules(): Promise<AdminRule[]> {
    return this.listAdminRules();
  }

  async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
    const rule = (maybeRule ?? companyIdOrRule) as Partial<AdminRule>;
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('admin_rules')
      .upsert({
        ...rule,
        company_id: companyId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as AdminRule;
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<void> {
    await this.upsertAdminRule(rule);
  }

  async deleteAdminRule(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('admin_rules').delete().eq('id', id);
    if (error) throw error;
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

    return (data ?? []).map((row: any) => ({
      id: row.id,
      kind: row.library,
      library_type: this.fromDbOwner(row.owner),
      company_id: row.company_id ?? null,
      parent_id: row.parent_id ?? null,
      name: row.name,
      order_index: Number(row.sort_order ?? 0),
      created_at: row.created_at,
    })) as any;
  }

  async createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    const { data, error } = await this.supabase
      .from('folders')
      .insert({
        owner,
        library: args.kind as DbLibrary,
        name: args.name,
        parent_id: args.parentId,
        sort_order: 0,
        company_id: owner === 'company' ? companyId : null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      kind: data.library,
      library_type: this.fromDbOwner(data.owner),
      company_id: data.company_id ?? null,
      parent_id: data.parent_id ?? null,
      name: data.name,
      order_index: Number(data.sort_order ?? 0),
      created_at: data.created_at,
    } as any;
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(folder.library_type ?? 'company');

    const { data, error } = await this.supabase
      .from('folders')
      .upsert({
        id: folder.id,
        owner,
        library: folder.kind ?? 'materials',
        company_id: owner === 'company' ? companyId : null,
        parent_id: folder.parent_id ?? null,
        name: folder.name,
        sort_order: folder.order_index ?? 0,
        created_at: folder.created_at,
      })
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      kind: data.library,
      library_type: this.fromDbOwner(data.owner),
      company_id: data.company_id ?? null,
      parent_id: data.parent_id ?? null,
      name: data.name,
      order_index: Number(data.sort_order ?? 0),
      created_at: data.created_at,
    } as any;
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
      .order('sort_order')
      .order('name');

    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id ?? null,
      folder_id: row.folder_id ?? null,
      name: row.name,
      sku: row.sku ?? null,
      description: row.description ?? null,
      base_cost: Number(row.base_cost ?? 0),
      taxable: Boolean(row.taxable ?? false),
      job_type_id: row.job_type_id ?? null,
      labor_minutes: Number(row.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(row.sort_order ?? 0),
      updated_at: row.updated_at ?? null,
      created_at: row.created_at ?? null,
      library_type: this.fromDbOwner(row.owner),
    })) as any;
  }

  async getMaterial(id: string): Promise<Material | null> {
    const { data } = await this.supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      folder_id: data.folder_id ?? null,
      name: data.name,
      sku: data.sku ?? null,
      description: data.description ?? null,
      base_cost: Number(data.base_cost ?? 0),
      taxable: Boolean(data.taxable ?? false),
      job_type_id: data.job_type_id ?? null,
      labor_minutes: Number(data.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(data.sort_order ?? 0),
      updated_at: data.updated_at ?? null,
      created_at: data.created_at ?? null,
      library_type: this.fromDbOwner(data.owner),
    } as any;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    if (material.company_id === null && !(await this.isAppOwner())) {
      throw new Error('App materials cannot be edited directly');
    }

    const owner = this.toDbOwner(material.library_type ?? 'company');

    const { data, error } = await this.supabase
      .from('materials')
      .upsert({
        id: material.id,
        owner,
        company_id: owner === 'company' ? (material.company_id ?? companyId) : null,
        folder_id: material.folder_id ?? null,
        name: material.name,
        sku: material.sku ?? null,
        description: material.description ?? null,
        base_cost: material.base_cost ?? 0,
        taxable: material.taxable ?? false,
        job_type_id: material.job_type_id ?? null,
        labor_minutes: material.labor_minutes ?? 0,
        sort_order: material.order_index ?? 0,
        updated_at: new Date().toISOString(),
        created_at: material.created_at,
      })
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      folder_id: data.folder_id ?? null,
      name: data.name,
      sku: data.sku ?? null,
      description: data.description ?? null,
      base_cost: Number(data.base_cost ?? 0),
      taxable: Boolean(data.taxable ?? false),
      job_type_id: data.job_type_id ?? null,
      labor_minutes: Number(data.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(data.sort_order ?? 0),
      updated_at: data.updated_at ?? null,
      created_at: data.created_at ?? null,
      library_type: this.fromDbOwner(data.owner),
    } as any;
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Assemblies (AUTHORITATIVE)
  ============================ */

  async listAssemblies(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('assemblies')
      .select('*')
      .eq('owner', owner)
      .order('name');

    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id ?? null,
      folder_id: row.folder_id ?? null,
      name: row.name,
      description: row.description ?? null,
      job_type_id: row.job_type_id ?? null,
      use_admin_rules: Boolean(row.use_admin_rules ?? false),
      customer_supplied_materials: Boolean(row.customer_supplies_materials ?? false),
      created_at: row.created_at,
      updated_at: row.updated_at,
      library_type: this.fromDbOwner(row.owner),
    })) as any;
  }

  async getAssembly(id: string): Promise<any | null> {
    const { data } = await this.supabase
      .from('assemblies')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;

    const { data: items, error } = await this.supabase
      .from('assembly_items')
      .select('*')
      .eq('assembly_id', id)
      .order('sort_order');
    if (error) throw error;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      folder_id: data.folder_id ?? null,
      name: data.name,
      description: data.description ?? null,
      job_type_id: data.job_type_id ?? null,
      use_admin_rules: Boolean(data.use_admin_rules ?? false),
      customer_supplied_materials: Boolean(data.customer_supplies_materials ?? false),
      created_at: data.created_at,
      updated_at: data.updated_at,
      library_type: this.fromDbOwner(data.owner),
      items: (items ?? []).map((it: any) => ({
        id: it.id,
        assembly_id: it.assembly_id,
        item_type: it.item_type,
        material_id: it.material_id ?? null,
        name: it.name ?? null,
        quantity: Number(it.quantity ?? 1),
        labor_minutes: Number(it.labor_minutes ?? 0),
        sort_order: Number(it.sort_order ?? 0),
      })),
    };
  }

  async upsertAssembly(arg: any): Promise<any> {
    const companyId = await this.currentCompanyId();
    const assembly = arg?.assembly ?? arg;
    const items = arg?.items ?? assembly?.items ?? [];

    const owner = this.toDbOwner(assembly.library_type ?? 'company');

    if (owner === 'app' && !(await this.isAppOwner())) {
      throw new Error('App assemblies cannot be edited directly');
    }

    const { data, error } = await this.supabase
      .from('assemblies')
      .upsert({
        id: assembly.id,
        owner,
        company_id: owner === 'company' ? companyId : null,
        folder_id: assembly.folder_id ?? null,
        name: assembly.name,
        description: assembly.description ?? null,
        job_type_id: assembly.job_type_id ?? null,
        use_admin_rules: Boolean(assembly.use_admin_rules ?? false),
        customer_supplies_materials: Boolean(assembly.customer_supplied_materials ?? false),
        updated_at: new Date().toISOString(),
        created_at: assembly.created_at,
      })
      .select()
      .single();
    if (error) throw error;

    await this.supabase.from('assembly_items').delete().eq('assembly_id', data.id);

    for (const [i, it] of items.entries()) {
      await this.supabase.from('assembly_items').insert({
        assembly_id: data.id,
        item_type: it.item_type,
        material_id: it.material_id ?? null,
        name: it.name ?? null,
        quantity: Number(it.quantity ?? 1),
        labor_minutes: Number(it.labor_minutes ?? 0),
        sort_order: i,
      });
    }

    return this.getAssembly(data.id);
  }

  async deleteAssembly(id: string): Promise<void> {
    await this.supabase.from('assembly_items').delete().eq('assembly_id', id);
    const { error } = await this.supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Stubbed sections (later)
  ============================ */

  async getEstimates(): Promise<Estimate[]> {
    return [];
  }
  async listEstimates(): Promise<Estimate[]> {
    return [];
  }
  async getEstimate(): Promise<Estimate | null> {
    return null;
  }
  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    return estimate as Estimate;
  }
  async deleteEstimate(): Promise<void> {}

  async getCsvSettings(): Promise<CsvSettings> {
    return {} as CsvSettings;
  }
  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings> {
    return settings as CsvSettings;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    return {} as BrandingSettings;
  }
  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    return settings as BrandingSettings;
  }
}
