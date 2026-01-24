// src/providers/data/IDataProvider.ts

import {
  Company,
  CompanySettings,
  JobType,
  AdminRule,
  CsvSettings,
  BrandingSettings,
  UUID,
} from "./types";

export interface IDataProvider {
  /* Company */
  getCompany(companyId: UUID): Promise<Company | null>;

  /* Company Settings */
  getCompanySettings(companyId: UUID): Promise<CompanySettings | null>;
  upsertCompanySettings(
    settings: Partial<CompanySettings> & { company_id: UUID }
  ): Promise<void>;

  /* Job Types */
  listJobTypes(companyId: UUID): Promise<JobType[]>;
  createJobType(
    jobType: Omit<JobType, "id" | "created_at">
  ): Promise<JobType>;
  updateJobType(jobType: JobType): Promise<void>;
  deleteJobType(id: UUID): Promise<void>;

  /* Admin Rules */
  listAdminRules(companyId: UUID): Promise<AdminRule[]>;
  upsertAdminRule(
    rule: Partial<AdminRule> & { company_id: UUID }
  ): Promise<void>;

  /* CSV Settings */
  getCsvSettings(companyId: UUID): Promise<CsvSettings | null>;
  upsertCsvSettings(
    settings: Partial<CsvSettings> & { company_id: UUID }
  ): Promise<void>;

  /* Branding */
  getBrandingSettings(companyId: UUID): Promise<BrandingSettings | null>;
  upsertBrandingSettings(
    settings: Partial<BrandingSettings> & { company_id: UUID }
  ): Promise<void>;
}
