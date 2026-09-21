import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { AdminLayout } from '../components/AdminLayout'
import { PermissionGate } from '../components/PermissionGate'
import { RoleFormDialog } from '../components/team/RoleFormDialog'
import { StaffFormDialog } from '../components/team/StaffFormDialog'
import { useAuth } from '../lib/auth'
import { hasPermission } from '../lib/permissions'
import {
  teamApi,
  type PermissionGroup,
  type Role,
  type RoleCreateInput,
  type RoleUpdateInput,
  type StaffCreateInput,
  type StaffMember,
  type StaffUpdateInput,
} from '../lib/teamApi'
import { ApiError } from '../lib/api'

type Tab = 'staff' | 'roles'

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function TeamPage() {
  return (
    <PermissionGate anyOf={['staff:read', 'role:read']}>
      <TeamPageContent />
    </PermissionGate>
  )
}

function TeamPageContent() {
  const { token, staff: currentStaff } = useAuth()
  const [tab, setTab] = useState<Tab>('staff')
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [staffDialog, setStaffDialog] = useState<StaffMember | null | 'new'>(null)
  const [roleDialog, setRoleDialog] = useState<Role | null | 'new'>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const canReadStaff = hasPermission(currentStaff, 'staff:read')
  const canCreateStaff = hasPermission(currentStaff, 'staff:create')
  const canUpdateStaff = hasPermission(currentStaff, 'staff:update')
  const canActivate = hasPermission(currentStaff, 'staff:activate')
  const canReadRoles = hasPermission(currentStaff, 'role:read')
  const canCreateRole = hasPermission(currentStaff, 'role:create')
  const canUpdateRole = hasPermission(currentStaff, 'role:update')
  const canDeleteRole = hasPermission(currentStaff, 'role:delete')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [staffData, rolesData, permData] = await Promise.all([
        canReadStaff ? teamApi.listStaff(token) : Promise.resolve([]),
        canReadRoles ? teamApi.listRoles(token) : Promise.resolve([]),
        canReadRoles ? teamApi.getPermissionCatalog(token).then((r) => r.groups) : Promise.resolve([]),
      ])
      setStaffList(staffData)
      setRoles(rolesData)
      setPermissionGroups(permData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load team data')
    } finally {
      setLoading(false)
    }
  }, [token, canReadStaff, canReadRoles])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!message && !error) return
    const t = setTimeout(() => { setMessage(''); setError('') }, 5000)
    return () => clearTimeout(t)
  }, [message, error])

  const stats = useMemo(() => ({
    total: staffList.length,
    active: staffList.filter((s) => s.status === 'active').length,
    inactive: staffList.filter((s) => s.status === 'inactive').length,
    roles: roles.length,
  }), [staffList, roles])

  const superAdminCount = useMemo(
    () => staffList.filter((s) => s.is_super_admin).length,
    [staffList],
  )

  const staffByRole = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of staffList) {
      if (s.role?.id) map[s.role.id] = (map[s.role.id] ?? 0) + 1
    }
    return map
  }, [staffList])

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return staffList.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!q) return true
      return (
        s.full_name.toLowerCase().includes(q)
        || s.email.toLowerCase().includes(q)
        || s.phone.includes(q)
        || s.role?.name.toLowerCase().includes(q)
      )
    })
  }, [staffList, searchQuery, statusFilter])

  const handleStaffSubmit = async (data: StaffCreateInput | StaffUpdateInput) => {
    if (!token) return
    if (staffDialog === 'new') {
      await teamApi.createStaff(token, data as StaffCreateInput)
      setMessage('Team member created. Assign a role and activate to grant login access.')
    } else if (staffDialog) {
      await teamApi.updateStaff(token, staffDialog.id, data as StaffUpdateInput)
      setMessage('Team member updated.')
    }
    await load()
  }

  const handleRoleSubmit = async (data: RoleCreateInput | RoleUpdateInput) => {
    if (!token) return
    if (roleDialog === 'new') {
      await teamApi.createRole(token, data as RoleCreateInput)
      setMessage('Role created.')
    } else if (roleDialog) {
      await teamApi.updateRole(token, roleDialog.id, data as RoleUpdateInput)
      setMessage('Role updated.')
    }
    await load()
  }

  const toggleStaffStatus = async (member: StaffMember) => {
    if (!token) return
    setMenuOpen(null)
    try {
      if (member.status === 'active') {
        await teamApi.deactivateStaff(token, member.id)
        setMessage(`${member.full_name} deactivated.`)
      } else {
        await teamApi.activateStaff(token, member.id)
        setMessage(`${member.full_name} activated.`)
      }
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed')
    }
  }

  const deleteRole = async (role: Role) => {
    if (!token || role.is_system) return
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return
    try {
      await teamApi.deleteRole(token, role.id)
      setMessage(`Role "${role.name}" deleted.`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed')
    }
  }

  return (
    <AdminLayout title="Team management" subtitle="Staff directory, roles, and access control">
      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Team members', value: stats.total, icon: Users, color: 'text-[#1b2f6b]' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'text-emerald-600' },
          { label: 'Inactive', value: stats.inactive, icon: UserMinus, color: 'text-amber-600' },
          { label: 'Roles', value: stats.roles, icon: Shield, color: 'text-sky-600' },
        ].map((s) => (
          <div key={s.label} className="dash-card p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <s.icon className={clsx('h-5 w-5', s.color)} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {(message || error) && (
        <div
          className={clsx(
            'mb-4 px-4 py-3 rounded-xl text-[13px] font-medium',
            error ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
          )}
        >
          {error || message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
          {canReadStaff && (
            <button
              type="button"
              onClick={() => setTab('staff')}
              className={clsx(
                'px-4 py-2 rounded-lg text-[13px] font-semibold transition-all',
                tab === 'staff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Team members
            </button>
          )}
          {canReadRoles && (
            <button
              type="button"
              onClick={() => setTab('roles')}
              className={clsx(
                'px-4 py-2 rounded-lg text-[13px] font-semibold transition-all',
                tab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Roles & access
            </button>
          )}
        </div>

        {tab === 'staff' && canCreateStaff && (
          <button
            type="button"
            onClick={() => setStaffDialog('new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1b2f6b] text-white text-[13px] font-semibold hover:bg-[#141f45] shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add member
          </button>
        )}
        {tab === 'roles' && canCreateRole && (
          <button
            type="button"
            onClick={() => setRoleDialog('new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1b2f6b] text-white text-[13px] font-semibold hover:bg-[#141f45] shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create role
          </button>
        )}
      </div>

      {loading ? (
        <div className="dash-card p-16 text-center">
          <div className="inline-block h-9 w-9 rounded-full border-2 border-slate-200 border-t-[#1b2f6b] animate-spin" />
        </div>
      ) : tab === 'staff' && canReadStaff ? (
        <div className="dash-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Staff directory</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filteredStaff.length} of {staffList.length} members
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, role…"
                  className="pl-9 pr-3 py-2 w-56 text-[12px] rounded-lg ring-1 ring-slate-200 bg-white outline-none focus:ring-[#1b2f6b]/25"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="text-[12px] rounded-lg ring-1 ring-slate-200 px-3 py-2 bg-white outline-none focus:ring-[#1b2f6b]/25"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          {filteredStaff.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No team members found</p>
              <p className="text-[12px] text-slate-400 mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Add your first team member to get started'}
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Contact</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => {
                  const isSelf = member.id === currentStaff?.id
                  return (
                    <tr key={member.id} className="border-t border-slate-100 hover:bg-slate-50/60 group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600">
                            {initials(member.full_name)}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-slate-900">{member.full_name}</p>
                            {member.is_super_admin && (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Super admin
                              </span>
                            )}
                            {isSelf && (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded ml-1">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[12px] text-slate-700">{member.email}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{member.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        {member.role ? (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 ring-1 ring-sky-200/80">
                            {member.role.name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No role</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase',
                            member.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          <span
                            className={clsx(
                              'h-1.5 w-1.5 rounded-full',
                              member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400',
                            )}
                          />
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 relative">
                        {(canUpdateStaff || canActivate) && !member.is_super_admin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpen === member.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                                <div className="absolute right-6 top-full z-20 w-44 py-1 rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
                                  {canUpdateStaff && (
                                    <button
                                      type="button"
                                      onClick={() => { setStaffDialog(member); setMenuOpen(null) }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50"
                                    >
                                      <Pencil className="h-3.5 w-3.5" /> Edit
                                    </button>
                                  )}
                                  {canActivate && !isSelf && (
                                    <button
                                      type="button"
                                      onClick={() => toggleStaffStatus(member)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50"
                                    >
                                      {member.status === 'active' ? (
                                        <><UserMinus className="h-3.5 w-3.5" /> Deactivate</>
                                      ) : (
                                        <><UserCheck className="h-3.5 w-3.5" /> Activate</>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : tab === 'roles' && canReadRoles ? (
        <>
        <div className="mb-4 px-4 py-3 rounded-xl bg-sky-50 text-sky-900 ring-1 ring-sky-200/80 text-[12px] leading-relaxed">
          <strong className="font-semibold">Default lending roles</strong> (Loan Officer, Credit Analyst, etc.) are editable templates — adjust permissions as your team needs.
          Only <strong className="font-semibold">Super Admin</strong> is locked. Your account uses the super admin flag for full access and is not counted as assigned to that role.
        </div>
        {roles.length === 0 ? (
          <div className="dash-card px-6 py-16 text-center">
            <Shield className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No roles defined</p>
            <p className="text-[12px] text-slate-400 mt-1">Create a role to assign permissions to staff</p>
          </div>
        ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => {
            const assignedCount = staffByRole[role.id] ?? 0
            const isSuperAdminRole = role.name === 'Super Admin'
            const staffLabel = isSuperAdminRole && superAdminCount > 0
              ? `${superAdminCount} super admin${superAdminCount > 1 ? 's' : ''}`
              : `${assignedCount} staff`

            return (
            <div
              key={role.id}
              className="dash-card p-5 flex flex-col hover:ring-1 hover:ring-[#1b2f6b]/15 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">{role.name}</h4>
                  {role.description && (
                    <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{role.description}</p>
                  )}
                </div>
                {role.is_system && (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                    System
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-violet-50 text-violet-700">
                  {role.permissions.length} permissions
                </span>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                  {staffLabel}
                </span>
              </div>

              <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
                {(canUpdateRole || role.is_system) && (
                  <button
                    type="button"
                    onClick={() => setRoleDialog(role)}
                    className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-[#1b2f6b] ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    {role.is_system ? 'View' : 'Edit'}
                  </button>
                )}
                {canDeleteRole && !role.is_system && (
                  <button
                    type="button"
                    onClick={() => deleteRole(role)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            )
          })}
        </div>
        )}
        </>
      ) : null}

      <StaffFormDialog
        open={staffDialog !== null}
        onClose={() => setStaffDialog(null)}
        roles={roles}
        initial={staffDialog === 'new' ? null : staffDialog}
        onSubmit={handleStaffSubmit}
      />

      <RoleFormDialog
        open={roleDialog !== null}
        onClose={() => setRoleDialog(null)}
        permissionGroups={permissionGroups}
        initial={roleDialog === 'new' ? null : roleDialog}
        onSubmit={handleRoleSubmit}
      />
    </AdminLayout>
  )
}
