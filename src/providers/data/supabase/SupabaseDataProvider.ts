// src/providers/data/supabase/SupabaseDataProvider.ts

import { IDataProvider } from "../IDataProvider";
import {
  Company,
  CompanySettings,
  JobType,
  AdminRule,
  CsvSettings,
  BrandingSettings,
  UUID,
} from "../types";
import { supabase } from "../../../supabase/client";

export class SupabaseDataProvider implements IDataProvider {
  /* Company */
  async getCompany(companyId: UUID): Promise<Company | null> {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error) {
      console.error("getCompany error", error);
      return null;
    }

    return data;
  }

  /* Company Settings */
  async getCompanySettings(
    companyId: UUID
  ): Promise<CompanySettings | null> {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("getCompanySettings error", error);
    }

    return data ?? null;
  }

  async upsertCompanySettings(
    settings: Partial<CompanySettings> & { company_id: UUID }
  ): Promise<void> {
    const { error } = await supabase
      .from("company_settings")
      .upsert(settings, { onConflict: "company_id" });

    if (error) {
      console.error("upsertCompanySettings error", error);
    }
  }

  /* Job Types */
  async listJobTypes(companyId: UUID): Promise<JobType[]> {
    const { data, error } = await supabase
      .from("job_types")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("listJobTypes error", error);
      return [];
    }

    return data ?? [];
  }

  async createJobType(
    jobType: Omit<JobType, "id" | "created_at">
  ): Promise<JobType> {
    const { data, error } = await supabase
      .from("job_types")
      .insert(jobType)
      .select()
      .single();

    if (error) {
      console.error("createJobType error", error);
      throw error;
    }

    return data;
  }

  async updateJobType(jobType: JobType): Promise<void> {
    const { error } = await supabase
      .from("job_types")
      .update(jobType)
      .eq("id", jobType.id);

    if (error) {
      console.error("updateJobType error", error);
    }
  }

  async deleteJobType(id: UUID): Promise<void> {
    const { error } = await supabase.from("job_types").delete().eq("id", id);

    if (error) {
      console.error("deleteJobType error", error);
    }
  }

  /* Admin Rules */
  async listAdminRules(companyId: UUID): Promise<AdminRule[]> {
    const { data, error } = await supabase
      .from("admin_rules")
      .select("*")
      .eq("company_id", companyId)
      .order("priority", { ascending: true });

    if (error) {
      console.error("listAdminRules error", error);
      return [];
    }

    return data ?? [];
  }

  async upsertAdminRule(
    rule: Partial<AdminRule> & { company_id: UUID }
  ): Promise<void> {
    const { error } = await supabase
      .from("admin_rules")
      .upsert(rule, { onConflict: "id" });

    if (error) {
      console.error("upsertAdminRule error", error);
    }
  }

  /* CSV Settings */
  async getCsvSettings(companyId: UUID): Promise<CsvSettings | null> {
    const { data, error } = await supabase
      .from("csv_settings")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("getCsvSettings error", error);
    }

    return data ?? null;
  }

  async upsertCsvSettings(
    settings: Partial<CsvSettings> & { company_id: UUID }
  ): Promise<void> {
    const { error } = await supabase
      .from("csv_settings")
      .upsert(settings, { onConflict: "company_id" });

    if (error) {
      console.error("upsertCsvSettings error", error);
    }
  }

  /* Branding */
  async getBrandingSettings(
    companyId: UUID
  ): Promise<BrandingSettings | null> {
    const { data, error } = await supabase
      .from("branding_settings")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("getBrandingSettings error", error);
    }

    return data ?? null;
  }

  async upsertBrandingSettings(
    settings: Partial<BrandingSettings> & { company_id: UUID }
  ): Promise<void> {
    const { error } = await supabase
      .from("branding_settings")
      .upsert(settings, { onConflict: "company_id" });

    if (error) {
      console.error("upsertBrandingSettings error", error);
    }
  }
}
