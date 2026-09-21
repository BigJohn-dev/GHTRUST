import { apiFetch } from './api'
import type { ApplicationSummary } from './loansApi'

export interface DashboardStatusCount {
  status: string
  count: number
}

export interface DashboardDailySubmission {
  date: string
  count: number
}

export interface DashboardProductMix {
  product_code: string
  product_name: string
  count: number
  percentage: number
}

export interface DemographicBucket {
  label: string
  count: number
  percentage: number
}

export interface DashboardDemographics {
  total_applicants: number
  gender: DemographicBucket[]
  age_buckets: DemographicBucket[]
  state_of_residence: DemographicBucket[]
  state_of_origin: DemographicBucket[]
}

export interface DashboardData {
  total_applications: number
  status_counts: DashboardStatusCount[]
  pending_review_count: number
  total_disbursed_amount: number
  loan_book_amount: number
  recent_applications: ApplicationSummary[]
  pending_queue: ApplicationSummary[]
  daily_submissions: DashboardDailySubmission[]
  product_mix: DashboardProductMix[]
  demographics: DashboardDemographics
}

export const dashboardApi = {
  get: (token: string) =>
    apiFetch<DashboardData>('/api/v1/admin/dashboard', {}, token),

  exportDemographics: async (token: string): Promise<Blob> => {
    const res = await fetch('/api/v1/admin/dashboard/demographics/export', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Export failed')
    return res.blob()
  },
}

export function formatNaira(amount: number | string | null | undefined): string {
  if (amount == null) return '—'
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}
