import { apiFetch } from './api'
import type { ApplicationSummary } from './loansApi'

export interface CustomerSummary {
  id: string
  account_number: string
  full_name: string
  bvn_masked: string
  phone: string
  email: string | null
  gender: string | null
  state_of_residence: string | null
  branch: string
  status: string
  application_count: number
  created_at: string
}

export interface CustomerStats {
  total_applications: number
  active_applications: number
  disbursed_count: number
  total_disbursed_amount: number
}

export interface CustomerDetail {
  id: string
  account_number: string
  bvn_masked: string
  first_name: string
  last_name: string
  middle_name: string | null
  full_name: string
  gender: string | null
  date_of_birth: string | null
  title: string | null
  phone: string
  phone_secondary: string | null
  email: string | null
  residential_address: string | null
  state_of_residence: string | null
  lga_of_residence: string | null
  state_of_origin: string | null
  lga_of_origin: string | null
  nationality: string | null
  marital_status: string | null
  enrollment_bank: string | null
  enrollment_branch: string | null
  level_of_account: string | null
  name_on_card: string | null
  branch: string
  status: string
  phone_verified: boolean
  last_login_at: string | null
  created_at: string
  stats: CustomerStats
  loan_applications: ApplicationSummary[]
}

export const customersApi = {
  list: (token: string, params?: { search?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.status) qs.set('status', params.status)
    const query = qs.toString()
    return apiFetch<CustomerSummary[]>(
      `/api/v1/admin/customers${query ? `?${query}` : ''}`,
      {},
      token,
    )
  },

  get: (token: string, id: string) =>
    apiFetch<CustomerDetail>(`/api/v1/admin/customers/${id}`, {}, token),
}

export function formatCustomerAge(dob: string | null | undefined): string {
  if (!dob) return '—'
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1
  return `${age} yrs`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
