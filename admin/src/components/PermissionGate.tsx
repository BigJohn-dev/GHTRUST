import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hasAnyPermission, hasPermission } from '../lib/permissions'

interface PermissionGateProps {
  permission?: string
  anyOf?: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({
  permission,
  anyOf,
  children,
  fallback,
}: PermissionGateProps) {
  const { staff, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-9 w-9 rounded-full border-2 border-slate-200 border-t-[#1b2f6b] animate-spin" />
      </div>
    )
  }

  const allowed = permission
    ? hasPermission(staff, permission)
    : anyOf
      ? hasAnyPermission(staff, anyOf)
      : true

  if (!allowed) {
    if (fallback) return <>{fallback}</>
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
