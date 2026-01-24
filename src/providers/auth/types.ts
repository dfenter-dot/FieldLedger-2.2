export type Role = 'admin' | 'technician';

export type Permissions = Partial<Record<
  | 'admin.access'
  | 'discount.apply'
  | 'materials.edit_user'
  | 'materials.override_app'
  | 'assemblies.edit_user'
  | 'assemblies.override_app'
  | 'estimates.delete'
  | 'materials.delete'
  | 'assemblies.delete',
  boolean
>>;

export type AppUser = {
  id: string;
  email: string;
  companyId: string;
  role: Role;
  permissions: Permissions;
  isAppOwner: boolean;
};
