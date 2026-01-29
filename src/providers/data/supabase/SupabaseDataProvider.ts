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
      const { data } = await this.supabase.from('profiles').select('is_app_owner').single();
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
    };
  }

  private mapFolderToDb(folder: Partial<Folder>): any {
    const owner = folder.library_type ? this.toDbOwner(folder.library_type) : 'company';
    return {
      id: folder.id,
      owner,
      library: folder.kind as DbLibrary,
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
      base_cost: Number(row.base_cost ?? 0),

      custom_cost: row.custom_cost ?? null,
      use_custom_cost: Boolean(row.use_custom_cost ?? false),

      taxable: Boolean(row.taxable ?? false),
      job_type_id: row.job_type_id ?? null,

      labor_minutes: Number(row.labor_minutes ?? 0),
      labor_hours: 0,

      order_index: Number(row.sort_order ?? 0),
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,

      library_type: this.fromDbOwner(row.owner),
    };
  }

  private mapMaterialToDb(material: Partial<Material>): any {
    const owner = material.library_type ? this.toDbOwner(material.library_type) : 'company';

    return {
      id: material.id,
      owner,
      company_id: owner === 'company' ? material.company_id : null,
      folder_id: material.folder_id ?? null,
      name: material.name,
      sku: material.sku ?? null,
      description: material.description ?? null,
      base_cost: material.base_cost ?? 0,

      custom_cost: material.custom_cost ?? null,
      use_custom_cost: Boolean(material.use_custom_cost ?? false),

      taxable: material.taxable ?? false,
      job_type_id: material.job_type_id ?? null,
      labor_minutes: material.labor_minutes ?? 0,

      sort_order: material.order_index ?? 0,
      updated_at: new Date().toISOString(),
      created_at: material.created_at,
    };
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

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    if (material.company_id === null && !(await this.isAppOwner())) {
      throw new Error('App materials cannot be edited directly');
    }

    const payload = this.mapMaterialToDb(material);

    if (payload.owner === 'company') payload.company_id = payload.company_id ?? companyId;
    if (!payload.id) delete payload.id;

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
     (everything else unchanged)
  ============================ */
}
