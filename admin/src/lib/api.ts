const API_BASE = import.meta.env.VITE_API_URL ?? ''

export { API_BASE }

export class ApiError extends Error {
  status: number
  detail?: unknown

  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail)) return data.detail.map((d: { msg?: string }) => d.msg).join(', ')
    return JSON.stringify(data.detail ?? data)
  } catch {
    return res.statusText
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface OtpSentResponse {
  message: string
  phone_masked: string
  expires_in: number
  purpose: string
}

export interface StaffProfile {
  id: string
  full_name: string
  email: string
  phone: string
  status: string
  is_super_admin: boolean
  permissions: string[]
  role: {
    id: string
    name: string
    description?: string | null
    permissions?: string[]
    is_system?: boolean
  } | null
}

export interface StaffAuthResponse {
  access_token: string
  token_type: string
  staff: StaffProfile
}

export const adminAuthApi = {
  requestOtp: (phone: string) =>
    apiFetch<OtpSentResponse>('/api/v1/admin/auth/login/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (phone: string, otp: string) =>
    apiFetch<StaffAuthResponse>('/api/v1/admin/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),

  resendOtp: (phone: string) =>
    apiFetch<OtpSentResponse>('/api/v1/admin/auth/login/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  me: (token: string) =>
    apiFetch<StaffProfile>('/api/v1/admin/auth/me', {}, token),
}
