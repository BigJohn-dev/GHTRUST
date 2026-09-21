import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { adminAuthApi, type StaffProfile } from './api'

const TOKEN_KEY = 'ghtrust_admin_token'
const STAFF_KEY = 'ghtrust_admin_staff'

interface AuthContextValue {
  staff: StaffProfile | null
  token: string | null
  loading: boolean
  login: (token: string, staff: StaffProfile) => void
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [staff, setStaff] = useState<StaffProfile | null>(() => {
    const raw = localStorage.getItem(STAFF_KEY)
    return raw ? (JSON.parse(raw) as StaffProfile) : null
  })
  const [loading, setLoading] = useState(!!token)

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(STAFF_KEY)
    setToken(null)
    setStaff(null)
  }, [])

  const login = useCallback((newToken: string, profile: StaffProfile) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(STAFF_KEY, JSON.stringify(profile))
    setToken(newToken)
    setStaff(profile)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!token) return
    try {
      const profile = await adminAuthApi.me(token)
      localStorage.setItem(STAFF_KEY, JSON.stringify(profile))
      setStaff(profile)
    } catch {
      logout()
    }
  }, [token, logout])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    refreshProfile().finally(() => setLoading(false))
  }, [token, refreshProfile])

  const value = useMemo(
    () => ({ staff, token, loading, login, logout, refreshProfile }),
    [staff, token, loading, login, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
