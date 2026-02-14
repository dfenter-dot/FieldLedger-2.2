import { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminRule,
  Assembly,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  EstimateOption,
  EstimateItem,
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

  private isValidUuid(id: any): id is string {
    if (typeof id !== 'string') return false;
    // RFC4122-ish UUID v1-v5 (Supabase ids are standard uuid)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }



  private _isAppOwner: boolean | null = null;
  private _estimateItemsOptionFkCol: string | null = null;

  /**
   * Estimate line items live in `estimate_items` and are scoped to a single option.
   * Across versions of your schema, the FK column on `estimate_items` that points to
   * `estimate_options.id` has not been consistent (e.g. `estimate_option_id`, `option_id`).
   *
   * This helper autodetects the correct FK column once and caches it, so inserts/updates
   * do not silently fail due to "column does not exist" errors.
   */
  private async getEstimateItemsOptionFkCol(): Promise<string> {
    if (this._estimateItemsOptionFkCol) return this._estimateItemsOptionFkCol;

    const candidates = ['estimate_option_id', 'option_id', 'estimate_options_id', 'estimate_option_uuid'];
    const probeValue = '00000000-0000-0000-0000-000000000000';

    for (const col of candidates) {
      const { error } = await this.supabase
        .from('estimate_items')
        .select('id', { head: true, count: 'exact' })
        .eq(col as any, probeValue)
        .limit(1);

      // If the column doesn't exist, PostgREST returns an error mentioning it.
      const msg = (error as any)?.message ?? '';
      if (error && /column .* does not exist/i.test(msg) && msg.includes(`"${col}"`)) {
        continue;
      }

      // Column exists (or we hit an RLS/permission error, which still implies the column exists)
      this._estimateItemsOptionFkCol = col;
      return col;
    }

    // Last resort: try the historically most common name
    this._estimateItemsOptionFkCol = 'estimate_option_id';
    return this._estimateItemsOptionFkCol;
  }

  /* ============================
     Helpers
  ============================ */

  private async currentCompanyId(): Promise<string> {
    const { data: authData, error: authError } = await this.supabase.auth.getUser();
    if (authError || !authData?.user?.id) throw new Error('Not authenticated');

    const userId = authData.user.id;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.company_id) throw new Error('No company context available (profiles.company_id missing)');
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
      labor_only: Boolean((row as any).labor_only ?? false),
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
      labor_only: Boolean((material as any).labor_only ?? false),
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

    let { data, error } = await this.supabase.from('job_types').upsert(payload).select().single();
    if (error) {
      // Tolerate partially-migrated schemas (e.g., missing hourly markup override columns).
      const msg = String((error as any)?.message ?? error);
      if (msg.includes('hourly_material_markup_mode') || msg.includes('hourly_material_markup_fixed_percent')) {
        const fallback = { ...payload } as any;
        delete fallback.hourly_material_markup_mode;
        delete fallback.hourly_material_markup_fixed_percent;
        ({ data, error } = await this.supabase.from('job_types').upsert(fallback).select().single());
      }
    }
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

// Seed material tiered markups from the app designer (template company), so users see the same defaults
// that exist in the app developer login (they can still edit/remove in their own company without affecting template).
const templateSettings = await this.tryGetTemplateCompanySettings();
if (templateSettings) {
  if (Array.isArray((templateSettings as any).material_markup_tiers)) {
    (seeded as any).material_markup_tiers = (templateSettings as any).material_markup_tiers;
  }
  if (typeof (templateSettings as any).material_markup_mode === 'string') {
    (seeded as any).material_markup_mode = (templateSettings as any).material_markup_mode;
  }
  if (typeof (templateSettings as any).hourly_material_markup_mode === 'string') {
    (seeded as any).hourly_material_markup_mode = (templateSettings as any).hourly_material_markup_mode;
  }
  if (typeof (templateSettings as any).hourly_material_markup_fixed_percent === 'number') {
    (seeded as any).hourly_material_markup_fixed_percent = (templateSettings as any).hourly_material_markup_fixed_percent;
  }
}

    const insert = async (payload: any) =>
      this.supabase.from('company_settings').insert(payload).select().single();

    let created: any = null;
    let createErr: any = null;

    ({ data: created, error: createErr } = await insert(seeded as any));

    // Tolerate partially-migrated schemas (e.g., missing show_tech_view_breakdown).
    if (createErr && String(createErr?.message ?? '').includes('show_tech_view_breakdown')) {
      const fallback = { ...(seeded as any) };
      delete fallback.show_tech_view_breakdown;
      ({ data: created, error: createErr } = await insert(fallback));
    }

    if (createErr) throw createErr;
    return created as any;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    let { data, error } = await this.supabase.from('company_settings').upsert(payload as any).select().single();
    if (error) {
      // Tolerate partially-migrated schemas (e.g., missing material markup strategy columns).
      const msg = String((error as any)?.message ?? error);
      if (msg.includes('material_markup_mode') || msg.includes('material_markup_fixed_percent')) {
        const fallback = { ...(payload as any) };
        delete fallback.material_markup_mode;
        delete fallback.material_markup_fixed_percent;
        ({ data, error } = await this.supabase.from('company_settings').upsert(fallback).select().single());
      }
    }
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
  // Cascade delete:
  // - materials folder: delete descendant folders, materials in them, and any assembly_items referencing those materials
  // - assemblies folder: delete descendant folders, assemblies in them, and their assembly_items
  const { data: folder, error: fErr } = await this.supabase.from('folders').select('*').eq('id', id).single();
  if (fErr) throw fErr;

  const library: 'materials' | 'assemblies' = folder.library;
  const owner: DbOwner = folder.owner;
  const companyId = await this.currentCompanyId();

  // DB stores company_id as NULL for app-owned rows. PostgREST will throw
  // "invalid input syntax for type uuid: \"null\"" if we use eq('company_id', null).
  // Use `.is('company_id', null)` for app-owned scope instead.
  const applyCompanyScope = <T extends { eq: any; is: any }>(q: T) =>
    owner === 'company' ? (q as any).eq('company_id', companyId) : (q as any).is('company_id', null);

  // 1) Collect folder subtree ids (including root)
  const folderIds: string[] = [id];
  let frontier: string[] = [id];
  while (frontier.length) {
    let kidsQ = this.supabase
      .from('folders')
      .select('id')
      .eq('library', library)
      .eq('owner', owner)
      .in('parent_id', frontier);
    kidsQ = applyCompanyScope(kidsQ as any) as any;
    const { data: kids, error: kErr } = await kidsQ;
    if (kErr) throw kErr;

    const next = (kids ?? []).map((r: any) => r.id).filter(Boolean);
    if (!next.length) break;
    folderIds.push(...next);
    frontier = next;
  }

  if (library === 'materials') {
    // 2) Delete materials inside subtree
    let matsQ = this.supabase
      .from('materials')
      .select('id')
      .eq('owner', owner)
      .in('folder_id', folderIds);
    matsQ = applyCompanyScope(matsQ as any) as any;
    const { data: mats, error: mErr } = await matsQ;
    if (mErr) throw mErr;

    const materialIds = (mats ?? []).map((r: any) => r.id).filter(Boolean);

    if (materialIds.length) {
      // 2a) Remove any assembly line items referencing these materials to satisfy FK constraints
      const { error: aiErr } = await this.supabase.from('assembly_items').delete().in('material_id', materialIds);
      if (aiErr) throw aiErr;

      // 2b) Delete the materials
      const { error: delMatErr } = await this.supabase.from('materials').delete().in('id', materialIds);
      if (delMatErr) throw delMatErr;
    }
  } else {
    // assemblies library
    let asmsQ = this.supabase
      .from('assemblies')
      .select('id')
      .eq('owner', owner)
      .in('folder_id', folderIds);
    asmsQ = applyCompanyScope(asmsQ as any) as any;
    const { data: asms, error: aErr } = await asmsQ;
    if (aErr) throw aErr;

    const assemblyIds = (asms ?? []).map((r: any) => r.id).filter(Boolean);

    if (assemblyIds.length) {
      const { error: aiErr } = await this.supabase.from('assembly_items').delete().in('assembly_id', assemblyIds);
      if (aiErr) throw aiErr;

      const { error: delAsmErr } = await this.supabase.from('assemblies').delete().in('id', assemblyIds);
      if (delAsmErr) throw delAsmErr;
    }
  }

  // 3) Delete folders (children first)
  const foldersToDelete = [...folderIds].reverse();
  const { error: delFolderErr } = await this.supabase.from('folders').delete().in('id', foldersToDelete);
  if (delFolderErr) throw delFolderErr;
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

    const base = (data ?? []).map((r: any) => this.mapMaterialFromDb(r));

    // For app-owned materials, merge this company's overrides so the UI loads/saves correctly.
    if (owner !== 'app') return base;

    const ids = base.map((m: any) => m?.id).filter(Boolean) as string[];
    if (ids.length === 0) return base;

    try {
      const companyId = await this.currentCompanyId();
      if (!companyId) return base;

      const { data: odata, error: oerr } = await this.supabase
        .from('app_material_overrides')
        .select('*')
        .eq('company_id', companyId)
        .in('material_id', ids)
        .order('updated_at', { ascending: false });

      if (oerr || !odata) return base;

      const latestByMaterial = new Map<string, any>();
      for (const row of odata) {
        if (!latestByMaterial.has(row.material_id)) latestByMaterial.set(row.material_id, row);
      }

      return base.map((m: any) => this.applyAppMaterialOverride(m, latestByMaterial.get(m.id)));
    } catch {
      return base;
    }
  }

  async getMaterial(id: string): Promise<Material | null> {
    if (!id) throw new Error('getMaterial: missing id');
    const { data, error } = await this.supabase.from('materials').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const material = this.mapMaterialFromDb(data);

    // Merge per-company overrides for app-owned materials so custom cost/toggles persist.
    // (Do not rely on a free variable; use the mapped material library_type.)
    if (material.library_type !== 'app') return material;

    try {
      const companyId2 = await this.currentCompanyId();
      if (!companyId2 || !material?.id) return material;

      const { data: override, error: oerr } = await this.supabase
        .from('app_material_overrides')
        .select('*')
        .eq('company_id', companyId2)
        .eq('material_id', material.id)
        .maybeSingle();

      if (oerr) return material;
      return this.applyAppMaterialOverride(material, override);
    } catch {
      return material;
    }
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
    if (error) {
      // Tolerate partially-migrated schemas where new columns may not exist yet.
      if (String((error as any)?.message ?? '').includes('labor_only')) {
        const fallback = { ...(payload as any) };
        delete fallback.labor_only;
        const { data: data2, error: error2 } = await this.supabase.from('materials').upsert(fallback).select().single();
        if (error2) throw error2;
        return this.mapMaterialFromDb(data2);
      }
      throw error;
    }

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

    // Assembly line items have existed with a few different column names over the life of the project.
    // Some DB schemas use `sort_order`, others use `order_index`, and some have no order column.
    // We MUST be tolerant here because a 400 from PostgREST will prevent materials from ever being added.
    let items: any[] | null = null;
    {
      const base = this.supabase.from('assembly_items').select('*').eq('assembly_id', id);
      const orderCandidates = ['sort_order', 'order_index', 'order'];
      let lastErr: any = null;

      for (const col of orderCandidates) {
        const { data: rows, error } = await base.order(col as any, { ascending: true });
        if (!error) {
          items = (rows ?? []) as any[];
          lastErr = null;
          break;
        }
        lastErr = error;
      }

      if (items == null) {
        // Fallback: no ordering.
        const { data: rows, error } = await base;
        if (error) throw error;
        items = (rows ?? []) as any[];
      }

      if (lastErr && items == null) throw lastErr;
    }

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
        // Support both DB styles (`item_type` vs `type`) and both UI styles (`type` vs `item_type`).
        item_type: it.item_type ?? it.type,
        type: it.item_type ?? it.type,
        material_id: it.material_id ?? null,
        name: it.name ?? null,
        quantity: Number(it.quantity ?? 1),
        // UI uses `unit_cost` for blank material rows; DB stores it in `material_cost_override`
        material_cost_override: it.material_cost_override ?? null,
        unit_cost: it.material_cost_override ?? null,
        // DB does not store taxable per item; default to true so UI doesn't flip unexpectedly.
        taxable: true,
        labor_minutes: Number(it.labor_minutes ?? 0),
        sort_order: Number(it.sort_order ?? it.order_index ?? it.order ?? 0),
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

      const inputItems = Array.isArray(items) ? items : [];

      // NOTE: Some deployments have a minimal `assembly_items` schema. We must not assume
      // optional columns exist (e.g. group_id / parent_group_id / quantity_factor / sort_order).
      // We'll insert with the richest payload first and retry with a smaller payload if PostgREST
      // rejects unknown columns.
      function buildRows(opts: {
        typeCol: 'item_type' | 'type';
        orderCol: 'sort_order' | 'order_index' | null;
        includeSnapshot: boolean;
      }) {
        return inputItems.map((it, idx) => {
          const type = it.type ?? it.item_type ?? 'material';

        if (type === 'labor') {
          const laborMinutes = Number.isFinite(Number(it.labor_minutes ?? it.laborMinutes ?? it.minutes))
            ? Math.max(0, Math.floor(Number(it.labor_minutes ?? it.laborMinutes ?? it.minutes)))
            : 0;
          const row: any = {
            assembly_id: data.id,
            [opts.typeCol]: 'labor',
            quantity: 1,
            labor_minutes: laborMinutes,
          };
          if (opts.includeSnapshot) {
            row.name = it.name ?? 'Labor';
            row.description = it.description ?? null;
          }
          if (opts.orderCol) row[opts.orderCol] = idx;
          return row;
        }

        // Assemblies do not contain other assemblies in the current app.
        // If a stray `assembly` type appears (e.g. legacy data), persist it as a one-off
        // material line (material_id null) so it still saves and renders.
        if (type === 'assembly') {
          const row: any = {
            assembly_id: data.id,
            [opts.typeCol]: 'material',
            material_id: null,
            quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
            labor_minutes: 0,
          };
          if (opts.includeSnapshot) {
            // Snapshot for UI (optional in DB)
            row.name = it.name ?? 'Assembly Line';
            row.description = it.description ?? null;
          }
          if (opts.orderCol) row[opts.orderCol] = idx;
          return row;
        }

        const row: any = {
          assembly_id: data.id,
          [opts.typeCol]: 'material',
          material_id: it.material_id ?? it.materialId ?? it.material_id,
          quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
          labor_minutes: 0,
        };
        if (opts.includeSnapshot) {
          // Optional snapshot for UI
          row.name = it.name ?? null;
          row.description = it.description ?? null;
        }
        if (opts.orderCol) row[opts.orderCol] = idx;
        return row;
      });

      }

      // Try the most common schema first: item_type + sort_order.
      // Then gracefully fall back to alternate schemas.
      const insertAttempts: Array<{ typeCol: 'item_type' | 'type'; orderCol: 'sort_order' | 'order_index' | null; includeSnapshot: boolean }> = [
        // Rich payload first
        { typeCol: 'item_type', orderCol: 'sort_order', includeSnapshot: true },
        { typeCol: 'item_type', orderCol: 'order_index', includeSnapshot: true },
        { typeCol: 'item_type', orderCol: null, includeSnapshot: true },
        { typeCol: 'type', orderCol: 'sort_order', includeSnapshot: true },
        { typeCol: 'type', orderCol: 'order_index', includeSnapshot: true },
        { typeCol: 'type', orderCol: null, includeSnapshot: true },
        // Minimal schema fallback (no name/description columns)
        { typeCol: 'item_type', orderCol: 'sort_order', includeSnapshot: false },
        { typeCol: 'item_type', orderCol: 'order_index', includeSnapshot: false },
        { typeCol: 'item_type', orderCol: null, includeSnapshot: false },
        { typeCol: 'type', orderCol: 'sort_order', includeSnapshot: false },
        { typeCol: 'type', orderCol: 'order_index', includeSnapshot: false },
        { typeCol: 'type', orderCol: null, includeSnapshot: false },
      ];

      if (inputItems.length) {
        let lastErr: any = null;
        for (const attempt of insertAttempts) {
          const rows = buildRows(attempt);
          const { error: insErr } = await this.supabase.from('assembly_items').insert(rows as any);
          if (!insErr) {
            lastErr = null;
            break;
          }
          lastErr = insErr;
        }
        if (lastErr) throw lastErr;
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

  async getAppMaterialOverride(materialId: string, companyId?: string): Promise<AppMaterialOverride | null> {
    if (!materialId) throw new Error('getAppMaterialOverride: missing materialId');
    const effectiveCompanyId = companyId ?? (await this.currentCompanyId());
    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .select('*')
      .eq('material_id', materialId)
      .eq('company_id', effectiveCompanyId)
      .maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  }

  /**
   * App Material Overrides
   *
   * NOTE: Historically this method was called with different signatures.
   * To avoid breaking existing UI code, support BOTH:
   *   - upsertAppMaterialOverride(materialId, patch)
   *   - upsertAppMaterialOverride(overrideObject)
   */
  
  private applyAppMaterialOverride(material: any, overrideRow: any) {
    if (!overrideRow) return material;

    return {
      ...material,
      use_custom_cost: overrideRow.use_custom_cost ?? material.use_custom_cost,
      // DB column is `custom_cost` (older code used `override_custom_cost`).
      custom_cost: (overrideRow.custom_cost ?? overrideRow.override_custom_cost) ?? material.custom_cost,
      override_job_type_id: overrideRow.job_type_id ?? material.override_job_type_id,
    };
  }

async upsertAppMaterialOverride(
    materialIdOrOverride: string | Partial<AppMaterialOverride>,
    patch?: Partial<AppMaterialOverride>
  ): Promise<AppMaterialOverride> {
    const companyId = await this.currentCompanyId();
    if (!companyId) throw new Error('No company');

    let payload: any;
    if (typeof materialIdOrOverride === 'string') {
      payload = {
        company_id: companyId,
        material_id: materialIdOrOverride,
        ...(patch ?? {}),
        updated_at: new Date().toISOString(),
      };
    } else {
      payload = {
        ...materialIdOrOverride,
        company_id: (materialIdOrOverride as any).company_id ?? companyId,
        // tolerate alternative key
        material_id:
          (materialIdOrOverride as any).material_id ??
          (materialIdOrOverride as any).materialId ??
          (materialIdOrOverride as any).app_material_id ??
          null,
        updated_at: new Date().toISOString(),
      };
    }

    // Normalize legacy "override_*" keys to actual DB column names.
    if (payload.override_job_type_id !== undefined && payload.job_type_id === undefined) payload.job_type_id = payload.override_job_type_id;
    if (payload.override_taxable !== undefined && payload.taxable === undefined) payload.taxable = payload.override_taxable;
    if (payload.override_custom_cost !== undefined && payload.custom_cost === undefined) payload.custom_cost = payload.override_custom_cost;
    if (payload.override_use_custom_cost !== undefined && payload.use_custom_cost === undefined) payload.use_custom_cost = payload.override_use_custom_cost;
    delete payload.override_job_type_id;
    delete payload.override_taxable;
    delete payload.override_custom_cost;
    delete payload.override_use_custom_cost;

    if (!payload.material_id) throw new Error('Missing material_id for app material override');

    // Avoid sending undefined values to PostgREST.
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .upsert(payload as any, { onConflict: 'company_id,material_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as any;
  }

  /* ============================
     Estimates
  ============================ */

  async getEstimate(id: string): Promise<Estimate | null> {
    if (!this.isValidUuid(id)) return null;
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    // Options
    const { data: options, error: optErr } = await this.supabase
      .from('estimate_options')
      .select('*')
      .eq('estimate_id', id)
      .order('sort_order', { ascending: true });
    if (optErr) throw optErr;

    // v1 UI edits a single active option. If none exist (legacy data), treat as empty.
    const activeOptionId =
      (data as any).active_option_id ?? (data as any).activeOptionId ?? (options?.[0]?.id ?? null);
    const activeOption = (options ?? []).find((o: any) => o.id === activeOptionId) ?? (options?.[0] ?? null);

    const optionFkCol = await this.getEstimateItemsOptionFkCol();

    // IMPORTANT:
    // If there is no active option (e.g. legacy data where options
    // haven't been created yet, or while the user is deleting an option/
    // estimate and the UI briefly reloads), we must NOT send an invalid
    // UUID filter to PostgREST. Using a sentinel like "__none__" causes
    // a 400 "invalid input syntax for type uuid".
    let items: any[] = [];
    if (activeOption?.id) {
      const { data: itemsData, error: itemsErr } = await this.supabase
        .from('estimate_items')
        .select('*')
        .eq(optionFkCol as any, activeOption.id)
        .order('sort_order', { ascending: true });
      if (itemsErr) throw itemsErr;
      items = itemsData ?? [];
    }

    const mappedItems = (items ?? []).map((it: any) => {
      const t = (it.item_type ?? it.type ?? 'material') as string;
      const group_id = it.group_id ?? it.groupId ?? null;
      const parent_group_id = it.parent_group_id ?? it.parentGroupId ?? null;
      const quantity_factor =
        it.quantity_factor != null || it.quantityFactor != null ? Number(it.quantity_factor ?? it.quantityFactor) : null;

      if (t === 'labor') {
        return {
          id: it.id,
          type: 'labor',
          name: it.name ?? 'Labor',
          description: it.description ?? null,
          labor_minutes: Number(it.labor_minutes ?? 0),
          quantity: 1,

          group_id,
          parent_group_id,
          quantity_factor,
        };
      }
      if (t === 'assembly') {
        return {
          id: it.id,
          type: 'assembly',
          assembly_id: it.assembly_id ?? null,
          quantity: Number(it.quantity ?? 1),

          // Snapshot for UI
          name: it.name ?? null,
          description: it.description ?? null,

          group_id,
          parent_group_id,
          quantity_factor,
        };
      }
      return {
        id: it.id,
        type: 'material',
        material_id: it.material_id ?? null,
        quantity: Number(it.quantity ?? 1),

        // Optional snapshot fields (safe to ignore)
        name: it.name ?? null,
        description: it.description ?? null,

        group_id,
        parent_group_id,
        quantity_factor,
      };
    });

    return {
      ...(data as any),
      // normalize to UI field name used elsewhere
      customer_supplied_materials: Boolean((data as any).customer_supplies_materials ?? (data as any).customer_supplied_materials ?? false),
      customer_supplies_materials: Boolean((data as any).customer_supplies_materials ?? false),
      options: (options ?? []) as any,
      active_option_id: (activeOption?.id ?? null) as any,
      items: mappedItems as any,
    } as any;
  }


  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const companyId = await this.currentCompanyId();

    const items: any[] = (estimate as any)?.items ?? [];

    // Whitelist columns that actually exist on `estimates`
    const payload: any = {
      id: (estimate as any).id,
      company_id: companyId,
      estimate_number: (estimate as any).estimate_number ?? null,
      name: (estimate as any).name ?? null,

      customer_name: (estimate as any).customer_name ?? null,
      customer_phone: (estimate as any).customer_phone ?? null,
      customer_email: (estimate as any).customer_email ?? null,
      customer_address: (estimate as any).customer_address ?? null,
      private_notes: (estimate as any).private_notes ?? null,

      active_option_id: (estimate as any).active_option_id ?? (estimate as any).activeOptionId ?? null,

      job_type_id: (estimate as any).job_type_id ?? null,
      use_admin_rules: Boolean((estimate as any).use_admin_rules ?? false),

      customer_supplies_materials: Boolean(
        (estimate as any).customer_supplies_materials ??
          (estimate as any).customer_supplied_materials ??
          false
      ),

      apply_discount: Boolean((estimate as any).apply_discount ?? false),
      // Editable per-estimate discount percent (capped by Admin). Nullable.
      discount_percent:
        (estimate as any).discount_percent == null || String((estimate as any).discount_percent).trim() === ''
          ? null
          : Number((estimate as any).discount_percent),
      apply_processing_fees: Boolean((estimate as any).apply_processing_fees ?? false),
      // Deprecated: misc material is governed solely by Admin configuration.
      // Do NOT send apply_misc_material to Supabase (column may not exist in migrated schemas).

      status: (estimate as any).status ?? 'draft',
      sent_at: (estimate as any).sent_at ?? null,
      approved_at: (estimate as any).approved_at ?? null,
      declined_at: (estimate as any).declined_at ?? null,
      valid_until: (estimate as any).valid_until ?? null,

      created_by: (estimate as any).created_by ?? null,
      created_at: (estimate as any).created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase.from('estimates').upsert(payload).select('*').single();
    if (error) throw error;

    // Options + items
    // v1 UI edits a single active option. We persist items against `estimate_options.id`
    // (so FK `estimate_items.estimate_option_id -> estimate_options.id` is satisfied).
    let activeOptionId: string | null =
      (estimate as any).active_option_id ?? (estimate as any).activeOptionId ?? null;

    const { data: options, error: optErr } = await this.supabase
      .from('estimate_options')
      .select('*')
      .eq('estimate_id', data.id)
      .order('sort_order', { ascending: true });
    if (optErr) throw optErr;

    let activeOption: any =
      (options ?? []).find((o: any) => o.id === activeOptionId) ?? (options ?? [])[0] ?? null;

    if (!activeOption) {
      const { data: createdOpt, error: createOptErr } = await this.supabase
        .from('estimate_options')
        .insert({ estimate_id: data.id, option_name: 'Option 1', sort_order: 1 })
        .select('*')
        .single();
      if (createOptErr) throw createOptErr;
      activeOption = createdOpt;
    }

    activeOptionId = activeOption?.id ?? null;

    // Replace all items for active option on save (option-scoped line items)
    {
      const optionFkCol = await this.getEstimateItemsOptionFkCol();

      const { count: existingCount, error: countErr } = await this.supabase
        .from('estimate_items')
        .select('id', { count: 'exact', head: true })
        .eq(optionFkCol as any, activeOptionId);
      if (countErr) throw countErr;

      const { data: deletedRows, error: delErr } = await this.supabase
        .from('estimate_items')
        .delete()
        .eq(optionFkCol as any, activeOptionId)
        .select('id');
      if (delErr) throw delErr;
      if ((existingCount ?? 0) > 0 && (deletedRows?.length ?? 0) === 0) {
        throw new Error(
          'Save failed: existing estimate line items could not be cleared (likely an RLS DELETE policy issue on estimate_items).'
        );
      }

      const rows = (Array.isArray(items) ? items : []).map((it, idx) => {
        const type = it.type ?? it.item_type ?? 'material';

        const group_id = it.group_id ?? it.groupId ?? null;
        const parent_group_id = it.parent_group_id ?? it.parentGroupId ?? null;
        const quantity_factor =
          it.quantity_factor != null || it.quantityFactor != null ? Number(it.quantity_factor ?? it.quantityFactor) : null;

        const base: any = {
          [optionFkCol]: activeOptionId,
          sort_order: idx,
          group_id,
          parent_group_id,
          quantity_factor,
        };

        if (type === 'labor') {
          const laborMinutes = Number.isFinite(Number(it.labor_minutes ?? it.laborMinutes ?? it.minutes))
            ? Math.max(0, Math.floor(Number(it.labor_minutes ?? it.laborMinutes ?? it.minutes)))
            : 0;
          return {
            ...base,
            item_type: 'labor',
            name: it.name ?? 'Labor',
            description: it.description ?? null,
            quantity: 1,
            labor_minutes: laborMinutes,
          };
        }

        if (type === 'assembly') {
          return {
            ...base,
            item_type: 'assembly',
            assembly_id: it.assembly_id ?? it.assemblyId ?? it.assembly_id,
            quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
            labor_minutes: 0,
            // Snapshot for UI
            name: it.name ?? null,
            description: it.description ?? null,
          };
        }

        return {
          ...base,
          item_type: 'material',
          material_id: it.material_id ?? it.materialId ?? it.material_id,
          quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
          labor_minutes: 0,
          // Optional snapshot for UI
          name: it.name ?? null,
          description: it.description ?? null,
        };
      });

      if (rows.length) {
        const { error: insErr } = await this.supabase.from('estimate_items').insert(rows as any);
        if (insErr) throw insErr;
      }
    }

    return (await this.getEstimate(data.id)) ?? (data as any);
  }


  

  async updateEstimateHeader(estimate: Partial<Estimate>): Promise<Estimate> {
    const companyId = await this.currentCompanyId();

    // Whitelist columns that actually exist on `estimates`
    const payload: any = {
      id: (estimate as any).id,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    // Only patch fields that are explicitly provided (avoid nulling existing data)
    if ((estimate as any).active_option_id !== undefined || (estimate as any).activeOptionId !== undefined) {
      payload.active_option_id = (estimate as any).active_option_id ?? (estimate as any).activeOptionId ?? null;
    }
if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase.from('estimates').upsert(payload).select('*').single();
    if (error) throw error;

    return (await this.getEstimate(data.id)) ?? (data as any);
  }

  async listEstimateOptions(estimateId: string): Promise<EstimateOption[]> {
    const companyId = await this.currentCompanyId();

    // Ensure tenant boundary: estimate must belong to company
    const { data: est, error: estErr } = await this.supabase
      .from('estimates')
      .select('id, company_id')
      .eq('company_id', companyId)
      .eq('id', estimateId)
      .maybeSingle();
    if (estErr) throw estErr;
    if (!est) return [];

    const { data, error } = await this.supabase
      .from('estimate_options')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as any;
  }

  async createEstimateOption(estimateId: string, optionName: string): Promise<EstimateOption> {
    const existing = await this.listEstimateOptions(estimateId);
    const nextSort = (existing?.reduce((m, o: any) => Math.max(m, Number(o.sort_order ?? 0)), 0) ?? 0) + 1;

    const { data, error } = await this.supabase
      .from('estimate_options')
      .insert({ estimate_id: estimateId, option_name: optionName, sort_order: nextSort })
      .select('*')
      .single();
    if (error) throw error;
    return data as any;
  }

  async updateEstimateOption(option: Partial<EstimateOption> & { id: string }): Promise<EstimateOption> {
    const payload: any = {};
    if ((option as any).option_name != null) payload.option_name = (option as any).option_name;
    if ((option as any).option_description !== undefined) payload.option_description = (option as any).option_description;
    if ((option as any).sort_order != null) payload.sort_order = (option as any).sort_order;

    const { data, error } = await this.supabase
      .from('estimate_options')
      .update(payload)
      .eq('id', option.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as any;
  }

  async getEstimateItemsForOption(optionId: string): Promise<EstimateItem[]> {
    const optionFkCol = await this.getEstimateItemsOptionFkCol();

    const { data: items, error: itemsErr } = await this.supabase
      .from('estimate_items')
      .select('*')
      .eq(optionFkCol as any, optionId)
      .order('sort_order', { ascending: true });
    if (itemsErr) throw itemsErr;

    const mappedItems = (items ?? []).map((it: any) => {
      const t = (it.item_type ?? it.type ?? 'material') as string;
      const group_id = it.group_id ?? it.groupId ?? null;
      const parent_group_id = it.parent_group_id ?? it.parentGroupId ?? null;
      const quantity_factor =
        it.quantity_factor != null || it.quantityFactor != null ? Number(it.quantity_factor ?? it.quantityFactor) : null;

      if (t === 'labor') {
        return {
          id: it.id,
          type: 'labor',
          name: it.name ?? 'Labor',
          description: it.description ?? null,
          labor_minutes: Number(it.labor_minutes ?? 0),
          quantity: 1,

          group_id,
          parent_group_id,
          quantity_factor,
        } as any;
      }
      if (t === 'assembly') {
        return {
          id: it.id,
          type: 'assembly',
          assembly_id: it.assembly_id ?? it.assemblyId ?? null,
          quantity: Number(it.quantity ?? 1),

          group_id,
          parent_group_id,
          quantity_factor,
        } as any;
      }
      // material
      return {
        id: it.id,
        type: 'material',
        material_id: it.material_id ?? it.materialId ?? null,
        quantity: Number(it.quantity ?? 1),

        group_id,
        parent_group_id,
        quantity_factor,
      } as any;
    });

    return mappedItems as any;
  }

  async replaceEstimateItemsForOption(optionId: string, items: EstimateItem[]): Promise<void> {
    const optionFkCol = await this.getEstimateItemsOptionFkCol();

    // Clear existing
    const { count: existingCount, error: countErr } = await this.supabase
      .from('estimate_items')
      .select('id', { count: 'exact', head: true })
      .eq(optionFkCol as any, optionId);
    if (countErr) throw countErr;

    const { data: deletedRows, error: delErr } = await this.supabase
      .from('estimate_items')
      .delete()
      .eq(optionFkCol as any, optionId)
      .select('id');
    if (delErr) throw delErr;
    if ((existingCount ?? 0) > 0 && (deletedRows?.length ?? 0) === 0) {
      throw new Error(
        'Save failed: existing estimate line items could not be cleared (likely an RLS DELETE policy issue on estimate_items).'
      );
    }

    const rows = (Array.isArray(items) ? items : []).map((it: any, idx: number) => {
      const type = it.type ?? it.item_type ?? 'material';

      const group_id = it.group_id ?? it.groupId ?? null;
      const parent_group_id = it.parent_group_id ?? it.parentGroupId ?? null;
      const quantity_factor =
        it.quantity_factor != null || it.quantityFactor != null ? Number(it.quantity_factor ?? it.quantityFactor) : null;

      const base: any = {
        [optionFkCol]: optionId,
        sort_order: idx,
        group_id,
        parent_group_id,
        quantity_factor,
      };

      if (type === 'labor') {
        const laborMinutes = Number.isFinite(Number(it.labor_minutes ?? it.laborMinutes ?? it.minutes))
          ? Math.max(0, Math.floor(Number(it.labor_minutes ?? it.laborMinutes ?? it.minutes)))
          : 0;
        return {
          ...base,
          item_type: 'labor',
          name: it.name ?? 'Labor',
          description: it.description ?? null,
          quantity: 1,
          labor_minutes: laborMinutes,
        };
      }

      if (type === 'assembly') {
        return {
          ...base,
          item_type: 'assembly',
          assembly_id: it.assembly_id ?? it.assemblyId ?? it.assembly_id,
          quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
          labor_minutes: 0,
        };
      }

      return {
        ...base,
        item_type: 'material',
        material_id: it.material_id ?? it.materialId ?? it.material_id,
        quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
        labor_minutes: 0,
      };
    });

    if (rows.length > 0) {
      const { error: insErr } = await this.supabase.from('estimate_items').insert(rows as any);
      if (insErr) throw insErr;
    }
  }

  async copyEstimateOption(estimateId: string, fromOptionId: string): Promise<EstimateOption> {
    const existing = await this.listEstimateOptions(estimateId);
    const nextSort = (existing?.reduce((m, o: any) => Math.max(m, Number(o.sort_order ?? 0)), 0) ?? 0) + 1;
    const newName = `Option ${nextSort}`;

    const { data: createdOpt, error: createOptErr } = await this.supabase
      .from('estimate_options')
      .insert({ estimate_id: estimateId, option_name: newName, sort_order: nextSort })
      .select('*')
      .single();
    if (createOptErr) throw createOptErr;

    const items = await this.getEstimateItemsForOption(fromOptionId);
    await this.replaceEstimateItemsForOption(createdOpt.id, items);

    return createdOpt as any;
  }
async deleteEstimate(id: string): Promise<void> {
    if (!this.isValidUuid(id)) return;

    const optionFkCol = await this.getEstimateItemsOptionFkCol();

    // Delete children first to avoid orphan fetches / constraint issues.
    const { data: optRows, error: optListErr } = await this.supabase
      .from('estimate_options')
      .select('id')
      .eq('estimate_id', id);

    if (optListErr) throw optListErr;

    const optionIds = (optRows ?? []).map((r: any) => r.id).filter((x: any) => this.isValidUuid(x));

    if (optionIds.length > 0) {
      const { error: itemsErr } = await this.supabase
        .from('estimate_items')
        .delete()
        .in(optionFkCol as any, optionIds as any);
      if (itemsErr) throw itemsErr;

      const { error: optsErr } = await this.supabase.from('estimate_options').delete().eq('estimate_id', id);
      if (optsErr) throw optsErr;
    }

    const { error } = await this.supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
  }


  /* ============================
     Lists / Admin Rules / CSV / Branding (unchanged)
  ============================ */

  async getEstimates(): Promise<Estimate[]> {
    const companyId = await this.currentCompanyId();
    if (!this.isValidUuid(companyId)) return [];
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
    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('company_id, company_display_name, license_info, warranty_info, terms_info, logo_storage_path, updated_at')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as any;

    const payload = {
      company_id: companyId,
      company_display_name: null,
      license_info: null,
      warranty_info: null,
      terms_info: null,
      logo_storage_path: null,
      updated_at: new Date().toISOString(),
    };
    const { data: created, error: createErr } = await this.supabase.from('branding_settings').insert(payload as any).select().single();
    if (createErr) throw createErr;
    return created as any;
  }

  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    // Only persist columns that exist in the current Supabase schema.
    const payload: any = {
      company_id: companyId,
      company_display_name: settings.company_display_name ?? null,
      license_info: settings.license_info ?? null,
      warranty_info: settings.warranty_info ?? null,
      terms_info: settings.terms_info ?? null,
      logo_storage_path: settings.logo_storage_path ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.supabase
      .from('branding_settings')
      .upsert(payload)
      .select('company_id, company_display_name, license_info, warranty_info, terms_info, logo_storage_path, updated_at')
      .single();
    if (error) throw error;
    return data as any;
  }
}




















/**
 * Best-effort fetch of the app designer's (template) company settings.
 * Used to seed new companies with the same default material tiered markups shown in the designer account.
 * If RLS prevents access, this safely returns null and we fall back to local defaults.
 */
private async tryGetTemplateCompanySettings(): Promise<CompanySettings | null> {
  try {
    const { data: tmplCompany, error: cErr } = await this.supabase
      .from('companies')
      .select('id')
      .eq('is_template', true)
      .limit(1)
      .maybeSingle();

    if (cErr || !tmplCompany?.id) return null;

    const { data: settings, error: sErr } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', tmplCompany.id)
      .maybeSingle();

    if (sErr || !settings) return null;
    return settings as unknown as CompanySettings;
  } catch {
    return null;
  }
}



