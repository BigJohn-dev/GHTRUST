import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Search, Users } from 'lucide-react'
import { AdminLayout } from '../components/AdminLayout'
import { PermissionGate } from '../components/PermissionGate'
import { useAuth } from '../lib/auth'
import { customersApi, type CustomerSummary } from '../lib/customersApi'
import { initials } from '../lib/productMeta'
import { ApiError } from '../lib/api'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending_otp', label: 'Pending OTP' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
] as const

export function CustomersPage() {
  return (
    <PermissionGate permission="loan:read">
      <CustomersPageContent />
    </PermissionGate>
  )
}

function CustomersPageContent() {
  const { token } = useAuth()
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const data = await customersApi.list(token, {
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      })
      setCustomers(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [token, debouncedSearch, statusFilter])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total: customers.length,
    withLoans: customers.filter((c) => c.application_count > 0).length,
    active: customers.filter((c) => c.status === 'active').length,
  }), [customers])

  return (
    <AdminLayout title="Customers" subtitle="Customer directory and loan history">
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Showing', value: stats.total, color: 'text-[#1b2f6b]' },
          { label: 'With loan apps', value: stats.withLoans, color: 'text-sky-600' },
          { label: 'Active', value: stats.active, color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="dash-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Users className={clsx('h-5 w-5', s.color)} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className={clsx('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Customer directory</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Search by name, account, phone, or BVN</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers…"
                className="pl-9 pr-3 py-2 w-56 text-[12px] rounded-lg ring-1 ring-slate-200 bg-white outline-none focus:ring-[#1b2f6b]/25"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[12px] rounded-lg ring-1 ring-slate-200 px-3 py-2 bg-white outline-none focus:ring-[#1b2f6b]/25"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-rose-50 text-rose-700 text-[13px] ring-1 ring-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center">
            <div className="inline-block h-9 w-9 rounded-full border-2 border-slate-200 border-t-[#1b2f6b] animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No customers found</p>
            <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Account</th>
                  <th className="px-6 py-3.5">Contact</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Loans</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60 group">
                    <td className="px-6 py-4">
                      <Link to={`/customers/${c.id}`} className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 group-hover:ring-2 group-hover:ring-[#1b2f6b]/20">
                          {initials(c.full_name)}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900 group-hover:text-[#1b2f6b]">{c.full_name}</p>
                          <p className="text-[11px] text-slate-400">{c.gender ?? '—'} · BVN {c.bvn_masked}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-mono font-semibold text-[#1b2f6b]">{c.account_number}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.branch}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] text-slate-700">{c.phone}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">{c.email ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-[12px] text-slate-600">
                      {c.state_of_residence ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-50 text-violet-700">
                        {c.application_count} app{c.application_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <CustomerStatusPill status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function CustomerStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    pending_otp: 'bg-amber-50 text-amber-700',
    suspended: 'bg-rose-50 text-rose-700',
    inactive: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={clsx('inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', styles[status] ?? 'bg-slate-100 text-slate-600')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
