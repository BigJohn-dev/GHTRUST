import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { adminAuthApi, tokenStore, type StaffProfile } from './api'

const STAFF_KEY = 'ghtrust_admin_staff'

interface AuthContextValue {
  staff: StaffProfile | null
  token: string | null
  loading: boolean
  login: (token: string, refreshToken: string, staff: StaffProfile) => void
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStore.access)
  const [staff, setStaff] = useState<StaffProfile | null>(() => {
    const raw = localStorage.getItem(STAFF_KEY)
    return raw ? (JSON.parse(raw) as StaffProfile) : null
  })
  const [loading, setLoading] = useState(!!token)

  // Follow token changes made outside React (background refresh, forced sign-out).
  useEffect(
    () =>
      tokenStore.subscribe((access) => {
        setToken(access)
        if (!access) {
          localStorage.removeItem(STAFF_KEY)
          setStaff(null)
        }
      }),
    [],
  )

  const logout = useCallback(() => {
    const current = tokenStore.access
    // Revoke the server session (best effort), then clear locally regardless.
    if (current) adminAuthApi.logout(current).catch(() => undefined)
    tokenStore.clear()
  }, [])

  const login = useCallback((newToken: string, refreshToken: string, profile: StaffProfile) => {
    localStorage.setItem(STAFF_KEY, JSON.stringify(profile))
    setStaff(profile)
    tokenStore.set(newToken, refreshToken)
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
