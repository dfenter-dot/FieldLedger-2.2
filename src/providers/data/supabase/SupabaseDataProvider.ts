import { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminRule,
  Assembly,
  AssemblyItem,
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
 * - owner: 'app' | 'company'
 * - folders.library: 'materials' | 'assemblies'
 */

type DbOwner = 'app' | 'company';

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

    // ENV check
    const envEmail = (import.meta as any)?.env?.VITE_APP_OWNER_EMAIL;
    if (envEmail) {
      const { data } = await this.supabase.auth.getUser();
      if (data?.user?.email?.toLowerCase() === String(envEmail).toLowerCase()) {
        this._isAppOwner = true;
        return true;
      }
    }

    // DB flag
    const { data } = await this.supabase
      .from('profiles')
      .select('is_app_owner')
      .single();
    this._isAppOwner = Boolean((data as any)?.is_app_owner);
    return this._isAppOwner;
  }

  private toDbOwner(libraryType: LibraryType): DbOwner {
    return libraryType === 'company' ? 'company' : 'app';
  }

  private fromDbOwner(owner: DbOwner): LibraryType {
    return owner === 'company' ? 'company' : 'app';
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
      .order('sort_order', { ascending: true });

    q = args.parentId ? q.eq('parent_id', args.parentId) : q.is('parent_id', null);
    q = owner === 'company'
      ? q.eq('company_id', companyId)
      : q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((r: any) => ({
      id: r.id,
      kind: r.library,
      library_type: this.fromDbOwner(r.owner),
      company_id: r.company_id ?? null,
      parent_id: r.parent_id ?? null,
      name: r.name,
      order_index: Number(r.sort_order ?? 0),
      created_at: r.created_at,
    }));
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
      company_id: owner === 'company' ? companyId : null,
      parent_id: args.parentId,
      name: args.name,
      sort_order: 0,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('folders')
      .insert(payload)
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
    };
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(folder.library_type ?? 'company');

    const payload = {
      id: folder.id,
      owner,
      library: folder.kind,
      company_id: owner === 'company' ? companyId : null,
      parent_id: folder.parent_id,
      name: folder.name,
      sort_order: folder.order_index ?? 0,
      created_at: folder.created_at,
    };

    const { data, error } = await this.supabase
      .from('folders')
      .upsert(payload)
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
    };
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

    q = owner === 'company'
      ? q.eq('company_id', companyId)
      : q.is('company_id', null);

    q = args.folderId
      ? q.eq('folder_id', args.folderId)
      : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((m: any) => ({
      id: m.id,
      company_id: m.company_id ?? null,
      folder_id: m.folder_id ?? null,
      library_type: this.fromDbOwner(m.owner),
      name: m.name,
      sku: m.sku ?? null,
      description: m.description ?? null,
      base_cost: Number(m.base_cost ?? 0),
      taxable: Boolean(m.taxable),
      job_type_id: m.job_type_id ?? null,
      labor_minutes: Number(m.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(m.sort_order ?? 0),
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  async getMaterial(id: string): Promise<Material | null> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      folder_id: data.folder_id ?? null,
      library_type: this.fromDbOwner(data.owner),
      name: data.name,
      sku: data.sku ?? null,
      description: data.description ?? null,
      base_cost: Number(data.base_cost ?? 0),
      taxable: Boolean(data.taxable),
      job_type_id: data.job_type_id ?? null,
      labor_minutes: Number(data.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(data.sort_order ?? 0),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(material.library_type ?? 'company');

    if (owner === 'app' && !(await this.isAppOwner())) {
      throw new Error('App materials cannot be edited');
    }

    const payload: any = {
      id: material.id,
      owner,
      company_id: owner === 'company' ? companyId : null,
      folder_id: material.folder_id,
      name: material.name,
      sku: material.sku ?? null,
      description: material.description ?? null,
      base_cost: material.base_cost ?? 0,
      taxable: material.taxable ?? false,
      job_type_id: material.job_type_id ?? null,
      labor_minutes: material.labor_minutes ?? 0,
      sort_order: material.order_index ?? 0,
      updated_at: new Date().toISOString(),
      created_at: material.created_at ?? new Date().toISOString(),
    };

    if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase
      .from('materials')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      folder_id: data.folder_id ?? null,
      library_type: this.fromDbOwner(data.owner),
      name: data.name,
      sku: data.sku ?? null,
      description: data.description ?? null,
      base_cost: Number(data.base_cost ?? 0),
      taxable: Boolean(data.taxable),
      job_type_id: data.job_type_id ?? null,
      labor_minutes: Number(data.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(data.sort_order ?? 0),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Assemblies
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

    q = owner === 'company'
      ? q.eq('company_id', companyId)
      : q.is('company_id', null);

    q = args.folderId
      ? q.eq('folder_id', args.folderId)
      : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((a: any) => ({
      id: a.id,
      company_id: a.company_id ?? null,
      library_type: this.fromDbOwner(a.owner),
      folder_id: a.folder_id,
      name: a.name,
      description: a.description ?? null,
      job_type_id: a.job_type_id ?? null,
      use_admin_rules: Boolean(a.use_admin_rules),
      customer_supplied_materials: Boolean(a.customer_supplies_materials),
      taxable: Boolean(a.taxable),
      created_at: a.created_at,
      updated_at: a.updated_at,
    }));
  }

  async getAssembly(id: string): Promise<Assembly | null> {
    const { data, error } = await this.supabase
      .from('assemblies')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: items } = await this.supabase
      .from('assembly_items')
      .select('*')
      .eq('assembly_id', id)
      .order('sort_order');

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      library_type: this.fromDbOwner(data.owner),
      folder_id: data.folder_id,
      name: data.name,
      description: data.description ?? null,
      job_type_id: data.job_type_id ?? null,
      use_admin_rules: Boolean(data.use_admin_rules),
      customer_supplied_materials: Boolean(data.customer_supplies_materials),
      taxable: Boolean(data.taxable),
      items: (items ?? []) as AssemblyItem[],
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async saveAssembly(args: {
    assembly: Partial<Assembly>;
    items?: AssemblyItem[];
  }): Promise<Assembly> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.assembly.library_type ?? 'company');

    if (!args.assembly.folder_id) {
      throw new Error('Assembly must belong to a folder');
    }

    if (owner === 'app' && !(await this.isAppOwner())) {
      throw new Error('App assemblies cannot be edited');
    }

    const payload: any = {
      id: args.assembly.id,
      owner,
      company_id: owner === 'company' ? companyId : null,
      folder_id: args.assembly.folder_id,
      name: args.assembly.name,
      description: args.assembly.description ?? null,
      job_type_id: args.assembly.job_type_id ?? null,
      use_admin_rules: args.assembly.use_admin_rules ?? false,
      customer_supplies_materials:
        args.assembly.customer_supplied_materials ?? false,
      taxable: args.assembly.taxable ?? false,
      updated_at: new Date().toISOString(),
      created_at: args.assembly.created_at ?? new Date().toISOString(),
    };

    if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase
      .from('assemblies')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    if (args.items) {
      await this.supabase
        .from('assembly_items')
        .delete()
        .eq('assembly_id', data.id);

      for (const it of args.items) {
        await this.supabase.from('assembly_items').insert({
          assembly_id: data.id,
          item_type: it.item_type,
          material_id: it.material_id ?? null,
          name: it.name ?? null,
          quantity: it.quantity,
          material_cost_override: it.material_cost_override ?? null,
          labor_minutes: it.labor_minutes,
          sort_order: it.sort_order,
        });
      }
    }

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      library_type: this.fromDbOwner(data.owner),
      folder_id: data.folder_id,
      name: data.name,
      description: data.description ?? null,
      job_type_id: data.job_type_id ?? null,
      use_admin_rules: Boolean(data.use_admin_rules),
      customer_supplied_materials: Boolean(data.customer_supplies_materials),
      taxable: Boolean(data.taxable),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async deleteAssembly(id: string): Promise<void> {
    await this.supabase.from('assembly_items').delete().eq('assembly_id', id);
    const { error } = await this.supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Remaining sections (Admin / Estimates / CSV / Branding)
     are unchanged from Phase 0 and will be addressed next.
  ============================ */

  async listEstimates(): Promise<Estimate[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data as any;
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  }

  async saveEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const companyId = await this.currentCompanyId();
    const payload = {
      ...estimate,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.supabase
      .from('estimates')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }

  async deleteEstimate(id: string): Promise<void> {
    const { error } = await this.supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
  }

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('name');
    if (error) throw error;
    return data as any;
  }

  async saveJobType(jobType: Partial<JobType>): Promise<JobType> {
    const companyId = await this.currentCompanyId();
    const payload = { ...jobType, company_id: jobType.company_id ?? companyId };
    const { data, error } = await this.supabase
      .from('job_types')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }

  async deleteJobType(id: string): Promise<void> {
    const { error } = await this.supabase.from('job_types').delete().eq('id', id);
    if (error) throw error;
  }

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority');
    if (error) throw error;
    return data as any;
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<AdminRule> {
    const companyId = await this.currentCompanyId();
    const payload = { ...rule, company_id: companyId };
    const { data, error } = await this.supabase
      .from('admin_rules')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }

  async deleteAdminRule(id: string): Promise<void> {
    const { error } = await this.supabase.from('admin_rules').delete().eq('id', id);
    if (error) throw error;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const { data } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) return data as any;

    const seeded = seedCompanySettings(companyId);
    const { data: created, error } = await this.supabase
      .from('company_settings')
      .insert(seeded as any)
      .select()
      .single();
    if (error) throw error;
    return created as any;
  }

  async saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId };
    const { data, error } = await this.supabase
      .from('company_settings')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const { data } = await this.supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    return data as any;
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId };
    const { data, error } = await this.supabase
      .from('csv_settings')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const { data } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    return data as any;
  }

  async saveBrandingSettings(
    settings: Partial<BrandingSettings>
  ): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId };
    const { data, error } = await this.supabase
      .from('branding_settings')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }
}
