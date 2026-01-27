// src/providers/data/supabase/SupabaseDataProvider.ts

import { supabase } from '../client';
import type {
  DataProvider,
  Material,
  Folder,
  AppMaterialOverride,
  OwnerType,
  LibraryType,
  UUID,
} from '../types';

export class SupabaseDataProvider implements DataProvider {
  /* ================================
     Helpers
  ================================ */

  private async getProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  private async isAppOwner(): Promise<boolean> {
    const profile = await this.getProfile();
    return Boolean(profile?.is_app_owner);
  }

  /* ================================
     Materials
  ================================ */

  async listMaterials(owner: OwnerType): Promise<Material[]> {
    const profile = await this.getProfile();

    const query = supabase
      .from('materials')
      .select('*')
      .eq('owner', owner);

    if (owner === 'user') {
      query.eq('company_id', profile.company_id);
    }

    const { data: materials, error } = await query;
    if (error) throw error;

    if (owner === 'app') {
      const { data: overrides, error: oErr } = await supabase
        .from('app_material_overrides')
        .select('*')
        .eq('company_id', profile.company_id);

      if (oErr) throw oErr;

      const overrideMap = new Map<
        string,
        AppMaterialOverride
      >(
        (overrides ?? []).map(o => [o.material_id, o])
      );

      return (materials ?? []).map(m => {
        const o = overrideMap.get(m.id);
        if (!o) return m;

        return {
          ...m,
          job_type_id: o.override_job_type_id ?? m.job_type_id,
          taxable: o.override_taxable ?? m.taxable,
          custom_cost: o.custom_cost ?? null,
          use_custom_cost: o.use_custom_cost ?? false,
        };
      });
    }

    return materials ?? [];
  }

  async getMaterial(id: UUID): Promise<Material | null> {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const profile = await this.getProfile();

    const payload = {
      ...material,
      company_id:
        material.owner === 'user' ? profile.company_id : null,
    };

    const { data, error } = await supabase
      .from('materials')
      .upsert(payload)
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

  /* ================================
     Folders
  ================================ */

  async listFolders(
    library: LibraryType,
    owner: OwnerType
  ): Promise<Folder[]> {
    const profile = await this.getProfile();

    const query = supabase
      .from('folders')
      .select('*')
      .eq('library', library)
      .eq('owner', owner);

    if (owner === 'user') {
      query.eq('company_id', profile.company_id);
    }

    const { data, error } = await query.order('sort_order', {
      ascending: true,
    });

    if (error) throw error;
    return data ?? [];
  }

  async upsertFolder(folder: Partial<Folder>): Promise<Folder> {
    const profile = await this.getProfile();

    const payload = {
      ...folder,
      company_id:
        folder.owner === 'user' ? profile.company_id : null,
    };

    const { data, error } = await supabase
      .from('folders')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteFolder(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /* ================================
     App Material Overrides
  ================================ */

  async listAppMaterialOverrides(): Promise<AppMaterialOverride[]> {
    const profile = await this.getProfile();

    const { data, error } = await supabase
      .from('app_material_overrides')
      .select('*')
      .eq('company_id', profile.company_id);

    if (error) throw error;
    return data ?? [];
  }

  async upsertAppMaterialOverride(
    override: Partial<AppMaterialOverride>
  ): Promise<void> {
    const profile = await this.getProfile();

    const payload = {
      ...override,
      company_id: profile.company_id,
    };

    const { error } = await supabase
      .from('app_material_overrides')
      .upsert(payload);

    if (error) throw error;
  }
}
