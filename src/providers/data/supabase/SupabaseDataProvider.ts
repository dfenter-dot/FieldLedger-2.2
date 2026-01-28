// src/providers/data/supabase/SupabaseDataProvider.ts

import { supabase } from './client';
import type {
  Assembly,
  AssemblyItem,
  AppAssemblyOverride,
  CompanySettings,
  Estimate,
  EstimateAssemblyLine,
  Folder,
  JobType,
  Material,
  UUID,
} from '../types';
import type { IDataProvider } from '../IDataProvider';
import { computeAssemblyPricing } from '../pricing';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private companyId: UUID, private isAppOwner: boolean) {}

  /* =======================
   * Folders
   * ======================= */
  async listFolders(params: {
    ownerType: 'user' | 'app';
    parentId: UUID | null;
  }): Promise<Folder[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('owner_type', params.ownerType)
      .eq('parent_id', params.parentId)
      .order('sort_order');

    if (error) throw error;
    return data ?? [];
  }

  async createFolder(folder: Partial<Folder>): Promise<Folder> {
    const { data, error } = await supabase
      .from('folders')
      .insert(folder)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateFolder(folder: Partial<Folder>): Promise<Folder> {
    const { data, error } = await supabase
      .from('folders')
      .update(folder)
      .eq('id', folder.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteFolder(folderId: UUID): Promise<void> {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (error) throw error;
  }

  /* =======================
   * Materials
   * ======================= */
  async listMaterials(params: {
    ownerType: 'user' | 'app';
    folderId: UUID;
  }): Promise<Material[]> {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('owner_type', params.ownerType)
      .eq('folder_id', params.folderId)
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async getMaterial(id: UUID): Promise<Material | null> {
    const { data } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    return data ?? null;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const { data, error } = await supabase
      .from('materials')
      .upsert(material)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMaterial(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /* =======================
   * Assemblies
   * ======================= */
  async listAssemblies(params: {
    libraryType: 'user' | 'app';
    folderId: UUID;
  }): Promise<Assembly[]> {
    const ownerType = params.libraryType === 'app' ? 'app' : 'user';

    const { data, error } = await supabase
      .from('assemblies')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('folder_id', params.folderId)
      .order('sort_order');

    if (error) throw error;
    return data ?? [];
  }

  async getAssembly(id: UUID): Promise<{
    assembly: Assembly;
    items: AssemblyItem[];
    appOverride?: AppAssemblyOverride | null;
  } | null> {
    const { data: assembly } = await supabase
      .from('assemblies')
      .select('*')
      .eq('id', id)
      .single();

    if (!assembly) return null;

    const { data: items } = await supabase
      .from('assembly_items')
      .select('*')
      .eq('assembly_id', id)
      .order('sort_order');

    let appOverride: AppAssemblyOverride | null = null;

    if (assembly.owner_type === 'app' && !this.isAppOwner) {
      const { data } = await supabase
        .from('app_assembly_overrides')
        .select('*')
        .eq('assembly_id', id)
        .eq('company_id', this.companyId)
        .single();

      appOverride = data ?? null;
    }

    return {
      assembly,
      items: items ?? [],
      appOverride,
    };
  }

  async upsertAssembly(params: {
    assembly: Partial<Assembly>;
    items: AssemblyItem[];
  }): Promise<Assembly> {
    const { assembly, items } = params;

    if (assembly.owner_type === 'app' && !this.isAppOwner) {
      throw new Error('Not allowed to modify app-owned assembly');
    }

    const { data: savedAssembly, error } = await supabase
      .from('assemblies')
      .upsert(assembly)
      .select()
      .single();

    if (error) throw error;

    if (items?.length) {
      await supabase
        .from('assembly_items')
        .delete()
        .eq('assembly_id', savedAssembly.id);

      const rows = items.map((i, idx) => ({
        ...i,
        assembly_id: savedAssembly.id,
        sort_order: idx,
      }));

      const { error: itemsError } = await supabase
        .from('assembly_items')
        .insert(rows);

      if (itemsError) throw itemsError;
    }

    return savedAssembly;
  }

  async deleteAssembly(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('assemblies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /* =======================
   * Assembly Overrides
   * ======================= */
  async getAppAssemblyOverride(
    assemblyId: UUID,
    companyId: UUID
  ): Promise<AppAssemblyOverride | null> {
    const { data } = await supabase
      .from('app_assembly_overrides')
      .select('*')
      .eq('assembly_id', assemblyId)
      .eq('company_id', companyId)
      .single();

    return data ?? null;
  }

  async upsertAppAssemblyOverride(
    override: Partial<AppAssemblyOverride>
  ): Promise<AppAssemblyOverride> {
    const { data, error } = await supabase
      .from('app_assembly_overrides')
      .upsert(override)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /* =======================
   * Estimates
   * ======================= */
  async getEstimate(id: UUID): Promise<Estimate | null> {
    const { data } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .single();

    return data ?? null;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const { data, error } = await supabase
      .from('estimates')
      .upsert(estimate)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteEstimate(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async addAssemblyToEstimate(params: {
    estimateId: UUID;
    assemblyId: UUID;
    quantity: number;
  }): Promise<EstimateAssemblyLine> {
    const { data, error } = await supabase
      .from('estimate_assemblies')
      .insert({
        estimate_id: params.estimateId,
        assembly_id: params.assemblyId,
        quantity: params.quantity,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeAssemblyFromEstimate(
    estimateAssemblyLineId: UUID
  ): Promise<void> {
    const { error } = await supabase
      .from('estimate_assemblies')
      .delete()
      .eq('id', estimateAssemblyLineId);

    if (error) throw error;
  }

  /* =======================
   * Job Types / Settings
   * ======================= */
  async listJobTypes(): Promise<JobType[]> {
    const { data, error } = await supabase
      .from('job_types')
      .select('*')
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', this.companyId)
      .single();

    if (error) throw error;
    return data;
  }

  /* =======================
   * Pricing
   * ======================= */
  computeAssemblyPricing(params: Parameters<IDataProvider['computeAssemblyPricing']>[0]) {
    return computeAssemblyPricing(params);
  }
}
