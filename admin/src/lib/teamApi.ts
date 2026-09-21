import { apiFetch } from './api'

export interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  is_system: boolean
}

export interface StaffMember {
  id: string
  full_name: string
  email: string
  phone: string
  status: 'active' | 'inactive' | string
  is_super_admin: boolean
  role: Role | null
  permissions: string[]
}

export interface PermissionGroup {
  label: string
  permissions: string[]
}

export interface StaffCreateInput {
  full_name: string
  email: string
  phone: string
  role_id?: string | null
}

export interface StaffUpdateInput {
  full_name?: string
  email?: string
  phone?: string
  role_id?: string | null
}

export interface RoleCreateInput {
  name: string
  description?: string
  permissions: string[]
}

export interface RoleUpdateInput {
  name?: string
  description?: string
  permissions?: string[]
}

export const teamApi = {
  listStaff: (token: string) =>
    apiFetch<StaffMember[]>('/api/v1/admin/staff', {}, token),

  getStaff: (token: string, id: string) =>
    apiFetch<StaffMember>(`/api/v1/admin/staff/${id}`, {}, token),

  createStaff: (token: string, data: StaffCreateInput) =>
    apiFetch<StaffMember>('/api/v1/admin/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  updateStaff: (token: string, id: string, data: StaffUpdateInput) =>
    apiFetch<StaffMember>(`/api/v1/admin/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, token),

  activateStaff: (token: string, id: string) =>
    apiFetch<StaffMember>(`/api/v1/admin/staff/${id}/activate`, { method: 'POST' }, token),

  deactivateStaff: (token: string, id: string) =>
    apiFetch<StaffMember>(`/api/v1/admin/staff/${id}/deactivate`, { method: 'POST' }, token),

  listRoles: (token: string) =>
    apiFetch<Role[]>('/api/v1/admin/roles', {}, token),

  createRole: (token: string, data: RoleCreateInput) =>
    apiFetch<Role>('/api/v1/admin/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  updateRole: (token: string, id: string, data: RoleUpdateInput) =>
    apiFetch<Role>(`/api/v1/admin/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, token),

  deleteRole: (token: string, id: string) =>
    apiFetch<void>(`/api/v1/admin/roles/${id}`, { method: 'DELETE' }, token),

  getPermissionCatalog: (token: string) =>
    apiFetch<{ groups: PermissionGroup[] }>('/api/v1/admin/permissions', {}, token),
}
