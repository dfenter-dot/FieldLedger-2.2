import type { BrandingSettings, Estimate, Folder, JobType, Material } from '../types';
import { uid } from './localStore';

export const SEED_JOB_TYPES: JobType[] = [
  {
    id: 'jt_service',
    name: 'Service',
    enabled: true,
    isDefault: true,
    mode: 'flat',
    grossMarginPct: 70,
    efficiencyPct: 50,
    allowDiscount: true,
  },
];

export const SEED_FOLDERS: Folder[] = [
  { id: 'f_app_root', companyId: 'mock-company', libraryType: 'app', parentId: null, name: 'Root', sortOrder: 0 },
  { id: 'f_user_root', companyId: 'mock-company', libraryType: 'user', parentId: null, name: 'Root', sortOrder: 0 },
  { id: 'f_app_devices', companyId: 'mock-company', libraryType: 'app', parentId: 'f_app_root', name: 'Devices', sortOrder: 1 },
  { id: 'f_app_devices_outlets', companyId: 'mock-company', libraryType: 'app', parentId: 'f_app_devices', name: 'Outlets', sortOrder: 1 },
];

export const SEED_MATERIALS: Material[] = [
  {
    id: 'm_tr_duplex',
    companyId: 'mock-company',
    libraryType: 'app',
    folderId: 'f_app_devices_outlets',
    name: 'TR Duplex Receptacle',
    sku: 'TR-15A',
    description: 'Tamper resistant duplex receptacle.',
    baseCost: 5,
    useCustomCost: false,
    customCost: null,
    taxable: true,
    jobTypeId: 'jt_service',
    laborMinutes: 30,
    imageUrl: null,
    sortOrder: 1,
  },
];

export const SEED_ESTIMATES: Estimate[] = [
  {
    id: uid('est'),
    companyId: 'mock-company',
    number: 1,
    name: 'Example Estimate',
    customerName: 'Sample Customer',
    customerPhone: '555-555-5555',
    customerEmail: 'customer@example.com',
    customerAddress: '123 Main St',
    privateNotes: 'Internal notes go here.',
    jobTypeId: 'jt_service',
    useAdminRules: false,
    customerSuppliesMaterials: false,
    discountId: null,
    applyProcessingFees: true,
    applyMiscMaterial: true,
    status: 'draft',
    createdAt: new Date().toISOString(),
    validUntil: null,
  },
];

export const SEED_BRANDING: BrandingSettings = {
  companyName: 'Your Company',
  licenseInfo: 'License #: ',
  warrantyInfo: 'Warranty: ',
  logoUrl: null,
};
