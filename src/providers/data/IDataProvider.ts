import {
  CompanySettings,
  JobType,
  AdminRule,
  CsvSettings,
  BrandingSettings,
} from './types';

/**
 * IDataProvider
 *
 * This interface defines the contract used by the app
 * to talk to either LocalDataProvider or SupabaseDataProvider.
 *
 * Phase 1 Rules work only requires READ / WRITE of Admin Rules.
 */
export interface IDataProvider {
  /* =========================
     Company
     ========================= */

  getCompanySettings(companyId: string): Promise<CompanySettings | null>;
  upsertCompanySettings(
    companyId: string,
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings>;

  /* =========================
     Job Types
     ========================= */

  getJobTypes(companyId: string): Promise<JobType[]>;
  upsertJobType(
    companyId: string,
    jobType: Partial<JobType>
  ): Promise<JobType>;
  deleteJobType(companyId: string, jobTypeId: string): Promise<void>;

  /* =========================
     Admin Rules
     ========================= */

  getAdminRules(companyId: string): Promise<AdminRule[]>;

  upsertAdminRule(
    companyId: string,
    rule: Partial<AdminRule>
  ): Promise<AdminRule>;

  deleteAdminRule(companyId: string, ruleId: string): Promise<void>;

  /* =========================
     CSV Settings
     ========================= */

  getCsvSettings(companyId: string): Promise<CsvSettings | null>;
  upsertCsvSettings(
    companyId: string,
    settings: Partial<CsvSettings>
  ): Promise<CsvSettings>;

  /* =========================
     Branding
     ========================= */

  getBrandingSettings(companyId: string): Promise<BrandingSettings | null>;
  upsertBrandingSettings(
    companyId: string,
    settings: Partial<BrandingSettings>
  ): Promise<BrandingSettings>;
}
