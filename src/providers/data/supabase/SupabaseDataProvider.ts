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
 * DB enums (your Supabase):
 * - owner: 'app' | 'company'
 * - library: 'materials' | 'assemblies'  (folders table)
 *
 * IMPORTANT DB NOTES (your Supabase):
 * - assemblies table uses `owner` and `customer_supplies_materials` (plural)
 * - assembly_items uses `item_type` and `labor_minutes` (no labor_hours)
 *
 * IMPORTANT MATERIALS NOTE:
 * - your `materials` table does NOT have `labor_hours`
 * - do NOT send `labor_hours` in inserts/updates or PostgREST returns 400
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

  /**
   * IMPORTANT:
   * Your UI/types have historically used various strings for libraries:
   * - company/user library: 'company' or 'user'
   * - app/system library: 'app' or 'personal'
   *
   * The DB is authoritative: owner is only 'company' | 'app'
   * So we normalize any incoming value to those DB enums.
   */
  private toDbOwner(libraryType: any): DbOwner {
    const v = String(libraryType ?? '').toLowerCase().trim();
    // Treat "company" AND "user" as company-owned rows
    if (v === 'company' || v === 'user') return 'company';
    // Everything else routes to app-owned rows
    return 'app';
  }

  private fromDbOwner(owner: DbOwner): any {
    // Always emit 'company' for company-owned.
    // For app-owned, emit 'app' (NOT 'personal') to match the app's conceptual model.
    return owner === 'company' ? ('company' as any) : ('app' as any);
  }

  /* ============================
     Folder Mapping
  ============================ */

  private mapFolderFromDb(row: any): Folder {
    return {
      id: row.id,
      kind: row.library,
      library_type: this.fromDbOwner(row.owner as DbOwner),
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
      sort_order: folder.order_index ?? 0,
      created_at: folder.created_at,
      // NO updated_at on folders table
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
      base_cost: Number(row.base_cost ?? 0),
      custom_cost: (row as any).custom_cost ?? null,
      use_custom_cost: Boolean((row as any).use_custom_cost ?? false),
      taxable: Boolean(row.taxable ?? false),
      job_type_id: row.job_type_id ?? null,
      labor_minutes: Number(row.labor_minutes ?? 0),

      // DB does NOT have labor_hours; keep for UI/types but always 0
      labor_hours: Number((row as any).labor_hours ?? 0) || 0,

      order_index: Number(row.sort_order ?? 0),
      updated_at: row.updated_at ?? null,
      created_at: row.created_at ?? null,
      library_type: this.fromDbOwner(row.owner as DbOwner),
    } as any;
  }

  private mapMaterialToDb(material: Partial<Material>): any {
    const owner = material.library_type ? this.toDbOwner(material.library_type) : 'company';

    const payload: any = {
      id: material.id,
      owner,
      company_id: owner === 'company' ? material.company_id : null,
      folder_id: (material as any).folder_id ?? null,
      name: material.name,
      sku: (material as any).sku ?? null,
      description: (material as any).description ?? null,
      base_cost: (material as any).base_cost ?? (material as any).unit_cost ?? 0,
      custom_cost: (material as any).custom_cost ?? null,
      use_custom_cost: Boolean((material as any).use_custom_cost ?? false),
      taxable: (material as any).taxable ?? false,
      job_type_id: (material as any).job_type_id ?? null,
      labor_minutes: (material as any).labor_minutes ?? 0,

      // IMPORTANT: do NOT send labor_hours — column does not exist in your DB
      // labor_hours: ...

      sort_order: (material as any).order_index ?? 0,
      created_at: (material as any).created_at,
      updated_at: new Date().toISOString(),
    };

    return payload;
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
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as any;
  }

  async getJobTypes(_companyId: string): Promise<JobType[]> {
    return this.listJobTypes();
  }

  async upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType> {
    const jobType = (maybeJobType ?? companyIdOrJobType) as Partial<JobType>;
    const companyId = await this.currentCompanyId();

    const payload: any = { ...jobType };
    if (!payload.company_id) payload.company_id = companyId;

    const { data, error } = await this.supabase.from('job_types').upsert(payload).select().single();
    if (error) throw error;
    return data as any;
  }

  async deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('job_types').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Company Settings
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;

    if (data) return data as any;

    const seeded = seedCompanySettings(companyId);
    const { data: created, error: createErr } = await this.supabase
      .from('company_settings')
      .insert(seeded as any)
      .select()
      .single();
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

  /* ============================
     Folders
  ============================ */

  async listFolders(args: { kind: 'materials' | 'assemblies'; libraryType: LibraryType; parentId: string | null }): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('folders')
      .select('*')
      .eq('library', args.kind)
      .eq('owner', owner)
      .order('sort_order', { ascending: true });

    q = args.parentId ? q.eq('parent_id', args.parentId) : q.is('parent_id', null);
    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: any) => this.mapFolderFromDb(r));
  }

  async createFolder(args: { kind: 'materials' | 'assemblies'; libraryType: LibraryType; parentId: string | null; name: string }): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    const payload: any = {
      owner,
      library: args.kind,
      name: args.name,
      parent_id: args.parentId,
      sort_order: 0,
      company_id: owner === 'company' ? companyId : null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase.from('folders').insert(payload).select().single();
    if (error) throw error;
    return this.mapFolderFromDb(data);
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const payload = this.mapFolderToDb(folder);

    if (payload.owner === 'company') payload.company_id = payload.company_id ?? companyId;
    else payload.company_id = null;

    delete payload.updated_at;

    const { data, error } = await this.supabase.from('folders').upsert(payload).select().single();
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

  async listMaterials(args: { libraryType: LibraryType; folderId: string | null }): Promise<Material[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('materials')
      .select('*')
      .eq('owner', owner)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: any) => this.mapMaterialFromDb(r));
  }

  async getMaterial(id: string): Promise<Material | null> {
    const { data, error } = await this.supabase.from('materials').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? this.mapMaterialFromDb(data) : null;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    // Protect app-owned base records
    if ((material as any).company_id === null) {
      const isOwner = await this.isAppOwner();
      if (!isOwner) throw new Error('App materials cannot be edited directly');
    }

    const payload = this.mapMaterialToDb(material);

    if (payload.owner === 'company') payload.company_id = payload.company_id ?? companyId;
    else payload.company_id = null;

    if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase.from('materials').upsert(payload).select().single();
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
     Assemblies
  ============================ */

  async listAssemblies(args: { libraryType: LibraryType; folderId: string | null }): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    // Include a lightweight item count so folder lists can show "N items" without loading all lines.
    // Supabase returns this as: assembly_items: [{ count: number }]
    let q = this.supabase
      .from('assemblies')
      .select('*, assembly_items(count)')
      .eq('owner', owner)
      .order('name', { ascending: true })
      .order('created_at', { ascending: false });

    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id ?? null,
      owner_type: row.owner,
      library_type: this.fromDbOwner(row.owner as DbOwner), // critical for UI filters
      folder_id: row.folder_id ?? null,
      name: row.name,
      description: row.description ?? null,
      job_type_id: row.job_type_id ?? null,
      use_admin_rules: Boolean(row.use_admin_rules ?? false),
      // Keep both spellings to avoid UI/pricing drift.
      // DB column is `customer_supplies_materials`.
      customer_supplied_materials: Boolean(row.customer_supplies_materials ?? false),
      customer_supplies_materials: Boolean(row.customer_supplies_materials ?? false),
      taxable: Boolean(row.taxable ?? false),
      // NOTE: used by LibraryFolderPage; safe to ignore elsewhere
      item_count: Number(row?.assembly_items?.[0]?.count ?? 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as any;
  }

  async getAssembly(id: string): Promise<any | null> {
    const { data, error } = await this.supabase.from('assemblies').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: items, error: itemsErr } = await this.supabase
      .from('assembly_items')
      .select('*')
      .eq('assembly_id', id)
      .order('sort_order', { ascending: true });
    if (itemsErr) throw itemsErr;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      owner_type: data.owner,
      library_type: this.fromDbOwner(data.owner as DbOwner),
      folder_id: data.folder_id ?? null,
      name: data.name,
      description: data.description ?? null,
      job_type_id: data.job_type_id ?? null,
      use_admin_rules: Boolean(data.use_admin_rules ?? false),
      // Keep both spellings to avoid UI/pricing drift.
      customer_supplied_materials: Boolean(data.customer_supplies_materials ?? false),
      customer_supplies_materials: Boolean(data.customer_supplies_materials ?? false),
      taxable: Boolean(data.taxable ?? false),
      created_at: data.created_at,
      updated_at: data.updated_at,
      items: (items ?? []).map((it: any) => ({
        id: it.id,
        assembly_id: it.assembly_id,
        // Support both provider styles (some UI code expects `type`, some expects `item_type`)
        item_type: it.item_type,
        type: it.item_type,
        material_id: it.material_id ?? null,
        name: it.name ?? null,
        quantity: Number(it.quantity ?? 1),
        // UI uses `unit_cost` for blank material rows; DB stores it in `material_cost_override`
        material_cost_override: it.material_cost_override ?? null,
        unit_cost: it.material_cost_override ?? null,
        // DB does not store taxable per item; default to true so UI doesn't flip unexpectedly.
        taxable: true,
        labor_minutes: Number(it.labor_minutes ?? 0),
        sort_order: Number(it.sort_order ?? 0),
      })),
    };
  }

  // Supports both calling styles:
  // - upsertAssembly({ assembly, items })
  // - upsertAssembly(assembly)
  async upsertAssembly(arg: any): Promise<any> {
    const companyId = await this.currentCompanyId();

    const assembly: any = arg?.assembly ? arg.assembly : arg;
    const items: any[] = arg?.items ?? assembly?.items ?? [];

    // Preserve existing owner when editing; fall back to library_type when creating.
    const owner: DbOwner =
      (assembly.owner_type ?? assembly.owner) === 'app'
        ? 'app'
        : (assembly.owner_type ?? assembly.owner) === 'company'
          ? 'company'
          : this.toDbOwner(assembly.library_type ?? assembly.libraryType ?? 'company');

    // SPEC: assemblies must belong to a folder
    const folderId = assembly.folder_id ?? null;
    if (!folderId) {
      throw new Error('Assembly must be saved inside a folder (folder_id is required)');
    }

    // Permissions: prevent non-app-owner from mutating app-owned base
    if ((assembly.company_id === null || owner === 'app') && !(await this.isAppOwner())) {
      throw new Error('App assemblies cannot be edited directly');
    }

    const payload: any = {
      id: assembly.id,
      owner,
      company_id: owner === 'company' ? (assembly.company_id ?? companyId) : null,
      folder_id: folderId,
      name: assembly.name,
      description: assembly.description ?? null,
      job_type_id: assembly.job_type_id ?? null,
      use_admin_rules: Boolean(assembly.use_admin_rules ?? false),
      customer_supplies_materials: Boolean(
        assembly.customer_supplied_materials ?? assembly.customer_supplies_materials ?? false
      ),
      taxable: Boolean(assembly.taxable ?? false),
      updated_at: new Date().toISOString(),
      created_at: assembly.created_at ?? new Date().toISOString(),
    };

    if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase.from('assemblies').upsert(payload).select().single();
    if (error) throw error;

    // Line items: for reliability (and to avoid UUID issues from client-generated ids),
    // we replace the entire item list on every save.
    // This also guarantees removed rows are actually removed.
    {
      // IMPORTANT: If RLS blocks DELETE, PostgREST can succeed with 0 rows affected.
      // That would cause duplicates because we then INSERT a new set of rows.
      // So we (1) count existing rows, (2) delete with `select()` returning, and
      // (3) throw a clear error if nothing was deleted when rows existed.
      const { count: existingCount, error: countErr } = await this.supabase
        .from('assembly_items')
        .select('id', { count: 'exact', head: true })
        .eq('assembly_id', data.id);
      if (countErr) throw countErr;

      const { data: deletedRows, error: delErr } = await this.supabase
        .from('assembly_items')
        .delete()
        .eq('assembly_id', data.id)
        .select('id');
      if (delErr) throw delErr;
      if ((existingCount ?? 0) > 0 && (deletedRows?.length ?? 0) === 0) {
        throw new Error(
          'Save failed: existing assembly line items could not be cleared (likely an RLS DELETE policy issue on assembly_items).'
        );
      }

      const rows = (Array.isArray(items) ? items : []).map((it, idx) => {
        const hours = Number((it.labor_hours ?? it.laborHours) ?? 0);
        const mins = Number((it.labor_minutes ?? it.laborMinutes) ?? 0);
        const laborMinutes = Number.isFinite(hours) && hours > 0 ? Math.floor(hours * 60 + mins) : mins;

        const unitCost = it.material_cost_override ?? it.material_cost ?? it.unit_cost ?? it.cost ?? null;

        return {
          // Let DB generate the UUID
          assembly_id: data.id,
          item_type: it.item_type ?? it.type ?? 'material',
          material_id: it.material_id ?? it.materialId ?? null,
          name: it.name ?? null,
          quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
          material_cost_override: unitCost == null ? null : Number(unitCost),
          labor_minutes: Number.isFinite(laborMinutes) ? Math.max(0, Math.floor(laborMinutes)) : 0,
          sort_order: Number.isFinite(Number(it.sort_order)) ? Number(it.sort_order) : idx,
        };
      });

      if (rows.length) {
        const { error: insErr } = await this.supabase.from('assembly_items').insert(rows as any);
        if (insErr) throw insErr;
      }
    }

    // IMPORTANT: The editor expects the returned assembly to include items.
    // Previously we returned only the header, which cleared the editor UI after Save.
    return (await this.getAssembly(data.id)) ?? {
      id: data.id,
      company_id: data.company_id ?? null,
      owner_type: data.owner,
      library_type: this.fromDbOwner(data.owner as DbOwner),
      folder_id: data.folder_id ?? null,
      name: data.name,
      description: data.description ?? null,
      job_type_id: data.job_type_id ?? null,
      use_admin_rules: Boolean(data.use_admin_rules ?? false),
      customer_supplied_materials: Boolean(data.customer_supplies_materials ?? false),
      customer_supplies_materials: Boolean(data.customer_supplies_materials ?? false),
      taxable: Boolean(data.taxable ?? false),
      created_at: data.created_at,
      updated_at: data.updated_at,
      items: [],
    };
  }

  async deleteAssembly(id: string): Promise<void> {
    const { error: itErr } = await this.supabase.from('assembly_items').delete().eq('assembly_id', id);
    if (itErr) throw itErr;

    const { error } = await this.supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     App Material Overrides
  ============================ */

  async getAppMaterialOverride(materialId: string, companyId: string): Promise<AppMaterialOverride | null> {
    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .select('*')
      .eq('material_id', materialId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  }

  async upsertAppMaterialOverride(override: Partial<AppMaterialOverride>): Promise<AppMaterialOverride> {
    const companyId = await this.currentCompanyId();
    const payload = { ...override, company_id: override.company_id ?? companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('app_material_overrides').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  /* ============================
     Estimates
  ============================ */

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

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const companyId = await this.currentCompanyId();

    // IMPORTANT: estimates table is the "header" only. Do not send nested collections
    // (e.g. items/options/lines) to PostgREST or it will 400 on unknown columns.
    const clean: any = { ...(estimate as any) };
    delete clean.items;
    delete clean.options;
    delete clean.estimate_items;
    delete clean.line_items;
    delete clean.lines;
    delete clean.materials;
    delete clean.assemblies;

    // Normalize company_id (never send empty string to uuid column)
    const incomingCompanyId = clean.company_id;
    clean.company_id =
      (typeof incomingCompanyId === 'string' && incomingCompanyId.trim() === '') ? companyId : (incomingCompanyId ?? companyId);

    clean.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase.from('estimates').upsert(clean).select('*').single();
    if (error) throw error;
    return data as any;
  }

  async deleteEstimate(id: string): Promise<void> {
    const { error } = await this.supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Lists / Admin Rules / CSV / Branding (unchanged)
  ============================ */

  async getEstimates(): Promise<Estimate[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('estimates').select('*').eq('company_id', companyId);
    if (error) throw error;
    return data ?? [];
  }

  async listEstimates(): Promise<Estimate[]> {
    return this.getEstimates();
  }

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

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('csv_settings').select('*').eq('company_id', companyId).maybeSingle();
    if (error) throw error;
    if (data) return data as any;

    const payload = { company_id: companyId, allow_material_import: true, allow_assembly_import: true, updated_at: new Date().toISOString() };
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

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('branding_settings').select('*').eq('company_id', companyId).maybeSingle();
    if (error) throw error;
    if (data) return data as any;

    const payload = { company_id: companyId, primary_color: null, logo_url: null, updated_at: new Date().toISOString() };
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


