import { apiFetch } from './api'
import type { LoanProduct } from './loansApi'

export interface AdminSettings {
  app_name: string
  app_env: string
  debug: boolean
  default_branch: string
  dojah_enabled: boolean
  dojah_mock: boolean
  sms_mock: boolean
  rate_limits_active: boolean
  otp_expire_seconds: number
  max_upload_size_mb: number
}

export interface BranchSummary {
  name: string
  customer_count: number
}

export interface GlobalAuditLog {
  id: string
  event_type: string
  actor_type: string
  actor_id: string | null
  actor_label: string | null
  message: string | null
  event_metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
  application_id: string
}

export const settingsApi = {
  get: (token: string) =>
    apiFetch<AdminSettings>('/api/v1/admin/settings', {}, token),

  listBranches: (token: string) =>
    apiFetch<BranchSummary[]>('/api/v1/admin/settings/branches', {}, token),

  listAuditLogs: (token: string, params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const query = qs.toString()
    return apiFetch<GlobalAuditLog[]>(
      `/api/v1/admin/settings/audit-logs${query ? `?${query}` : ''}`,
      {},
      token,
    )
  },

  listProducts: (token: string) =>
    apiFetch<LoanProduct[]>('/api/v1/admin/loans/products', {}, token),

  toggleProduct: (token: string, productCode: string, isActive: boolean) =>
    apiFetch<LoanProduct>(`/api/v1/admin/loans/products/${productCode}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }, token),
}

export function formatEventType(event: string): string {
  return event.replace(/_/g, ' ')
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
