// src/providers/data/local/seed.ts

import type {
  AdminRule,
  Assembly,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  Folder,
  JobType,
  Material,
} from '../types';

const now = () => new Date().toISOString();

export const SEED_COMPANY_ID = 'demo-company-id';
export const SEED_USER_ID = 'demo-user-id';

/* ---------------- Folders ---------------- */

export const seedFolders: Folder[] = [
  {
    id: 'folder-materials-root',
    name: 'Materials',
    parent_id: null,
    kind: 'materials',
    library_type: 'company',
    company_id: SEED_COMPANY_ID,
    created_at: now(),
  },
  {
    id: 'folder-assemblies-root',
    name: 'Assemblies',
    parent_id: null,
    kind: 'assemblies',
    library_type: 'company',
    company_id: SEED_COMPANY_ID,
    created_at: now(),
  },
  {
    id: 'folder-estimates-root',
    name: 'Estimates',
    parent_id: null,
    kind: 'estimates',
    library_type: 'company',
    company_id: SEED_COMPANY_ID,
    created_at: now(),
  },
];

/* ---------------- Materials ---------------- */

export const seedMaterials: Material[] = [
  {
    id: 'mat-1',
    company_id: SEED_COMPANY_ID,
    name: 'TR Duplex Receptacle',
    description: '15A tamper-resistant duplex',
    unit_cost: 2.5,
    taxable: true,
    labor_minutes: 10,
    folder_id: 'folder-materials-root',
    created_at: now(),
  },
  {
    id: 'mat-2',
    company_id: SEED_COMPANY_ID,
    name: 'Single Pole Switch',
    description: '15A single pole',
    unit_cost: 2.25,
    taxable: true,
    labor_minutes: 10,
    folder_id: 'folder-materials-root',
    created_at: now(),
  },
];

/* ---------------- Assemblies ---------------- */

export const seedAssemblies: Assembly[] = [
  {
    id: 'asm-1',
    company_id: SEED_COMPANY_ID,
    name: 'Replace Duplex Receptacle',
    description: 'Replace an existing duplex receptacle',
    items: [
      { id: 'asm-1-item-1', material_id: 'mat-1', quantity: 1 },
    ],
    labor_minutes: 15,
    folder_id: 'folder-assemblies-root',
    created_at: now(),
  },
];

/* ---------------- Estimates ---------------- */

export const seedEstimates: Estimate[] = [
  {
    id: 'est-1',
    company_id: SEED_COMPANY_ID,
    estimate_number: 1000,
    name: 'Sample Estimate',
    job_type_id: 'jt-1',
    items: [
      { id: 'est-1-item-1', assembly_id: 'asm-1', quantity: 1 },
      { id: 'est-1-item-2', material_id: 'mat-2', quantity: 2 },
    ],
    created_at: now(),
  },
];

/* ---------------- Admin: Job Types ---------------- */

export const seedJobTypes: JobType[] = [
  {
    id: 'jt-1',
    company_id: SEED_COMPANY_ID,
    name: 'Service Call',
    description: 'General service work',
    is_default: true,
    created_at: now(),
  },
  {
    id: 'jt-2',
    company_id: SEED_COMPANY_ID,
    name: 'Install',
    description: 'New installations',
    is_default: false,
    created_at: now(),
  },
];

/* ---------------- Admin: Rules ---------------- */

export const seedAdminRules: AdminRule[] = [
  {
    id: 'rule-1',
    company_id: SEED_COMPANY_ID,
    name: 'Minimum Labor Minutes',
    priority: 1,
    enabled: true,
    created_at: now(),
  },
];

/* ---------------- Admin: Settings ---------------- */

export const seedCompanySettings: CompanySettings = {
  id: 'company-settings-1',
  company_id: SEED_COMPANY_ID,
  starting_estimate_number: 1000,
  min_labor_minutes: 15,
  created_at: now(),
  updated_at: now(),
};

export const seedCsvSettings: CsvSettings = {
  id: 'csv-settings-1',
  company_id: SEED_COMPANY_ID,
  allow_material_import: true,
  allow_assembly_import: true,
  created_at: now(),
  updated_at: now(),
};

export const seedBrandingSettings: BrandingSettings = {
  id: 'branding-settings-1',
  company_id: SEED_COMPANY_ID,
  logo_url: null,
  primary_color: null,
  created_at: now(),
  updated_at: now(),
};
